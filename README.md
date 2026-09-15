# MediaClear Pro

SaaS đa tenant giúp creator, affiliate marketer, shop online và agency **làm sạch, phục hồi, chuẩn
hoá ảnh/video mà họ sở hữu hoặc có quyền chỉnh sửa**.

> **Trạng thái: Phase 0 — Foundation.** Repository này **chưa xử lý media thật**. Nó chứa
> contract, tài liệu và skeleton. Mọi route nghiệp vụ trả `501 MCP_NOT_IMPLEMENTED`.
> Không có provider AI thật, không thu tiền, không có Chrome Extension, không có Python worker.

## Bắt đầu

```bash
pnpm install
pnpm typecheck     # tsc -b
pnpm test          # vitest — 72 test
pnpm lint          # eslint
pnpm build:web     # next build
pnpm check         # typecheck + lint + test
```

Chạy thử skeleton:

```bash
node apps/api/dist/server.js        # PORT=3001, chỉ /healthz là thật
pnpm --filter @mediaclear/web dev   # http://localhost:3000
```

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `packages/contracts` | domain types, enum, state machine, policy gate, provider interface, usage ledger, invariants, error catalogue |
| `packages/design-tokens` | token màu/spacing/a11y + `tokens.css` |
| `packages/i18n` | `vi` (mặc định) + `en`, 107 key, format locale-aware |
| `apps/web` | Next.js App Router — 10 màn foundation (skeleton) |
| `apps/api` | Fastify — `/healthz` thật, 9 route nghiệp vụ trả 501 |
| `docs` | tài liệu Phase 0 + 9 MINI-SPEC + phase gate report |

## Tài liệu

`docs/PHASE_0_REPORT.md` (đọc trước) · `PRODUCT_SCOPE.md` · `FEATURES.md` · `ARCH.md` · `API.md` ·
`POLICY.md` · `DATA_MODEL.md` · `UX_FOUNDATION.md` · `PROVIDER_BENCHMARK.md` ·
`TEST_STRATEGY.md` · `TEST_LOG.md` · `DECISIONS.md` · `OPEN_QUESTIONS.md` ·
`PHASE_0_DECISION_LOG.md` · `docs/mini-specs/MCP-00..MCP-08.md`

## Nguyên tắc không được vi phạm

1. Chỉ xử lý nội dung người dùng sở hữu hoặc có quyền chỉnh sửa; Rights Guard không có đường tắt.
2. Chỉ xử lý phần **nhìn thấy được**. Không phát hiện, không gỡ, không cam kết kiểm soát watermark
   vô hình (gồm SynthID).
3. Giữ metadata gốc và AI provenance — mặc định ON, MVP không tắt được.
4. File gốc không bao giờ bị ghi đè.
5. Thiếu bằng chứng thì báo `unknown`/`unconfirmed`/`blocked`, không giả định pass.
