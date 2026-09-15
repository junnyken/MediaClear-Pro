# MCP-08 — Phase 0 Verification Gate

| | |
|---|---|
| **ID** | MCP-08 · **Parent phase** Phase 0 |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: toàn bộ MCP-00..07, `TEST_STRATEGY.md`, `TEST_LOG.md`, `OPEN_QUESTIONS.md`.
- Trạng thái: contract + skeleton + docs đã xong; chưa có nghiệp vụ nào chạy thật.

## Goal
Đảm bảo docs, contracts, tests, build/lint và decision log hoàn thành **trước khi** cho phép
Phase 1 — và nói đúng mức độ sẵn sàng, không tô hồng.

## Constraints
1. Không chọn `READY_FOR_PHASE_1` nếu còn lỗi build/typecheck hoặc thiếu policy/contract quan trọng.
2. Không đếm test chưa chạy như đã chạy.
3. Không ghi vào báo cáo thứ chưa thực sự tồn tại trong repo.
4. Không tự động bắt đầu Phase 1.

## Scope
- **A. Domain model**: `INVARIANTS` registry — 8 invariant.
- **B. Services/engine**: không thêm.
- **C. API contract**: không thêm.
- **D. UI surfaces**: không thêm.
- **E. Tests**: `invariants.test.ts` (9) + `docs-consistency.test.ts` (6).

## Audit Before Build
- Đã kiểm: 10 file test, 4 lệnh kiểm tra (typecheck/lint/test/build), 13 tài liệu + 9 MINI-SPEC.
- Gap **observability của chính quy trình**: nếu invariant chỉ nằm trong tài liệu thì không ai biết
  khi nó bị vi phạm → phải đưa vào code (`INVARIANTS`) và test.
- Gap **docs↔code**: tài liệu dễ trôi khỏi code → phải có test đối chiếu route/state/invariant.

## Design Choice
Biến "phase gate" thành test chạy được thay vì checklist đọc bằng mắt:
`docs-consistency.test.ts` đối chiếu `API_ROUTES` ↔ `API.md`, `INVARIANTS` ↔ `TEST_STRATEGY.md`,
`JOB_STATES` ↔ `DATA_MODEL.md`, chặn câu khẳng định về watermark vô hình, và chặn số liệu bịa trong
bảng benchmark (mọi ô phải là `unknown` hoặc `—`).

## Test Plan
- **Unit/Regression**: 8 invariant.
- **Docs consistency**: 6 kiểm tra nêu trên.
- **Build/lint/typecheck**: chạy thật, kết quả trong `TEST_LOG.md`.
- **Live**: API `/healthz` + 10 màn web — đã chạy thật.

## Live Verification
Đã thực hiện, xem `TEST_LOG.md` §2 và §3. Kết quả đúng kỳ vọng: route nghiệp vụ trả 501 thay vì
giả vờ thành công; 10 màn hiển thị tiếng Việt và tự khai là khung thiết kế.

## Success Criteria
1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build:web` đều exit 0. — **đạt**
2. Mọi invariant có test tương ứng. — **đạt** (8/8)
3. Tài liệu không mâu thuẫn với code (test tự động). — **đạt**
4. Mọi mục thiếu bằng chứng đều nằm trong `OPEN_QUESTIONS.md`. — **đạt** (12 câu hỏi)
5. Phase gate nêu rõ READY / READY_WITH_BLOCKERS / NOT_READY. — xem `PHASE_0_REPORT.md`

## Remaining Limits
- Bộ kiểm tra hiện chỉ chứng minh **contract** đúng, chưa chứng minh **pipeline** đúng — vì chưa có
  pipeline.
- Không có integration/DB/E2E/live-media test (lý do ghi trong `TEST_STRATEGY.md` §5).

---

## Amendment 2026-09-15 — Re-run gate sau owner decisions

**Bối cảnh**: Phase 0 đóng ở `READY_WITH_BLOCKERS` với 7 câu hỏi chặn. Owner đã quyết cả 7
(Q-01, Q-03, Q-04, Q-06, Q-08, Q-09, Q-10). MINI-SPEC này chạy lại để xác minh gate.

**Invariant mở rộng 8 → 12** theo danh sách owner: thêm I-4 (`blocked` không quay lại
`processing`), I-5 (attestation không suy diễn từ membership), I-6 (viewer không tạo job), I-10
(không lộ existence ngoài workspace), I-11 (hai namespace `blocked`), I-12 (preview không tính phí).
Invariant cũ "attestation chỉ là lời khai, không phải bằng chứng sở hữu" **không bị bỏ**: nó nằm
trong test của I-5 (khẳng định contract không có field kiểu `ownershipVerified` và không role nào
được miễn attestation) và trong `POLICY.md` §4.

**Docs consistency mở rộng**: thêm 4 kiểm tra — mọi mã lỗi phải có trong bảng mapping của `API.md`;
mọi role phải có trong `POLICY.md`; các con số giới hạn trong `PRODUCT_SCOPE.md` phải khớp
`config.ts`; và **không câu hỏi nào vừa "đang mở" vừa "đã giải quyết"** trong `OPEN_QUESTIONS.md`.

**Kết quả chạy lại** (chi tiết trong `TEST_LOG.md` §lần 2): typecheck 0 · lint 0 · test **136/136** ·
build 0 · live API + web đạt · không có secret nào trong repo (đã quét).

**Success Criteria — đánh giá lại**
1. Bốn lệnh kiểm tra đều exit 0 — **đạt**.
2. Mọi invariant có test tương ứng (12/12) — **đạt**.
3. Tài liệu không mâu thuẫn với code (10 kiểm tra tự động) — **đạt**.
4. Mọi mục thiếu bằng chứng nằm trong `OPEN_QUESTIONS.md`, không trùng trạng thái — **đạt**.
5. Phase gate nêu rõ quyết định — **đạt**, xem `PHASE_0_GATE_CLOSURE_REPORT.md`.

**Remaining Limits**: bộ kiểm tra vẫn chỉ chứng minh **contract** đúng, chưa chứng minh **pipeline**
đúng — vì Phase 0 cố ý chưa có pipeline, chưa có DB, chưa có provider thật.
