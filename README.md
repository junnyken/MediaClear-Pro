# MediaClear Pro

SaaS đa tenant giúp creator, affiliate marketer, shop online và agency **làm sạch, phục hồi, chuẩn
hoá ảnh/video mà họ sở hữu hoặc có quyền chỉnh sửa**.

> **Trạng thái: Phase 0 — Foundation, gate `READY_FOR_PHASE_1` (2026-09-15).** Repository này
> **chưa xử lý media thật**. Nó chứa contract, tài liệu và skeleton. Mọi route nghiệp vụ trả
> `501 MCP_NOT_IMPLEMENTED`. Không có provider AI thật, không có database, không thu tiền, không có
> Chrome Extension, không có Python worker.

## Bắt đầu

```bash
pnpm install
pnpm typecheck     # tsc -b
pnpm test          # vitest — 136 test
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
| `packages/contracts` | config giới hạn, domain types, enum, state machine, policy gate, tenancy/roles, storage abstraction, provider + benchmark harness, preview, usage ledger, 12 invariant, 39 error code |
| `packages/design-tokens` | token màu/spacing/a11y + `tokens.css` |
| `packages/i18n` | `vi` (mặc định) + `en`, 127 key, format locale-aware |
| `apps/web` | Next.js App Router — 10 màn foundation (skeleton) |
| `apps/api` | Fastify — `/healthz` thật, 10 route nghiệp vụ trả 501 |
| `docs` | tài liệu Phase 0 + 11 MINI-SPEC + phase gate report |

## Tài liệu

`docs/PHASE_0_GATE_CLOSURE_REPORT.md` (đọc trước) · `docs/PHASE_0_REPORT.md` · `PRODUCT_SCOPE.md` · `FEATURES.md` · `ARCH.md` · `API.md` ·
`POLICY.md` · `DATA_MODEL.md` · `UX_FOUNDATION.md` · `PROVIDER_BENCHMARK.md` ·
`TEST_STRATEGY.md` · `TEST_LOG.md` · `DECISIONS.md` · `OPEN_QUESTIONS.md` ·
`PHASE_0_DECISION_LOG.md` · `docs/mini-specs/MCP-00..MCP-10.md`

## Nguyên tắc không được vi phạm

1. Chỉ xử lý nội dung người dùng sở hữu hoặc có quyền chỉnh sửa; Rights Guard không có đường tắt.
2. Chỉ xử lý phần **nhìn thấy được**. Không phát hiện, không gỡ, không cam kết kiểm soát watermark
   vô hình (gồm SynthID).
3. Giữ metadata gốc và AI provenance — mặc định ON, MVP không tắt được.
4. File gốc không bao giờ bị ghi đè.
5. Thiếu bằng chứng thì báo `unknown`/`unconfirmed`/`blocked`, không giả định pass.
6. Một user không chạm được tài nguyên ngoài workspace của mình; `viewer` không tạo được yêu cầu xử lý.

## Giới hạn media (nguồn: `packages/contracts/src/config.ts`)

Tối đa **199 MB** · video tối đa **09:59** · video tối đa **3840×3840** · ảnh JPEG/PNG/WebP ·
video MP4/MOV/WebM · xác nhận quyền hiệu lực **365 ngày**.
