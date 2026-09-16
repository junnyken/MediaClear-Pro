# P2-MCP-33 — Preview, Receipt and Retention in the UI

- **Canonical ID**: `P2-MCP-33` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-048`

## Context

Đã đọc: `P2-MCP-29` (tải kết quả) · `P2-MCP-30` (biên nhận) · `P2-MCP-31` (xem trước) ·
`P1.1-MCP-18` (luật lưu giữ) · `apps/web/app/`. Commit nền: `5f5fdc6`.

**Vấn đề.** Ba tính năng đã chạy thật ở tầng API nhưng **không có đường nào trên giao diện**: xem
trước, biên nhận, và hạn lưu giữ. Route có, test xanh, nhưng người dùng không bấm tới được.

## Design Choice

**1. Xem trước chỉ hiện khi job CHƯA xong.** Xong rồi thì tệp kết quả thật có ích hơn hẳn một bản
proxy độ phân giải thấp. URL đúc khi **bấm**, không phải khi mở trang.

**2. Biên nhận hiện CẢ phần chưa đo được.** Giấu đi sẽ khiến người dùng tưởng mọi thứ đều đã được
kiểm chứng. Dòng "Giới hạn của lần đo này" nói thẳng là chưa có công cụ đọc dấu vết AI.

**3. Hạn lưu giữ đọc từ route riêng**, không nhét vào `AssetView`. Khi tệp đã tới hạn, câu chữ phải
nói **hệ thống chưa xoá gì** — hiện "đã tới hạn" mà dừng ở đó sẽ khiến người dùng tưởng tệp đã mất.

## Bốn lỗi chỉ lộ ra khi BẤM TAY

Cả bốn đều lọt qua 528 test, `tsc` và `eslint`.

**1. `formatBytes` hiện "0 MB" cho tệp 5421 byte.** Hàm luôn chia cho 1 MB, nên **mọi** tệp dưới
~50 KB đều là "0 MB". Người dùng nhìn thẻ "Tệp kết quả" và có mọi lý do để hiểu rằng tệp của họ rỗng.
Test duy nhất của hàm này chỉ kiểm ca `null`. Đã sửa thành đổi đơn vị B/KB/MB/GB + thêm test.

**2. Câu giới hạn hiện ra là chuỗi tiếng Việt KHÔNG DẤU.** `C2PA_LIMITATION_NOTE` là một chuỗi viết
thẳng trong mã nguồn — chú thích trong repo này không dấu theo quy ước, nhưng chuỗi đó **đi thẳng ra
màn hình người dùng**. Đổi thành **khoá i18n** (`provenance.limitation.no_c2pa_reader`), giao diện
`translate()` nó, câu tiếng Việt có dấu nằm trong tệp ngôn ngữ.

**3. Nút "Tải tệp kết quả" mở ảnh trong tab thay vì tải tệp.** Thiếu `Content-Disposition`, nên trình
duyệt hiển thị ngay; nếu người dùng bấm lưu thì tên tệp là **cả chuỗi vé đã ký** dài hàng trăm ký tự.
Thêm `attachment; filename="<tên object>"` + test.

**4. Mốc thời gian trên trang Nhật ký hiện dạng ISO thô** (`2026-09-16T13:39:39.081Z`). Đổi sang
`formatDateTime`.

## Test Plan & Verification

Phần này **không thay thế được bằng test** — ba lỗi đầu đều xanh hết mọi lệnh kiểm. Bấm tay trên
Chrome thật, tài khoản tạo mới qua giao diện:

| Bước | Kết quả |
|---|---|
| Tạo tài khoản → workspace qua giao diện | vào được, không lỗi console |
| Job `queued` → thẻ **Xem trước** hiện, bấm ra ảnh 240×160 | ảnh render thật trong trình duyệt |
| Mức dùng sau khi xem trước | vẫn **"Đang giữ"** — không bị tính (I-12) |
| Trang tệp → thẻ **Thời hạn lưu giữ** | "Đang giữ · Giữ đến 16/10/2026 · Tệp còn trong thời hạn" |
| Job `completed` → thẻ **Tệp kết quả** | "5,4 KB" (trước bản vá: "0 MB") |
| Thẻ **Biên nhận xử lý** | "Mức bằng chứng: Chưa xác định", giới hạn **có dấu** |
| Bấm "Tải tệp kết quả" | `attachment; filename="out_….png"`, 5499 byte |
| Trang Nhật ký (sau `P2-MCP-32`) | 19 sự kiện, mới nhất trước, không lỗi |

Console: **không có lỗi hay cảnh báo nào**.

## Remaining Limits / Follow-ups

- **Loại sự kiện trên trang Nhật ký vẫn hiện nguyên chuỗi tiếng Anh** `snake_case`
  (`output_download_url_issued`). Cần ~20 nhãn câu chữ **do owner/BA duyệt** — DEV không tự chế.
- **Toàn bộ câu chữ mới của `P2-MCP-29/31/33` chưa được owner duyệt** (nay là 8 + 20 khoá).
- Chưa có nút "xem lại" hay lịch sử các lần xem trước.
- Chưa bấm tay trên màn hình nhỏ; chưa kiểm bằng trình đọc màn hình.
- Trang Nhật ký chưa có lọc, và nút "Xem thêm" chưa được bấm thật (dữ liệu chưa đủ một trang).
