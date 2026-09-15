# MCP-09 — Tenancy & Role Permission Contract

| | |
|---|---|
| **ID** | MCP-09 · **Parent phase** Phase 0 (gate closure) |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: `POLICY.md` §2, owner decision Q-04, `MCP-02`, `MCP-00` (audit gốc).
- Trạng thái trước khi làm: entity đã có `workspaceId` nhưng **không có role, không có ma trận
  quyền, không có nơi nào quyết định allow/deny theo vai trò**.
- Quyết định phải giữ: chỉ xử lý nội dung người dùng có quyền; không có đường tắt bypass gate.

## Goal
Không một user nào chạm được vào tài nguyên ngoài workspace của mình, và không vai trò nào làm được
việc vượt quá thứ owner đã cho phép.

## Constraints
1. Ma trận quyền liệt kê **tường minh**; cấm suy diễn theo thứ hạng role.
2. Kiểm tra workspace **trước** kiểm tra role.
3. Từ chối cross-workspace không được tiết lộ tài nguyên có tồn tại hay không.
4. Mọi quyết định authorization đều sinh audit event.
5. Không triển khai billing thật; `billing.manage` chỉ là quyền trong ma trận.
6. Auth provider cụ thể được phép để ngỏ, nhưng **domain permission contract phải chốt**.

## Scope
- **A. Domain model**: `WorkspaceRole`, `Permission`, entity `WorkspaceMembership`.
- **B. Services/engine**: `roleHasPermission()`, `permissionsForRole()`, `authorize()`.
- **C. API contract**: mã lỗi `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` (404) và
  `MCP_AUTHZ_INSUFFICIENT_ROLE` (403) trong `API.md`.
- **D. UI surfaces**: nhãn `role.*`, ẩn hành động mà vai trò không có quyền.
- **E. Tests**: `tenancy.test.ts` (9) + phần tenancy trong `policy`, `invariants`,
  `integration-pipeline`.

## Audit Before Build
- Đã kiểm: `entities.ts` (có `workspaceId`, không có role), `policy.ts` (chỉ so sánh workspace id
  bằng `MCP_POLICY_WORKSPACE_MISMATCH`), `errors.ts` (không có nhóm authz).
- Gap **data & permission**: không có khái niệm role ⇒ không thể chặn viewer tạo job.
- Gap **vocabulary**: `MCP_POLICY_WORKSPACE_MISMATCH` mô tả *tình trạng dữ liệu* chứ không phải
  *quyết định truy cập*; giữ nó cạnh mã authz mới sẽ thành hai mã trùng nghĩa ⇒ thay thế (D-021).
- Gap **observability**: chưa có audit cho quyết định truy cập.

## Design Choice
Một hàm thuần `authorize()` trả `{ decision, error, auditEventType, auditDetail,
revealsResourceExistence }`. Trường `revealsResourceExistence` là cách **bắt buộc** caller nghĩ về
rò rỉ existence: với từ chối cross-workspace nó là `false` và `auditDetail.resourceId` bị set `null`.
`evaluateProcessingPolicy()` gọi `authorize()` trước mọi kiểm tra khác — nhờ vậy viewer hay user
ngoài workspace không bao giờ đi tới bước đọc attestation.

## Test Plan
- **Unit**: ma trận quyền đối chiếu bảng kỳ vọng viết độc lập; viewer không có `job.create`; member
  không có `billing.manage`/`workspace.manage`; admin không có billing; không permission nào mồ côi.
- **Regression**: cross-workspace từ chối kể cả với `owner`, `revealsResourceExistence === false`
  (I-10); viewer bị chặn ở policy gate (I-6).
- **Integration**: `integration-pipeline.test.ts` — workspace isolation và viewer trong luồng thật.
- **Live**: `planned` (chưa có auth runtime).

## Success Criteria
1. Không có đường nào tạo job mà bỏ qua `authorize()`.
2. Thêm một permission mới mà quên gán cho role nào → test đỏ.
3. Từ chối cross-workspace trả 404 và audit không chứa id tài nguyên.

## Remaining Limits
- Chưa có auth provider/IdP (Q-14) — chưa có session, token hay middleware thật.
- Chưa có UI quản lý thành viên.
- Chưa có quyền cấp project (mọi quyền hiện ở cấp workspace).
