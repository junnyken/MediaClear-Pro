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
