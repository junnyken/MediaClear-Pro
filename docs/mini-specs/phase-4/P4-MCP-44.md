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

---

## Cập nhật `D-072` — màn hình đã có

Cùng trang với `P4-MCP-42`, có chủ đích: với người dùng, *"vì sao chưa xong"* và *"tôi phải sửa gì"*
là **một** việc. Tách hai trang sẽ bắt họ nhớ số liệu ở trang này để hiểu trang kia.

Hiện **số cụ thể**: tổng khung hình · đã theo dõi được · độ tin cậy thấp · cần xem lại · lỗi · **còn
thiếu**. Mỗi lý do kèm số đếm — *"Có khung hình độ tin cậy thấp — 1"*, không phải *"Có lỗi"*.

**Nút tải về `disabled`** khi cổng chưa nói `completed`. Không suy từ "trông có vẻ xong".

Quan sát khi bấm tay: sửa frame 4 sang `x=0.42` trong khi lân cận ở `0.1` thì `P4-MCP-43` **lập tức**
thêm lý do *"Vùng che nhảy bất thường, cần xem lại — 2"*.
