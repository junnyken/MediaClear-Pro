# ARCH — MediaClear Pro

- **Date**: 2026-09-15 · **Phase**: 0

## 1. Kiến trúc đã chọn

Monorepo TypeScript (pnpm workspace). Một domain contract dùng chung cho mọi client và mọi
worker.

```
Tool MediaClear Pro/
├─ packages/contracts/       # implemented — domain types, enum, state machine, policy gate,
│                            #   tenancy/roles, storage abstraction, provider interface +
│                            #   benchmark harness, preview contract, usage ledger,
│                            #   12 invariants, 39 error code (kèm HTTP/retry/release),
│                            #   config.ts = nguồn duy nhất của mọi giới hạn
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

## 4. Hạ tầng

> Cập nhật 2026-09-15 theo owner decision Q-01 (D-017).

| Thành phần | Trạng thái |
|---|---|
| Database | **PostgreSQL** — đã chốt cho domain state (users, workspaces, projects, assets, jobs, usage, audit). Trong repo hiện có: **contract only**, `0 migration` |
| Object storage | **S3-compatible abstraction** (`ObjectStorageAdapter`) — đã chốt; mục tiêu production ban đầu **Cloudflare R2**, `deploymentReviewStatus: 'pending'` |
| Adapter dev/test | `InMemoryStorageAdapter` (`isProductionAdapter = false`); MinIO/local là lựa chọn hợp lệ cho dev |
| Media binary trong DB | **Không bao giờ** (`MEDIA_BINARY_IN_DATABASE = false`) |
| Queue | `unknown` — Q-02 |
| Auth provider cụ thể | `unknown` — Q-14 (owner cho phép để ngỏ); **domain permission contract đã chốt** (D-019) |
| CI/CD | `not found` — chưa có pipeline nào trong repo |
| Deployment | `not found` |

### 4.1. Migration: cái gì thuộc Phase 0, cái gì để Phase 1

| | |
|---|---|
| Migration thuộc Phase 0 | **Không có.** Phase 0 chỉ cần contract nên không tạo schema placeholder nào — tránh migration production không cần thiết (yêu cầu của owner ở Q-01) |
| Migration để Phase 1 | Toàn bộ: 15 entity trong `DATA_MODEL.md`, ràng buộc unique `(jobId, entryType='commit')` cho usage ledger, index theo `workspaceId`, và bảng `WorkspaceMembership` |

### 4.2. Ranh giới storage

Domain **không** import SDK của vendor nào. Mọi truy cập đi qua `ObjectStorageAdapter`; khoá có
cấu trúc `<workspaceId>/<source|output|preview>/<id><ext>`; `assertWritableKey()` chặn mọi thao tác
ghi đè lên object class `source` (invariant I-1).

## 5. Lệnh build/test thật

| Lệnh | Tác dụng |
|---|---|
| `pnpm install` | cài workspace |
| `pnpm typecheck` | `tsc -b` cho contracts, design-tokens, i18n, api |
| `pnpm test` | vitest — contract + regression |
| `pnpm lint` | eslint (đã kiểm chứng quét cả `.ts` và `.tsx`) |
| `pnpm build:web` | `next build` |

`pnpm check` chạy typecheck + lint + test.

---

# Phase 1 — SaaS Shell & Media Intake (2026-09-15)

## 6. Những gì Phase 1 đã dựng thật

```
apps/web (Next.js)                    apps/api (Fastify)
  màn hình theo workflow        HTTP    server.ts  ── composition root (app-context.ts)
  gọi API bằng Bearer token  ───────►     ├── services/access.ts   (session → workspace → authorize)
  không giữ logic nghiệp vụ              ├── services/{workspaces,projects,assets,attestations,jobs,usage}
                                         ├── media/header-probe.ts (đọc số đo THẬT từ byte)
                                         ├── storage/local-fs-adapter.ts (ObjectStorageAdapter)
                                         └── persistence/in-memory.ts  (PersistencePort)
```

Bốn cổng thay thế được (port/adapter), mỗi cổng tự khai mình có phải production không và `/healthz`
phơi ra hết:

| Cổng | Bản Phase 1 | Tự khai | Thay bằng gì ở phase sau |
|---|---|---|---|
| `IdentityProvider` | `DevIdentityProvider` (in-memory) | `production: false` | IdP thật khi owner chốt Q-14 |
| `PersistencePort` | `InMemoryPersistence` | `durability: 'ephemeral'` | adapter PostgreSQL (schema đã có) |
| `ObjectStorageAdapter` | `LocalFsStorageAdapter` | `isProductionAdapter: false` | Cloudflare R2 / MinIO (Q-01) |
| `MediaProbeAdapter` | `HeaderMediaProbe` (thuần TS) | — | giữ nguyên, hoặc bổ sung probe sâu hơn |

## 7. Ranh giới auth và tenancy

`session → workspace context → authorize()`. `authorize()` là **của Phase 0**, Phase 1 không viết
engine quyền thứ hai. Thứ tự kiểm là một phần contract: **workspace trước, role sau** — nếu kiểm role
trước thì thông báo lỗi đã đủ để suy ra tài nguyên có tồn tại hay không (I-10).

Mọi method của `PersistencePort` đụng tới tài nguyên đều **bắt buộc** nhận `workspaceId`; không tồn
tại `findById(id)` trần, nên không có đường vô tình đọc chéo tenant.

## 8. Ranh giới lưu trữ

- Khoá object: `workspaces/<ws>/projects/<prj>/assets/<ast>/source/<sourceFileId><ext>` — **không**
  lấy từ tên file người dùng (tên gốc chỉ là `originalFilename` để hiển thị).
- `storageClassOf()` đọc segment ngay trước tên file, nên `assertWritableKey()` vẫn chặn ghi đè
  `source` với **cả hai** dạng khoá (phẳng của Phase 0 và lồng của Phase 1).
- Upload đi qua **ticket ký HMAC** (bucket + khoá + content-type + trần dung lượng + hạn dùng), mô
  phỏng đúng hợp đồng presigned URL của S3.
- Media binary **không bao giờ** vào PostgreSQL; DB chỉ giữ `storage_key`.

## 9. Ranh giới tạo job

Năm cổng theo thứ tự cố định: quyền → validation → attestation/policy → provider capability →
usage reserve. Không có provider production nào được đăng ký, nên job hợp lệ dừng ở `queued` và API
tự khai `productionProcessingEnabled: false`.

## 10. Quan sát và nhật ký

Mỗi request ghi: `requestId`, workspace, user, subject, operation, kết quả, mã lỗi, thời gian,
thao tác usage. **Không** ghi: byte media, API key, session token, mật khẩu, URL có chữ ký.
`redactAuditDetail()` chặn theo **tên trường** và có test riêng.
