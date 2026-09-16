# FEATURES — MediaClear Pro

- **Date**: 2026-09-16 · **Phase**: 3 (tới `P3-MCP-34`)

Bảng dưới là **trạng thái thật trong repository này**, không phải kế hoạch bán hàng.
`implemented` = có code chạy được, có test, và đã được gọi thật ít nhất một lần.

## 1. Đang chạy thật (`implemented`)

| Capability | Nơi ở | Bằng chứng |
|---|---|---|
| Đăng nhập tạm + phiên làm việc (dev) | `apps/api/src/auth/identity.ts` | 401 khi thiếu/hỏng phiên; đã đăng nhập thật qua trình duyệt |
| Workspace: tạo, chọn, danh sách, thành viên, vai trò | `services/workspaces.ts` | 11 test tenancy + click-through |
| Ranh giới workspace (không lộ existence) | `tenancy.ts` + `services/access.ts` | 404 cho cả "của người khác" lẫn "không tồn tại" |
| Ma trận quyền 4 role có hiệu lực ở HTTP | `tenancy.ts` | viewer bị chặn tạo job/project; member bị chặn quản trị |
| Project: tạo, danh sách (có cursor), chi tiết | `services/projects.ts` | test HTTP thật |
| Upload asset: intent → PUT byte thật → lưu đĩa | `services/assets.ts`, `storage/local-fs-adapter.ts` | SHA-256 khớp file gốc, tải về khớp lại |
| Khoá object an toàn, chống traversal, chống ghi đè source | `storage/object-key.ts` | 4 test đơn vị + test I-1 |
| Đo media thật từ byte (PNG/JPEG/WebP, MP4/MOV/WebM) | `media/header-probe.ts` | 12 test trên file thật, đối chứng `ffprobe` |
| Kiểm tra media theo config tập trung | `media-limits.ts` + `services/assets.ts` | biên 199 MB / 599 s / 3840 px kiểm trên **file thật** |
| Phát hiện khai sai định dạng | `services/assets.ts` | `MCP_VAL_MIME_MISMATCH` khi byte ≠ MIME khai báo |
| Xác nhận quyền cấp asset, hiệu lực 365 ngày | `services/attestations.ts` | test biên 365/366, test "asset A không cứu asset B" |
| Ranh giới tạo job 5 cổng | `services/jobs.ts` | 13 test job/usage + click-through |
| `blocked` là trạng thái cuối | `job-state-machine.ts` | huỷ job blocked ⇒ `MCP_STATE_TERMINAL` |
| Chống gửi trùng (idempotency) | `services/jobs.ts` | gửi 3 lần ⇒ 1 job, 1 bản ghi ledger |
| Usage reserve/release, làm tròn lên theo phút | `services/usage.ts` | video 599 s ⇒ 10 phút; huỷ ⇒ hoàn lại |
| Nhật ký request + audit có che thông tin nhạy cảm | `observability/`, `services/audit.ts` | 7 test; không token nào lọt vào log |
| Lỗi luôn ra ApiError có translation key | `server.ts` (`setErrorHandler`) | không còn `FST_ERR_*` lọt ra ngoài |
| Giao diện 16 màn theo workflow, vi mặc định | `apps/web/app/` | bấm tay hết luồng trên trình duyệt thật, 0 lỗi console |
| i18n vi + en, 235 khoá, parity tuyệt đối | `packages/i18n/` | 8 test |
| Schema PostgreSQL cho 10 entity | `db/migrations/0001_phase1_init.sql` | chạy thật trên DB sạch, 6 ràng buộc chặn đúng |
| Hạn 30 phút cho khoản giữ mức dùng + hoàn trả idempotent | `usage-reservation.ts`, `services/usage.ts` | 18 test đơn vị + 11 test HTTP, có ca biên 1799/1800/1801 giây |
| Tách rõ "đang giữ" / "đã hết hạn giữ" / "đã tính" | `services/usage.ts` | kiểm live trên server đã build |
| Luật lưu giữ dữ liệu theo từng lớp + báo cáo thử-không-xoá | `retention.ts`, `services/retention.ts` | 18 test đơn vị + 11 test HTTP; live: 0 ứng viên hôm nay, 1 ứng viên khi nhìn tới 31 ngày sau |
| Route vận hành nội bộ tắt mặc định | `server.ts` | không khoá hoặc sai khoá đều trả 404 |
| Index ID của MINI-SPEC | `docs/MINI_SPEC_INDEX.md` | 9 test chặn trùng ID, chặn tham chiếu mồ côi |
| Câu chữ owner duyệt + phiên bản 2 của nội dung xác nhận | `policy.ts`, `packages/i18n/` | 11 test câu chữ; live: lời khai v1 bị từ chối là `stale` |
| Worker tự nhận và chạy job (PostgreSQL `FOR UPDATE SKIP LOCKED`) | `worker/job-worker.ts`, `persistence/postgres.ts` | 8 test, trong đó 3 worker song song trên PG thật chỉ một bên nhận được; live: route nội bộ TẮT, job tạo qua API nằm `queued` 5 s rồi tự tới `completed` trong 1 s sau khi bật worker |
| Tải bản kết quả về (tách hẳn khỏi đường tải tệp nguồn) | `services/outputs.ts`, `app/jobs/[jobId]/page.tsx` | 8 test, có đối chứng âm "đường tải asset vẫn trả tệp nguồn"; live: tải thật 5421 byte, sha256 khớp đúng số hệ thống khai |
| Đo dấu vết nguồn gốc trên byte thật + biên nhận xử lý | `media/provenance-probe.ts`, `db/migrations/0006_*.sql` | 10 test; live: EXIF 240 byte còn nguyên trên tệp vừa tải về, biên nhận tự khai `unknown` về dấu vết AI thay vì `verified` |
| Ước tính mức dùng + xem trước trên bản proxy | `services/outputs.ts`, `services/preview.ts` | 11 test, trong đó 4 phép đo "không xảy ra điều gì"; live: xem trước chạy thật mà số bút toán mức dùng 1→1 |
| Phân trang nhật ký kiểm toán (con trỏ, mới nhất trước) | `persistence/{in-memory,postgres}.ts`, `app/activity/page.tsx` | 14 test trên cả hai adapter + đối chứng âm bỏ khoá phụ; live: 3 trang ra đúng tập hợp như đọc một lần |
| Giao diện: xem trước · biên nhận · hạn lưu giữ | `app/jobs/[jobId]/page.tsx`, `app/assets/[assetId]/page.tsx` | bấm tay trên Chrome thật: xem trước render ảnh, mức dùng không đổi, tải về ra đúng một tệp; 4 lỗi tìm được mà 528 test không bắt |
| Tài liệu OpenAPI sinh từ bảng route | `packages/contracts/src/openapi.ts` | 8 test gồm phép đối chiếu NGƯỢC với Fastify thật + đối chứng âm; live: 34 đường dẫn, 48 mã lỗi |
| Tải lên nhiều mảnh, nối lại được sau khi mất kết nối | `services/resumable-upload.ts`, `db/migrations/0007_*.sql` | 11 test gồm mô phỏng đứt kết nối; live: đứt ở 14/29 mảnh rồi nối lại, tệp ghép khớp từng byte |
| Xử lý VIDEO tất định: mask · crop · blur (ffmpeg) | `providers/deterministic-video.ts`, `media/ffmpeg.ts` | 29 test trên video thật; audio giữ nguyên qua cả ba chế độ; 2 lỗi chỉ lộ khi render đã có test hồi quy |
| Audio là CỔNG: mất tiếng thì job KHÔNG được `completed` | `services/run-video-job.ts`, `contracts/phase3.ts` | đối chứng âm đã chạy: ép bỏ audio ⇒ job `failed` kèm `reason: audio_lost` |
| Bản proxy xem trước cho video | `services/video-proxy.ts` | 10 test; proxy ở lớp `preview`, tệp gốc khớp từng byte sau khi sinh |
| Preset xuất (TikTok/Reels/Shorts/vuông/ngang) | `contracts/presets.ts` | 13 test; KHÔNG preset nào khai `verified`; giới hạn nền tảng đều `null` |
| Hợp đồng dùng chung UI ↔ server + kiểm lúc chạy | `contracts/{schema,phase3}.ts` | 25 test gồm thiếu trường/sai enum/sai kiểu; đóng D-047 **trong phạm vi Phase 3** |
| Kiểm lúc chạy cho **toàn bộ** biên UI ↔ server | `contracts/api-schemas.ts`, `web/tests/contract-boundary.test.ts` | 0/29 lời gọi chưa kiểm; chốt chặn tái phát + đối chứng âm; bật lên là lộ ngay 3 lệch thật giữa UI và máy chủ |
| Giao diện làm sạch video (chọn vùng · xem trước · preset · reset) | `app/assets/[assetId]/video/page.tsx` | bấm tay Chrome thật 1280×900 và 390×844: 0 tràn ngang, 0 chữ cắt, 0 khoá thô, console sạch; 3 lỗi chỉ bấm tay mới thấy |

