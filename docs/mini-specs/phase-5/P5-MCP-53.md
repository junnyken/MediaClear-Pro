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

---

## Cập nhật `D-077` — tải logo và dán lớp phủ (ẢNH)

### Tải tệp logo

Đo trên **byte thật** — `content-type` của client chỉ để **đối chiếu**, không được tin (một tệp đổi
tên thành `.png` vẫn khai `image/png`). Qua tầng trừu tượng kho, **không chạm** hệ tệp trực tiếp.

**Không ghi đè**: mỗi lần tải là một khoá kho **mới**. Gán logo = **tạo phiên bản mới** của bộ nhận
diện. Ghi đè sẽ làm mọi bản xuất đã phát hành trỏ tới một hình ảnh khác với cái đã thật sự được dán.

`sharedStorage: false` đi qua biên giới API **có chủ đích**: tệp đang nằm trên kho **cục bộ** của
container — **không phải** kho dùng chung, và **không được gọi là** đã lưu trữ ở mức production
(`Q-23`).

### Dán lớp phủ

**KHÔNG nhầm với thao tác `brand_overlay`**: thao tác đó là mặt nạ xám đặc tô kín một vùng (`Q-15`)
— nó **xoá** thông tin. Mục này **thêm** thông tin lên trên. Nên lựa chọn lớp phủ là một trường
**riêng** (`ProcessingJobRequest.branding`), không phải một `operation`.

1. **Không bao giờ tự dán** — `branding` mặc định `null`.
2. **Ghim PHIÊN BẢN người dùng đã chọn**, không lấy "phiên bản đang hiệu lực".
3. **Dán ngay sau render, ngay trước khi ghi** — dán sau khi ghi sẽ làm `I-2` đỏ oan.
4. **Ghi cái ĐO ĐƯỢC**: logo hỏng ⇒ `brandOverlayApplied: false`, `brandLogoAssetId: null`.

`brandOverlayApplied` là cột **riêng**, không suy từ `brandKitId !== null`: người dùng có thể chọn
một bộ rồi **tắt** lớp phủ.

### Chưa làm

Lớp phủ cho **video** — xem `Q-P5-03`. Biên nhận của lượt video ghi `brandOverlayApplied: false`,
và đó là sự thật.
