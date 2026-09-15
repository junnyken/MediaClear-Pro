# ARCH — MediaClear Pro

- **Date**: 2026-09-15 · **Phase**: 0

## 1. Kiến trúc đã chọn

Monorepo TypeScript (pnpm workspace). Một domain contract dùng chung cho mọi client và mọi
worker.

```
Tool MediaClear Pro/
├─ packages/contracts/       # implemented — domain types, enum, state machine, policy,
│                            #   provider interface, usage ledger, invariants, error catalogue
├─ packages/design-tokens/   # implemented — token màu/spacing/a11y + tokens.css
├─ packages/i18n/            # implemented — vi (mặc định) + en, format locale-aware
├─ apps/web/                 # implemented (skeleton) — Next.js App Router, 10 màn foundation
├─ apps/api/                 # implemented (skeleton) — Fastify; /healthz thật, 9 route trả 501
└─ docs/                     # tài liệu Phase 0 + MINI-SPEC MCP-00..08
```

**Lý do chọn**: repository rỗng, không có framework để bám; prompt Phase 0 viết interface provider
bằng TypeScript; một ngôn ngữ duy nhất cho web + API + contract giúp state/enum không bị nhân bản
giữa hai runtime. Owner chốt phương án này ngày 2026-09-15.

**Hướng bị loại bỏ**:
- Next.js + FastAPI (Python) ngay từ Phase 0 — bị loại vì hai toolchain nhân đôi chi phí kiểm
  chứng trong khi Phase 0 không xử lý media thật; owner chỉ đạo không thêm Python service.
- Docs-only, không code — bị loại vì sẽ không chạy được build/lint/typecheck/test, buộc phase gate
  phải là `READY_WITH_BLOCKERS`.

## 2. Ranh giới kiến trúc bắt buộc giữ

1. **Contract là nguồn sự thật duy nhất.** State machine, enum, giới hạn media, quy tắc usage chỉ
   được định nghĩa một lần ở `packages/contracts`. Cấm copy sang service khác.
2. **Client-agnostic.** API không có route/field riêng cho web hay extension. Chrome Extension
   tương lai chỉ là một `ApiClientKind` mới (`packages/contracts/src/worker.ts`), không có engine
   riêng (guardrail 12).
3. **Worker-agnostic.** `WorkerJobEnvelope` / `WorkerResultEnvelope` là JSON thuần, có
   `envelopeVersion`, không mang kiểu riêng của Node → Python media worker ở phase sau tiêu thụ
   trực tiếp mà không đổi domain.
4. **Provider-agnostic.** Mọi provider AI đi qua `MediaProcessingProvider`. Không hard-code API
   key: `resolveProviderCredential(env, providerId)` đọc từ env, thiếu thì trả `null` và caller
   phải báo `blocked`/`unconfirmed`.
5. **Tenant boundary.** Mọi entity mang `workspaceId`; policy gate từ chối asset khác workspace.

## 3. Luồng dự kiến (Phase 1+, hiện `planned`)

```
Web (hoặc Extension sau này)
  → POST /v1/uploads            → SourceFile (immutable)
  → POST /v1/assets/:id/validate → validateMedia()  [MCP-03]
  → POST /v1/assets/:id/attestations → RightsAttestation [MCP-02]
  → POST /v1/jobs               → evaluateProcessingPolicy() → allow | block
      allow → usage reserve → queue → WorkerJobEnvelope → Provider adapter
            → WorkerResultEnvelope → validate output → ProcessingReceipt
            → completed (chỉ khi output verified) → usage commit
      block → AuditEvent + ProcessingJob.state = 'blocked' (terminal)
```

## 4. Hạ tầng chưa chốt

| Thành phần | Trạng thái |
|---|---|
| Database | `planned` — dự kiến PostgreSQL, **chưa** có migration nào trong repo |
| Object storage | `unknown` — xem OPEN_QUESTIONS Q-01 |
| Queue | `unknown` — Q-02 |
| Auth | `unknown` — Q-04 |
| CI/CD | `not found` — chưa có pipeline nào trong repo |
| Deployment | `not found` |

## 5. Lệnh build/test thật

| Lệnh | Tác dụng |
|---|---|
| `pnpm install` | cài workspace |
| `pnpm typecheck` | `tsc -b` cho contracts, design-tokens, i18n, api |
| `pnpm test` | vitest — contract + regression |
| `pnpm lint` | eslint (đã kiểm chứng quét cả `.ts` và `.tsx`) |
| `pnpm build:web` | `next build` |

`pnpm check` chạy typecheck + lint + test.
