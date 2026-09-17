# P5-MCP-50 — Provenance Inspector

- **Phase**: 5 · **Trạng thái**: xem `PHASE_5_CLOSURE.md` · **Quyết định**: `D-075`
- **Quy ước ID**: `P5-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**). Owner **chưa xác nhận
  riêng** cho Phase 5 — xem `Q-P5-01`, cùng tình trạng `Q-P4-03`.

---

## Mục tiêu

Cho người dùng truy ngược một tệp: từ tệp gốc → bản xem trước → lượt xử lý → lần sửa tay → tệp kết
quả → biên nhận → công bố AI.

## Quyết định nền: KHÔNG có bảng sự kiện thứ hai

Dòng thời gian được **dựng từ các nguồn đã có** (tệp gốc, bản xem trước, job, biên nhận, lịch sử sửa
khung hình, ảnh chụp thông tin kèm theo). Tạo một bảng `provenance_events` riêng sẽ lập tức sinh ra
nguồn sự thật thứ hai, và hai nguồn sẽ lệch nhau — đúng điều `D-047` tồn tại để chặn.

Đổi lại, mục này phải **tự dựng quan hệ cha–con**, và quan hệ đó được kiểm.

## Hai điều bắt buộc

1. **Thứ tự ổn định.** Sắp theo `(occurredAt, kind, id)`. Chỉ sắp theo thời gian thì hai mục cùng
   mốc sẽ đổi chỗ giữa hai lần đọc, và người dùng thấy lịch sử "tự nhiên đổi".
2. **Mục mồ côi phải LỘ RA.** Một mục trỏ tới cha không tồn tại nghĩa là dữ liệu thiếu. Lọc nó ở máy
   chủ sẽ làm dòng thời gian trông như đã đầy đủ — đúng kiểu nói dối mục này tồn tại để chặn.
   `orphanIds` đi qua được biên giới API **có chủ đích**.

## Giới hạn không được che

Mục nào `unknown` thì hiển thị `unknown`. Nhãn giao diện không được nâng cấp bằng chứng: một ảnh
chụp không đọc được là một **phép đo thất bại**, không phải một kết luận.
