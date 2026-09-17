# P5-MCP-51 — Preserve Metadata Pipeline

- **Phase**: 5 · **Trạng thái**: xem `PHASE_5_CLOSURE.md` · **Quyết định**: `D-075`
- **Quy ước ID**: `P5-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**). Owner **chưa xác nhận
  riêng** cho Phase 5 — xem `Q-P5-01`, cùng tình trạng `Q-P4-03`.

---

## Mục tiêu

Đo thông tin kèm theo tệp **theo từng trường** ở cả hai phía, và nói đúng cái gì còn, cái gì mất,
cái gì được gỡ theo quy định.

## Vì sao phải theo từng trường

`"metadata preserved"` sau khi chỉ kiểm vài trường là một lỗ hổng quen thuộc: nó đúng với những
trường đã kiểm và nói dối về phần còn lại. `compareMetadata` lấy **hợp** của hai phía làm tập khoá,
và **mọi khoá đều phải có một trạng thái**.

## Bảy trạng thái, và vì sao `removed_by_policy` tách riêng

`preserved` · `changed` · `removed` · `removed_by_policy` · `added` · `not_available` · `unknown`.

`removed_by_policy` **không** gộp với `removed`: một bên là quyết định, một bên là mất mát. Gộp lại
thì không còn phân biệt được "hệ thống làm đúng việc của nó" với "hệ thống làm hỏng tệp".

Vị trí chụp và thiết bị chụp bị gỡ **theo mặc định**. Đây là chủ đích — nhưng vẫn phải ghi lại, vì
người dùng có quyền biết cái gì đã bị gỡ khỏi tệp của họ.

## Kết luận chung

Còn bất kỳ `unknown` nào ⇒ verdict là `unknown`. **Không** được nói "đã giữ" khi còn chỗ chưa đo được.

## Giới hạn thật của bộ đọc

- **Ảnh**: hệ thống **không** thêm thư viện phân tích EXIF (một phụ thuộc mới là một quyết định —
  `D-039`). Bộ đọc tự duyệt cấu trúc TIFF/IFD cho **một danh sách đóng** gồm 5 thẻ. Thẻ ngoài danh
  sách **không** được đọc, và vì vậy **không** được báo cáo là "không có".
- **Video**: đọc `format.tags` + `stream.tags` qua ffprobe — đây là trường thật.
- Có khối EXIF nhưng không duyệt được ⇒ cả ảnh chụp là **không đọc được**, không phải "rỗng".
