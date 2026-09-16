# PHASE_1_1_Q21_Q22_CLOSURE — MediaClear Pro

Báo cáo closure gộp cho **Q-21** và **Q-22** của Phase 1.1.

| | Q-22 | Q-21 |
|---|---|---|
| MINI-SPEC | `P1.1-Q22-MCP-22` | `P1.1-Q21-MCP-21` |
| Quyết định | `D-035` | `D-034` |
| Commit | `4125966` (2026-09-15) | `0bd8420` (2026-09-16) |
| Báo cáo chi tiết | `docs/PHASE_1_1_Q22_CLOSURE.md` | tài liệu này, §3 |
| Kết quả câu hỏi | **resolved** | **vẫn `unconfirmed`** — đóng *công việc*, không đóng câu hỏi |

- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Gate**: **READY_FOR_PHASE_2** (không đổi) · **Phase 2**: chưa bắt đầu

## 1. Summary

**Q-22** sửa chỗ mơ hồ của ô tick: hộp thoại hiện bốn đoạn văn nhưng ô tick ghi *"xác nhận nội dung
trên"*, trong khi hệ thống chỉ version hoá và chỉ lưu **một câu** làm bằng chứng. Nay nhãn ô tick
**chính là câu được ký**, và câu đó chỉ tồn tại đúng một chỗ trong hộp thoại.

**Q-21** không sửa câu chữ nào. Nó biến trạng thái "bản English chưa được owner duyệt" từ **một dòng
chữ trong tài liệu** thành **ràng buộc máy kiểm được**. Câu hỏi vẫn mở.

Không tạo Rights Attestation v3. `statementVersion` giữ nguyên `2`. Văn bản đã ký v1/v2 không đổi một
ký tự.

## 2. Đánh số ID: bảng đối chiếu cũ ↔ mới

ID hiện tại **khớp đúng** cách đánh số owner chỉ định. Nhưng bốn ID này **đã từng mang số khác** trong
hai commit đầu, nên bảng dưới đây là chỗ tra khi đọc lại hai commit đó:

| | ID trong commit `4125966` / `0bd8420` | ID hiện tại |
|---|---|---|
| MINI-SPEC Q-21 | `P1.1-Q21-MCP-22` | **`P1.1-Q21-MCP-21`** |
| MINI-SPEC Q-22 | `P1.1-Q22-MCP-21` | **`P1.1-Q22-MCP-22`** |
| Quyết định Q-21 | `D-035` | **`D-034`** |
| Quyết định Q-22 | `D-034` | **`D-035`** |

