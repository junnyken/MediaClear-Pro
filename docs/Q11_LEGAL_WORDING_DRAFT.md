# `Q-11` — Bản nháp câu chữ pháp lý, trình luật/BA duyệt

> **Trạng thái: KHÔNG ÁP DỤNG. Giữ làm tài liệu tham khảo.**
>
> `2026-09-17`, owner trả lời `Q-11`: **không cần luật sư/BA duyệt trước khi lên production**
> (`D-068`). Vì vậy **không đề xuất nào trong tài liệu này được áp dụng**. `Rights Statement v2`
> **giữ nguyên từng ký tự**, **không tạo v3**, mã nguồn **không** đổi theo tài liệu này.
>
> Giữ lại vì hai lý do: (1) nếu sau này owner đổi ý hoặc mở cho khách ngoài, đây là điểm bắt đầu
> sẵn có; (2) nó ghi lại **những rủi ro đã được nêu ra và đã bị bỏ qua có ý thức** — thứ đó có giá
> trị hơn một tài liệu bị xoá.
>
> Người soạn: agent. **Agent không phải luật sư.** Tài liệu này **chưa từng được** người có chuyên
> môn pháp lý đọc.

- **Liên quan**: `Q-11` (đã đóng, `D-068`) · **Ngày soạn**: 2026-09-17 · **Người duyệt pháp lý**: _không có, và sẽ không có_

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

## 4. Bốn phần owner yêu cầu soạn thêm

> Owner đã bỏ giới hạn phạm vi trước đó và yêu cầu soạn cả bốn phần này. Đây **vẫn là bản nháp**:
> agent không phải luật sư, và **không** phần nào dưới đây có hiệu lực cho tới khi người chịu trách
> nhiệm pháp lý đọc và ký.
>
> **Chỗ để trống là cố ý.** `«…»` là thông tin agent **không được phép tự điền** — tên pháp nhân,
> địa chỉ, mã số doanh nghiệp, mức trần trách nhiệm. Điền bừa những chỗ này sẽ tạo ra một văn bản
> trông như thật nhưng sai chủ thể.

### 4.1 Giới hạn trách nhiệm

**Rủi ro cần chặn.** Hệ thống xoá logo/dấu hiệu nhận diện **nhìn thấy được**. Nó **không** bảo đảm
kết quả đủ điều kiện để người dùng đăng ở bất kỳ nền tảng nào, và **không** thẩm định quyền của họ
(`Q-P3-04` ghi rõ: không có bằng chứng nào từ nền tảng). Nếu người dùng đăng bản đã xử lý rồi bị
khiếu nại, ranh giới trách nhiệm phải rõ từ trước.

**Đề xuất (vi).**
> «TÊN PHÁP NHÂN» cung cấp công cụ xử lý tệp theo yêu cầu của bạn. Chúng tôi không bảo đảm kết quả
> xử lý đáp ứng yêu cầu của bất kỳ nền tảng, bên thứ ba hay cơ quan nào, và không chịu trách nhiệm
> về thiệt hại phát sinh từ việc bạn sử dụng tệp kết quả. Trong mọi trường hợp, tổng trách nhiệm của
> chúng tôi đối với một tệp không vượt quá «MỨC TRẦN».

**Đề xuất (en).**
> «LEGAL ENTITY» provides a tool that processes files at your request. We do not warrant that the
> result meets the requirements of any platform, third party or authority, and we are not liable for
> damages arising from your use of the resulting file. Our total liability for any one file shall not
> exceed «CAP».

**Luật sư cần quyết:** mức trần tính theo phí đã trả cho tệp đó, theo tháng, hay một số cố định; và
giới hạn này có bị vô hiệu với lỗi cố ý / vi phạm nghiêm trọng hay không.

### 4.2 Bồi thường

**Rủi ro cần chặn.** Người dùng tải lên nội dung **họ không có quyền**, hệ thống xử lý theo yêu cầu,
bên thứ ba khiếu nại. Xác nhận ở §2 đã nói người dùng tự khai quyền, nhưng lời khai đó **chưa gắn
với nghĩa vụ bồi hoàn**.

**Đề xuất (vi).**
> Bạn chịu trách nhiệm bồi thường cho «TÊN PHÁP NHÂN» đối với khiếu nại của bên thứ ba phát sinh từ
> nội dung bạn tải lên hoặc từ cách bạn sử dụng tệp kết quả, trong phạm vi khiếu nại đó bắt nguồn từ
> việc bạn không có quyền như đã xác nhận.

**Đề xuất (en).**
> You will indemnify «LEGAL ENTITY» against third-party claims arising from the content you upload
> or from your use of the resulting file, to the extent the claim stems from your not holding the
> rights you confirmed.

**Luật sư cần quyết:** phạm vi bồi hoàn (có gồm chi phí luật sư không), và có đối ứng nghĩa vụ nào từ
phía nhà cung cấp hay không.

### 4.3 Luật áp dụng và cơ quan giải quyết tranh chấp

