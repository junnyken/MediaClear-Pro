# MCP-02 — Rights Guard & Processing Policy Gate

| | |
|---|---|
| **ID** | MCP-02 · **Parent phase** Phase 0 |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: `POLICY.md`, `MCP-01`, guardrails 1/2/5/11 của prompt.
- Trạng thái: chưa có bất kỳ cơ chế quyền nào trong repo (`MCP-00`).
- Quyết định giữ nguyên: xác nhận quyền là **lời khai của người dùng**, không phải bằng chứng sở hữu.

## Goal
Không cho workflow xử lý đi qua nếu quyền sử dụng chưa được xác nhận hoặc policy status là
`blocked`.

## Constraints
1. Không có đường tắt bypass gate, kể cả cho admin.
2. Mọi lần đánh giá đều sinh audit event — cả `allow` lẫn `block`.
3. Không suy ra quyền từ lần xác nhận của asset khác.
4. Yêu cầu xoá provenance → luôn `block` (guardrail 7).
5. Thiếu bằng chứng (attestation không đọc được, ngày giờ không hợp lệ) → `block`, không cho qua.
6. `auditDetail` không chứa PII, media bytes hay API key.

## Scope
- **A. Domain model**: `RightsAttestation`, `AuditEvent`.
- **B. Services/engine**: `evaluateProcessingPolicy()` — pure function, nhận cả `now` để test được.
- **C. API contract**: `POST /v1/assets/:assetId/attestations`, `POST /v1/jobs` (planned),
  `GET /v1/workspaces/:workspaceId/audit-events` (planned).
- **D. UI surfaces**: màn "Xác nhận quyền sử dụng" hiển thị đúng câu statement theo locale + ghi
  `statementVersion` đã hiển thị.
- **E. Tests**: 9 test policy + 1 regression I-3.

## Audit Before Build
- Đã kiểm: không có permission framework, không có audit table, không có khái niệm tenant.
- Gap **data & permission**: cần `workspaceId` trên mọi entity và một chỗ duy nhất quyết định
  allow/block.
- Gap **UX wording**: câu xác nhận phải tránh gợi ý "xoá logo của người khác" — đã viết theo hướng
  "sở hữu hoặc có quyền chỉnh sửa" + "chịu trách nhiệm về việc sử dụng kết quả".

## Design Choice
Một hàm thuần duy nhất trả về `{ decision, errors[], auditEventType, auditDetail }`. Không nhúng
quyết định policy vào route handler hay worker — để chỉ có **một** chỗ có thể nói "allow".
Attestation ở scope `asset` (D-006) và hết hiệu lực sau 365 ngày hoặc khi đổi `statementVersion`
(D-015). `blocked` là terminal (D-005).

## Test Plan
- **Unit**: allow hợp lệ; thiếu attestation; attestation của asset khác; quá hạn; statement cũ;
  xin xoá provenance; cross-tenant; media không hợp lệ; audit detail sạch.
- **Regression**: `canSubmitProviderJob('blocked') === false` (I-3).
- **Integration**: `planned` — cần DB.
- **Live**: `planned`.

## Success Criteria
1. Không có đường nào tạo `ProcessingJob` ở `queued` mà không đi qua `evaluateProcessingPolicy`.
2. Mọi quyết định block đều có mã lý do và audit event.
3. Không có field nào trong contract mang nghĩa "đã xác minh quyền sở hữu".

## Remaining Limits
- Chưa thi hành runtime (route còn 501).
- Quy trình report/abuse: `unknown` (Q-05). Câu chữ pháp lý chưa được duyệt (Q-11).

---

## Amendment 2026-09-15 — Owner decisions (Q-04, Q-08, Q-09)

**Thứ tự gate đổi**: nay kiểm tra **tenancy + role trước** (`authorize()` của MCP-09), rồi mới tới
attestation → media. Viewer và user ngoài workspace bị chặn trước khi hệ thống đọc attestation.

**Attestation** (Q-09): gắn với **cả** `assetId` và `sourceFileId` (source file mới ⇒ xác nhận lại);
thêm `status: 'active' | 'blocked'` cho trường hợp asset bị report; tách `EXPIRED` (quá 365 ngày)
khỏi `STALE` (đổi `statementVersion`).

**Block reason kind** (Q-08): mọi quyết định block nay trả `blockReasonKind` suy từ category của mã
lỗi — `policy_block` / `validation_block` / `provider_block`.

**Chống rò rỉ existence** (Q-04): `PolicyDecision.revealsResourceExistence`; khi từ chối
cross-workspace thì `auditDetail.assetId = null` và HTTP là **404**.

**Test**: `policy.test.ts` 13 test (thêm biên 365/366 ngày, attestation blocked, viewer, cross-tenant
không lộ existence); invariant I-5 khẳng định **không role nào** được miễn attestation.
