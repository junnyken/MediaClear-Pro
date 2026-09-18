# API — MediaClear Pro

- **Date**: 2026-09-15 (Phase 1.1) · **Base path**: `/v1`

> **Sự thật hiện tại**: 27 route chạy thật, 3 route vẫn trả **HTTP 501**
> `MCP_NOT_IMPLEMENTED`, 1 route chỉ bật ở môi trường dev, 2 route vận hành nội bộ
> **tắt mặc định**. **Chưa có xử lý AI production**: không job nào đạt `completed`, không có output nào.
> Bảng dưới sinh từ `API_ROUTES` trong `packages/contracts/src/api.ts` và có test đối chiếu
> từng dòng (`docs-consistency.test.ts`) — docs lệch khỏi code là test đỏ.

## 1. Bảng route

| Method | Path | Status | MINI-SPEC |
|---|---|---|---|
| GET | `/` | implemented | P0-MCP-00 |
| GET | `/healthz` | implemented | P0-MCP-00 |
| GET | `/openapi.json` | implemented | P2-MCP-34 |
| POST | `/v1/auth/dev-session` | dev_only | P1-MCP-10 |
| POST | `/v1/auth/register` | implemented | P2-MCP-25 |
| POST | `/v1/auth/sign-in` | implemented | P2-MCP-25 |
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
| POST | `/v1/assets/:assetId/proxy` | implemented | P3-MCP-30 |
| GET | `/v1/assets/:assetId/proxy` | implemented | P3-MCP-30 |
| GET | `/v1/assets/:assetId/proxy/download-url` | implemented | P3-MCP-30 |
| GET | `/v1/export-presets` | implemented | P3-MCP-34 |
| POST | `/v1/source-files/:sourceFileId/upload-session` | implemented | P2-MCP-35 |
| GET | `/v1/upload-sessions/:sessionId` | implemented | P2-MCP-35 |
| PUT | `/v1/upload-sessions/:sessionId/chunks/:chunkIndex` | implemented | P2-MCP-35 |
| POST | `/v1/upload-sessions/:sessionId/complete` | implemented | P2-MCP-35 |
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
| POST | `/v1/internal/jobs/run` | internal | P2-MCP-27 |
| GET | `/v1/jobs/:jobId/output` | implemented | P2-MCP-29 |
| GET | `/v1/jobs/:jobId/output/download-url` | implemented | P2-MCP-29 |
| GET | `/v1/jobs/:jobId/receipt` | implemented | P2-MCP-30 |
| GET | `/v1/jobs/:jobId/frames` | implemented |
| POST | `/v1/jobs/:jobId/frames/:frameIndex/correction` | implemented |
| GET | `/v1/assets/:assetId/provenance` | implemented |
| GET | `/v1/jobs/:jobId/metadata` | implemented |
| GET | `/v1/brand-kits` | implemented |
| POST | `/v1/brand-kits` | implemented |
| GET | `/v1/brand-kits/:brandKitId` | implemented |
| POST | `/v1/brand-kits/:brandKitId/versions` | implemented |
| POST | `/v1/brand-kits/:brandKitId/state` | implemented |
| PUT | `/v1/brand-kits/:brandKitId/logo` | implemented |
| POST | `/v1/jobs/:jobId/estimate` | implemented | P2-MCP-31 |
| POST | `/v1/jobs/:jobId/preview` | implemented | P2-MCP-31 |


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
- **P2-MCP-25 (Q-14 đã chốt)**: `POST /v1/auth/register` và `POST /v1/auth/sign-in` là **xác thực
  thật** — email + mật khẩu, phiên lưu trong bảng `sessions`. Mật khẩu băm bằng `scrypt`; cơ sở dữ
  liệu **chỉ lưu hash của token phiên**, không bao giờ lưu token dùng được.
  - Sai mật khẩu, email không tồn tại, và đăng ký trùng email đều trả **cùng một** mã
    `MCP_AUTH_INVALID_CREDENTIALS`. Tách ra là tạo một kênh **dò email**.
  - Độ bền của phiên là việc của **tầng lưu trữ**: chạy in-memory thì phiên bay theo restart, chạy
    PostgreSQL thì sống sót. `/healthz` tự khai điều đó qua `persistence.durability`.
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
| `MCP_STATE_QUALITY_REVIEW_REQUIRED` | state | 409 | có | không |
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
| `MCP_AUTH_INVALID_CREDENTIALS` | authz | 401 | không | có |
| `MCP_AUTH_PASSWORD_TOO_SHORT` | validation | 400 | không | có |
| `MCP_RESOURCE_NOT_FOUND` | generic | 404 | không | có |
| `MCP_VAL_REQUEST_INVALID` | validation | 400 | không | có |
| `MCP_VAL_NOT_VALIDATED` | validation | 409 | có | có |
| `MCP_JOB_IDEMPOTENCY_CONFLICT` | state | 409 | không | không |
| `MCP_JOB_MAX_ATTEMPTS_EXCEEDED` | state | 500 | không | có |

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

