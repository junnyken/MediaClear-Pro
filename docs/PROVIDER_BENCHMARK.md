# PROVIDER_BENCHMARK — MediaClear Pro

- **Date**: 2026-09-15 (cập nhật sau owner decision Q-06)
- **MINI-SPEC**: MCP-04 · **Trạng thái**: harness `implemented`, số liệu `unknown`

> **CHƯA CHẠY BENCHMARK NÀO.** Mọi ô số liệu bên dưới là `unknown`. Không được điền số ước đoán.
> Chỉ điền khi có run thật, kèm ngày và `ProviderRun.id`. `assertNoFabricatedNumbers()` coi một ô
> **có số nhưng thiếu `providerRunId` hoặc evidence `unknown`** là số bịa.

## 1. Quyết định của owner (Q-06)

- **Không khoá provider AI production trong Phase 0.**
- Provider adapter và registry giữ provider-agnostic.
- No-op provider **chỉ** dùng cho contract test.
- **Chuẩn bị benchmark harness trước khi chọn provider production** — đã làm, xem §3.

## 2. Provider đang có

| Provider | Loại | Trạng thái |
|---|---|---|
| `noop-contract` | mock cho contract test | **KHÔNG PHẢI production AI provider**; mọi capability `unknown`, mọi cost `null` |

Chưa chọn provider AI thật nào. `ProviderRegistry.listProduction()` trả mảng rỗng.

### 2.1. Deterministic fallback (không cần provider AI)

`crop`, `blur`, `brand_overlay` là **deterministic fallback capabilities** — chạy được mà không gọi
provider nào. "Static mask" không phải enum riêng: nó là `blur`/`brand_overlay` áp lên một
`NormalizedRegion` cố định (D-020). `requiresProvider(op)` trả `false` cho nhóm này, nhờ đó preview
của các thao tác này có **ngân sách provider job = 0**.

## 3. Benchmark harness

`packages/contracts/src/benchmark.ts`:

- `BENCHMARK_SCENARIOS` — 10 kịch bản bắt buộc.
- `BENCHMARK_METRICS` — 10 metric bắt buộc.
- `createBenchmarkPlan()` — sinh ma trận 10×10 với mọi ô `value: null`, `evidence: 'unknown'`,
  `providerRunId: null`.
- `isFabricatedCell()` / `assertNoFabricatedNumbers()` — chặn số liệu không có bằng chứng.
- `evaluateReadiness()` — `readyToSelectProvider` chỉ `true` khi **không còn ô `unknown`** và không
  có ô bịa. Hiện tại: `false`.

## 4. Ma trận kịch bản bắt buộc

| # | Kịch bản | Media | Cost/ảnh | Cost/phút | Thời gian | Fail rate | Retry rate | Edge quality | Temporal flicker | Audio giữ | Metadata giữ | Sửa tay |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | Logo góc, nền đơn giản | image | unknown | — | unknown | unknown | unknown | unknown | — | — | unknown | unknown |
| S2 | Logo trên nền phức tạp | image | unknown | — | unknown | unknown | unknown | unknown | — | — | unknown | unknown |
| S3 | Có người/sản phẩm sát vùng xử lý | image | unknown | — | unknown | unknown | unknown | unknown | — | — | unknown | unknown |
| S4 | Logo cố định | video | — | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| S5 | Logo trên nền chuyển động | video | — | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| S6 | Camera lia/zoom | video | — | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| S7 | Video có audio | video | — | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| S8 | Video 10 giây | video | — | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| S9 | Video 60 giây | video | — | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| S10 | Video gần giới hạn 09:59 (599 giây) | video | — | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown |

## 5. Dữ liệu phải ghi cho mỗi lần chạy (`ProviderRun`)

`providerId` · `modelVersion` · `operation` · `inputWidthPx`/`inputHeightPx`/`inputDurationSeconds`
· `estimatedCostUsd` · `actualCostUsd` · `latencyMs` · `qualityReviewResult` · `errorCode` ·
`evidenceStatus`.

Provider không trả chi phí → `actualCostUsd = null`, `evidenceStatus = 'unknown'`. Không suy ra giá
từ bảng giá công bố nếu lần chạy đó không trả số. API key đọc từ env
(`resolveProviderCredential`), **không** commit vào repo và **không** ghi vào log.

## 6. Quy tắc bằng chứng

- `ProviderCapability.support` mặc định `unknown`; `capabilityEvidence()` trả `unknown` khi provider
  không khai báo.
- `ProviderRegistry.findCapable()` **chỉ** trả provider có `support === 'verified'` → capability
  chưa benchmark thì hệ thống tự động không dùng.
- Mock (`isProductionProvider === false`) không bao giờ lọt vào `listProduction()`.
- Provider failure **không bao giờ** được map thành job success (invariant I-7).

## 7. Test media

`not found` — chưa có bộ media mẫu nào trong repo. Cần chuẩn bị ở Phase 1 (Q-07).

## 8. Chi phí nội bộ ≠ mức dùng của khách

`ProviderRun.actualCostUsd` là chi phí nội bộ để benchmark. Khi provider lỗi, mức dùng của khách
được **release** (không tính tiền) nhưng chi phí nội bộ vẫn được ghi lại.
