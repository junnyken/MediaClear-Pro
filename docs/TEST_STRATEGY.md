# TEST_STRATEGY — MediaClear Pro

- **Date**: 2026-09-15 · **MINI-SPEC**: MCP-08

## 1. Hạ tầng test hiện có

| Loại | Công cụ | Trạng thái |
|---|---|---|
| Unit / contract | vitest 2.1 | `implemented` — 66 test |
| Typecheck | `tsc -b` | `implemented` |
| Lint | eslint 9 flat config + typescript-eslint | `implemented` (đã kiểm chứng quét `.ts`/`.tsx`) |
| Build FE | `next build` | `implemented` |
| Integration (HTTP + DB) | — | `not found` — chưa có DB nên chưa có |
| E2E browser | — | `not found` |
| Migration test | — | `not found` — chưa có migration |

## 2. Invariant phải luôn xanh

| ID | Nội dung | Test |
|---|---|---|
| I-1 | File gốc không bao giờ bị ghi đè; output luôn liên kết tới source | `invariants.test.ts` |
| I-2 | `completed` chỉ khi output tồn tại **và** đã verified | `invariants.test.ts`, `job-state-machine.test.ts` |
| I-3 | `blocked` không bao giờ submit provider job | `invariants.test.ts` |
| I-4 | Rights confirmation chỉ là user attestation, không phải bằng chứng sở hữu | `invariants.test.ts` |
| I-5 | Preview không làm mất metadata gốc | `invariants.test.ts`, `provenance.test.ts` |
| I-6 | Provider failure không được tính như success | `invariants.test.ts`, `usage.test.ts` |
| I-7 | Retry không double-charge | `invariants.test.ts`, `usage.test.ts` |
| I-8 | Preserve metadata + provenance mặc định ON, MVP không tắt được | `invariants.test.ts`, `provenance.test.ts` |

Danh sách này được sinh từ `INVARIANTS` trong `packages/contracts/src/invariants.ts`; có test
khẳng định registry đủ 8 mục và mỗi mục đều có mô tả.

## 3. Contract test theo MINI-SPEC

| MINI-SPEC | File test | Số test |
|---|---|---|
| MCP-01 vocabulary | `vocabulary.test.ts` | 4 |
| MCP-02 policy | `policy.test.ts` | 9 |
| MCP-03 media limits | `media-limits.test.ts` | 7 |
| MCP-03 state machine | `job-state-machine.test.ts` | 7 |
| MCP-04 provider | `provider.test.ts` | 6 |
| MCP-05 provenance | `provenance.test.ts` | 8 |
| MCP-07 usage | `usage.test.ts` | 8 |
| MCP-06 i18n | `i18n.test.ts` | 8 |
| MCP-08 invariants | `invariants.test.ts` | 9 |

## 4. Nguyên tắc test

1. **Không mock chính thứ đang kiểm tra.** Các hàm policy/validate/state đều pure nên test gọi
   thẳng, không mock.
2. **Test biên, không test giữa.** Giới hạn "dưới 10 phút" được test tại 599.9 / 600 / 600.1 giây;
   "dưới 200 MB" tại 209.715.199 / 209.715.200 bytes.
3. **Thiếu bằng chứng phải đỏ.** Duration `null`, dimension `null`, cost `null` đều có test khẳng
   định hệ thống **không** cho qua và **không** tự điền số.
4. **Mock phải tự khai.** `NoopContractProvider.isProductionProvider === false` và có test khẳng
   định registry loại nó khỏi traffic production.

## 5. Còn thiếu (kèm lý do)

| Hạng mục | Lý do chưa chạy |
|---|---|
| Integration HTTP + DB | chưa chọn DB, chưa có schema (Q-01) |
| Live verification với media thật | chưa có provider thật và chưa có bộ media mẫu (Q-06, Q-07) |
| E2E click-through 10 màn | Phase 0 chỉ có skeleton; sẽ làm khi màn hình có nghiệp vụ |
| Kiểm tra contrast tự động | chưa có component library |
| Migration trên DB sạch | chưa có migration |