Bản vá Q-22 (`P1.1-Q22-MCP-22`, D-035) chỉ sửa **nhãn hiển thị của ô tick** trong hộp thoại xác nhận
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

## 12. P2-MCP-23 — không có thay đổi API

Adapter PostgreSQL (`P2-MCP-23`, D-037) đổi **tầng lưu trữ**, không đổi bề mặt API.

| Hạng mục | Trước | Sau |
|---|---|---|
| Số route | 31 | 31 |
| Route `DELETE` | không có | không có |
| Hình dạng request/response | — | **giữ nguyên** |
| `/healthz` → `persistence.durability` | `ephemeral` | `durable` **khi** có `MEDIACLEAR_DATABASE_URL` |
| Migration | `0001`, `0002` | thêm `0003` (chỉ thêm cột) |

Biến môi trường mới: **`MEDIACLEAR_DATABASE_URL`**. Không đặt ⇒ chạy in-memory y như trước. Khi có,
server chạy migration **trước khi** nhận request đầu tiên và in ra số migration đã áp dụng/bỏ qua.

## 13. P2-MCP-24 — không có thay đổi API

Adapter object storage S3-compatible (`P2-MCP-24`, D-038) đổi **chỗ byte nằm**, không đổi bề mặt API.

| Hạng mục | Trước | Sau |
|---|---|---|
| Số route | 31 | 31 |
| Biên upload/download | ticket HMAC qua API | **giữ nguyên** |
| `/healthz` → `storage.production` | `false` | `true` **khi** có cấu hình `MEDIACLEAR_S3_*` |
| Migration | `0001`…`0003` | không thêm bản nào |

Biến môi trường mới: `MEDIACLEAR_S3_ENDPOINT` · `MEDIACLEAR_S3_ACCESS_KEY_ID` ·
`MEDIACLEAR_S3_SECRET_ACCESS_KEY` · `MEDIACLEAR_S3_BUCKET` · `MEDIACLEAR_S3_REGION` (mặc định `auto`) ·
`MEDIACLEAR_S3_FORCE_PATH_STYLE` · `MEDIACLEAR_S3_CREATE_BUCKET`.

**Thiếu bất kỳ mảnh bắt buộc nào** (endpoint / khoá / bí mật / bucket) ⇒ chạy đĩa local như cũ.
**Thiếu bucket trên đích S3** ⇒ server **từ chối khởi động**, không chạy nửa vời.
---

## Sửa khung hình — ngữ nghĩa `reinterpolated` (`D-074`)

`POST /v1/jobs/:jobId/frames/:frameIndex/correction`

Một lần sửa **không chỉ đụng tới một khung hình**. Luật canonical `planFrameCorrection` tính lại các
khung lân cận trong bán kính `CORRECTION_NEIGHBOUR_RADIUS = 2` mỗi bên, nội suy tuyến tính từ vùng
che vừa sửa về phía vùng che cũ của khung lân cận.

Cả `POST` (ghi) lẫn `GET /v1/jobs/:jobId/frames` (đọc) trả **cùng một hình dạng**, gồm
`lastCorrection`:

| Trường | Ý nghĩa |
|---|---|
| `frameIndex` | khung hình người dùng sửa trực tiếp |
| `reinterpolated` | chỉ số các khung lân cận **thực sự** được tính lại. Trước `D-074` đường API luôn ghi `[]` dù không tính gì — đó là `Q-P4-05` |
| `flickerBefore` / `flickerAfter` | số đoạn mask nhảy bất thường, đo ngay trước và ngay sau lần sửa. `null` = không đo được |
| `gateVerdictBefore` / `gateVerdictAfter` | kết quả cổng chặn chất lượng ở hai vế. `null` = không đo được |

