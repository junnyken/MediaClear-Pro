# API — MediaClear Pro

- **Date**: 2026-09-15 (Phase 1) · **Base path**: `/v1`

> **Sự thật hiện tại**: 24 route chạy thật, 3 route vẫn trả **HTTP 501**
> `MCP_NOT_IMPLEMENTED`, 1 route chỉ bật ở môi trường dev. **Chưa có xử lý AI production**:
> không job nào đạt `completed`, không có output nào được sinh ra.
> Bảng dưới sinh từ `API_ROUTES` trong `packages/contracts/src/api.ts` và có test đối chiếu
> từng dòng (`docs-consistency.test.ts`) — docs lệch khỏi code là test đỏ.

## 1. Bảng route

| Method | Path | Status | MINI-SPEC |
|---|---|---|---|
| GET | `/healthz` | implemented | MCP-00 |
| POST | `/v1/auth/dev-session` | dev_only | MCP-10-P1 |
| GET | `/v1/me` | implemented | MCP-10-P1 |
| GET | `/v1/workspaces` | implemented | MCP-10-P1 |
| POST | `/v1/workspaces` | implemented | MCP-10-P1 |
| GET | `/v1/workspaces/:workspaceId` | implemented | MCP-10-P1 |
| GET | `/v1/workspaces/:workspaceId/members` | implemented | MCP-10-P1 |
| POST | `/v1/workspaces/:workspaceId/members` | implemented | MCP-10-P1 |
| GET | `/v1/workspaces/:workspaceId/audit-events` | implemented | MCP-10-P1 |
| GET | `/v1/workspaces/:workspaceId/projects` | implemented | MCP-11-P1 |
| POST | `/v1/workspaces/:workspaceId/projects` | implemented | MCP-11-P1 |
| GET | `/v1/projects/:projectId` | implemented | MCP-11-P1 |
| GET | `/v1/projects/:projectId/assets` | implemented | MCP-11-P1 |
| GET | `/v1/assets/:assetId` | implemented | MCP-11-P1 |
| POST | `/v1/projects/:projectId/assets/upload-intent` | implemented | MCP-15-P1 |
| PUT | `/v1/storage/upload/:uploadToken` | implemented | MCP-15-P1 |
| GET | `/v1/assets/:assetId/download-url` | implemented | MCP-15-P1 |
| GET | `/v1/storage/download/:downloadToken` | implemented | MCP-15-P1 |
| POST | `/v1/assets/:assetId/validate` | implemented | MCP-12-P1 |
| POST | `/v1/assets/:assetId/rights-attestation` | implemented | MCP-13-P1 |
| GET | `/v1/assets/:assetId/rights-attestation` | implemented | MCP-13-P1 |
| POST | `/v1/assets/:assetId/jobs` | implemented | MCP-14-P1 |
| GET | `/v1/jobs/:jobId` | implemented | MCP-14-P1 |
| POST | `/v1/jobs/:jobId/cancel` | implemented | MCP-14-P1 |
| GET | `/v1/usage` | implemented | MCP-14-P1 |
| POST | `/v1/jobs/:jobId/estimate` | planned | MCP-07 |
| POST | `/v1/jobs/:jobId/preview` | planned | MCP-07 |
| GET | `/v1/jobs/:jobId/receipt` | planned | MCP-05 |

Ý nghĩa `Status`: `implemented` = có handler thật + test HTTP thật · `planned` = còn trả 501 ·
`dev_only` = chỉ bật khi `MEDIACLEAR_DEV_AUTH` cho phép (auth provider production còn chờ Q-14).

### 1.1 Route Phase 0 đã được thay (D-024)

Các path dưới đây **chưa từng được hiện thực** ở Phase 0 (đều trả 501). Phase 1 thay bằng path lồng
tài nguyên theo owner prompt mục 8:

| Phase 0 (đã bỏ) | Phase 1 (đang dùng) |
|---|---|
| `POST /v1/uploads` | `POST /v1/projects/:projectId/assets/upload-intent` |
| `POST /v1/assets/:assetId/attestations` | `POST /v1/assets/:assetId/rights-attestation` |
| `POST /v1/jobs` | `POST /v1/assets/:assetId/jobs` |
| `GET /v1/workspaces/:workspaceId/usage` | `GET /v1/usage` |

## 2. Xác thực và ngữ cảnh workspace

```
Authorization: Bearer <session token>
X-Workspace-Id: <workspaceId>     # bắt buộc khi user có nhiều workspace
```

- Thiếu/hỏng session → **401** `MCP_AUTHZ_SESSION_REQUIRED`.
- Tài nguyên ngoài workspace → **404** `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED`; tài nguyên không tồn tại
  trong workspace của mình → **404** `MCP_RESOURCE_NOT_FOUND`. Hai trường hợp **cố ý** không phân
  biệt được từ bên ngoài (invariant I-10).
