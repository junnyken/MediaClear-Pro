# PHASE_1_1_Q22_CLOSURE — MediaClear Pro

- **MINI-SPEC**: `P1.1-Q22-MCP-21` — Rights Attestation Checkbox Scope Clarification
- **Decision**: `D-034` · **Closes**: Q-22
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-15
- **Base commit**: `511498a` (Q-20 closure) · trên nền `5d491e3` (Phase 1.1 hardening)

Tài liệu đã đọc trước khi thay đổi: `MINI_SPEC_PLAYBOOK.md` (bản v2 owner gửi kèm hội thoại) ·
`docs/PHASE_0_REPORT.md` · `docs/PHASE_0_DECISION_LOG.md` · `docs/PHASE_0_GATE_CLOSURE_REPORT.md` ·
`docs/PHASE_1_REPORT.md` · `docs/PHASE_1_1_REPORT.md` · `docs/PHASE_1_1_Q20_CLOSURE.md` ·
`docs/OPEN_QUESTIONS.md` · `docs/DECISIONS.md` · `docs/POLICY.md` · `docs/API.md` ·
`docs/DATA_MODEL.md` · `docs/UX_FOUNDATION.md` · `docs/TEST_LOG.md` · `docs/MINI_SPEC_INDEX.md` ·
`docs/mini-specs/phase-1/MCP-13.md` · `docs/mini-specs/phase-1.1/P1.1-MCP-19.md` ·
`docs/mini-specs/phase-1.1/P1.1-Q20-MCP-20.md`.

## 1. Summary

Hộp thoại xác nhận quyền hiển thị bốn đoạn văn nhưng ô tick chỉ ghi *"Tôi đã đọc và xác nhận **nội
dung trên**"*. Hệ thống lại chỉ version hoá và chỉ lưu **một câu** làm bằng chứng. Người dùng tick vào
một phạm vi rộng hơn thứ họ thực sự ký, còn hồ sơ lưu lại thì hẹp hơn thứ giao diện ngụ ý.

Bản vá này làm **nhãn ô tick chính là câu được ký**, và câu đó chỉ tồn tại **đúng một chỗ** trong hộp
thoại. Không tạo statement v3, không đổi văn bản đã ký, không đổi API.

## 2. Audit Before Build

| Mục audit | Phát hiện | Kết luận |
|---|---|---|
| Registry `RIGHTS_STATEMENT` | `version: 2`, `i18nKey: rights.attestation.v2.statement` | đúng, không đụng |
| Văn bản đã ký **v1** | khớp từng ký tự bản đóng băng | **không thay đổi** |
| Văn bản đã ký **v2** | khớp từng ký tự bản đóng băng | **không thay đổi** |
| Cổng `stale` | `policy.ts:112` — `statementVersion < RIGHTS_STATEMENT.version` | giữ nguyên |
| Fixture / request / response | không có literal văn bản ký nào bị cứng hoá sai | sạch |
| Bản ghi lịch sử | không có đường nào sửa bản ghi đã lưu | sạch |
| Thành phần giao diện | **một** hộp thoại `RightsDialog.tsx` | không có biến thể mobile/desktop, không bản sao |
| Ô tick | đúng **một** `input type="checkbox"` | nhãn là `rights.attestation.v2.checkbox` |
| Snapshot test | **không có tệp `.snap` nào** trong repo | không snapshot nào ghim nhãn cũ |
| Trạng thái disabled/loading/error | nút khoá khi `!accepted \|\| busy \|\| statement === null`; lỗi qua `ErrorNotice` | giữ nguyên |
| Parity khoá dịch | vi 253 / en 253, không lệch nội suy, không khoá thô | sạch |
| Trùng chữ | `v1.checkbox` và `v2.checkbox` **giống hệt nhau** | nhãn mơ hồ có từ Phase 1 |
| ID quyết định | đã dùng D-001…D-033 | **D-034** còn trống |
| ID MINI-SPEC | đã dùng tới `P1.1-Q20-MCP-20` | `P1.1-Q22-MCP-21` còn trống |
| Câu hỏi mở | Q-21 `unconfirmed`, Q-22 `unconfirmed` | Q-21 **giữ nguyên**, Q-22 đóng lượt này |

**Không mục nào phải dừng.** Điều kiện chặn của prompt — "signed statement text v1/v2 không thay đổi"
— được xác nhận đúng, nên không ghi `blocked`.

## 3. Design Choice

| Phương án | Kết quả |
|---|---|
| (a) Đổi **nội dung** khoá `v2.checkbox` thành câu canonical | **Loại.** Cùng một câu ở hai khoá ⇒ sửa một khoá quên khoá kia thì nhãn ô tick và văn bản ký lệch nhau trong im lặng — đúng loại lỗi Q-22 muốn chặn |
| (b) Version hoá cả phần ngữ cảnh, tạo v3 | **Loại.** Owner cấm tạo v3; và buộc mọi người đã ký v2 ký lại dù câu họ ký không đổi một chữ |
| (c) Giữ nhãn cũ, thêm câu giải thích bên dưới | **Loại.** Thêm chữ chứ không sửa chỗ mơ hồ |
| **(d) Nhãn ô tick dùng lại chính khoá của văn bản được ký** | **Chọn.** Câu được ký chuyển từ thẻ `<p>` riêng vào trong `<label>`; tồn tại đúng một chỗ, và chỗ đó là thứ người dùng tick |

