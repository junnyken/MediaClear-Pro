# WORDING_REVIEW_P3 — rà soát câu chữ Phase 2 + Phase 3

- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-17
- **Phạm vi**: **77 khoá i18n** thêm từ commit `170b244` (mở Phase 2) tới `3d3d74f`
- **Liên quan**: `Q-P3-08` · **Quyết định**: `D-059`
- **Không thuộc phạm vi**: câu chữ **xác nhận quyền** (`rights.attestation.*`) — xem §5

## 1. Rà cái gì, và bằng cách nào

Không đọc bằng mắt rồi nói "ổn". Rà bằng **năm phép kiểm chạy được trên toàn bộ 77 khoá**:

| Phép kiểm | Vì sao | Kết quả |
|---|---|---|
| Chuỗi trùng dưới hai khoá khác nhau | hai tên cho một khái niệm ⇒ người dùng tưởng là hai thứ | **2** — đều **cố ý** |
| Thuật ngữ kỹ thuật lọt ra giao diện | người dùng cuối không hiểu, và nó che mất ý thật | **1 — lỗi thật, đã sửa** |
| Câu khai quá năng lực (*"bảo đảm"*, *"hoàn toàn"*, *"mọi… đều"*) | đúng thứ mọi guardrail của dự án nhắm vào | **0** |
| Thiếu bản dịch tiếng Anh | màn hình hiện khoá thô | **0** |
| Chuỗi quá dài (> 95 ký tự) | cắt chữ trên màn hình nhỏ | **3** — đã kiểm ở 390 px, **không cắt** |

## 2. Lỗi thật tìm được

**`provenance.limitation.no_c2pa_reader`** để lọt `C2PA / Content Credentials` ra màn hình.

> Trước: *"Chưa có công cụ đọc dấu vết AI (C2PA / Content Credentials) trong tệp."*
> Sau: *"Hệ thống chưa có cách đọc dấu hiệu cho biết tệp do AI tạo ra. Phần này chưa được kiểm tra."*

Tên chuẩn thì chính xác với người trong nghề, nhưng với người dùng cuối nó **không mang thông tin
gì** — và tệ hơn, nó làm câu khó đọc nên người ta bỏ qua đúng phần quan trọng nhất: **phần này chưa
được kiểm tra**. Tên chuẩn thuộc về **tài liệu**, không thuộc về giao diện.

**Phép chắn đã được mở rộng** để lần sau tự bắt: danh sách cấm nay có thêm `C2PA`,
`Content Credentials`, `checksum`, `codec`, `proxy`, `token`, `SHA-256`, `JSON`, `API`.
**Đối chứng âm đã chạy**: đưa lại `C2PA` ⇒ test **đỏ**; khôi phục ⇒ xanh.

## 3. Hai chuỗi trùng — giữ nguyên, có lý do

| Chuỗi | Hai khoá |
|---|---|
| "Cách xử lý" | `screen.video.mode_title` · `screen.job_status.mode` |
| "Khung hình khi xuất" | `screen.video.preset_title` · `screen.job_status.preset` |

Cùng một khái niệm ở hai màn hình (lúc **chọn** và lúc **xem lại**). Dùng **cùng một từ** là đúng —
đổi tên giữa hai màn hình mới là thứ làm người dùng bối rối.

## 4. Nguyên tắc câu chữ rút ra từ đợt rà này

1. **Nói giới hạn trước, đừng giấu ở cuối.** *"Phần này chưa được kiểm tra"* phải đọc được ngay.
2. **Không dùng tên chuẩn kỹ thuật làm câu chữ.** Nếu cần chính xác, mô tả bằng lời thường.
3. **Cùng khái niệm thì cùng từ**, kể cả khác màn hình.
4. **Không có từ tuyệt đối** — *"luôn"* chỉ được dùng cho điều hệ thống **thật sự bảo đảm bằng mã**
   (vd *"Tệp gốc của bạn luôn được giữ nguyên"* — có bất biến I-1 và chốt ở tầng lưu trữ).

## 5. Phần KHÔNG rà, và vì sao

**Câu chữ xác nhận quyền** (`rights.attestation.*`, `policy.*`) **không nằm trong đợt này**. Đó là
`Q-11`, và nó có **sức nặng pháp lý**: người dùng ký vào đó để khai rằng họ có quyền chỉnh sửa tệp.
Một agent rà cho gọn gàng, dễ đọc thì được — nhưng **không thay thế được** người chịu trách nhiệm
pháp lý đọc và duyệt. `Q-11` **vẫn mở**, và `Rights Statement v1/v2` **không bị đụng vào**.

Tên nền tảng trong preset (`TikTok` / `Reels` / `Shorts`) cũng là mục **cần owner quyết**: dùng tên
thương hiệu làm nhãn có thể bị hiểu là cam kết tương thích. Hiện đã có câu ngay bên cạnh nói rõ *"Tên
nền tảng chỉ gợi ý tỉ lệ phổ biến. Hệ thống chưa kiểm tra được nền tảng có chấp nhận tệp hay không."*
Nếu owner muốn bỏ hẳn tên thương hiệu, đổi 5 khoá là xong.
