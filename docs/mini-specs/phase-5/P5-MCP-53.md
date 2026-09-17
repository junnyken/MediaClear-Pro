# P5-MCP-53 — Brand Kit

- **Phase**: 5 · **Trạng thái**: xem `PHASE_5_CLOSURE.md` · **Quyết định**: `D-075`
- **Quy ước ID**: `P5-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**). Owner **chưa xác nhận
  riêng** cho Phase 5 — xem `Q-P5-01`, cùng tình trạng `Q-P4-03`.

---

## Mục tiêu

Workspace quản lý bộ nhận diện dùng cho xem trước / bản xuất, **không** lẫn với Rights Statement đã
ký và **không** lẫn với bằng chứng nguồn gốc.

## Ba điều định hình

1. **Sửa = tạo PHIÊN BẢN mới.** Biên nhận trỏ tới `(brandKitId, version)`. Sửa trực tiếp nội dung
   sẽ làm biên nhận cũ trỏ tới một thứ **khác** với cái đã thật sự được áp dụng — hồ sơ nói dối về
   quá khứ. Bảng phiên bản không có đường `UPDATE` nào.
2. **Không có đường XOÁ.** Bộ không dùng nữa thì `archived`. Xoá dòng là xoá luôn bằng chứng rằng
   một bản xuất đã từng mang bộ nhận diện nào.
3. **Không tự áp dụng.** Không hàm nào điền `brandKitId` vào biên nhận. Chỉ khi người dùng **chọn**
   thì đường xuất mới ghi.

## Quyền

Đọc dùng `asset.read`, sửa dùng `project.manage`. **Không** thêm quyền mới — ma trận quyền là quyết
định của owner (`Q-04`), không phải thứ một mục tự nới rộng.

## Phạm vi

Cô lập theo workspace. Workspace khác đọc/sửa đều trả cùng một mã lỗi với "không tồn tại" — không
xác nhận sự tồn tại của tài nguyên người khác (`I-10`).
