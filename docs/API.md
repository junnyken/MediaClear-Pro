# API — MediaClear Pro

- **Date**: 2026-09-15 · **Base path**: `/v1` · **Trạng thái**: xem cột "Status"

> **Sự thật hiện tại**: chỉ `GET /healthz` chạy thật. Toàn bộ 9 route nghiệp vụ trả
> **HTTP 501** kèm `MCP_NOT_IMPLEMENTED`. Đây là contract surface, **không phải** bằng chứng
> pipeline đã hoạt động. Bảng route được định nghĩa tại `packages/contracts/src/api.ts`
> (`API_ROUTES`) và được test đối chiếu với tài liệu này.

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
hôm nay và Chrome Extension sau này hiển thị đúng cùng một thông điệp.

## 3. Ví dụ thật (đã chạy 2026-09-15)

```
GET /healthz  → 200
{"ok":true,"phase":"phase-0-foundation","productionAiProcessingEnabled":false,"routes":10}

POST /v1/jobs → 501
{"ok":false,"error":{"code":"MCP_NOT_IMPLEMENTED","messageKey":"errors.mcp_not_implemented",
 "params":{"route":"/v1/jobs"}}}
```

## 4. Contract type đã chốt

`CreateUploadRequest/Response` · `ValidateAssetResponse` · `CreateAttestationRequest` ·
`CreateJobRequest` · `JobEstimateResponse` · `UsageSummaryResponse` — xem
`packages/contracts/src/api.ts`.

`JobEstimateResponse.estimatedCostUsd` là `number | null`. `null` = **chưa có bằng chứng giá**;
UI phải hiện "Chưa có ước tính chi phí cho tệp này", tuyệt đối không hiện `0`.

## 5. Client kinds

`API_CLIENT_KINDS = ['web', 'chrome_extension']`, nhưng `ENABLED_API_CLIENT_KINDS = ['web']` trong
Phase 0. Extension chưa tồn tại; khi có, nó dùng **chính** các route trên.

## 6. Chưa có

Auth scheme (`unknown`, Q-04) · rate limit (`unknown`) · pagination contract (`planned`) ·
webhook (`out_of_scope` Phase 0) · OpenAPI file (`planned`).