`lastCorrection` là `null` khi chưa ai sửa.

**Bốn quy tắc người gọi cần biết:**

1. Khung sửa trực tiếp có `source: "manual"` và `confidence: null` — người thật đặt tay vào thì độ
   tin cậy của máy không còn ý nghĩa.
2. Khung nội suy có `source: "interpolated"` và `confidence: null` — vùng che mới **chưa** được đo.
3. Khung lân cận **đang bị gắn cờ** (`frame_low_confidence`, `frame_review_required`) giữ nguyên
   trạng thái: vùng che được cập nhật, nhưng nội suy không trả lời được câu hỏi đã gắn cờ nó.
4. Khung `frame_failed` không có vùng che thì **bị bỏ qua** — không giả vờ phục hồi byte đã hỏng.

Cổng chặn chất lượng và phép kiểm tính liên tục **chạy lại** sau mỗi lần sửa. Một lần sửa tạo ra cú
nhảy sẽ khiến `gate.verdict` rời khỏi `completed`, và `GET /v1/jobs/:jobId/output/download-url` trả
`409 MCP_STATE_QUALITY_REVIEW_REQUIRED` (`D-073`).

Toàn bộ thao tác ghi trong **một giao dịch**: hồ sơ và mọi khung hình bị đụng tới cùng đứng hoặc
cùng đổ.

---

## Lớp phủ nhận diện & công bố AI (`D-077`)

### `PUT /v1/brand-kits/:brandKitId/logo`

Nhận **byte thô** (`application/octet-stream` hoặc kiểu ảnh). Không dùng JSON: mã hoá base64 phóng
to 33% và bắt cả hai bên làm việc không cần thiết.

Kiểu tệp và kích thước được đo trên **chính byte** ở máy chủ. `content-type` của client chỉ dùng để
**đối chiếu** — lệch thì trả `MCP_VAL_MIME_MISMATCH`.

| Trường phản hồi | Ý nghĩa |
|---|---|
| `widthPx` / `heightPx` / `byteSize` / `mimeType` | **đo trên byte**, không phải lời khai |
| `checksumSha256` | để đối chiếu về sau |
| `sharedStorage` | `false` = tệp nằm trên kho **cục bộ** của container, **không phải** kho dùng chung, và **không được gọi là** đã lưu trữ ở mức production (`Q-23`) |

Tải logo thành công sẽ **tạo một phiên bản mới** của bộ nhận diện. Phiên bản cũ không bao giờ bị
đụng tới.

### `POST /v1/assets/:assetId/jobs` — trường `branding`

```jsonc
"branding": {
  "brandKitId": "bkt_…",
  "brandKitVersion": 2,   // PHIÊN BẢN CỤ THỂ, không phải "đang hiệu lực"
  "applyLogo": true,
  "applyDisclosure": true
}
```

`null` (hoặc vắng mặt, hoặc sai hình dạng) ⇒ **không dán lớp phủ nào**. Đây là mặc định và là chỗ an
toàn: hệ thống không bao giờ dán một thứ người dùng không chọn.

**KHÔNG nhầm với thao tác `brand_overlay` trong `operations`**: thao tác đó là **mặt nạ xám đặc** tô
kín một vùng (`Q-15`) — nó **xoá** thông tin. `branding` **thêm** thông tin lên trên.

Bốn trường biên nhận tương ứng — và `brandOverlayApplied` là **cột riêng**, không suy từ
`brandKitId !== null` (người dùng có thể chọn một bộ rồi **tắt** lớp phủ):

| Trường | Ý nghĩa |
|---|---|
| `brandKitId` / `brandKitVersion` | bộ và **phiên bản** đã thật sự được dán |
| `brandLogoAssetId` | tệp logo đã dán. `null` = không dán logo nào (kể cả khi `applyLogo` bật mà tệp hỏng) |
| `brandOverlayApplied` | **đo được**, không phải lời khai |
| `disclosureOverlayApplied` | `false` khi không vẽ được chữ — một công bố trống còn tệ hơn không công bố |

Lớp phủ cho **video** chưa có (`Q-P5-03`); biên nhận video ghi `brandOverlayApplied: false`.
