# API — MediaClear Pro

- **Date**: 2026-09-15 (cập nhật sau owner decisions) · **Base path**: `/v1`

> **Sự thật hiện tại**: chỉ `GET /healthz` chạy thật. Toàn bộ 10 route nghiệp vụ trả
> **HTTP 501** kèm `MCP_NOT_IMPLEMENTED`. Đây là contract surface, **không phải** bằng chứng
> pipeline đã hoạt động. Bảng route định nghĩa tại `packages/contracts/src/api.ts` (`API_ROUTES`)
> và được test đối chiếu với tài liệu này.

## 1. Bảng route

| Method | Path | Status | MINI-SPEC |
|---|---|---|---|
| GET | `/healthz` | implemented | MCP-00 |
| POST | `/v1/uploads` | planned | MCP-03 |
| POST | `/v1/assets/:assetId/validate` | planned | MCP-03 |
| POST | `/v1/assets/:assetId/attestations` | planned | MCP-02 |
| POST | `/v1/jobs` | planned | MCP-02 |
| GET | `/v1/jobs/:jobId` | planned | MCP-03 |
| POST | `/v1/jobs/:jobId/estimate` | planned | MCP-07 |
| POST | `/v1/jobs/:jobId/preview` | planned | MCP-07 |
| GET | `/v1/jobs/:jobId/receipt` | planned | MCP-05 |
| GET | `/v1/workspaces/:workspaceId/usage` | planned | MCP-07 |
| GET | `/v1/workspaces/:workspaceId/audit-events` | planned | MCP-02 |

## 2. Envelope chung

```ts
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

interface ApiError {
  code: ErrorCode;       // vd 'MCP_VAL_DURATION_EXCEEDED'
  messageKey: string;    // vd 'errors.mcp_val_duration_exceeded'
  params?: Record<string, string | number>;
}
```

API **không bao giờ** trả text đã dịch. Client tự render theo locale từ `messageKey` — nhờ vậy web
hôm nay và Chrome Extension sau này hiển thị đúng cùng một thông điệp. Có test HTTP thật khẳng định
response không chứa chuỗi tiếng Việt.

## 3. Error mapping (nguồn: `ERROR_CATALOGUE` trong `errors.ts`)

Mỗi mã lỗi có: machine code · translation key `errors.<mã viết thường>` (vi + en) · HTTP status ·
`retryAllowed` · `releasesUsageReservation`. Dùng `httpStatusFor(code)` và
`usageEffectOfError(code)`; **không** hard-code status ở tầng route.