- Thiếu quyền theo role → **403** `MCP_AUTHZ_INSUFFICIENT_ROLE`.
- `POST /v1/auth/dev-session` là **đăng nhập tạm cho môi trường dev**, không phải hệ thống tài khoản
  production. `/healthz` tự khai `identityProvider.production = false`.

## 3. Envelope chung

```ts
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

interface ApiError {
  code: ErrorCode;       // vd 'MCP_VAL_DURATION_EXCEEDED'
  messageKey: string;    // vd 'errors.mcp_val_duration_exceeded'
  params?: Record<string, string | number>;
}
```

API **không bao giờ** trả text đã dịch, và **không bao giờ** trả lỗi nội bộ của framework: mọi lỗi —
kể cả body JSON rỗng, JSON hỏng, body quá lớn, route không tồn tại — đều đi qua `setErrorHandler`
để thành `ApiError` có translation key.

> Ngoại lệ có chủ đích: `GET /healthz` là **probe hạ tầng**, trả đối tượng phẳng (không bọc
> `{ok,data}`) để công cụ giám sát đọc trực tiếp.

## 4. Error mapping (nguồn: `ERROR_CATALOGUE` trong `errors.ts`)

Mỗi mã có: machine code · translation key `errors.<mã viết thường>` (vi + en) · HTTP status ·
`retryAllowed` · `releasesUsageReservation`. Dùng `httpStatusFor(code)` và `usageEffectOfError(code)`;
**không** hard-code status ở tầng route.

| Mã lỗi | Nhóm | HTTP | Retry | Giải phóng reservation |
|---|---|---|---|---|
| `MCP_VAL_UNSUPPORTED_FORMAT` | validation | 415 | không | có |
| `MCP_VAL_MIME_MISMATCH` | validation | 415 | không | có |
| `MCP_VAL_FILE_TOO_LARGE` | validation | 413 | không | có |
| `MCP_VAL_EMPTY_FILE` | validation | 400 | có | có |
| `MCP_VAL_DURATION_EXCEEDED` | validation | 422 | không | có |
| `MCP_VAL_DURATION_UNKNOWN` | validation | 422 | có | có |
| `MCP_VAL_DIMENSION_EXCEEDED` | validation | 422 | không | có |
| `MCP_VAL_DIMENSION_TOO_SMALL` | validation | 422 | không | có |
| `MCP_VAL_DIMENSION_UNKNOWN` | validation | 422 | có | có |
| `MCP_VAL_VIDEO_WIDTH_EXCEEDED` | validation | 422 | không | có |
| `MCP_VAL_VIDEO_HEIGHT_EXCEEDED` | validation | 422 | không | có |
| `MCP_VAL_CORRUPT_MEDIA` | validation | 422 | không | có |
| `MCP_POLICY_RIGHTS_ATTESTATION_MISSING` | policy | 403 | không | có |
| `MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED` | policy | 403 | không | có |
| `MCP_POLICY_RIGHTS_ATTESTATION_STALE` | policy | 403 | không | có |
| `MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED` | policy | 403 | không | có |
| `MCP_POLICY_OPERATION_NOT_PERMITTED` | policy | 422 | không | có |
| `MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED` | policy | 403 | không | có |
| `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` | authz | 404 | không | có |
| `MCP_AUTHZ_INSUFFICIENT_ROLE` | authz | 403 | không | có |
| `MCP_STATE_INVALID_TRANSITION` | state | 409 | không | không |
| `MCP_STATE_TERMINAL` | state | 409 | không | không |
| `MCP_STATE_OUTPUT_NOT_VERIFIED` | state | 409 | có | không |
| `MCP_STATE_JOB_BLOCKED` | state | 409 | không | có |
| `MCP_PROVIDER_CAPABILITY_UNSUPPORTED` | provider | 422 | không | có |
| `MCP_PROVIDER_CAPABILITY_UNKNOWN` | provider | 422 | không | có |
| `MCP_PROVIDER_UNAVAILABLE` | provider | 503 | có | có |
| `MCP_PROVIDER_SUBMIT_FAILED` | provider | 502 | có | có |
| `MCP_PROVIDER_TIMEOUT` | provider | 504 | có | có |
| `MCP_PROVIDER_RESULT_MISSING` | provider | 502 | có | có |
| `MCP_PROVIDER_NOT_PRODUCTION` | provider | 500 | không | có |
| `MCP_USAGE_DOUBLE_COMMIT` | usage | 409 | không | không |
| `MCP_USAGE_RESERVE_MISSING` | usage | 409 | không | không |
| `MCP_USAGE_RESERVATION_CONFLICT` | usage | 409 | không | không |
| `MCP_USAGE_QUANTITY_UNKNOWN` | usage | 422 | có | có |
| `MCP_STORAGE_OBJECT_NOT_FOUND` | storage | 404 | không | có |
| `MCP_STORAGE_WRITE_DENIED` | storage | 409 | không | có |
| `MCP_STORAGE_UPLOAD_FAILED` | storage | 502 | có | có |
| `MCP_STORAGE_UPLOAD_TICKET_INVALID` | storage | 403 | không | có |
| `MCP_NOT_IMPLEMENTED` | generic | 501 | không | không |
| `MCP_AUTHZ_SESSION_REQUIRED` | authz | 401 | không | có |
| `MCP_RESOURCE_NOT_FOUND` | generic | 404 | không | có |
| `MCP_VAL_REQUEST_INVALID` | validation | 400 | không | có |
| `MCP_VAL_NOT_VALIDATED` | validation | 409 | có | có |
| `MCP_JOB_IDEMPOTENCY_CONFLICT` | state | 409 | không | không |