**Vì sao từng khác:** Q-22 hoàn thành trước Q-21 một ngày, nên ban đầu số chạy theo **thứ tự hoàn
thành**. Owner sau đó chỉ định rõ, hai lần, rằng số phải chạy theo **số hiệu câu hỏi**. Quy ước đó nay
được ghi thành **D-036**, cùng với ngoại lệ một lần đối với D-029 (quy tắc "ID ổn định, không đánh số
lại").

**Ngoại lệ này chỉ hợp lệ vì repo chưa có remote và chưa push** — bốn ID cũ chưa bao giờ rời khỏi máy
này. Từ đây về sau, ID đã phát hành **không được đánh số lại**; phải chọn đúng ngay từ đầu.

**Thứ tự trong decision log:** log giữ số tăng dần, nên D-034 (Q-21, **16-09**) đứng trước D-035
(Q-22, **15-09**). Ngày là ngày thật, không sửa cho khớp thứ tự. Thông điệp commit của `4125966` và
`0bd8420` vẫn nhắc ID cũ — git không sửa được, và cũng không nên sửa.

## 3. Q-21 — English Provenance Wording Unconfirmed State

### 3.1 Vấn đề

Prompt owner ở bản vá Q-20 **bị cắt ở "identifying ma"**. Repo giữ đúng chữ owner viết ở phần đọc
được và hoàn thành chữ cuối thành `marks`:

> `policy.visible_identity_scope` (en) = "MediaClear Pro only supports processing visible logos,
> trademarks, and identifying marks"

Chữ `marks` là **suy ra**. Vấn đề thật không phải là đoán nốt câu — mà là: trước lượt này, trạng thái
"chưa được duyệt" chỉ tồn tại dưới dạng **một dòng chữ** trong `OPEN_QUESTIONS.md`. Không có gì ngăn:

1. sửa chuỗi English rồi để Q-21 vẫn `unconfirmed` — chuỗi mới cũng không ai duyệt, nhưng tài liệu
   vẫn mô tả cái cũ ⇒ **hồ sơ nói sai**; hoặc
2. đóng Q-21 thành `confirmed` trong khi chuỗi vẫn là bản agent tự hoàn thành ⇒ **tuyên bố owner đã
   duyệt khi chưa**.

### 3.2 Quyết định (D-034)

Không viết tiếp câu bị cắt. Không đóng Q-21. Thay vào đó dựng **ràng buộc hai chiều**:

> Chuỗi English của `policy.visible_identity_scope` bằng bản-suy-ra **khi và chỉ khi** Q-21 còn
> `unconfirmed`.

Sửa chuỗi mà quên cập nhật Q-21 ⇒ **đỏ**. Đóng Q-21 mà chuỗi không đổi ⇒ **đỏ**. Khi owner gửi bản
đầy đủ, hai việc buộc phải làm cùng lúc.

Phương án bị loại: tự hoàn thiện câu (bịa nội dung pháp lý — prompt owner đã bị cắt tới lần thứ ba) ·
xoá hẳn câu English (người dùng English mất thông tin phạm vi) · chỉ thêm ghi chú (đúng là hiện
trạng, và hiện trạng không chặn được gì) · đánh dấu `confirmed` vì chữ `marks` "gần như chắc chắn
đúng" ("gần như chắc chắn" không phải chữ ký của owner).

### 3.3 Chốt parity bản dịch bổ sung

| Chốt | Bắt lỗi gì | Số liệu hiện tại |
|---|---|---|
| Không giá trị nào trong `en.json` còn dấu tiếng Việt | quên dịch, chép nguyên bản vi | **0** vi phạm |
| Không khoá nào `vi === en` ngoài miễn trừ ghi rõ | chép nguyên bản vi sang en | đúng **1** miễn trừ: `app.name` (tên sản phẩm) |
| Danh sách miễn trừ không chứa khoá đã biến mất | miễn trừ mục nát | sạch |

## 4. Changed Files (lượt Q-21)

| Tệp | Thay đổi |
|---|---|
| `packages/i18n/tests/q21-english-provenance.test.ts` | **mới** — 11 test: ràng buộc hai chiều, điểm bị cắt, chống viết tiếp, trạng thái bằng chứng, 4 chốt parity, 1 chốt không phá Q-22 |
| `docs/mini-specs/phase-1.1/P1.1-Q21-MCP-21.md` | **mới** — MINI-SPEC |
| `docs/DECISIONS.md` | thêm `D-034` |
| `docs/OPEN_QUESTIONS.md` | Q-21 **giữ `unconfirmed`**, ghi rõ chữ cuối là suy ra + tham chiếu D-034 |
| `docs/POLICY.md` | §17 thêm bảng trạng thái bản vi/en và phát biểu ràng buộc hai chiều |
| `docs/MINI_SPEC_INDEX.md` | thêm `P1.1-Q21-MCP-21`; Phase 2 dời sang `P2-MCP-23`; ghi rõ quy ước đánh số theo thứ tự hoàn thành |
| `docs/PHASE_1_1_Q21_Q22_CLOSURE.md` | **mới** — tài liệu này |
| `docs/TEST_LOG.md` | mục "lần 7" |

**Không** đụng: `packages/i18n/src/locales/*.json` · `RightsDialog.tsx` · `packages/contracts/src/policy.ts`
· API · schema · migration.

## 5. Tests

| Bộ | Số test | Ghi chú |
|---|---|---|
| Trước Q-22 (`511498a`) | 327 | |
| Sau Q-22 (`4125966`) | **337** | +10 (9 test `q22-checkbox` + 1 test khoá nhãn cũ đã biến mất) |
| Sau Q-21 (`0bd8420`) | **348** | +11 (`q21-english-provenance`) |

Mốc **327 → 337** mà prompt yêu cầu đối chiếu: **đúng**, đó là phần đóng góp của Q-22. Q-21 cộng
thêm 11 test nữa.

Chỉ số giữ nguyên: **0 khoá dịch thô** · **0 route `DELETE`** · **31 route** · **không migration mới**
· `RIGHTS_STATEMENT.version = 2` · văn bản ký v1/v2 đóng băng.

Đối chứng âm cho các chốt mới: xem `TEST_LOG.md` mục "lần 7" §2.

## 6. Evidence Status

| Khẳng định | Trạng thái | Bằng chứng |
|---|---|---|
| Văn bản đã ký v1/v2 không đổi | `confirmed` | test đóng băng; đối chứng âm đổi 1 ký tự ⇒ đỏ |
| Không tạo statement v3, vẫn `version: 2` | `confirmed` | `/healthz` công bố `2`; `v3.statement` không tồn tại |
| Nhãn ô tick đúng câu được ký | `confirmed` | trình đọc màn hình đọc ra đúng câu, 1280×900 và 390×844 |
| Q-21 vẫn `unconfirmed`, không tự đóng | `confirmed` | ràng buộc hai chiều, có đối chứng âm cả hai chiều |
| Chuỗi English không bị viết tiếp | `confirmed` | test so **độ dài** với bản-suy-ra |
| Parity bản dịch | `confirmed` | 252/252 khoá; 0 rò rỉ tiếng Việt; 1 miễn trừ có lý do |
| Không đổi API | `confirmed` | 31 route, không `DELETE`, migration vẫn `0001`,`0002` |
| Không lỗi console, không tràn ngang | `confirmed` | desktop và mobile |
| **Bản English trên giao diện thật** | **`partially_verified`** | **giao diện chưa có nút đổi ngôn ngữ; bản en chỉ kiểm được ở tầng dữ liệu** |
| Nội dung câu English đúng ý owner | **`unconfirmed`** | prompt owner bị cắt ở "identifying ma" — **chờ owner** |

## 7. Remaining Limits

- **Q-21 vẫn mở.** Lượt này đóng công việc ghi nhận và canh giữ, **không** đóng câu hỏi. Cần owner gửi
  phần sau "identifying ma".
- Giao diện chưa có nút đổi ngôn ngữ ⇒ bản English còn `partially_verified` cho tới khi có.
- Phần ngữ cảnh (phạm vi, cảnh báo) vẫn **không có version** — đúng theo D-035.
- Runtime vẫn `ephemeral`; dữ liệu kiểm live chỉ tồn tại trong phiên kiểm.
- Giới hạn Phase 1.1 giữ nguyên: chưa có worker, benchmark provider `unknown`, chưa có provider AI
  production, **không có đường xoá dữ liệu nào**.

## 8. Không làm trong lượt này

Không bắt đầu Phase 2 · không sửa văn bản đã ký · không tạo v3 · không đoán phần câu English bị cắt ·
không đánh dấu Q-21 đã duyệt · không đánh số lại ID đã phát hành · không đổi API/schema/migration ·
không provider AI production · không Chrome Extension · không Google Drive · không billing thật ·
không push (repo **chưa có remote**).

## 9. Gate Decision

## **READY_FOR_PHASE_2**

Bốn lệnh kiểm chạy riêng, đều thoát `0`. 348/348 test đạt. Đối chứng âm xác nhận các chốt mới thật sự
chặn được lỗi, **cả hai chiều** của ràng buộc Q-21. Ký thành công trên trình duyệt thật ở 1280×900 và
390×844, không lỗi console, không tràn ngang.

Gate giữ nguyên. Q-21 còn mở nhưng **không chặn** Phase 2: nó ảnh hưởng đúng một khoá i18n và nay đã
có chốt canh không cho ai âm thầm đổi hoặc âm thầm đóng.