| Mã lỗi | HTTP | Retry | Release reservation |
|---|---|---|---|
| `MCP_VAL_UNSUPPORTED_FORMAT` | 415 | không | có |
| `MCP_VAL_MIME_MISMATCH` | 415 | không | có |
| `MCP_VAL_FILE_TOO_LARGE` | 413 | không | có |
| `MCP_VAL_EMPTY_FILE` | 400 | có | có |
| `MCP_VAL_DURATION_EXCEEDED` | 422 | không | có |
| `MCP_VAL_DURATION_UNKNOWN` | 422 | có | có |
| `MCP_VAL_DIMENSION_EXCEEDED` | 422 | không | có |
| `MCP_VAL_DIMENSION_TOO_SMALL` | 422 | không | có |
| `MCP_VAL_DIMENSION_UNKNOWN` | 422 | có | có |
| `MCP_VAL_VIDEO_WIDTH_EXCEEDED` | 422 | không | có |
| `MCP_VAL_VIDEO_HEIGHT_EXCEEDED` | 422 | không | có |
| `MCP_VAL_CORRUPT_MEDIA` | 422 | không | có |
| `MCP_POLICY_RIGHTS_ATTESTATION_MISSING` | 403 | không | có |
| `MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED` | 403 | không | có |
| `MCP_POLICY_RIGHTS_ATTESTATION_STALE` | 403 | không | có |
| `MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED` | 403 | không | có |
| `MCP_POLICY_OPERATION_NOT_PERMITTED` | 422 | không | có |
| `MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED` | 403 | không | có |
| `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` | **404** | không | có |
| `MCP_AUTHZ_INSUFFICIENT_ROLE` | 403 | không | có |
| `MCP_STATE_INVALID_TRANSITION` | 409 | không | không |
| `MCP_STATE_TERMINAL` | 409 | không | không |
| `MCP_STATE_OUTPUT_NOT_VERIFIED` | 409 | có | không |
| `MCP_STATE_JOB_BLOCKED` | 409 | không | có |
| `MCP_PROVIDER_CAPABILITY_UNSUPPORTED` | 422 | không | có |
| `MCP_PROVIDER_CAPABILITY_UNKNOWN` | 422 | không | có |
| `MCP_PROVIDER_UNAVAILABLE` | 503 | có | có |
| `MCP_PROVIDER_SUBMIT_FAILED` | 502 | có | có |
| `MCP_PROVIDER_TIMEOUT` | 504 | có | có |
| `MCP_PROVIDER_RESULT_MISSING` | 502 | có | có |
| `MCP_PROVIDER_NOT_PRODUCTION` | 500 | không | có |
| `MCP_USAGE_DOUBLE_COMMIT` | 409 | không | không |
| `MCP_USAGE_RESERVE_MISSING` | 409 | không | không |
| `MCP_USAGE_RESERVATION_CONFLICT` | 409 | không | không |
| `MCP_USAGE_QUANTITY_UNKNOWN` | 422 | có | có |
| `MCP_STORAGE_OBJECT_NOT_FOUND` | 404 | không | có |
| `MCP_STORAGE_WRITE_DENIED` | 409 | không | có |
| `MCP_STORAGE_UPLOAD_FAILED` | 502 | có | có |
| `MCP_NOT_IMPLEMENTED` | 501 | không | không |

**404 cho `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` là cố ý**: tài nguyên ngoài workspace không được xác
nhận là có tồn tại (invariant I-10). Thiếu quyền *bên trong* workspace mới trả 403.

## 4. Hành vi usage gắn với lỗi

| Tình huống | Usage |
|---|---|
| Job được chấp nhận | `reserve` (một lần duy nhất mỗi `jobId`) |
| Output đã verified | `commit` (một lần duy nhất mỗi `jobId`) |
| Provider lỗi / validation lỗi do người dùng | `release` theo `releasesUsageReservation` |
| Job fail trước khi provider chạy | không có `commit` (vì chưa có `reserve` hợp lệ) |
| Preview | **không** ghi vào ledger |
| Gửi lại `reserve` cho cùng job | `MCP_USAGE_RESERVATION_CONFLICT` |

## 5. Contract type đã chốt

`CreateUploadRequest/Response` · `ValidateAssetResponse` · `CreateAttestationRequest` ·
`CreateJobRequest` · `JobEstimateResponse` · `UsageSummaryResponse` — xem
`packages/contracts/src/api.ts`.

`JobEstimateResponse.estimatedCostUsd` là `number | null`. `null` = **chưa có bằng chứng giá**;
UI phải hiện "Chưa có ước tính chi phí cho tệp này", tuyệt đối không hiện `0`.

## 6. Ví dụ thật (đã chạy 2026-09-15)

```
GET /healthz  → 200
{"ok":true,"phase":"phase-0-foundation","productionAiProcessingEnabled":false,"routes":11}

POST /v1/jobs → 501
{"ok":false,"error":{"code":"MCP_NOT_IMPLEMENTED","messageKey":"errors.mcp_not_implemented",
 "params":{"route":"/v1/jobs"}}}
```

## 7. Client kinds

`API_CLIENT_KINDS = ['web', 'chrome_extension']`, nhưng `ENABLED_API_CLIENT_KINDS = ['web']` trong
Phase 0. Extension chưa tồn tại; khi có, nó dùng **chính** các route trên.

## 8. Chưa có

Auth scheme cụ thể (`unknown`, Q-14) · rate limit (`unknown`) · pagination contract (`planned`) ·
webhook (`out_of_scope` Phase 0) · OpenAPI file (`planned`).
