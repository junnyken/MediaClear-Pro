# P5-MCP-54 — AI Disclosure Overlay

- **Phase**: 5 · **Trạng thái**: xem `PHASE_5_CLOSURE.md` · **Quyết định**: `D-075`
- **Quy ước ID**: `P5-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**). Owner **chưa xác nhận
  riêng** cho Phase 5 — xem `Q-P5-01`, cùng tình trạng `Q-P4-03`.

---

## Mục tiêu

Công bố minh bạch về việc dùng AI, **không** biến trạng thái chưa biết thành một kết luận.

## Ba điều không bao giờ được làm

Mỗi điều đều là một cách hệ thống có thể nói dối:

1. **`absent` của bộ dò KHÔNG thành "không phải AI".** Bộ dò chỉ đọc bản khả năng công khai trong
   tệp. Một tệp do AI tạo ra rồi bị gỡ thông tin sẽ cho `absent` — kết luận "không phải AI" từ đó
   là sai, và sai theo hướng nguy hiểm nhất.
2. **`unknown` KHÔNG thành một kết luận.** Không đọc được thì nói là không biết.
3. **`present` KHÔNG thành "đã xác minh".** Có dấu hiệu khác hẳn có dấu hiệu **thật và còn nguyên
   vẹn**; bộ dò của hệ thống không kiểm chữ ký nào (`D-069`).

## Thứ tự ưu tiên

Trạng thái của **dịch vụ xử lý** được trả lời trước: khi chưa có dịch vụ thật thì mọi kết luận về
"AI đã làm gì" đều chưa có cơ sở. Hiện tại `Q-P4-01` còn `blocked` ⇒ trạng thái thực tế là
`provider_blocked`.

## Lớp phủ

**Opt-in.** Mặc định `includeDisclosure = false`. Lớp phủ là một thông báo hiển thị, **không phải
bằng chứng xác thực** — câu chữ phải nói rõ điều đó.
