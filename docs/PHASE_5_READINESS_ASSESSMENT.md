# PHASE 5 — Đánh giá sẵn sàng (Bước 0)

- **Ngày**: 2026-09-18 · **Cổng vào**: `READY_FOR_PHASE_5_EXCEPT_PROVIDER_AND_ONLINE` · **Quyết định**: `D-075`
- **Go-live**: `NOT_READY_FOR_GO_LIVE` — blocker vẫn là `Q-23`, **không bị đụng tới trong Phase 5**

---

## 1. Kiểm kê thật trước khi viết dòng mã nào

| Thứ cần cho Phase 5 | Đã có gì | Còn thiếu gì |
|---|---|---|
| Bản ghi nguồn gốc | `ProvenanceRecord` (Phase 2) — có/không + kết quả giữ lại | **không** có so sánh theo từng trường |
| Biên nhận | `ProcessingReceipt` — đã có ~15 trường kể cả audio trước/sau | thiếu kết luận thông tin kèm theo, công bố AI, bộ nhận diện |
| Dấu hiệu AI | `c2pa-probe.ts` (`D-069`) — **chỉ đọc sự hiện diện** | không có tầng trạng thái công bố |
| Nhật ký | `audit_events` APPEND-ONLY, phân trang, theo workspace | thiếu loại sự kiện cho bộ nhận diện |
| Bộ nhận diện | **không có gì** | toàn bộ |
| Dòng thời gian | **không có gì** | toàn bộ |

**Kết luận Bước 0**: nền Phase 2/3 đủ mạnh để Phase 5 **mở rộng** chứ không phải dựng lại. Điều đó
định hình quyết định lớn nhất của `MCP-50`: **không tạo bảng sự kiện thứ hai**.

## 2. Đọc thông tin kèm theo tệp — giới hạn thật

- **Ảnh**: `sharp` trả EXIF/ICC/XMP/IPTC dưới dạng **buffer thô**, không phải trường đã phân tích.
  Không thêm thư viện phân tích EXIF (một phụ thuộc mới là một quyết định — `D-039`). Bộ đọc tự
  duyệt cấu trúc TIFF/IFD cho **một danh sách đóng 5 thẻ**.
- **Video**: `ffprobe` trả `format.tags` + `stream.tags` — trường thật, không phải suy.
- **Đo được trên fixture thật**: ảnh đọc `ImageDescription`/`Make`/`Model`/`Software`; video đọc
  `title`/`comment`/`location`.

## 3. Xung đột chính sách phát hiện khi đo thật

`preserveOriginalMetadata` là `true` **cố định** theo **guardrail 6 và 7** — cam kết cấp owner rằng
hệ thống **giữ nguyên** thông tin gốc. Đo trên lượt chạy thật: `exif.Make = 'MatBao'` đi nguyên vẹn
từ tệp vào sang bản xuất.

Chính sách gỡ vị trí/thiết bị mà Phase 5 định đặt **mâu thuẫn trực tiếp** với guardrail đó. Không tự
quyết — xem `Q-P5-02`. Mã được sửa để **không khai một chính sách nó không thi hành**.

## 4. Provider AI

Vẫn `blocked` (`Q-P4-01`). Hệ quả cho `MCP-54`: trạng thái công bố thực tế là `provider_blocked`,
và đó là **kết luận đúng**, không phải chỗ trống.

## 5. Không đụng tới

`Q-23` **blocked** · `MEDIACLEAR_CLEANUP_ENABLED` **tắt** · Rights Statement v1/v2 **không đổi một
ký tự**, không có v3 · không route DELETE · không đánh số lại ID lịch sử.
