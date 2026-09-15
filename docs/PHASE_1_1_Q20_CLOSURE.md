# PHASE_1_1_Q20_CLOSURE — MediaClear Pro

- **Date**: 2026-09-15 · **Author**: Nguyễn Thiên Triều (trieunt@matbao.com)
- **Repository**: `/home/coder/workspace/projects/Tool MediaClear Pro`
- **Baseline giữ nguyên**: `cd15e2b`, `f427efc` (Phase 0), `4572cbd` (Phase 1), `5d491e3` (Phase 1.1)
- **MINI-SPEC**: `P1.1-Q20-MCP-20` · **Quyết định**: `D-033`

---

## 1. Summary

Bản vá đóng đúng Q-20: áp bộ câu chữ canonical owner duyệt, dựng lại hộp thoại xác nhận quyền theo
cấu trúc ba mục, và chốt rõ **cái gì là bằng chứng, cái gì là ngữ cảnh**. Audit cho thấy câu phạm vi
tiếng Việt và câu xác nhận quyền **đã khớp từng chữ** từ Phase 1.1, nên thay đổi thật nằm ở bản
English, câu về dữ liệu còn sót trong tệp, và cách sắp xếp hiển thị. **Không tạo phiên bản tuyên bố
mới** và **không sửa một chữ nào** của văn bản đã phát hành. 327/327 test xanh; gate giữ nguyên.

---

## 2. Audit Before Build

**Tài liệu đã đọc**: `MINI_SPEC_PLAYBOOK.md` (bản v2 owner gửi kèm hội thoại) ·
`docs/PHASE_0_GATE_CLOSURE_REPORT.md` · `docs/PHASE_1_REPORT.md` · `docs/PHASE_1_1_REPORT.md` ·
`docs/OPEN_QUESTIONS.md` · `docs/DECISIONS.md` · `docs/POLICY.md` · `docs/API.md` ·
`docs/DATA_MODEL.md` · `docs/UX_FOUNDATION.md` · `docs/TEST_LOG.md` · `docs/MINI_SPEC_INDEX.md` ·
`docs/mini-specs/phase-1/MCP-13.md` (Rights Attestation) · `packages/i18n/src/locales/{vi,en}.json` ·
`apps/web/app/_components/RightsDialog.tsx`.

### Wording references đã kiểm tra

| Quét | Kết quả |
|---|---|
| `watermark` trong text người dùng | **1 khoá** — `provenance.invisible_watermark_disclaimer`, bản Phase 1, **giao diện không còn gọi**; giữ làm lịch sử |
| `logo` / `nhãn hiệu` / trademark | 4 khoá, đều đúng ngữ cảnh, không khoá nào hứa hẹn quá mức |
| `provenance` / nguồn gốc | 12 khoá |
| Nhóm từ khoá về dấu hiệu không nhìn thấy được | 2 khoá |
| Rights Attestation text | 26 khoá (10 của v1, 9 của v2, còn lại là provenance) |
| CTA chính | **không CTA nào** chứa cách nói bị cấm |
| Giá trị trông như khoá thô | **không có** |
| Lệch nội suy vi ↔ en | **không có** |
| parity | 250/250 trước bản vá |

### Translation keys đã kiểm tra

Ba trong năm khoá prompt gợi ý **đã có sẵn** trong repo dưới tên khác ⇒ dùng lại, không tạo khoá
trùng nghĩa. Bảng ánh xạ đầy đủ ở `POLICY.md` §18.

### Statement version behavior đã kiểm tra

| Điểm | Kết quả |
|---|---|
| `RIGHTS_STATEMENT` | `id = rights_attestation`, `version = 2`, `i18nKey = rights.attestation.v2.statement` |
| Cổng stale | `statementVersion < RIGHTS_STATEMENT.version` ⇒ v1 là stale |
| Fixture trong test | đọc từ `RIGHTS_STATEMENT.version`, **không** hard-code số (trừ hai test cố ý gửi bản cũ) |
| Hồ sơ lịch sử | append-only, không có đường nào ghi đè |
| Cơ chế stale | đã chạy thật ở Phase 1.1 |

### UI dialog/CTA đã kiểm tra

Hộp thoại đang render **phẳng** — chưa có mục "Phạm vi hỗ trợ" và nhãn "Phiên bản tuyên bố" mà prompt
§7.3 yêu cầu. Không có khoá thô (đã có chốt chặn từ Phase 1.1).

---

## 3. Design Choice

