# P2-MCP-24 — S3-Compatible Object Storage Adapter

- **Canonical ID**: `P2-MCP-24` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-038`

## Context

Đã đọc trước khi sửa: `docs/mini-specs/phase-2/P2-MCP-23.md` · `docs/PHASE_2_READINESS_ASSESSMENT.md` ·
`docs/FEATURES.md` · `docs/ARCH.md` · `docs/API.md` · `docs/DATA_MODEL.md` · `docs/DECISIONS.md` ·
`packages/contracts/src/storage.ts` · `apps/api/src/storage/local-fs-adapter.ts` ·
`apps/api/src/storage/object-key.ts` · `apps/api/src/app-context.ts` · `apps/api/src/server.ts`.

Commit nền: `6451612` (P2-MCP-23).

**Vấn đề.** `/healthz` khai `storage: { id: 'local-fs-phase1', production: false }`. Tệp gốc của người
dùng nằm trên **đĩa của đúng một máy**. Mất máy là mất tệp; không nhân bản, không sao lưu, không chạy
được nhiều tiến trình API.

Owner decision Q-01 đã chốt từ Phase 0: object storage là **trừu tượng S3-compatible**, đích
production đầu tiên là Cloudflare R2. Cổng `ObjectStorageAdapter` có sẵn từ `P0-MCP-10`; thứ thiếu là
một hiện thực thật.

## Constraints (Guardrails)

- **Không** đổi hành vi mặc định: thiếu cấu hình S3 thì vẫn ghi ra đĩa local như cũ.
- **Không** đổi API: giữ 31 route, không thêm route `DELETE`, không đổi request/response.
- **Không** phá bất biến **I-1**: tệp gốc (`source`) không bao giờ bị ghi đè — phải đúng trên **cả
  hai** adapter.
- **Không** commit khoá truy cập hay chuỗi kết nối.
- **Không** tự tạo hạ tầng trên đích production mà không được cho phép rõ ràng.
- Giữ 12 invariant Phase 0 và toàn bộ hồi quy Phase 1 / 1.1 / P2-MCP-23.

## Scope

**Trong phạm vi**: adapter S3-compatible (R2 / MinIO / S3) · tách phần ký ticket dùng chung · bổ sung
`getObject` + `contentTypeOf` vào hợp đồng · bộ test hợp đồng chạy trên **cả hai** adapter · ráp qua
biến môi trường · kiểm bucket lúc khởi động · tài liệu.

**Ngoài phạm vi**: presigned URL tải thẳng từ trình duyệt lên S3 (đổi kiến trúc biên, kéo theo CORS
và làm mất điểm kiểm giới hạn kích thước) · resumable upload · CDN · vòng đời object trên S3 · xoá dữ
liệu theo luật lưu giữ (owner đã chốt: **giữ nguyên bản thử, không tạo đường xoá**).

## Audit Before Build

| Mục | Phát hiện |
|---|---|
| Hợp đồng `ObjectStorageAdapter` | 6 phương thức: `createUploadUrl` · `createDownloadUrl` · `head` · `putObject` · `deleteObject` + `id`/`isProductionAdapter` |
| Biên upload hiện tại | **byte đi qua API** bằng ticket HMAC, **không** phải tải thẳng lên S3 |
| Probe đọc byte từ đâu | từ **bộ nhớ** (`bufferSource(body)`), **không** đụng storage ⇒ không phải sửa |
| Chỗ bám vào đĩa | đúng **một**: route download gọi `objectPath()` rồi `readFile(path)` |
| `deleteObject` được gọi ở đâu | **không chỗ nào** — chỉ nhắc trong chú thích của `retention.ts` |
| Ký ticket | nằm **bên trong** `LocalFsStorageAdapter` ⇒ adapter thứ hai sẽ phải chép đôi hoặc kế thừa |
| Bất biến I-1 ở tầng lưu trữ | `assertWritableKey(key, exists)` trong contracts — dùng lại được nguyên vẹn |
| MinIO / PostgreSQL trong workspace | **không có sẵn**; dựng bằng Docker để kiểm thật |

## Design Choice

**1. Giữ biên ticket, chỉ đổi chỗ byte nằm.**

| Phương án | Kết quả |
|---|---|
| Trả presigned URL của S3 cho trình duyệt tải thẳng | **Loại ở lượt này.** Đúng hướng production, nhưng đổi biên: phải cấu hình CORS trên R2, và **mất điểm kiểm** giới hạn kích thước + bất biến I-1 vốn đang nằm gọn ở một chỗ. Là một MINI-SPEC riêng |
| **Giữ ticket HMAC, byte ghi xuống S3** | **Chọn.** Biên vẫn một chỗ, client không phải sửa gì, I-1 vẫn được ép ở đúng một nơi |

**2. `objectPath` không thể nằm trong hợp đồng chung.**

Route download đọc bằng **đường dẫn tệp** — khái niệm chỉ tồn tại với đĩa local. Hợp đồng chung phải
là **byte**. Vì vậy thêm `getObject(ref): Promise<Uint8Array>` và `contentTypeOf` vào
`ObjectStorageAdapter`; `objectPath` ở lại riêng adapter local.

**3. Tách phần ký ticket ra `upload-ticket.ts`.**

Để nguyên trong adapter local thì adapter mới chỉ còn hai lối: chép đôi logic ký (rồi hai bản trôi
khác nhau), hoặc kế thừa adapter local (vô nghĩa). Tách ra là lối thứ ba.

**4. Không tự tạo bucket ở đường khởi động mặc định.**

Thiếu bucket ⇒ **từ chối khởi động** kèm thông báo chỉ rõ cách sửa. Chỉ tạo khi có
`MEDIACLEAR_S3_CREATE_BUCKET=1`. Lý do: gõ nhầm tên bucket trong cấu hình mà hệ thống tự tạo thì lỗi
sẽ thành "chạy được" — và người vận hành phát hiện ra khi đã muộn.

**5. Cấu hình thiếu một nửa thì coi như không cấu hình.**

`readS3Config` đòi **đủ bốn** mảnh (endpoint, khoá, bí mật, bucket) mới trả về cấu hình. Một cấu hình
thiếu một nửa còn nguy hiểm hơn không cấu hình: nó chạy được một lúc rồi hỏng giữa chừng.

## Test Plan

Bộ hợp đồng **13 ca**, viết một lần, chạy trên **cả hai** adapter:

| Test | Chặn điều gì |
|---|---|
| object chưa ghi ⇒ `head` báo không tồn tại, không bịa số | adapter đoán số |
| ghi rồi đọc lại đúng từng byte | hỏng đường truyền dữ liệu |
| `head` trả đúng kích thước và **checksum thật** | báo checksum không có thật |
| giữ nguyên content type đã ghi | mất thông tin khi qua tầng lưu |
| **I-1: ghi đè `source` bị từ chối**, và bản gốc còn nguyên vẹn | vỡ bất biến tệp gốc bất biến |
| `output` thì được ghi đè | siết nhầm, chặn cả thứ được phép |
| đọc object không tồn tại ⇒ báo không tìm thấy, không trả byte rỗng | lỗi im lặng |
| xoá rồi ⇒ `head` báo không tồn tại | xoá không thật |
| khoá có `..` bị từ chối | thoát thư mục |
| URL upload/download có hạn đúng và trỏ về biên API | rò đường đi vòng |
| ticket không dùng chéo mục đích được | ticket upload dùng để tải xuống |
| ticket hết hạn bị từ chối | ticket sống mãi |

Thêm: hai nhánh khởi động (thiếu bucket ⇒ từ chối; có cờ ⇒ tạo).

## Live Verification

> Tải tệp qua **giao diện thật** → byte nằm trong **MinIO thật** → tải xuống qua API → **byte y hệt**.

Kiểm bằng cách đọc **thẳng từ MinIO** (không qua API) và so sha256 với tệp gốc tính trước khi tải lên.

## Success Criteria

- 13/13 ca hợp đồng xanh trên **cả hai** adapter.
- `/healthz` khai `storage: { id: 's3-compatible-phase2', production: true }` khi chạy với S3.
- Byte trong MinIO khớp sha256 với tệp gốc; tải xuống qua API cũng khớp.
- Thiếu bucket thì **từ chối khởi động**.
- Bốn lệnh kiểm chạy **riêng**, đều thoát 0. Không đổi số route.

## Remaining Limits / Follow-ups

- **Chưa kiểm trên Cloudflare R2 thật** — mới kiểm trên MinIO. R2 có khác biệt về `region` và
  virtual-host style; cần một lượt kiểm riêng khi có khoá R2.
- Byte vẫn **đi qua API**; chưa tải thẳng từ trình duyệt lên S3.
- Chưa có CDN, chưa có vòng đời object, chưa đo hiệu năng dưới tải.
- `deleteObject` có trên adapter nhưng **không đường nào gọi** — đúng theo quyết định giữ dry-run.
