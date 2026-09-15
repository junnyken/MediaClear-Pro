# PROVIDER_BENCHMARK — MediaClear Pro

- **Date**: 2026-09-15 · **MINI-SPEC**: MCP-04 · **Trạng thái**: kế hoạch `planned`, số liệu `unknown`

> **CHƯA CHẠY BENCHMARK NÀO.** Mọi ô số liệu bên dưới là `unknown`. Không được điền số ước đoán
> vào bảng này. Chỉ điền khi có run thật, kèm ngày và `ProviderRun.id`.

## 1. Provider đang có

| Provider | Loại | Trạng thái |
|---|---|---|
| `noop-contract` | mock cho contract test | **KHÔNG PHẢI production AI provider**; mọi capability `unknown`, mọi cost `null` |

Chưa chọn provider AI thật nào. Xem OPEN_QUESTIONS Q-06.

## 2. Ma trận kịch bản bắt buộc

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
| S10 | Video gần 10 phút (≈ 9:55) | video | — | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown | unknown |

## 3. Dữ liệu phải ghi cho mỗi lần chạy (`ProviderRun`)

`providerId` · `modelVersion` · `operation` · `inputWidthPx`/`inputHeightPx`/`inputDurationSeconds`
· `estimatedCostUsd` · `actualCostUsd` · `latencyMs` · `qualityReviewResult` · `errorCode` ·
`evidenceStatus`.

Provider không trả chi phí → `actualCostUsd = null`, `evidenceStatus = 'unknown'`. Không suy ra
giá từ bảng giá công bố nếu lần chạy đó không trả số.

## 4. Quy tắc bằng chứng

- `ProviderCapability.support` mặc định `unknown`. Chỉ chuyển sang `verified` khi có ít nhất một
  run thật đạt ở kịch bản tương ứng.
- `ProviderRegistry.findCapable()` **chỉ** trả provider có `support === 'verified'` → capability
  chưa benchmark thì hệ thống tự động không dùng.
- Mock (`isProductionProvider === false`) không bao giờ lọt vào `listProduction()`.

## 5. Test media

`not found` — chưa có bộ media mẫu nào trong repo. Cần chuẩn bị ở Phase 1 (Q-07).

## 6. Chi phí nội bộ ≠ mức dùng của khách

`ProviderRun.actualCostUsd` là chi phí nội bộ để benchmark. Khi provider lỗi, mức dùng của khách
được **release** (không tính tiền) nhưng chi phí nội bộ vẫn được ghi lại.
