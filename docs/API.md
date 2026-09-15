# API — MediaClear Pro

- **Date**: 2026-09-15 (Phase 1.1) · **Base path**: `/v1`

> **Sự thật hiện tại**: 25 route chạy thật, 3 route vẫn trả **HTTP 501**
> `MCP_NOT_IMPLEMENTED`, 1 route chỉ bật ở môi trường dev, 2 route vận hành nội bộ
> **tắt mặc định**. **Chưa có xử lý AI production**: không job nào đạt `completed`, không có output nào.
> Bảng dưới sinh từ `API_ROUTES` trong `packages/contracts/src/api.ts` và có test đối chiếu
> từng dòng (`docs-consistency.test.ts`) — docs lệch khỏi code là test đỏ.

## 1. Bảng route

| Method | Path | Status | MINI-SPEC |
|---|---|---|---|
| GET | `/healthz` | implemented | P0-MCP-00 |
| POST | `/v1/auth/dev-session` | dev_only | P1-MCP-10 |
| GET | `/v1/me` | implemented | P1-MCP-10 |
| GET | `/v1/workspaces` | implemented | P1-MCP-10 |
| POST | `/v1/workspaces` | implemented | P1-MCP-10 |
| GET | `/v1/workspaces/:workspaceId` | implemented | P1-MCP-10 |
| GET | `/v1/workspaces/:workspaceId/members` | implemented | P1-MCP-10 |
| POST | `/v1/workspaces/:workspaceId/members` | implemented | P1-MCP-10 |
| GET | `/v1/workspaces/:workspaceId/audit-events` | implemented | P1-MCP-10 |
| GET | `/v1/workspaces/:workspaceId/projects` | implemented | P1-MCP-11 |
| POST | `/v1/workspaces/:workspaceId/projects` | implemented | P1-MCP-11 |
| GET | `/v1/projects/:projectId` | implemented | P1-MCP-11 |
| GET | `/v1/projects/:projectId/assets` | implemented | P1-MCP-11 |
| GET | `/v1/assets/:assetId` | implemented | P1-MCP-11 |
| POST | `/v1/projects/:projectId/assets/upload-intent` | implemented | P1-MCP-15 |
| PUT | `/v1/storage/upload/:uploadToken` | implemented | P1-MCP-15 |
| GET | `/v1/assets/:assetId/download-url` | implemented | P1-MCP-15 |
| GET | `/v1/storage/download/:downloadToken` | implemented | P1-MCP-15 |
| POST | `/v1/assets/:assetId/validate` | implemented | P1-MCP-12 |
| POST | `/v1/assets/:assetId/rights-attestation` | implemented | P1-MCP-13 |
| GET | `/v1/assets/:assetId/rights-attestation` | implemented | P1-MCP-13 |
| POST | `/v1/assets/:assetId/jobs` | implemented | P1-MCP-14 |
| GET | `/v1/jobs/:jobId` | implemented | P1-MCP-14 |
| POST | `/v1/jobs/:jobId/cancel` | implemented | P1-MCP-14 |
| GET | `/v1/usage` | implemented | P1-MCP-14 |
| GET | `/v1/assets/:assetId/retention` | implemented | P1.1-MCP-18 |
| POST | `/v1/internal/usage-reservations/expire` | internal | P1.1-MCP-17 |
| POST | `/v1/internal/retention/dry-run` | internal | P1.1-MCP-18 |
| POST | `/v1/jobs/:jobId/estimate` | planned | P0-MCP-07 |
| POST | `/v1/jobs/:jobId/preview` | planned | P0-MCP-07 |
| GET | `/v1/jobs/:jobId/receipt` | planned | P0-MCP-05 |

Ý nghĩa `Status`:

| Giá trị | Nghĩa |
|---|---|
| `implemented` | có handler thật + test HTTP thật |
| `planned` | còn trả 501, chưa hiện thực |
| `dev_only` | chỉ bật ở môi trường dev (auth provider production còn chờ Q-14) |
| `internal` | route vận hành nội bộ, **tắt mặc định**; không cấu hình khoá thì trả 404 như đường dẫn lạ |

Cột MINI-SPEC dùng **canonical ID** theo `docs/MINI_SPEC_INDEX.md` (P1.1-MCP-16 / D-029).

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
- Hạn của phiên tính theo **đồng hồ của ứng dụng**, không phải giờ hệ thống của tiến trình.

### 2.1 Route vận hành nội bộ

```
X-Internal-Token: <khoá nội bộ>
```

- Không cấu hình `MEDIACLEAR_INTERNAL_TOKEN` (tối thiểu 16 ký tự) ⇒ route nội bộ **không tồn tại**:
  trả 404 y hệt đường dẫn lạ, không tiết lộ là có route.
- Sai khoá cũng trả 404 — không phân biệt được từ bên ngoài.
- Route nội bộ **không bao giờ** xoá dữ liệu (xem §7).

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
> `{ok,data}`) để công cụ giám sát đọc trực tiếp (D-028).

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
| `MCP_USAGE_RESERVATION_EXPIRED` | usage | 409 | không | không |
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

## 5. Vòng đời khoản giữ mức dùng (P1.1-MCP-17)

`UsageReservation.state` **khác** `ProcessingJob.state`. Hết hạn là chuyện của khoản giữ, **không**
đổi trạng thái job.

```
reserved ──(quá 1800 giây)──> expired ──(lệnh hoàn trả)──> released
   │
   ├──(huỷ job)──> released
   └──(output đã kiểm chứng)──> committed      ← Phase 1.1 chưa từng xảy ra
```

