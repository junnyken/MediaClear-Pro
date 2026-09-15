# MCP-14 — Processing Job Creation Boundary (Phase 1)

- **ID**: `MCP-14` · **Parent phase**: Phase 1 — SaaS Shell & Media Intake Foundation
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-15

## Context

Đọc: như `MCP-10` (Phase 1) + `docs/mini-specs/MCP-02.md`, `MCP-04.md`, `MCP-07.md` (Phase 0).
Trạng thái: `job-state-machine.ts` (ALLOWED_TRANSITIONS, guard `completed`, `blocked` terminal,
`assertCanSubmitProviderJob`), `policy.ts`, `usage.ts` (`canReserveUsage`, `canCommitUsage`,
`computeUsageQuantity`, `usageEffectOfError`), `provider.ts` (registry + `capabilityEvidence` +
`DETERMINISTIC_FALLBACK_OPERATIONS`) **đều đã có và đã test**. Không có provider production nào.

Quyết định phải giữ: `blocked` là terminal (D-005/Q-08) — gỡ block = job mới; `completed` chỉ khi có
output đã verified (I-2); Phase 1 **không có** output verified nên **không job nào được `completed`**.

## Goal

Cho phép tạo processing job thật từ asset hợp lệ, đi qua đủ bốn cổng (quyền → validation → attestation →
provider capability) và dừng lại ở trạng thái trung thực, tuyệt đối không hiển thị kết quả xử lý giả.

## Constraints (Guardrails)

1. Không job nào được vào `completed` trong Phase 1 (không có output verified).
2. `blocked` terminal: không có đường nào đưa job từ `blocked` về `processing`/`completed`.
3. Gỡ nguyên nhân chặn ⇒ tạo job **mới** với id mới; job cũ giữ nguyên state + audit.
4. Validation phải chạy trước; asset chưa qua validate ⇒ `validation_block`.
5. Reserve usage đúng **một lần**/job; retry cùng `idempotencyKey` ⇒ trả job cũ, không reserve lần hai.
6. Provider thất bại/không có ⇒ không bao giờ map thành success (I-7).
7. Capability chưa có bằng chứng ⇒ `unknown`; provider có nhưng không hỗ trợ operation ⇒ `blocked`.
8. Không commit usage khi chưa có output verified.
9. Mọi nhánh (allow/block) đều sinh audit event.

## Scope

**A. Domain model** — tái dùng `ProcessingJob` (đã có `idempotencyKey`, `reasonCode`,
`blockReasonKind`, `attemptCount`), `UsageLedgerEntry`, `ProviderRun`.

**B. Services/engine** — `JobService.create()` thực thi chuỗi cổng; `JobService.cancel()` (release);
gắn `ProviderRegistry` (Phase 1 chỉ đăng ký `NoopContractProvider`, `isProductionProvider=false`).

**C. API contract** — `POST /v1/assets/:assetId/jobs`, `GET /v1/jobs/:jobId`,
`POST /v1/jobs/:jobId/cancel`, `GET /v1/usage`.

**D. UI surfaces** — Create job review (hiện rõ 4 cổng và giới hạn), Job status detail (trạng thái thật
+ thông điệp "đã tiếp nhận / chưa bật xử lý AI production / không hiển thị kết quả giả"),
Error & blocked state (nói rõ lý do + hành động tiếp theo + nút tạo job mới sau khi gỡ).

**E. Tests** — unit (thứ tự cổng, idempotency, ánh xạ reason code), integration (viewer bị chặn,
thiếu attestation bị chặn, job hợp lệ ra `queued`), regression (I-2, I-3, I-4, I-6, I-7, I-8).

## Audit Before Build

| Đã kiểm | Kết luận |
|---|---|
| `canTransition` / `assertCanSubmitProviderJob` | Đủ chặt, có guard `completed`. **Không sửa.** |
| `evaluateProcessingPolicy` | Đã gộp tenancy + attestation + mediaValid. Dùng làm cổng 1+3. |
| `canReserveUsage` / `canCommitUsage` | Đã chặn double-reserve và double-commit. Dùng lại. |
| `ProviderRegistry.findCapable` | Trả rỗng cả khi "chưa biết" lẫn "không hỗ trợ" → cần phân biệt ở tầng service. |
| `NoopContractProvider` | `getStatus()` trả `failed` + `MCP_PROVIDER_NOT_PRODUCTION`. Đúng tinh thần. |

**Gap** (state machine): chưa có service nào chạy chuỗi cổng.
**Gap** (vocabulary): cần phân biệt "chưa có provider nào" (⇒ `unknown`, job vẫn `queued`) với
"có provider production nhưng không hỗ trợ operation" (⇒ `provider_block`).

## Design Choice

`JobService.create()` là **một** hàm chạy tuần tự 5 bước có thứ tự cố định:
idempotency → quyền+attestation+validation (`evaluateProcessingPolicy`) → validation record →
provider capability → reserve usage → tạo job ở `queued`. Lý do: một chỗ duy nhất quyết định, thứ tự
kiểm là một phần của contract (quyền trước để không lộ existence), và mỗi bước trả về `ApiError` của
Phase 0 nên HTTP status/retry/release tự suy ra từ catalogue. Bỏ hướng "middleware chain" vì làm thứ
tự cổng ẩn đi và khó test là cổng nào chặn.

Phase 1 **không** đăng ký provider production nào: job hợp lệ dừng ở `queued`, `providerCapability`
báo `unknown`, và API/UI nói thẳng là chưa bật xử lý AI production.

## Test Plan

- Unit: mọi thứ tự chặn; reserve đúng 1 lần; `usageOutcomeForJobState`.
- Integration: viewer 403 · thiếu attestation 403 + không có job nào được tạo · asset invalid bị chặn ·
  job hợp lệ ⇒ `queued` · submit lại cùng idempotencyKey ⇒ cùng `jobId`, ledger không tăng ·
  cancel ⇒ release · không route nào trả `completed`.
- Regression: I-2, I-3, I-4, I-6, I-7, I-8 + R-8 (no-op provider không sinh output verified giả).
- Live: tạo job thật qua HTTP, đọc lại `GET /v1/jobs/:id` và `GET /v1/usage`.

## Success Criteria

- Job không tạo được khi policy/media/permission fail.
- Job hợp lệ tạo được với trạng thái trung thực (`queued`, không phải "thành công").
- `blocked` terminal có test; retry không double-charge; không có output giả.

## Remaining Limits / Follow-ups

- Không có queue runtime (Q-02) — job nằm `queued` cho đến khi Phase sau có worker.
- Reservation của job `queued` ở lại trạng thái "đã giữ, chưa tính" — đúng contract, nhưng cần dọn khi
  Phase 2 có worker.
- Không gọi provider AI production (Q-06/Q-07 chưa có evidence).