**Đề xuất (vi).**
> Các điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Tranh chấp phát sinh sẽ được giải quyết
> tại «TOÀ ÁN / TRUNG TÂM TRỌNG TÀI CÓ THẨM QUYỀN».

**Đề xuất (en).**
> These terms are governed by the laws of Vietnam. Disputes shall be resolved at «COMPETENT COURT /
> ARBITRATION CENTRE».

**Luật sư cần quyết:** toà án hay trọng tài (VIAC); nếu có người dùng ngoài Việt Nam thì điều khoản
này có bị hạn chế bởi luật bảo vệ người tiêu dùng nước sở tại hay không.

### 4.4 Dữ liệu cá nhân và hình ảnh người thật

**Đây là phần nặng nhất, và nó liên quan tới hệ thống NGAY HÔM NAY chứ không phải tương lai.**

Phạm vi xử lý hiện tại là **logo và dấu hiệu nhận diện nhìn thấy được**
(`policy.visible_identity_scope`) — hệ thống **không** chỉnh sửa khuôn mặt. Nhưng ảnh/video người
dùng tải lên **vẫn có thể chứa hình ảnh người thật**, và hệ thống **lưu trữ** chúng (hiện là 365
ngày theo `D-019`). Lưu trữ đã là một hoạt động xử lý dữ liệu cá nhân, kể cả khi không ai chỉnh sửa
khuôn mặt.

**Điểm luật sư cần xác nhận — agent nêu để không bị bỏ sót, không kết luận thay:**

1. Nghị định **13/2023/NĐ-CP** về bảo vệ dữ liệu cá nhân có áp dụng cho hoạt động lưu trữ này không,
   và nếu có thì cần **cơ sở pháp lý** nào (sự đồng ý của chủ thể dữ liệu, hay cơ sở khác).
2. Người dùng tải tệp lên **không phải** chủ thể dữ liệu của người xuất hiện trong tệp. Xác nhận ở
   §2 hiện chỉ nói về **quyền chỉnh sửa nội dung**, **không** nói gì về người trong ảnh.
3. Có cần **hồ sơ đánh giá tác động** xử lý dữ liệu cá nhân hay không.
4. Nếu sau này mở phạm vi sang **chỉnh sửa khuôn mặt**, đây là câu hỏi pháp lý **mới và nặng hơn
   hẳn** — không nằm trong bản nháp này.

**Đề xuất câu bổ sung vào phần xác nhận (vi).**
> Nếu tệp của bạn có hình ảnh người khác, bạn xác nhận bạn có cơ sở hợp pháp để tải lên và xử lý tệp
> đó. MediaClear Pro chỉ xử lý logo và dấu hiệu nhận diện nhìn thấy được, không chỉnh sửa khuôn mặt.

**Đề xuất câu bổ sung (en).**
> If your file contains images of other people, you confirm you have a lawful basis to upload and
> process it. MediaClear Pro only processes visible logos and branding; it does not edit faces.

### 4.5 Phần agent vẫn KHÔNG đề xuất, và lý do là kỹ thuật chứ không phải né

- **Đổi thời hạn 365 ngày** — đã chốt ở `D-019`, đổi là quyết định sản phẩm, không phải câu chữ.
- **Con số, tên pháp nhân, địa chỉ, toà án cụ thể** — agent không có nguồn nào để lấy. Bịa ra sẽ tạo
  văn bản sai chủ thể, đúng dạng lỗi mà `feedback_absolute_no_fake_data` cấm.

## 5. Nếu sau này owner đổi ý

Owner đã chốt **không** dùng các đề xuất ở §3 và §4 (`D-068`). Nếu sau này quay lại — ví dụ khi mở
cho khách ngoài Mắt Bão, hoặc khi mở phạm vi sang chỉnh sửa khuôn mặt — thì trình tự là:

1. Người có thẩm quyền ghi **duyệt / sửa / bác** cho từng mục 3.1–3.3 và 4.1–4.4, và điền các chỗ
   `«…»` (tên pháp nhân, mức trần trách nhiệm, toà án).
2. Có mục nào được duyệt ⇒ **tạo `Rights Statement v3`** theo đúng quy trình version hoá. **Không**
   sửa v1/v2 — chúng là bằng chứng của những lần ký đã thực sự xảy ra.
3. Mở lại `Q-11` trong `OPEN_QUESTIONS.md` và ghi một quyết định mới.
4. Chạy lại phép chắn câu chữ và đối chứng âm.

**Rủi ro đã được nêu và đã bị bỏ qua có ý thức** — liệt kê ở đây để sau này không ai phải đoán lại:
câu được ký không tự nói lên phạm vi *tệp này/thời điểm này* (§3.1) · v2 đã bỏ vế trách nhiệm về
việc sử dụng kết quả (§3.2) · chưa nói rõ hệ thống không thẩm định quyền (§3.3) · chưa có giới hạn
trách nhiệm, bồi thường, luật áp dụng (§4.1–4.3) · **hệ thống lưu trữ 365 ngày tệp có thể chứa hình
ảnh người thật, và xác nhận hiện tại không nói gì về người trong ảnh** (§4.4).
