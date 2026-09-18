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

---

## 6. Kết quả completion patch (`D-076`, `D-077` · 2026-09-18)

### `Q-P5-02` đã chốt

Mục 3 ở trên nêu xung đột. Chốt: **giữ nguyên** thông tin gốc, đúng guardrail 6/7. Mã nay nói đúng
điều nó làm — `METADATA_POLICIES` chỉ có `preserve`, và `METADATA_CATEGORIES_STRIPPED_BY_DEFAULT`
rỗng. Chi tiết: `D-076`.

### `Q-P5-04` — đã bớt nguy hiểm, vẫn còn mở

Bộ đọc vẫn chỉ phủ **5 thẻ EXIF**. Nhưng nay nó **kê tên** những thẻ nó không đọc được
(`unmeasuredKeys`), nên phép đối chiếu gọi chúng là `unknown` thay vì im lặng bỏ qua, và
`evidenceStatus` tụt xuống `partially_verified`.

Câu hỏi vẫn mở — nhưng hậu quả của nó **không còn là một lời nói dối im lặng**.

### Hai gói hệ thống biến mất giữa hai phiên

`ffmpeg` và **toàn bộ font** mất sau một lần khởi động lại. Hệ quả: 78 phép kiểm bị bỏ qua im lặng,
và bộ dán lớp phủ vẽ ra dải công bố trống ruột. Đây là rủi ro **môi trường**, không phải mã — nhưng
`D-077` bổ sung một đối chứng âm **lúc chạy** để mã tự phát hiện, thay vì phụ thuộc vào việc máy có
font hay không.