## 2. Đã có contract/schema, chưa nối vào runtime (`planned`)

**worker tự chạy việc hoàn trả khoản giữ quá hạn** · **worker dọn dữ liệu theo luật lưu giữ** ·
**worker dọn phiên tải lên quá hạn** (P2-MCP-35 để lại mảnh thừa) ·
**nhãn câu chữ cho loại sự kiện ở trang Nhật ký** (chờ owner/BA duyệt) ·
**giao diện dùng đường tải lên nối lại được** (mới có API).

> Sửa một mục khai sai: *"Auth provider production"* vẫn nằm ở đây trong khi `P2-MCP-25` đã làm xong
> từ trước. Bản online tự khai `identityProvider: password-phase2, production: true`. Bảng này nói sai
> về chính hệ thống nên đã bỏ mục đó.

> **Đã ra khỏi mục này (P2-MCP-31, D-046): ước tính + xem trước.** Đây là **hai route 501 cuối
> cùng** — `/healthz` nay khai `plannedRoutes: 0`. `estimatedCostUsd` luôn `null` (không phải `0`)
> vì chưa có bảng giá nào. Xem trước không tính tiền và không để lại object trong kho.
>
> **Đã ra khỏi mục này (P2-MCP-30, D-045): biên nhận xử lý.** Trước đó `ProcessingReceipt` là **bất
> khả thi về cấu trúc** — nó bắt buộc có `provenanceBeforeId` mà repo không có bảng provenance nào.
> Nay đo thật trên byte trước/sau và ghi biên nhận. **Chưa có giao diện xem biên nhận.**
>
> **Đã ra khỏi mục này (P2-MCP-29, D-043): lấy bản kết quả về.** Trước đó tệp đã xử lý xong nằm
> trong kho mà **không đường nào dẫn tới nó**. Nay có `GET /v1/jobs/:jobId/output` và
> `…/output/download-url`, giao diện hiện thẻ kết quả kèm nút tải. **Câu chữ mới chưa được owner duyệt.**
>
> **Đã ra khỏi mục này (P2-MCP-28, D-042): worker tự chạy job.** Hàng đợi nằm trên PostgreSQL
> (`FOR UPDATE SKIP LOCKED`), worker là vai thứ ba của cùng ảnh Docker (`MEDIACLEAR_ROLE=worker`).
> Job tạo qua API **tự chạy**, không còn phải gọi route nội bộ. **Chưa có** retry có backoff và
> **chưa có** cơ chế cứu job kẹt ở `processing` khi worker chết giữa chừng.
>
> **Đã ra khỏi mục này (P2-MCP-27, D-041): xử lý ảnh THẬT.** Job nay đi tới `completed` với kết quả
> thật — `crop`/`blur`/`brand_overlay` trên ảnh, chạy bằng libvips, **không dùng AI**. Video và các
> thao tác cần AI vẫn chưa làm được.
>
> **Đã ra khỏi mục này (P2-MCP-24, D-038): adapter object storage S3-compatible.** Chạy thật trên
> MinIO, tự khai `production: true`. Bật bằng `MEDIACLEAR_S3_*`; thiếu cấu hình thì vẫn ghi đĩa local.
> **Chưa kiểm trên Cloudflare R2 thật.**
>
> **Đã ra khỏi mục này (P2-MCP-23, D-037): adapter PostgreSQL.** Nay chạy thật, tự khai
> `durability: 'durable'` ở `/healthz`, kèm trình chạy migration. Bật bằng `MEDIACLEAR_DATABASE_URL`;
> không có biến đó thì vẫn in-memory như cũ.

