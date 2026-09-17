# P4-MCP-41 — Motion Mask Tracking

- **Phase**: 4 · **Trạng thái**: xem cuối tài liệu · **Quyết định**: `D-071`
- **Quy ước ID**: `P4-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**), nhưng owner **chưa xác nhận riêng** cho Phase 4 — xem `Q-P4-03`.

---

## Mục tiêu

Theo dõi vùng logo/watermark di chuyển qua các frame, tạo mask cho từng frame.

## Kết luận Bước 0 — provider

**Không có provider tracking nào** trong repo, và `PROVIDER_BENCHMARK.md` ghi rõ **chưa chạy
benchmark nào** (mọi ô `unknown`). Vì vậy:

- Provider thật: **`blocked`**, không phải `verified`.
- Dùng `DeterministicTrackingProvider` — tất định, **không phụ thuộc native nào**.
- Mọi thứ nối qua cổng `MotionTrackingProvider`, không gọi thẳng API nào.

**Rủi ro native binding:** bộ tracking thật sẽ kéo theo OpenCV binding hoặc ONNX runtime — đều là
native, đúng dạng rủi ro đã làm hỏng build Docker ở `D-039`. Phải đánh giá **trước** khi chọn.

## Ngưỡng confidence

`FRAME_CONFIDENCE_THRESHOLD = 0.6`. **Đây là ƯỚC LƯỢNG, không phải kết quả đo** — chưa có provider
thật nên chưa có phân bố confidence thật. Phase 3 đã làm đúng việc này một lần: dung sai audio
`0.25s` được **đo** bằng 12 lượt render rồi mới ghim. Ở đây chưa đo được, nên con số nằm tường minh
một chỗ, được ghi là ước lượng, và có câu hỏi mở để đo lại.

## Quy tắc không được vi phạm

- `confidence === null` **khác** `0`. `null` = provider không trả số nào ⇒ `frame_review_required`.
- Provider quá hạn ⇒ `frame_failed`, **không đoán vị trí**.
- Nội suy ⇒ đánh dấu `interpolated`, **không trộn** với `tracked`.

## Trạng thái

`completed` với provider giả; provider thật **`blocked`** (thiếu benchmark).
