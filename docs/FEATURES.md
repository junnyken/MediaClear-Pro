# FEATURES — MediaClear Pro

- **Date**: 2026-09-15 · **Phase**: 1 (SaaS Shell & Media Intake Foundation)

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

## 2. Đã có contract/schema, chưa nối vào runtime (`planned`)

Adapter PostgreSQL thật (schema đã có) · Adapter R2/MinIO thật (port đã có) · Auth provider
production · Queue/worker · Preview render · Ước tính chi phí · Biên nhận xử lý · Phân trang audit ·
Soft-delete/retention · Resumable upload · OpenAPI.

## 3. Chưa có bằng chứng (`unknown`)

Provider AI nào đủ chất lượng · Giá thật mỗi ảnh/mỗi phút video · Tỷ lệ fail/retry thực tế · Thư viện
đọc C2PA · Queue runtime (Q-02) · Auth provider cụ thể (Q-14) · Bộ media mẫu cho benchmark (Q-07).

## 4. Chưa xác minh (`unconfirmed`)

Bảo toàn metadata/provenance khi xử lý thật (chưa xử lý lần nào) · Hành vi ở tải cao · Khả năng phục
hồi khi mất kết nối giữa chừng upload · Đọc màn hình (screen reader) trên toàn bộ giao diện.

## 5. Cố ý không làm (`out_of_scope` trong Phase 1)

Xử lý AI production (ảnh và video) · Trình sửa khung hình · Bám chuyển động · Chọn provider
production · Thanh toán thật · Google Drive · Chrome Extension · API công khai cho khách · Quyền
nâng cao ngoài 4 role · Gỡ dấu vết nguồn gốc · Tự động thu thập media từ website bên thứ ba.

> Về các dấu ẩn không nhìn thấy được trong tệp (gồm SynthID): hệ thống **không** phát hiện,
> **không** gỡ và **không** cam kết kiểm soát chúng. Đây là giới hạn được nêu rõ với người dùng ngay
> trong hộp thoại xác nhận quyền.
