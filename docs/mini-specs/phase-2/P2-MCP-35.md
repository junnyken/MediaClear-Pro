# P2-MCP-35 — Resumable Upload

- **Canonical ID**: `P2-MCP-35` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-050`

## Context

Đã đọc: `P1-MCP-15` (upload storage adapter) · `packages/contracts/src/storage.ts` ·
`apps/api/src/services/assets.ts`. Commit nền: `6c7bb8e`.

**Vấn đề.** Một lượt tải lên là **một request `PUT` duy nhất**. Mất kết nối giữa chừng là mất toàn bộ
và phải làm lại từ đầu. Với trần **199 MB** trên đường truyền kém, đó là chuyện xảy ra **thường
xuyên**, không phải ca hiếm.

## Constraints (Guardrails)

- **Bất biến I-1**: khoá `source` vẫn bất biến. Mảnh **không bao giờ** được ghi vào đó.
- Chỉ bản **đã ghép, đã đo, đã kiểm** mới được ghi vào khoá `source`.
- Ghép hai lần phải bị chặn.
- Ranh giới workspace áp cho cả phiên lẫn mảnh.

## Design Choice

**1. Lớp lưu trữ mới `staging` cho các mảnh.**

Mảnh là thứ **tạm**: được phép **ghi đè** (tải lại một mảnh hỏng là chuyện bình thường) và bị **xoá**
sau khi ghép. Chúng không bao giờ là `source`, nên `assertWritableKey` vẫn bảo vệ I-1 nguyên vẹn.

**2. `receivedChunks` là thứ DUY NHẤT làm cho "nối lại" có thật.**

Không có nó, client không biết tải tiếp từ đâu và "nối lại được" chỉ là một cái tên. Lưu **chỉ số**
chứ không lưu cỡ, vì cỡ mảnh suy ra được từ `chunkSizeBytes` và `declaredByteSize`.

**3. `recordChunk` phải NGUYÊN TỬ.**

Trên PostgreSQL đây là **một câu lệnh** `UPDATE … jsonb_agg(...)`, không đọc-sửa-ghi. Hai mảnh gửi
song song mà đọc-sửa-ghi thì một trong hai **biến mất khỏi danh sách**, và lượt tải lên sẽ "thiếu
mảnh" mà không ai biết vì sao. Cùng họ với `FOR UPDATE SKIP LOCKED` của `P2-MCP-28`.

**4. Kiểm cỡ mảnh NGAY lúc nhận,** không đợi tới lúc ghép. Một mảnh thiếu byte sẽ làm tệp ghép ra sai
mà không chỗ nào phát hiện — và nó chỉ lộ ở bước đo lại cuối cùng, lúc đã tốn công tải hết mọi thứ.

**5. Đo lại tổng số byte TRƯỚC khi ghi vào `source`.** Client khai trước kích thước; nếu tổng các
mảnh không khớp thì có gì đó sai, và ghi bừa vào khoá `source` là **không sửa được** (I-1).

**6. Xoá mảnh SAU KHI đã ghi và đã đánh dấu xong.** Xoá trước thì một sự cố giữa chừng sẽ làm mất
**cả mảnh lẫn tệp gốc** — không còn gì để thử lại. Xoá thất bại **không** làm lượt tải lên thất bại.

**7. Mở lại phiên đã có ⇒ trả nguyên trạng thái**, không tạo phiên mới và **không xoá mảnh đã gửi**.
Đây chính là đường mà client dùng sau khi mất kết nối.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| **mô phỏng đứt kết nối: gửi nửa chừng → hỏi lại server → gửi tiếp phần thiếu** | "nối lại" chỉ là cái tên |
| chưa đủ mảnh ⇒ từ chối ghép, **nói rõ thiếu mảnh nào** | báo lỗi chung chung |
| **tệp ghép ra khớp TỪNG BYTE với bản gốc** (đọc lại từ kho) | chỉ khớp kích thước |
| gửi lại một mảnh không sinh bản sao trong danh sách | danh sách phình, ghép sai |
| mảnh **sai kích thước** bị từ chối ngay | lỗi chỉ lộ ở bước cuối |
| chỉ số mảnh ngoài khoảng bị từ chối | ghi ra ngoài phạm vi |
| **ghép hai lần bị chặn** | vỡ I-1 |
| mở lại phiên đã có giữ nguyên mảnh đã gửi | mất tiến độ khi nối lại |
| **tệp gốc vẫn `pending` sau khi đã gửi mảnh** | mảnh rò vào lớp `source` |
| workspace khác không dùng được phiên | rò dữ liệu |

Phép thử chính là **mô phỏng đứt kết nối**. Chỉ kiểm "gửi đủ mảnh thì ghép được" **không chứng minh
được gì** về khả năng nối lại — mà đó là lý do tồn tại của cả mục này.

## Success Criteria

- Đứt giữa chừng rồi nối lại cho ra tệp **khớp từng byte** với bản gốc.
- Tệp gốc chưa bao giờ tồn tại trong kho cho tới khi mọi mảnh đã về và đã đo.

## Remaining Limits / Follow-ups

- **Ghép trong bộ nhớ.** `Buffer.concat` toàn bộ tệp — với trần 199 MB là chịu được, nhưng đây là
  đỉnh bộ nhớ thật cho mỗi lượt ghép và **chưa đo dưới tải**. Dùng `multipart upload` của S3 sẽ tránh
  hẳn; cần thêm phương thức vào cổng lưu trữ.
- **Chưa có việc dọn phiên quá hạn.** Cột `expires_at` có và phiên hết hạn bị từ chối, nhưng **không
  ai xoá mảnh thừa** — chúng nằm lại trong kho. Cùng dạng thiếu sót với worker dọn dữ liệu theo luật
  lưu giữ.
- **Chưa có checksum cho từng mảnh.** Hiện chỉ kiểm cỡ; một mảnh hỏng đúng cỡ sẽ lọt tới bước đo lại
  cuối cùng.
- **Chưa nối vào giao diện** — mới có API. Giao diện vẫn dùng đường tải lên một lần.
- Chưa có `abort` để client chủ động huỷ phiên và giải phóng mảnh.
