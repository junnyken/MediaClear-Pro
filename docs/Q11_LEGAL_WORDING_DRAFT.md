# `Q-11` — Bản nháp câu chữ pháp lý, trình luật/BA duyệt

> **Trạng thái: BẢN NHÁP. Chưa có hiệu lực. Chưa ai ký.**
>
> Tài liệu này **không** thay đổi gì trong hệ thống. `Rights Statement v1` và `v2` **giữ nguyên
> từng ký tự**, **không tạo v3**, và mã nguồn **không** được sửa theo bản nháp này cho tới khi có
> người chịu trách nhiệm pháp lý duyệt.
>
> Người soạn: agent. **Agent không phải luật sư và không thay thế được thẩm định pháp lý.** Bản
> nháp này chỉ để rút ngắn thời gian của người duyệt, không phải để thay họ.

- **Liên quan**: `Q-11` · **Ngày soạn**: 2026-09-17 · **Người duyệt**: _chưa có_

---

## 1. Câu hỏi đang chờ trả lời

> Có cần luật sư/BA duyệt câu chữ xác nhận quyền (vi + en) trước khi lên production không?

Đây là **blocker go-live**. Nó không đóng được bằng kỹ thuật.

## 2. Câu đang được ký hôm nay (v2) — KHÔNG sửa

| | Nội dung |
|---|---|
| **vi** | Tôi xác nhận rằng tôi sở hữu nội dung này hoặc có quyền chỉnh sửa nội dung này. |
| **en** | I confirm that I own this content or that I have the right to edit this content. |

Đây là **chuỗi duy nhất được version hoá và lưu làm bằng chứng** (`D-035`). Nhãn ô tick **chính là**
câu này, nên chữ hiển thị và chữ được lưu không thể lệch nhau.

## 3. Ba rủi ro mà người duyệt nên cân, kèm câu đề xuất

Mỗi mục nêu **rủi ro** trước, **đề xuất** sau. Người duyệt có thể bác bất kỳ mục nào.

### 3.1 Câu hiện tại không nói người dùng xác nhận vào **thời điểm nào** và cho **tệp nào**

**Rủi ro.** Xác nhận có hiệu lực 365 ngày cho **đúng một tệp** (`D-019`), nhưng bản thân câu được ký
không nhắc điều đó — thông tin nằm ở một dòng chú thích bên cạnh, **không** được lưu làm bằng chứng.
Nếu về sau có tranh chấp, thứ còn lại trong hồ sơ là câu ở §2, và nó không tự nói lên phạm vi.

**Đề xuất (vi).**
> Tôi xác nhận rằng tôi sở hữu tệp này hoặc có quyền chỉnh sửa tệp này, tại thời điểm tôi bấm xác nhận.

**Đề xuất (en).**
> I confirm that I own this file, or have the right to edit it, at the time I submit this confirmation.

### 3.2 Câu hiện tại không tách **quyền chỉnh sửa** khỏi **quyền sử dụng kết quả**

**Rủi ro.** Hai quyền này khác nhau. Một người có thể có quyền chỉnh sửa tệp nhưng **không** có
quyền dùng bản đã xoá logo cho mục đích thương mại. Câu v1 từng có vế *"và tôi chịu trách nhiệm về
việc sử dụng kết quả sau khi xử lý"*; câu v2 **đã bỏ vế đó**. Người duyệt nên quyết định việc bỏ đó
là cố ý hay là mất mát.

**Đề xuất (vi).**
> Tôi chịu trách nhiệm về cách tôi sử dụng tệp kết quả.

**Đề xuất (en).**
> I am responsible for how I use the resulting file.

### 3.3 Chưa nói rõ hệ thống **không thẩm định** quyền của người dùng

**Rủi ro.** Có dòng `declaration_note` nói ý này, nhưng nó **không** nằm trong chuỗi được ký. Nếu
người dùng hiểu nhầm rằng việc hệ thống chấp nhận tệp là một hình thức xác nhận quyền, đó là rủi ro
cho bên vận hành.

**Đề xuất (vi).**
> MediaClear Pro không kiểm tra và không xác nhận quyền của bạn đối với nội dung này.

**Đề xuất (en).**
> MediaClear Pro does not verify or confirm your rights to this content.

## 4. Những chỗ agent **cố ý không đụng vào**

- **Không** đề xuất câu về giới hạn trách nhiệm, bồi thường, luật áp dụng hay cơ quan tài phán —
  đó là phần phải do luật sư viết, không phải phần "viết lại cho dễ hiểu".
- **Không** đề xuất câu về dữ liệu cá nhân / hình ảnh người thật. Hệ thống hiện xử lý **logo và dấu
  hiệu nhận diện nhìn thấy được** (`policy.visible_identity_scope`); nếu phạm vi mở rộng sang khuôn
  mặt người, đó là một câu hỏi pháp lý **mới** và nặng hơn.
- **Không** đề xuất đổi thời hạn 365 ngày — đó là quyết định đã chốt (`D-019`).

## 5. Việc cần làm sau khi có người duyệt

1. Người duyệt ghi rõ **duyệt / sửa / bác** cho **từng mục** 3.1–3.3.
2. Nếu có mục nào được duyệt ⇒ **tạo `Rights Statement v3`** theo đúng quy trình version hoá; **không**
   sửa v1/v2 (chúng là bằng chứng của những lần ký đã xảy ra).
3. Cập nhật `Q-11` trong `OPEN_QUESTIONS.md` và ghi một quyết định mới trong `DECISIONS.md`.
4. Chạy lại phép chắn câu chữ và đối chứng âm.

Nếu người duyệt **bác toàn bộ**, `Q-11` vẫn đóng được — bằng một câu xác nhận rằng câu v2 hiện tại
**đã đủ** và được chấp nhận cho production. Điều quan trọng là có **người chịu trách nhiệm** nói ra,
chứ không phải agent tự kết luận.