## 3. Chưa có bằng chứng (`unknown`)

Provider AI nào đủ chất lượng (Q-06) · Giá thật mỗi ảnh/mỗi phút video (Q-07) · Tỷ lệ fail/retry thực
tế · Thư viện đọc C2PA (Q-12) · Bộ media mẫu cho benchmark (Q-07) · **Hành vi khi tệp gần trần 199 MB**
(mới thử tới 1,9 MB) · **Đỉnh bộ nhớ khi ghép tệp lớn** (`P2-MCP-35` ghép trong bộ nhớ, chưa đo dưới tải).

## 4. Chưa xác minh (`unconfirmed`)

Việc dọn dữ liệu thật theo luật lưu giữ (**chưa từng chạy** — Phase 1.1 chỉ có bản thử chỉ đếm) ·
Hành vi hoàn trả tại đúng mốc 30 phút trên môi trường thật (đã kiểm bằng đồng hồ điều khiển được
trong test; live chỉ xác nhận lệnh chạy được và bị chặn đúng) ·

Hành vi ở tải cao · **Đọc màn hình (screen reader) trên toàn bộ giao diện** · **Giao diện trên màn
hình nhỏ** · Việc dọn phiên tải lên quá hạn (`P2-MCP-35` để lại mảnh thừa, chưa ai xoá).

> **Hai mục đã RA KHỎI danh sách này trong Phase 2, vì nay đã đo được thật:**
> *"Bảo toàn metadata khi xử lý thật"* — `P2-MCP-30` đo trên byte đã lưu: EXIF **240 byte còn nguyên**
> trên chính tệp tải về. Nhưng phần **dấu vết AI** vẫn `unknown` vì không có bộ đọc C2PA (Q-12).
> *"Khả năng phục hồi khi mất kết nối giữa chừng upload"* — `P2-MCP-35` kiểm live: đứt ở 14/29 mảnh
> rồi nối lại, tệp ghép **khớp từng byte**.

## 5. Cố ý không làm (`out_of_scope` tới hết Phase 2)

Xử lý AI production (ảnh và video) · Trình sửa khung hình · Bám chuyển động · Chọn provider
production · Thanh toán thật · Google Drive · Chrome Extension · API công khai cho khách · Quyền
nâng cao ngoài 4 role · Gỡ dấu vết nguồn gốc · Tự động thu thập media từ website bên thứ ba.

> Về các dấu ẩn không nhìn thấy được trong tệp (gồm SynthID): hệ thống **không** phát hiện,
> **không** gỡ và **không** cam kết kiểm soát chúng. Đây là giới hạn được nêu rõ với người dùng ngay
> trong hộp thoại xác nhận quyền.
