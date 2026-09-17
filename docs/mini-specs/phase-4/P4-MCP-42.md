# P4-MCP-42 — Keyframe Correction

- **Phase**: 4 · **Trạng thái**: xem cuối tài liệu · **Quyết định**: `D-071`
- **Quy ước ID**: `P4-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**), nhưng owner **chưa xác nhận riêng** cho Phase 4 — xem `Q-P4-03`.

---

## Mục tiêu

Người thật sửa mask tại keyframe khi tracking tự động sai.

## Hai điều bắt buộc

**1. Không ghi đè lịch sử.** Bản ghi trước khi sửa được cất vào `audit` **trước** khi thay đổi gì.
Sửa mà không giữ bản cũ thì không ai đối chiếu lại được quyết định của người dùng. `audit` được
**nối thêm**, không bao giờ thay thế.

**2. Tính lại frame lân cận.** Sửa đúng một frame rồi để các frame xung quanh giữ giá trị cũ sẽ tạo
ra một cú "nhảy" ngay tại chỗ vừa sửa — tức là sửa một lỗi và tạo ra một lỗi khác.

## Nguồn gốc mask

`manual` · `tracked` · `interpolated` — ba giá trị phân biệt được, không gộp. Một giá trị **suy ra**
không được trộn với một giá trị **đo được**.

## Frame hỏng decode

Sửa tay trên frame `frame_failed` phải xử lý **rõ ràng**, không giả định frame đã tồn tại. Bản ghi
audit giữ đúng sự thật rằng nó từng là frame hỏng.

## Trạng thái

`completed`. 4 test, có đối chứng âm cho việc mất audit trail.

---

## Cập nhật `D-072` — màn hình đã có

`/jobs/[jobId]/frames`. Chọn khung hình từ lưới có màu theo trạng thái, sửa vùng che bằng toạ độ
**chuẩn hoá [0,1]** — cùng hệ với máy chủ, không đổi đơn vị ở giao diện.

**Nút lưu bị khoá** khi số nhập không hợp lệ (vùng che tràn ra ngoài khung hình, hoặc chiều rộng /
chiều cao bằng 0), kèm câu giải thích. Chặn ngay tại chỗ nhập, không đợi máy chủ.

Khung hình **lỗi decode** hiện một câu nói thẳng: sửa tay chỉ ghi lại vùng bạn chọn, **không khôi
phục được** hình ảnh đã hỏng. Giao diện không được để người dùng tưởng mình vừa "sửa xong" một khung
hình không tồn tại.

**Audit trail ở tầng API** (`correctJobFrame`) ghi **trước** khi đổi frame, và là APPEND-ONLY. Đối
chứng âm của `D-072` cho thấy lớp này **chưa có test nào canh** cho tới khi `p4-correction-api.test.ts`
ra đời.

---

## Cập nhật `D-074` — hai đường đã hội tụ (đóng `Q-P4-05`)

Yêu cầu **2. Tính lại frame lân cận** ở trên là bắt buộc của mini-spec này, nhưng đường **API**
(`correctJobFrame`) chưa hề thi hành: nó ghi `reinterpolated: []` và không tính lại gì. Chỉ hàm thuần
`applyCorrection` làm. Đó là `Q-P4-05`.

Nay cả hai gọi **một** luật canonical duy nhất: `planFrameCorrection` trong contract.

**Hai điểm luật được SỬA khi hội tụ** — vì đo hàm đích trước mới thấy nó cũng sai:

1. **Confidence của khung nội suy → `null`.** Bản cũ giữ nguyên số cũ trong khi vùng che đã đổi, tức
   là con số đang mô tả một vùng che **không còn tồn tại**.
2. **Khung lân cận đang bị gắn cờ giữ nguyên trạng thái.** Bản cũ thăng cấp chúng lên
   `frame_correction_applied`: đo được trên timeline 7 khung, sửa **một** khung làm
   `lowConfidence: 2 → 0` và `canComplete: false → true` — xoá câu hỏi đang treo ở hai khung người
   dùng chưa hề nhìn. Nội suy làm vùng che mượt hơn; nó không trả lời được câu hỏi đã gắn cờ khung đó.

**Bán kính `2`** là **ước lượng**, thừa kế từ tham số mặc định cũ:
`CORRECTION_NEIGHBOUR_RADIUS_IS_MEASURED = false`. Chưa ai đo xem sửa một khung thực tế ảnh hưởng
lan bao xa.

**Ghi là một giao dịch** (`applyCorrectionAtomically`): hồ sơ và mọi khung bị đụng tới cùng đứng hoặc
cùng đổ, có phép chắn trên **cả hai** bản lưu trữ.

**Màn hình** hiện thêm thẻ *"Lần sửa gần nhất"*: khung đã sửa, danh sách khung lân cận được tính lại,
số đoạn nhảy và kết quả cổng chặn ở **cả hai vế** (trước · sau).
