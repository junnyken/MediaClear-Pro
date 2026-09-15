# MCP-10 — Authentication & Workspace Boundary (Phase 1)

- **ID**: `MCP-10` (Phase 1) · **Parent phase**: Phase 1 — SaaS Shell & Media Intake Foundation
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-15

> ⚠️ **Va chạm ID đã biết**: Phase 0 đã dùng `MCP-10` cho *Object Storage Abstraction*
> (`docs/mini-specs/MCP-10.md`). Prompt Phase 1 gán lại `MCP-10` cho Auth & Workspace Boundary.
> Không sửa/ghi đè tài liệu Phase 0. Bộ Phase 1 nằm trong `docs/mini-specs/phase-1/`.
> Ghi ở `OPEN_QUESTIONS.md` (Q-16) để owner quyết cách đánh số về sau.

## Context

Tài liệu bắt buộc đã đọc: `MINI_SPEC_PLAYBOOK.md` (bản v2 owner gửi kèm hội thoại),
`docs/PHASE_0_GATE_CLOSURE_REPORT.md`, `docs/PHASE_0_REPORT.md`, `docs/DECISIONS.md`,
`docs/OPEN_QUESTIONS.md`, `docs/FEATURES.md`, `docs/ARCH.md`, `docs/API.md`,
`docs/DATA_MODEL.md`, `docs/POLICY.md`, `docs/UX_FOUNDATION.md`, `docs/PROVIDER_BENCHMARK.md`,
`docs/TEST_STRATEGY.md`, `docs/TEST_LOG.md`, `docs/mini-specs/MCP-00.md` … `MCP-10.md`.

Trạng thái hiện tại:
- `packages/contracts/src/tenancy.ts` **đã có** `WORKSPACE_ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`,
  `authorize()` với thứ tự đúng: workspace boundary → role. Đây là engine quyền, **không viết lại**.
- `entities.ts` đã có `User`, `Workspace`, `WorkspaceMembership`.
- **Chưa có**: session/identity, workspace context resolver ở tầng HTTP, không có store nào.

Quyết định kiến trúc phải giữ nguyên:
- Không có quyền suy diễn (D-019). `authorize()` là đường duy nhất ra quyết định.
- Cross-workspace trả `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` → HTTP **404**, không lộ existence (I-10).
- Q-14 (auth provider production) vẫn **mở**: không được tự chọn IdP.

## Goal

Cho mọi request HTTP của Phase 1 một actor xác định (user + workspace + role) đi qua đúng một cổng
kiểm quyền, để không tồn tại đường nào chạm tài nguyên mà không qua `authorize()`.

## Constraints (Guardrails)

1. Không viết engine quyền thứ hai; mọi route gọi `authorize()` của Phase 0.
2. Không tự chọn auth provider production (Q-14 đang mở) — Phase 1 chỉ có identity provider **dev**,
   tự khai `isProductionProvider = false` và lộ ra ở `/healthz`.
3. Session token không được log, không lọt vào audit detail, không vào response của route khác.
4. Từ chối cross-workspace phải đi trước kiểm role và không lộ existence.
5. Thiếu/hỏng session → 401 với mã lỗi ổn định, không trả stack trace hay lỗi nội bộ.
6. Không thêm role ngoài 4 role MVP.
7. Mọi quyết định allow/deny sinh audit event; audit không chứa token/PII.

## Scope

**A. Domain model** — tái dùng `User`, `Workspace`, `WorkspaceMembership`, `AuditEvent` của Phase 0.
Thêm **duy nhất** `Session` (id, userId, expiresAt) ở tầng app (không vào contracts vì còn chờ Q-14).

**B. Services/engine** — `IdentityProvider` port + `DevIdentityProvider` (in-memory);
`resolveActor(request)` → `{ user, workspace, role }`; `requirePermission()` bọc `authorize()`.

**C. API contract** — `POST /v1/auth/dev-session` (dev_only), `GET /v1/me`,
`GET|POST /v1/workspaces`, `GET /v1/workspaces/:workspaceId`,
`GET|POST /v1/workspaces/:workspaceId/members`.

**D. UI surfaces** — màn đăng nhập dev, chọn workspace, tạo workspace, badge role trên Shell.

**E. Tests** — unit (role matrix, context resolver), integration (HTTP thật: 401 khi thiếu session,
404 cross-workspace, 403 thiếu role), regression (I-5, I-6, I-10).

## Audit Before Build

| Đã kiểm | Kết luận |
|---|---|
| `tenancy.ts::authorize` | Đúng, đủ; chỉ thiếu tầng gọi. **Không sửa.** |
| `ERROR_CODES.MCP_AUTHZ_*` | Đã có 2 mã + HTTP 404/403 trong catalogue. Dùng lại. |
| `server.ts` | Chỉ có `/healthz` + vòng lặp 501. Chưa có middleware nào. |
| i18n `role.*` | Đã có 4 key role. Dùng lại, không tạo key trùng nghĩa. |

**Gap** (data & permission): không có identity, không có store, không có nơi gắn workspace vào request.
**Gap** (vocabulary): chưa có mã lỗi cho "chưa đăng nhập" → cần thêm `MCP_AUTHZ_SESSION_REQUIRED`.

## Design Choice

Một **composition root** (`app-context.ts`) dựng sẵn identity provider, persistence và storage; route
chỉ nhận context qua tham số. Session gửi bằng `Authorization: Bearer <token>`, xác thực bởi
`DevIdentityProvider` in-memory; workspace hiện hành lấy từ header `X-Workspace-Id` (fallback: workspace
duy nhất của user). Lý do chọn: giữ nguyên `authorize()`, không ràng buộc vào IdP nào nên khi Q-14 chốt
chỉ cần thêm một implementation của cùng port. Bỏ hướng "JWT tự ký" vì sẽ ngầm quyết định Q-14.

## Test Plan

- Unit: ma trận 4 role × 10 permission; resolver chọn đúng workspace; session hết hạn.
- Integration: 401 không session · 404 workspace của người khác · 403 viewer tạo job ·
  tạo workspace → người tạo là `owner` · thêm member.
- Regression: I-5, I-6, I-10 vẫn xanh.
- Live: gọi thật `/v1/me`, `/v1/workspaces` trên server đang chạy.

## Success Criteria

- User chỉ thấy workspace mình là thành viên.
- Không đường nào đọc được project/asset/job ngoài workspace (kể cả đoán id).
- Owner quản lý được workspace/thành viên; viewer không tạo được job.
- `/healthz` tự khai auth provider hiện tại **không** phải production.

## Remaining Limits / Follow-ups

- Auth provider production (Q-14) vẫn `unknown`; session không bền qua restart (in-memory).
- Không có refresh token, không có MFA, không có quên mật khẩu — ngoài scope Phase 1.
