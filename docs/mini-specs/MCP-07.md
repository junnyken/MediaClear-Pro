# MCP-07 — Usage Ledger & Cost Measurement Contract

| | |
|---|---|
| **ID** | MCP-07 · **Parent phase** Phase 0 |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: prompt mục J, guardrail 17 (Phase 0 **không** thu tiền thật).
- Trạng thái: chưa có billing, credit hay telemetry nào.

## Goal
Đo mức dùng theo ảnh và phút video, tránh double charge, và ghi nhận chi phí provider — mà không
thu một đồng nào trong Phase 0.

## Constraints
1. Không triển khai thanh toán thật; chỉ contract + sổ ghi.
2. Một `jobId` chỉ được **một** entry `commit`.
3. Provider lỗi → `release`, không tính như thành công.
4. Không biết thời lượng → không tính, trả `MCP_USAGE_QUANTITY_UNKNOWN`.
5. Preview không tính phí.
6. Chi phí nội bộ (`ProviderRun.actualCostUsd`) tách khỏi mức dùng của khách.

## Scope
- **A. Domain model**: `UsageLedgerEntry` (`reserve`/`commit`/`release`), `UnitType`, `ReleaseReason`.
- **B. Services/engine**: `computeUsageQuantity()`, `canCommitUsage()`, `usageOutcomeForJobState()`.
- **C. API contract**: `POST /v1/jobs/:jobId/estimate`, `GET /v1/workspaces/:id/usage` (`planned`).
- **D. UI surfaces**: màn "Mức dùng và hạn mức"; ước tính trước khi chạy; nhãn "Xem thử không tính
  vào mức dùng".
- **E. Tests**: 8 test usage + regression I-6, I-7.

## Audit Before Build
- Đã kiểm: không có ledger, không có telemetry, không có khái niệm credit.
- Gap **state machine**: phải gắn thời điểm reserve/commit/release vào đúng transition, nếu không sẽ
  có job tính phí hai lần hoặc không tính lần nào.
- Gap **vocabulary**: cần phân biệt `provider_error` với `user_error` trong `reasonCode`, nếu không
  sau này không phân tích được chi phí hỏng do ai.

## Design Choice
Sổ ghi kiểu **reserve → commit/release** thay vì trừ thẳng credit: giữ được dấu vết cả những lần
không thu tiền (provider lỗi), phục vụ benchmark. Chống double charge bằng ràng buộc dữ liệu (một
`commit` mỗi `jobId`, đã `release` thì không commit lại) chứ không bằng cờ trong service — retry
dùng lại `jobId` nên tự động không sinh lần tính phí thứ hai. Định nghĩa đơn vị:
`image_unit` = 1 job ảnh **được chấp nhận**; `video_minute_unit` = `ceil(duration/60)` của video
**được chấp nhận** (D-009).

## Test Plan
- **Unit**: ảnh = 1; video 1/59/60/61/599 giây → 1/1/1/2/10; duration `null` → unknown;
  preview không tính phí.
- **Regression**: commit không reserve → từ chối; commit lần hai → `MCP_USAGE_DOUBLE_COMMIT`;
  đã release → không commit; provider lỗi → `release`.
- **Integration**: `planned` — cần DB để kiểm ràng buộc unique thật.
- **Live**: `planned`.

## Success Criteria
1. Không tồn tại đường nào tạo hai `commit` cho cùng một job.
2. Job không `completed` thì không bao giờ `commit`.
3. Không có số tiền nào được ghi khi provider không trả chi phí thật.

## Remaining Limits
- Chưa có bảng giá (Q-10) → `estimatedCostUsd` luôn `null` hôm nay.
- Chưa có ràng buộc unique ở DB (chưa có DB).
- Chưa quyết: job `review_required` mà người dùng bỏ giữa chừng thì tính hay không — `unknown`.

---

## Amendment 2026-09-15 — Owner decision Q-10

**Vòng đời chốt**: `accepted job submission → reserve usage → provider processing → verified output
→ commit usage`. Thất bại (provider hoặc validation do người dùng) → `release` theo error policy.

**Thêm**:
- `canReserveUsage()` — mỗi `jobId` chỉ được reserve **một lần**; lần hai trả
  `MCP_USAGE_RESERVATION_CONFLICT`.
- `usageEffectOfError(code)` — lấy `releasesReservation` / `retryAllowed` từ `ERROR_CATALOGUE`,
  không hard-code rải rác (D-021).
- `PREVIEW_IS_BILLABLE` chuyển về `config.ts` để chỉ có một nguồn sự thật.

**Preview** (D-022): `planPreview()` trả `billable: false` và **ngân sách provider job**: 0 cho thao
tác deterministic, tối đa 1 cho thao tác cần AI — chặn kịch bản preview đốt nhiều provider job.

**Đã có sẵn, không đổi**: `ceil(duration/60)` cho video, một `commit` mỗi `jobId`, job fail trước
provider thì không có reserve nên không commit được.

**Test**: `usage.test.ts` (10), `preview.test.ts` (4), và luồng đầy đủ trong
`integration-pipeline.test.ts`.