**Canonical wording** — câu tiếng Việt giữ nguyên vì đã khớp từng chữ. Bản English dùng đúng từ ngữ
owner ở phần đọc được (`trademarks`, `identifying ma…`); chữ cuối hoàn thành là `marks` vì tiếng Việt
canonical là "dấu hiệu nhận diện", và đánh dấu `unconfirmed` (Q-21) thay vì im lặng chọn. Câu thứ hai
của tooltip trong prompt **bị cắt giữa chừng** ⇒ chỉ lấy câu đầu (đọc được trọn vẹn), **không viết tiếp**.

**Version preservation** — không tạo v3. Văn bản được ký không đổi; các đoạn phạm vi/cảnh báo là ngữ
cảnh hiển thị kèm. Tạo phiên bản mới cho một thay đổi không chạm văn bản ký sẽ buộc mọi người dùng
đã ký phải ký lại mà không bảo vệ thêm được gì. Thêm **test đóng băng** hai văn bản v1/v2.

**Translation key reuse/new key** — dùng lại ba khoá sẵn có; chỉ thêm ba khoá mới (`scope_heading`,
`statement_version_label`, `retained_data_note`). Khoá mới **không gắn version** vì là nhãn giao diện —
sửa đúng điểm yếu đã ghi ở báo cáo Phase 1.1. **Không** đổi tên hàng loạt bộ khoá v2 (prompt cảnh báo
đúng rủi ro này, và Phase 1.1 đã trả giá một lần khi đổi tiền tố hàng loạt làm lộ khoá thô).

**UI placement** — ba mục: Phạm vi hỗ trợ → Xác nhận quyền sử dụng (kèm ô tick) → Phiên bản tuyên bố.
Vẫn giữ đủ bốn thông điệp bắt buộc của Phase 1; hai mục có tiêu đề gắn nhãn cho trình đọc màn hình.

---

## 4. Changed Files

- **Domain/service**: *không đổi*. `RIGHTS_STATEMENT` giữ nguyên v2; không service mới.
- **API**: *không đổi*. Bảng route vẫn 31 (25 implemented · 3 planned · 1 dev_only · 2 internal).
- **UI**: `apps/web/app/_components/RightsDialog.tsx` — dựng lại theo ba mục.
- **i18n**: `vi.json`, `en.json` — 250 → **253 khoá**; thêm `rights.attestation.scope_heading`,
  `rights.attestation.statement_version_label`, `provenance.retained_data_note`; cập nhật bản English
  của `policy.visible_identity_scope`. **Không đụng** `rights.attestation.v1.statement` và
  `rights.attestation.v2.statement`.
- **Tests**: mới — `packages/i18n/tests/q20-wording.test.ts`,
  `apps/api/tests/phase11-q20-statement.test.ts`, `apps/web/tests/q20-dialog.test.ts`;
  sửa — `packages/contracts/tests/mini-spec-index.test.ts` (nhận dạng ID `P1.1-Q20-MCP-20`).
- **Docs**: `MINI_SPEC_INDEX.md`, `POLICY.md` (§16–§19), `OPEN_QUESTIONS.md`, `DECISIONS.md`,
  `TEST_LOG.md`, `PHASE_1_REPORT`/`PHASE_1_1_REPORT` (trỏ dẫn), MINI-SPEC `P1.1-Q20-MCP-20`,
  và tài liệu này.

`API.md` và `DATA_MODEL.md` **không sửa**: contract phiên bản tuyên bố không thay đổi, không có
trường dữ liệu nào thêm bớt.

---

## 5. New/Updated Contract

- **Wording key**: 3 khoá mới (nhãn giao diện, không gắn version) + 1 khoá English cập nhật.
  Bảng ánh xạ sang ngữ nghĩa prompt gợi ý ở `POLICY.md` §18.
- **Statement version behavior**: **không đổi**. v2 là bản hiệu lực; v1 là stale cho lời khai mới
  nhưng **vẫn đọc được** cho hồ sơ lịch sử.
- **Error/state changes**: **không có**.

---

## 6. Tests

| Check | Result | Notes |
|---|---|---|
| Typecheck | **exit 0** | chạy riêng |
| Lint | **exit 0** | chạy riêng |
| Tests | **327/327 pass**, 36 tệp, 0 fail, 0 skip | Phase 1.1: 299 ⇒ **+28** |
| Build | **exit 0** | `dist` gói i18n đồng bộ `src` (253/253); bundle chứa câu canonical |
| Live verification | **đạt** (giao diện: `partially_verified` — chưa có bộ chuyển ngôn ngữ) | chi tiết `TEST_LOG.md` mục 3–4 |

