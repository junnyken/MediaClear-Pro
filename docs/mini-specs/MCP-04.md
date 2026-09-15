# MCP-04 — Provider Adapter & Evidence Model

| | |
|---|---|
| **ID** | MCP-04 · **Parent phase** Phase 0 |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: `PROVIDER_BENCHMARK.md`, prompt mục F/G, guardrails 10/13.
- Trạng thái: chưa chọn provider AI nào; chưa chạy benchmark nào.

## Goal
Cho phép benchmark và thay provider mà không đổi domain workflow, đồng thời không bao giờ giả định
capability hay cost khi chưa có bằng chứng.

## Constraints
1. Không hard-code API key; đọc qua `resolveProviderCredential(env, providerId)`, thiếu → `null`.
2. Không khoá hệ thống vào một provider; mọi truy cập đi qua `MediaProcessingProvider`.
3. Capability mặc định `unknown`; chỉ `verified` sau khi có run thật.
4. Cost không có thì để `null`, **không** suy từ bảng giá công bố.
5. Mock phải tự khai `isProductionProvider = false` và không được lọt vào traffic thật.
6. Không tạo engine xử lý riêng cho Chrome Extension.

## Scope
- **A. Domain model**: `ProviderCapability`, `ProviderEstimate`, `ProviderJobInput/Reference/Status`,
  `ProviderResult`, `ProviderRun`, `NormalizedRegion`.
- **B. Services/engine**: `ProviderRegistry` (register / get / listProduction / findCapable);
  `NoopContractProvider` chỉ dùng cho test.
- **C. API contract**: `POST /v1/jobs/:jobId/estimate` (`planned`) — trả `estimatedCostUsd` có thể
  `null` kèm `costEvidence`.
- **D. UI surfaces**: chỗ nào hiện chi phí đều phải xử lý `null` = "Chưa có ước tính", không hiện 0.
- **E. Tests**: 6 test provider.

## Audit Before Build
- Đã kiểm: không có adapter, registry, benchmark hay test media nào (`MCP-00`).
- Gap **observability**: cần `ProviderRun` ghi đủ 10 trường (provider id, model version, operation,
  input dimension/duration, estimated cost, actual cost, latency, quality review, error code,
  evidence status) — nếu thiếu thì sau này không so sánh được provider.
- Gap **vocabulary**: cần tách "chi phí nội bộ" khỏi "mức dùng của khách", nếu không sẽ tính nhầm
  tiền khi provider lỗi.

## Design Choice
Interface đúng như spec mục F, thêm đúng một trường `isProductionProvider` — trường này là cách rẻ
nhất để chặn kịch bản mock tạo ra "kết quả" giả trong runtime thật. `NormalizedRegion` dùng toạ độ
0..1 để không phụ thuộc độ phân giải, nhờ đó cùng một vùng mô tả được cho cả preview và bản gốc.
`findCapable()` lọc theo `support === 'verified'` → capability chưa benchmark tự động không được
chọn, thay vì trông chờ người viết service nhớ kiểm tra.

## Test Plan
- **Unit**: noop không phải production; estimate trả `null` + `unknown`; capability chưa benchmark
  không `verified`; credential đọc từ env (thiếu/rỗng/có).
- **Regression**: `listProduction()` và `findCapable()` loại mock.
- **Live**: `planned` — chưa có provider thật (Q-06).

## Success Criteria
1. Thay provider không phải sửa domain workflow.
2. Không có số cost nào xuất hiện mà không đến từ một `ProviderRun` thật.
3. Không có API key nào trong source code.

## Remaining Limits
- Chưa có adapter thật nào. Chưa có bộ media benchmark (Q-07).
- Chưa có chính sách retry/timeout cho provider — `planned`.

---

## Amendment 2026-09-15 — Owner decision Q-06

**Chốt**: không khoá provider AI production trong Phase 0; chuẩn bị **benchmark harness trước** khi
chọn provider.

**Harness đã thêm** (`src/benchmark.ts`): 10 kịch bản (S10 = video gần giới hạn **09:59**) × 10
metric, khởi tạo toàn bộ `value: null` / `evidence: 'unknown'` / `providerRunId: null`;
`isFabricatedCell()` coi ô có số mà thiếu `providerRunId` hoặc evidence `unknown` là **số bịa**;
`evaluateReadiness()` chỉ cho phép chọn provider khi không còn ô `unknown`.

**Deterministic fallback**: `crop`, `blur`, `brand_overlay` không cần provider AI
(`requiresProvider()` trả `false`). "Static mask" map vào nhóm này thay vì tạo enum mới (D-020).

**Capability evidence**: `capabilityEvidence()` trả `unknown` khi provider không khai báo — không
bao giờ mặc định `verified`.

**Test**: `benchmark.test.ts` (5) + `provider.test.ts` (8, thêm deterministic fallback và capability
evidence).
