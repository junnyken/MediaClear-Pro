# P4-MCP-44 — Quality Review Gate

- **Phase**: 4 · **Trạng thái**: xem cuối tài liệu · **Quyết định**: `D-071`
- **Quy ước ID**: `P4-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**), nhưng owner **chưa xác nhận riêng** cho Phase 4 — xem `Q-P4-03`.

---

## Mục tiêu

Cổng chặn **cuối cùng** trước khi xuất. Đây là nơi **duy nhất** được phép nói `completed`.

## Ba bất biến cốt lõi của Phase 4 hội tụ ở đây

| Bất biến | Thi hành ở đâu |
|---|---|
| Không frame nào bị bỏ sót mà UI báo hoàn tất | `summariseTimeline` so `states.size` với `expectedFrameCount` (đến từ `P4-MCP-40`, **không** từ kết quả tracking) |
| Frame confidence thấp phải được đánh dấu review | `frameStateFor` → `frame_low_confidence` → `canComplete = false` |
| Video không được xuất nếu audio mất ngoài ý muốn | `audioAllowsCompletion` — **dùng lại** `compareAudio` của Phase 3, không viết lại |

## Không có "completed theo phần trăm"

49/50 frame tốt **không** đủ để báo hoàn tất. Có test riêng cho đúng câu này.

## `failed` nặng hơn `review_required`

Frame thiếu, frame hỏng decode, audio mất ⇒ `failed`. Một người bấm "duyệt" **không làm audio quay
trở lại**, nên nó không thể là `review_required`.

## Lý do phải CỤ THỂ

`counts` cho phép UI nói *"12 frame có độ tin cậy thấp"* thay vì một nhãn chung. Có test đòi đúng
điều đó.

## Trạng thái

`completed`. 6 test + phần lớn 9 đối chứng âm của Phase 4 hội tụ ở cổng này.