Đối chứng âm đã chạy: sửa văn bản tuyên bố v2 ⇒ 3 test đỏ; khôi phục ⇒ xanh lại.

---

## 7. Bugs Found and Fixed

**#12 — Test index MINI-SPEC phát biểu sai ý định của chính nó.**
*Reproduction*: thêm hàng `P1.1-Q20-MCP-20` với phase "Phase 1.1 (Q-20 closure)" ⇒ test
"historical ID không bị xoá" đỏ.
*Root cause*: điều kiện lọc bám vào chuỗi phase (`!== 'Phase 1.1'`) thay vì bám vào ý định
"hàng nào phải có ID lịch sử".
*Fix*: lọc theo `phase.startsWith('Phase 1.1')`, thêm khẳng định số hàng cũ tối thiểu.
*Regression test*: chính test đó, nay phát biểu đúng ý định.

Không có bug sản phẩm nào trong lượt này.

---

## 8. Evidence Status

| Hạng mục | Trạng thái |
|---|---|
| Câu phạm vi tiếng Việt khớp từng chữ | **verified** |
| Câu xác nhận quyền khớp từng chữ | **verified** |
| Văn bản v1/v2 không bị sửa | **verified** — test đóng băng, có đối chứng âm |
| v1 là stale, v2 được chấp nhận | **verified** — kiểm trên server thật |
| Hồ sơ lịch sử không bị tự cập nhật | **verified** |
| Hộp thoại đúng cấu trúc ba mục, không khoá thô, CTA đúng | **verified** — đọc trên trình duyệt thật |
| Không tràn/cắt chữ ở khổ điện thoại 390×844 | **verified** — đo 12 phần tử, 0 vi phạm |
| Không có lỗi console | **verified** |
| Bản English tương đương | **partially_verified** — đúng ở tầng dữ liệu; giao diện **chưa có bộ chuyển ngôn ngữ** nên chưa đọc được bằng mắt |
| Chữ cuối bản English (`marks`) | **unconfirmed** — suy ra từ bản prompt bị cắt (Q-21) |
| Câu thứ hai của tooltip trong prompt | **unknown** — không đọc được, **không viết tiếp** |
| Có nên version hoá phần ngữ cảnh | **unconfirmed** — Q-22 |
| Provider benchmark | **unknown** — không đổi |
| Dọn dữ liệu thật theo luật lưu giữ | **unconfirmed** — không đổi, vẫn không có đường xoá |

---

## 9. Remaining Limits

- **Runtime vẫn `ephemeral`** — không đổi trong lượt này.
- **Provider benchmark vẫn `unknown`** — chưa chạy lần nào.
- **Không có xử lý AI production** — không job nào đạt `completed`.
- **Không có dọn dữ liệu huỷ hoại** — vẫn chỉ có bản thử chỉ đếm, không route `DELETE`.
- Chưa có worker hoàn trả khoản giữ và worker lưu giữ.
- Giao diện chưa có bộ chuyển ngôn ngữ ⇒ bản English chưa kiểm được bằng mắt.
- Q-21 và Q-22 còn chờ owner.
- **Phase 2 chưa bắt đầu.**

---

## 10. Gate Decision

## **READY_FOR_PHASE_2**

| Điều kiện | Kết quả |
|---|---|
| Q-20 được đánh dấu resolved | ✅ `OPEN_QUESTIONS.md` mục "Đã giải quyết", kèm D-033 |
| Câu canonical tiếng Việt dùng đúng nguyên văn | ✅ test khớp từng chữ |
| Bản English có parity | ✅ 253/253, không lệch nội suy |
| Phiên bản tuyên bố được giữ | ✅ vẫn v2; văn bản v1/v2 đóng băng, có đối chứng âm |
| Không còn khoá thô ở hộp thoại | ✅ kiểm bằng test và bằng mắt trên trình duyệt |
| CTA không chứa cách nói bị cấm | ✅ kiểm ở cả vi và en |
| Typecheck, lint, test, build đạt | ✅ exit 0 cả bốn; 327/327 |
| Không route mới ngoài phạm vi, không thêm đường xoá | ✅ bảng route vẫn 31, không method `DELETE` |
| Invariant Phase 0 và hồi quy Phase 1/1.1 | ✅ toàn bộ vẫn xanh |

Bản vá chỉ chạm câu chữ và cách sắp xếp hiển thị; không hạ bất kỳ bảo đảm nào. Gate giữ nguyên.

**Agent dừng tại đây, không bắt đầu Phase 2.**
