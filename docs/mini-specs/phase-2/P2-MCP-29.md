# P2-MCP-29 — Output Retrieval

- **Canonical ID**: `P2-MCP-29` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-043`

## Context

Đã đọc: `P2-MCP-27` (xử lý ảnh tất định) · `P2-MCP-28` (worker) · `docs/DECISIONS.md` (D-041, D-042) ·
`apps/api/src/services/assets.ts` · `db/migrations/0005_phase2_output_assets.sql`. Commit nền: `33cb7e8`.

**Vấn đề.** `P2-MCP-27` làm job chạy tới `completed` và ghi bản kết quả vào kho. `P2-MCP-28` làm nó tự
chạy. Nhưng **không đường nào dẫn tới tệp đó**:

1. Bảng route **không có** route nào cho bản kết quả.
2. `/v1/assets/:assetId/download-url` **luôn** trả tệp **nguồn** — nó tra `asset.sourceFileId` rồi ký
   URL cho `record.storageKey`. Id `out_…` không nằm trong bảng `assets` nên chỉ nhận 404.
3. Giao diện đọc `outputAssetId` vào kiểu dữ liệu nhưng **không hiển thị ở đâu**, và không có nút tải.
4. Mọi job không bị chặn đều hiện câu *"Phần xử lý AI chưa được bật trong không gian làm việc này."* —
   kể cả job đã `completed` với tệp thật. Câu đó đọc theo nghĩa đen **vẫn đúng** (không có AI, chỉ có
   xử lý tất định), nhưng đặt cạnh một job đã xong thì nó dẫn người dùng hiểu sai là chưa có gì xảy ra.

Tôi chỉ chứng minh được tệp tồn tại bằng cách **đọc thẳng MinIO**. Người dùng thật không làm được thế.
**Lấy được tệp đã làm sạch chính là sản phẩm.**

## Constraints (Guardrails)

- **Bất biến I-1**: bản kết quả là bản **mới**; tệp gốc không bao giờ bị thay thế. Hai đường tải phải
  **tách bạch**, không bao giờ nhập một.
- **Bất biến I-2**: `validated` chỉ `true` sau khi hệ thống đọc lại byte và đo lại. **Chưa `validated`
  thì không phát URL.**
- Ranh giới workspace: trả **cùng một mã lỗi** cho "không tồn tại" và "của người khác".
- Không khai bừa: nếu kho mất tệp mà cơ sở dữ liệu không biết, phải nói thật thay vì phát một URL hỏng.

## Design Choice

**1. Hai route tách rời, không gộp.**

| Route | Trả gì |
|---|---|
| `GET /v1/jobs/:jobId/output` | thông tin bản kết quả (id, kích thước, mã kiểm tra, `validated`) |
| `GET /v1/jobs/:jobId/output/download-url` | URL đã ký, có hạn ngắn |

Gộp một sẽ khiến **mỗi lần xem trang lại đúc ra một URL tải mới**. Vừa thừa, vừa làm dấu vết "đã phát
quyền tải" mất nghĩa — không còn phân biệt được ai thật sự định tải tệp về.

**2. Đặt dưới `jobs/` chứ không tạo tài nguyên `outputs/` ở cấp trên.**

`output_assets` có ràng buộc `UNIQUE (job_id)`: mỗi job đúng một bản kết quả. Quan hệ 1–1 nên `jobId`
đủ để định danh, và giao diện **đã có sẵn** `jobId`. Thêm một tài nguyên cấp trên là thêm một không
gian id nữa phải kiểm quyền riêng mà không đổi lại được gì.

**3. `validated` là cổng cuối cùng, không phải thứ suy ra.**

Về lý thuyết job không thể `completed` nếu chưa `validated` — ràng buộc lược đồ chặn. Nhưng cổng này
**không dựa vào giả định đó**: nó đọc `validated` thật trong cơ sở dữ liệu và từ chối nếu `false`. Đây
là chỗ **cuối cùng** trước khi tệp tới tay người dùng; đưa ra một tệp chưa kiểm chứng chính là "nói đã
xong về thứ chưa đo".

**4. Hỏi kho trước khi hứa.** `head()` trước khi ký URL — cơ sở dữ liệu có thể còn dòng trong khi kho
đã mất tệp (Vibe Host không có S3, object storage là đĩa container nên **mất mỗi lần redeploy** — D-040).

**5. Trả lại mã kiểm tra cho người tải.** Response tải về lặp lại `checksumSha256` và `byteSize` để
người dùng **tự đối chiếu** tệp mình nhận được, thay vì phải tin lời hệ thống.

**6. Ghi dấu vết ở lúc PHÁT URL, không phải lúc tải xong.** Kho lưu trữ phục vụ byte trực tiếp, API
không nhìn thấy lượt tải đó. Nói "đã phát quyền tải" là điều hệ thống **biết chắc**; nói "đã tải về"
thì không. Sự kiện mới: `output_download_url_issued`, `subjectType: 'output'`.

**7. Giao diện: job `completed` hiện thẻ kết quả thay cho thẻ "đã tiếp nhận".** Câu chữ owner đã duyệt
**không bị sửa** — nó chỉ thôi xuất hiện ở trạng thái mà nó gây hiểu nhầm. URL tải được đúc khi người
dùng **bấm**, không phải khi mở trang: URL có hạn ngắn nên đúc sẵn lúc mở trang thì đến lúc bấm có thể
đã hết hạn.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| job xong thì đọc được thông tin bản kết quả | không có đường nào tới kết quả |
| **byte tải về khớp checksum hệ thống khai** | URL trỏ sai tệp mà test vẫn xanh |
| **đối chứng âm**: `download-url` của asset vẫn trả tệp **nguồn** | hai đường tải bị nhập một (vỡ I-1) |
| job chưa xong → 404 | trả tệp nửa vời |
| `validated = false` → từ chối | vỡ bất biến I-2 |
| workspace khác → 404, **cùng mã lỗi** với job không có thật | lộ sự tồn tại |
| không có phiên → 401 | tệp của người dùng ra ngoài |
| phát URL có ghi dấu vết, trỏ đúng bản kết quả | không truy được ai lấy tệp |

Phép thu quan trọng nhất là **so byte tải về với checksum**. Nếu chỉ kiểm "có trả về một URL" thì một
URL trỏ sai tệp vẫn làm test xanh — và đó đúng là loại lỗi khiến người dùng nhận về tệp của người khác.

## Success Criteria

- Người dùng tải được tệp đã xử lý **qua API**, không cần đọc kho.
- Byte nhận về khớp checksum và kích thước hệ thống khai.
- Tệp nguồn và bản kết quả vẫn là **hai đường tải khác nhau**.
- Job đã xong không còn hiện câu dẫn tới hiểu nhầm là chưa có gì xảy ra.

## Remaining Limits / Follow-ups

- **Câu chữ mới chưa được owner duyệt.** 8 khoá i18n mới (`screen.job_status.result_*`,
  `…download_*`) là **tôi viết**, theo đúng ràng buộc không rò thuật ngữ kỹ thuật. Cần BA/owner rà
  lại, giống cách Q-20/Q-22 đã làm.
- **Không có `lastAccessedAt` cho bản kết quả.** `output_assets` không có cột đó, nên luật lưu giữ
  lớp `output_asset` **chưa tính được** theo lần đọc gần nhất như tệp nguồn đang làm.
- Chưa có tải hàng loạt, chưa có tải lại theo phiên bản, chưa đặt tên tệp khi tải về.
- Chưa có route xoá bản kết quả theo yêu cầu người dùng.
- Dấu vết ghi lúc **phát URL**, nên một URL đã phát mà không ai dùng vẫn được đếm.
