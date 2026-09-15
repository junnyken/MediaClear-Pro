# MCP-11 — Project & Asset Library (Phase 1)

- **ID**: `MCP-11` · **Parent phase**: Phase 1 — SaaS Shell & Media Intake Foundation
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-15

## Context

Đọc: như `MCP-10` (Phase 1) + `docs/DATA_MODEL.md` §Project/Asset/SourceFile.
Trạng thái: `entities.ts` đã có `Project`, `Asset`, `SourceFile` (có `readonly immutable: true`),
`OutputAsset` (bắt buộc `sourceAssetId`). Chưa có store, chưa có route, chưa có UI thật.
Quyết định phải giữ: I-1 (không ghi đè file gốc), mọi truy vấn lọc theo `workspaceId`.

## Goal

Cho người dùng tạo project và nhìn thấy thư viện asset của đúng workspace mình, với file gốc là bất
biến và không truy vấn nào rò rỉ dữ liệu của workspace khác.

## Constraints (Guardrails)

1. Mọi repository method **bắt buộc** nhận `workspaceId`; không có hàm `findById(id)` trần.
2. Không sửa `SourceFile` sau khi tạo (trừ trường probe được điền đúng một lần khi upload xong).
3. Asset phải thuộc đúng một Project và một Workspace; Project thuộc đúng một Workspace.
4. Danh sách phải có phân trang (cursor) ngay từ đầu để không phải đổi contract sau.
5. UI không hard-code chuỗi hiển thị; mọi text đi qua translation key.
6. Không tạo entity mới nếu Phase 0 đã có tương đương (reuse-first).

## Scope

**A. Domain model** — tái dùng `Project`, `Asset`, `SourceFile`. Thêm ở tầng app: `AssetRecord`
(asset + sourceFile + trạng thái validation + trạng thái attestation) chỉ là *view model*, không phải
entity mới trong DB.

**B. Services/engine** — `ProjectService` (create/list/get), `AssetService` (list/get), cursor
pagination thuần (`createdAt`+`id`).

**C. API contract** — `GET|POST /v1/workspaces/:workspaceId/projects`, `GET /v1/projects/:projectId`,
`GET /v1/projects/:projectId/assets`, `GET /v1/assets/:assetId`.

**D. UI surfaces** — Project list, Create project, Project detail, Asset library, Asset detail;
mỗi màn có loading / empty / error / permission-denied.

**E. Tests** — unit (pagination, ownership), integration (tạo project → list → detail; cross-workspace
404), regression (asset list không lộ dữ liệu workspace khác).

## Audit Before Build

| Đã kiểm | Kết luận |
|---|---|
| `entities.ts` | Đủ field cho Phase 1. Không thêm entity. |
| `authorize()` | `resourceType` đã có `'project'`/`'asset'`. Dùng lại. |
| i18n | Có `screen.project_detail.*`; thiếu key cho list/empty/tạo mới → bổ sung. |
| `API_ROUTES` | Phase 0 chưa có route project/asset → thêm mới, không đổi nghĩa route cũ. |

**Gap**: không có tầng persistence nào; không có cursor contract; UI mới là placeholder tĩnh.

## Design Choice

`PersistencePort` (interface) + `InMemoryPersistence` (Phase 1). Lý do: Phase 1 cần chạy thật và test
được ngay, trong khi adapter PostgreSQL thật cần kết nối DB mà môi trường build/test không có sẵn.
Schema SQL vẫn được thiết kế và **chạy thử trên database sạch** (xem `MCP-15` §migration) để không nợ
thiết kế. In-memory tự khai `durability: 'ephemeral'` và lộ ra `/healthz` — không giả vờ là production.

## Test Plan

- Unit: cursor ổn định khi thêm bản ghi; `listAssets` lọc theo workspace.
- Integration: HTTP thật cho toàn bộ CRUD đọc; 404 cho project của workspace khác.
- Regression: R-1 (user ngoài workspace không đọc được project), R-2 (…không đọc được asset).
- Live: tạo project qua HTTP thật rồi đọc lại.

## Success Criteria

- Tạo/list/xem project chạy thật qua HTTP.
- Asset gắn đúng workspace + project.
- Binary của source không bao giờ bị ghi đè (chứng minh ở `MCP-15`).
- Không có response nào chứa dữ liệu của workspace khác.

## Remaining Limits / Follow-ups

- Chưa có soft-delete/retention (ghi rõ `planned`).
- Chưa có OutputAsset thật vì Phase 1 không xử lý media.
