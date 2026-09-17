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