Cấm: `released → committed` · `expired → committed` · `committed → released` · `released → reserved`.

| Tình huống | Ledger |
|---|---|
| Job được chấp nhận | 1 bản ghi `reserve` kèm `expiresAt = recordedAt + 1800s` |
| Job bị chặn | **không** có bản ghi nào |
| Huỷ job | `release` với `reasonCode = cancelled` |
| Quá hạn, chạy lệnh hoàn trả | `release` với `reasonCode = expired` — **đúng một lần** |
| Chạy lệnh lần hai | không sinh bản ghi nào (idempotent) |
| Gửi lại cùng `idempotencyKey` | trả job cũ, **không** reserve lần hai |

`GET /v1/usage` tách ba nhóm: **đang giữ** (còn hạn) · **đã hết hạn giữ** (quá hạn, chưa hoàn trả) ·
**đã tính** (chỉ khi có output đã kiểm chứng).

## 6. Luồng intake (đường duy nhất để có asset dùng được)

```
POST /v1/projects/:projectId/assets/upload-intent   -> { assetId, sourceFileId, uploadUrl }
PUT  <uploadUrl>                                     -> byte thật, server đo và tính SHA-256
POST /v1/assets/:assetId/validate                    -> đọc số đo THẬT, đối chiếu config
POST /v1/assets/:assetId/rights-attestation          -> lời khai quyền của người dùng
POST /v1/assets/:assetId/jobs                        -> qua 5 cổng rồi mới nhận
```

`uploadUrl` là URL **có chữ ký, có hạn**, gắn chặt bucket/khoá/content-type/kích thước tối đa.

## 7. Lưu giữ dữ liệu (P1.1-MCP-18)

`GET /v1/assets/:assetId/retention` trả: trạng thái lưu giữ · giữ tới khi nào · lần truy cập cuối ·
đã đủ điều kiện bị dọn hay chưa (kèm lý do).

`POST /v1/internal/retention/dry-run` **chỉ đếm**:

```
Input :  { asOf?, workspaceId?, dataClass? }
Output:  { dryRun: true, candidateCount, byRetentionState, byDataClass, byReason,
           oldestCandidateAt, wouldDeleteBytes, scannedCount, policyVersion }
```

**Phase 1.1 không có bất kỳ đường xoá nào**: không route `DELETE`, không cờ `--force`, không lệnh
dọn thật. Có test khẳng định bảng route không chứa method `DELETE` và không path nào mang nghĩa xoá.

## 8. Ví dụ thật (chạy trên server đã build, 2026-09-15)

```
GET /healthz -> 200
{"ok":true,"phase":"phase-1-saas-shell","productionAiProcessingEnabled":false,
 "identityProvider":{"id":"dev-in-memory","production":false},
 "persistence":{"id":"in-memory-phase1","durability":"ephemeral"},
 "storage":{"id":"local-fs-phase1","production":false},"productionProviders":0,
 "limits":{"usageReservationTtlSeconds":1800,"retentionPolicyVersion":1,"rightsStatementVersion":2}}

POST /v1/assets/:assetId/jobs (sau khi xác nhận quyền) -> 200
{"ok":true,"data":{"job":{"state":"queued","outputAssetId":null},
 "providerCapability":"unknown","productionProcessingEnabled":false,
 "usage":{"unitType":"video_minute_unit","quantity":10,"state":"reserved",
          "expiresAt":"2026-09-15T10:30:00.000Z"}}}

POST /v1/internal/usage-reservations/expire (không có khoá) -> 404
{"ok":false,"error":{"code":"MCP_RESOURCE_NOT_FOUND","messageKey":"errors.mcp_resource_not_found",
 "params":{"resource":"route"}}}
```

## 9. Client kinds

`API_CLIENT_KINDS = ['web', 'chrome_extension']`, `ENABLED_API_CLIENT_KINDS = ['web']`.
Extension chưa tồn tại; khi có, nó dùng **chính** các route trên, không có route riêng.

## 10. Chưa có

Rate limit (`unknown`) · webhook (`out_of_scope`) · OpenAPI file (`planned`) · phân trang cho
audit events (`planned`) · auth provider production (`unknown`, Q-14) · resumable upload (`planned`) ·
worker tự chạy lệnh hết hạn và báo cáo lưu giữ (`planned`).

## 11. Bản vá Q-22 — không có thay đổi API

Bản vá Q-22 (`P1.1-Q22-MCP-21`, D-034) chỉ sửa **nhãn hiển thị của ô tick** trong hộp thoại xác nhận
quyền. Không có gì ở tầng API đổi:

| Hạng mục | Trước Q-22 | Sau Q-22 |
|---|---|---|
| Số route | 31 | 31 |
| Route mới / xoá | — | không có |
| Route `DELETE` | không có | không có |
| Hình dạng request `POST /v1/assets/:assetId/rights-attestation` | `statementId`, `statementVersion`, `localeShown`, `accepted` | **giữ nguyên** |
| Hình dạng response `GET /v1/assets/:assetId/rights-attestation` | `statement.{id,version,i18nKey,validityDays}` | **giữ nguyên** |
| `RIGHTS_STATEMENT.version` do API công bố | `2` | `2` |
| Cổng `stale` (`statementVersion` cũ hơn ⇒ 403) | có | **giữ nguyên** |
| Migration | `0001`, `0002` | không thêm bản nào |

Lý do không cần đổi API: thứ được lưu làm bằng chứng vẫn là **đúng câu cũ** ở **đúng phiên bản cũ**.
Q-22 sửa chỗ người dùng *đọc* câu đó, không sửa câu.
