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

---

## Cập nhật `D-077` — dán dải công bố vào bản xuất (ẢNH)

Lớp phủ công bố là **opt-in**: mặc định tắt, và không đường nào trong mã tự bật.

Câu chữ do **người gọi** truyền vào (qua i18n) — mục dán không tự chế chữ. Đã từng có tiếng Việt
không dấu đi thẳng ra màn hình từ một mục tương tự.

### Lỗi đo được: dải công bố TRỐNG RUỘT

Workspace mất **sạch font** sau một lần khởi động lại (`fc-list` trả về 0). Thư viện vẽ SVG vẫn trả
về một ảnh **hợp lệ** — chỉ là không có chữ. Bản xuất sẽ mang một dải tối màu trống ruột: trông như
một dấu có chủ định nhưng **không nói gì**, và biên nhận khai rằng đã công bố.

**Một công bố trống còn tệ hơn không công bố.**

`renderDisclosureBand` tự chạy một **đối chứng âm lúc chạy**: vẽ dải với câu chữ thật, vẽ lại với
chuỗi rỗng, so byte. Giống nhau ⇒ chữ không lên được pixel nào ⇒ **không dán gì** và
`disclosureApplied` là `false`.

Không kiểm *"có font không"* — phép kiểm đó trả lời một câu khác. Font có thể có mặt mà vẫn không vẽ
được chữ Việt có dấu; điều duy nhất đáng tin là đối chiếu **pixel**.