Khoá nhãn cũ `rights.attestation.v2.checkbox` bị **xoá khỏi cả hai locale** để nhãn mơ hồ không quay
lại được. Khoá lịch sử `rights.attestation.v1.checkbox` **giữ nguyên** làm dấu vết hộp thoại v1 — mã
web đã bị test cấm gọi bất kỳ khoá `rights.attestation.v1.*` nào.

## 4. Changed Files

| Tệp | Thay đổi |
|---|---|
| `apps/web/app/_components/RightsDialog.tsx` | bỏ thẻ `<p>` chứa câu ký; nhãn `<label>` của ô tick nay render `rights.attestation.v2.statement`; thêm ghi chú giải thích vì sao câu này chỉ được ở một chỗ |
| `packages/i18n/src/locales/vi.json` | xoá `rights.attestation.v2.checkbox` (253 → 252 khoá) |
| `packages/i18n/src/locales/en.json` | xoá `rights.attestation.v2.checkbox` (253 → 252 khoá) |
| `packages/i18n/tests/wording.test.ts` | bỏ `checkbox` khỏi bộ hậu tố bắt buộc; **thêm** test khẳng định khoá đó đã biến mất |
| `apps/web/tests/q20-dialog.test.ts` | bỏ khẳng định về khoá nhãn cũ (chi tiết chuyển sang test Q-22) |
| `apps/web/tests/q22-checkbox.test.ts` | **mới** — 9 test |
| `docs/mini-specs/phase-1.1/P1.1-Q22-MCP-21.md` | **mới** — MINI-SPEC |
| `docs/DECISIONS.md` | thêm D-034 |
| `docs/OPEN_QUESTIONS.md` | Q-22 → đã giải quyết; **Q-21 giữ nguyên `unconfirmed`** |
| `docs/POLICY.md` | §16 ghi ranh giới bằng chứng ↔ ngữ cảnh và nghĩa vụ của ô tick; §18 ghi ngoại lệ xoá khoá; §19 cập nhật sơ đồ |
| `docs/DATA_MODEL.md` | §16 tham chiếu chéo, ghi rõ không đổi lược đồ |
| `docs/API.md` | §11 ghi "không có thay đổi API" kèm bảng đối chiếu |
| `docs/MINI_SPEC_INDEX.md` | thêm hàng `P1.1-Q22-MCP-21`; Phase 2 dời sang `P2-MCP-22` |
| `docs/TEST_LOG.md` | mục "lần 6" |

## 5. New/Updated Contract

**Không có contract mới.** `RIGHTS_STATEMENT` không đổi một trường nào. Thứ được siết lại là một
**quy tắc tài liệu có test chấp hành**, ghi ở `POLICY.md` §16:

> Số phiên bản tuyên bố áp dụng **chỉ** cho câu xác nhận quyền. Vì vậy ô tick **bắt buộc** hiển thị
> thẳng chính câu được ký, và câu đó chỉ được xuất hiện đúng một chỗ trong hộp thoại.

`P1.1-Q22-MCP-21` là ID mới duy nhất. Vì `P1.1-Q22-MCP-21` dùng số `21`, ghi chú trong
`MINI_SPEC_INDEX.md` được sửa để Phase 2 bắt đầu từ `P2-MCP-22`; đồng thời ghi rõ canonical ID là
**chuỗi đầy đủ**, nên `P1.1-Q22-MCP-21` và `P2-MCP-21` không bao giờ đụng nhau.

## 6. Tests

`apps/web/tests/q22-checkbox.test.ts` (mới, 9 test):

| Test | Chặn điều gì |
|---|---|
| nhãn ô tick tra ra đúng câu canonical | nhãn mơ hồ quay lại |
| nhãn ô tick dùng lại chính khoá của văn bản được ký | tách nhãn khỏi văn bản ký |
| câu được ký chỉ xuất hiện **đúng một lần** | hai chỗ hiển thị lệch nhau |
| hộp thoại không còn gọi nhãn mơ hồ cũ | dùng lại khoá cũ |
| nhãn cũ đã bị gỡ khỏi **cả hai** locale | để sót trong catalogue |
| khoá lịch sử `v1.checkbox` vẫn còn | xoá nhầm dấu vết lịch sử |
| vẫn là v2, không có `v3.statement` | vô tình tạo v3 |
| **Q-21 vẫn `unconfirmed`** | tự ý đóng câu hỏi của owner |
| Q-22 không còn ở bảng câu hỏi đang mở | tài liệu mâu thuẫn |

Thêm ở `packages/i18n/tests/wording.test.ts`: test khẳng định `rights.attestation.v2.checkbox` **không
còn tồn tại** ở cả hai locale.