## 5. Hành vi usage gắn với lỗi

| Tình huống | Ledger |
|---|---|
| Job được chấp nhận | 1 bản ghi `reserve` |
| Job bị chặn (policy/validation/provider) | **không** có bản ghi nào |
| Huỷ job | `release` với `reasonCode = cancelled` |
| Output đã verified | `commit` — **Phase 1 chưa bao giờ xảy ra** |
| Gửi lại cùng `idempotencyKey` | trả job cũ, **không** reserve lần hai |
| Preview | route còn 501 nên không thể ghi ledger |

## 6. Luồng intake (đường duy nhất để có asset dùng được)

```
POST /v1/projects/:projectId/assets/upload-intent   -> { assetId, sourceFileId, uploadUrl }
PUT  <uploadUrl>                                     -> byte thật, server đo và tính SHA-256
POST /v1/assets/:assetId/validate                    -> đọc số đo THẬT, đối chiếu config
POST /v1/assets/:assetId/rights-attestation          -> lời khai quyền của người dùng
POST /v1/assets/:assetId/jobs                        -> qua 5 cổng rồi mới nhận
```

`uploadUrl` là URL **có chữ ký, có hạn**, gắn chặt bucket/khoá/content-type/kích thước tối đa.
Với adapter local nó trỏ về chính API; khi đổi sang R2/MinIO, client PUT thẳng lên đó, contract
không đổi.

## 7. Ví dụ thật (chạy trên server đã build, 2026-09-15)

```
GET /healthz -> 200
{"ok":true,"phase":"phase-1-saas-shell","productionAiProcessingEnabled":false,
 "routes":28,"implementedRoutes":24,"plannedRoutes":3,
 "identityProvider":{"id":"dev-in-memory","production":false},
 "persistence":{"id":"in-memory-phase1","durability":"ephemeral"},
 "storage":{"id":"local-fs-phase1","production":false},"productionProviders":0}

POST /v1/assets/:assetId/jobs (chưa xác nhận quyền) -> 403
{"ok":false,"error":{"code":"MCP_POLICY_RIGHTS_ATTESTATION_MISSING",
 "messageKey":"errors.mcp_policy_rights_attestation_missing",
 "params":{"jobId":"job_b7cd915966f84d82a83fafff3324dd5e"}}}

POST /v1/assets/:assetId/jobs (sau khi xác nhận) -> 200
{"ok":true,"data":{"job":{"state":"queued","outputAssetId":null,...},
 "providerCapability":"unknown","productionProcessingEnabled":false,
 "usage":{"unitType":"video_minute_unit","quantity":10,"state":"reserved"}}}

POST /v1/jobs/:jobId/preview -> 501
{"ok":false,"error":{"code":"MCP_NOT_IMPLEMENTED","messageKey":"errors.mcp_not_implemented",
 "params":{"route":"/v1/jobs/:jobId/preview"}}}
```

Video dài 599 giây ⇒ `quantity = 10` (làm tròn **lên** theo phút). `jobId` trong `params` của lỗi là
job đã bị chặn, được giữ lại để tra cứu — job bị chặn là trạng thái **cuối**, gỡ xong phải tạo job mới.

## 8. Client kinds

`API_CLIENT_KINDS = ['web', 'chrome_extension']`, `ENABLED_API_CLIENT_KINDS = ['web']`.
Extension chưa tồn tại; khi có, nó dùng **chính** các route trên, không có route riêng.

## 9. Chưa có

Rate limit (`unknown`) · webhook (`out_of_scope`) · OpenAPI file (`planned`) · phân trang cho
audit events (`planned`) · auth provider production (`unknown`, Q-14) · resumable upload (`planned`).