Giữ nguyên và vẫn xanh: đóng băng văn bản v1/v2 · ánh xạ version · v1 `stale` / v2 được nhận · parity
vi-en · không khoá thô · không lệch nội suy · CTA owner duyệt · hộp thoại đủ 3 mục và 4 thông điệp.

**Tổng: 37 tệp / 337 test đạt** (trước Q-22: 36 tệp / 327 test).

Đối chứng âm: **5 phép**, chi tiết ở `TEST_LOG.md` mục "lần 6" §2. Mỗi phép tái tạo đúng lỗi cần chặn,
xác nhận test đỏ, rồi khôi phục và chạy lại toàn bộ cho xanh. Không phép nào được xử lý bằng cách nới
lỏng test.

## 7. Bugs Found and Fixed

**#13 — Test bộ khoá v2 của Phase 1.1 khoá cứng một khoá mà Q-22 phải bỏ.** `wording.test.ts` đòi
`rights.attestation.v2.*` phải có đủ 9 hậu tố, trong đó có `checkbox`. Khi xoá khoá nhãn mơ hồ, test
đỏ. Nguyên nhân: test phát biểu **hiện trạng** của Phase 1.1 như thể nó là bất biến. Cách sửa: bỏ
`checkbox` khỏi danh sách và thêm một test **ngược chiều** đòi khoá đó phải biến mất — để việc xoá là
có chủ đích, không phải sơ suất.

Không có bug sản phẩm nào trong lượt này.

Một ghi chú về thao tác, không phải bug mã: lần chạy build đầu dùng `pnpm build` và trả `254` vì gốc
repo không có script tên đó (`build:web` mới đúng).

## 8. Evidence Status

| Khẳng định | Trạng thái | Bằng chứng |
|---|---|---|
| Nhãn ô tick hiển thị đúng câu canonical | `confirmed` | trình đọc màn hình đọc ra đúng câu, cả 1280×900 và 390×844 |
| Câu được ký xuất hiện đúng 1 lần trong hộp thoại | `confirmed` | đếm trên DOM thật: `1` |
| Văn bản đã ký v1/v2 không đổi | `confirmed` | test đóng băng + đối chứng âm đổi 1 ký tự ⇒ đỏ |
| Không tạo statement v3 | `confirmed` | API công bố `version: 2`; `v3.statement` không tồn tại |
| Ký v1 bị chặn, ký v2 được nhận | `confirmed` | HTTP 403 `MCP_POLICY_RIGHTS_ATTESTATION_STALE` / HTTP 200 |
| Bản ghi lưu đủ version + locale + type | `confirmed` | `statementVersion: 2`, `localeShown: "vi"`, `attestationType: "user_self_declared"` |
| Không có thay đổi API | `confirmed` | `/healthz` vẫn `31` route; không route `DELETE`; migration vẫn `0001`,`0002` |
| Không lỗi console | `confirmed` | desktop và mobile đều không có message `error`/`warn` |
| Không tràn ngang | `confirmed` | 1280: `1280 = 1280` · 390: `390 = 390`, không phần tử nào vượt biên |
| Q-21 vẫn để ngỏ | `confirmed` | `unconfirmed` trong `OPEN_QUESTIONS.md`, có test canh |
| **Bản English của nhãn trên giao diện thật** | **`partially_verified`** | **giao diện chưa có nút đổi ngôn ngữ; bản en chỉ kiểm được ở tầng dữ liệu** |

## 9. Remaining Limits

- Không kiểm được bản **English** bằng mắt: chưa có bộ chuyển ngôn ngữ trên giao diện.
- **Q-21 vẫn để ngỏ**: chữ cuối bản English của câu phạm vi suy ra từ prompt bị cắt ở "identifying ma".
  Q-22 **không** đụng tới khoá đó.
- Phần ngữ cảnh vẫn **không có version**. Nếu sau này owner muốn lưu cả ngữ cảnh làm bằng chứng thì đó
  là một MINI-SPEC mới.
- Runtime vẫn `ephemeral`; hai asset dùng để kiểm chỉ tồn tại trong phiên kiểm.
- Mọi giới hạn Phase 1.1 giữ nguyên: chưa có worker, benchmark provider `unknown`, chưa có provider AI
  production, **không có đường xoá dữ liệu nào**.

## 10. Không làm trong lượt này

Không bắt đầu Phase 2 · không tích hợp provider AI production · không Chrome Extension · không Google
Drive · không billing thật · không chạy dọn dữ liệu · không sửa văn bản đã ký · không tạo statement v3
· không đóng Q-21 · không đổi tiền tố khoá hàng loạt · không push (repo **chưa có remote**).

## 11. Gate Decision

## **READY_FOR_PHASE_2**

Bốn lệnh kiểm chạy riêng, đều thoát `0`. 337/337 test đạt, 5 đối chứng âm xác nhận các chốt mới thật
sự chặn được lỗi. Ký thành công trên trình duyệt thật ở cả hai kích thước, không lỗi console, không
tràn ngang. Bằng chứng của mọi lời khai đã ký còn nguyên và không ai phải ký lại.
