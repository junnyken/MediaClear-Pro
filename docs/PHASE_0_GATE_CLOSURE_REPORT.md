# PHASE_0_GATE_CLOSURE_REPORT — MediaClear Pro

- **Date**: 2026-09-15 · **Author**: Nguyễn Thiên Triều (trieunt@matbao.com)
- **Repository**: `/home/coder/workspace/projects/Tool MediaClear Pro`
- **Commit foundation trước đó**: `cd15e2b` (giữ nguyên, không sửa lịch sử)

---

## 1. Summary

Phase 0 trước đây đóng ở `READY_WITH_BLOCKERS` với 7 câu hỏi chặn. Owner đã quyết cả 7 (Q-01, Q-03,
Q-04, Q-06, Q-08, Q-09, Q-10). Lượt này áp dụng các quyết định đó vào **contract, config, docs và
test**: thêm config tập trung cho mọi giới hạn, đổi giới hạn media sang 199 MB / 09:59 / 3840×3840,
thêm tenancy + ma trận quyền 4 role, thêm object storage abstraction S3-compatible, thêm benchmark
harness (mọi ô vẫn `unknown`), chốt vòng đời usage và preview proxy miễn phí, mở rộng error
catalogue lên 39 mã có HTTP/retry/release, và mở rộng invariant từ 8 lên 12. Không có code Phase 1:
không pipeline xử lý media, không DB, không provider thật, không billing.

---

## 2. Owner Decisions Applied

| Question | Decision | Contract/code affected | Status |
|---|---|---|---|
| Q-01 | PostgreSQL cho domain state; object storage S3-compatible abstraction; mục tiêu production đầu tiên Cloudflare R2 (chờ deployment review); media binary không vào DB | `src/storage.ts`, `src/storage-adapters/in-memory-adapter.ts`, `ARCH.md` §4, `DATA_MODEL.md` §7, MCP-10 | **resolved** |
| Q-03 | JPEG/PNG/WebP + MP4/MOV/WebM; 199 MB; 09:59; video ≤ 3840×3840; preview chạy trên proxy | `src/config.ts`, `src/media-limits.ts`, `src/preview.ts`, MCP-03 amendment | **resolved** |
| Q-04 | User → Workspace → Project → Asset; role owner/admin/member/viewer; không rò rỉ existence | `src/tenancy.ts`, `src/policy.ts`, `src/entities.ts` (`WorkspaceMembership`), MCP-09 | **resolved** |
| Q-06 | Chưa khoá provider production; registry provider-agnostic; no-op chỉ cho test; chuẩn bị benchmark harness trước | `src/benchmark.ts`, `src/provider.ts` (deterministic fallback), `PROVIDER_BENCHMARK.md` | **resolved with benchmark pending** |
| Q-08 | `blocked` terminal cho job hiện tại; gỡ block = `ProcessingJob` mới; phân biệt policy/validation/provider block | `src/job-state-machine.ts`, `src/policy.ts` (`BlockReasonKind`) | **resolved** |
| Q-09 | Attestation asset-level, 365 ngày, gắn cả `sourceFileId`, có `status: blocked` khi bị report | `src/policy.ts`, `src/entities.ts`, `POLICY.md` §3 | **resolved** |
| Q-10 | Preview miễn phí; video làm tròn lên theo phút; reserve → commit khi output verified; release theo error policy | `src/usage.ts`, `src/preview.ts`, `src/config.ts`, `API.md` §4 | **resolved** |

---

## 3. Audit Before Build

### Files/docs đã đọc
`MINI_SPEC_PLAYBOOK` v2 (bản owner gửi) · `docs/PHASE_0_REPORT.md` · `docs/TEST_LOG.md` ·
`docs/DECISIONS.md` · `docs/PHASE_0_DECISION_LOG.md` · `docs/OPEN_QUESTIONS.md` ·
`docs/FEATURES.md` · `docs/ARCH.md` · `docs/API.md` · `docs/DATA_MODEL.md` · `docs/POLICY.md` ·
`docs/PRODUCT_SCOPE.md` · `docs/UX_FOUNDATION.md` · `docs/PROVIDER_BENCHMARK.md` ·
`docs/TEST_STRATEGY.md` · toàn bộ `docs/mini-specs/MCP-00.md` … `MCP-08.md`.

> Ghi chú đường dẫn: tất cả tài liệu nằm trong `docs/` (không có bản ở thư mục gốc). MINI-SPEC nằm
> trong `docs/mini-specs/`. Playbook dùng là bản v2 owner cung cấp — bản
> `projects/audit-ads/MINI_SPEC_PLAYBOOK.md` trong workspace là tài liệu **khác**, không dùng.

### Entity/state/contract đã kiểm tra
15 entity trong `entities.ts` · 4 enum vocabulary + các enum phụ trợ · `ALLOWED_TRANSITIONS` ·
`evaluateProcessingPolicy()` · `validateMedia()` + `MEDIA_LIMITS` · `MediaProcessingProvider` +
`ProviderRegistry` · `usage.ts` (reserve/commit/release) · `provenance.ts` · `errors.ts` (27 mã cũ) ·
`api.ts` (`API_ROUTES`) · `invariants.ts` (8 mục cũ) · `apps/api/src/server.ts`.

### Gap trước khi sửa
| Nhóm | Gap |
|---|---|
| Configuration | Giới hạn nằm rải trong `media-limits.ts` và `policy.ts`, không có nguồn duy nhất ⇒ không thể đổi một chỗ |
| Media validation | Dùng biên **strict** 200 MB / 600 s; **không** có giới hạn pixel video; không phân biệt lỗi width vs height |
| Data & permission | Không có role, không có ma trận quyền ⇒ không chặn được viewer; `MCP_POLICY_WORKSPACE_MISMATCH` mô tả tình trạng dữ liệu chứ không phải quyết định truy cập, và trả 4xx có thể lộ existence |
| Storage | `storageKey` là chuỗi tự do, không có `StorageClass` ⇒ không thi hành được tính bất biến của file gốc ở tầng lưu trữ |
| Provider | Không có harness; không có khái niệm deterministic fallback; `capabilityEvidence` chưa có |
| Usage | Không chặn reserve trùng; hành vi release theo lỗi chưa gắn với error catalogue |
| Error catalogue | Thiếu HTTP mapping, retry, release; thiếu 13 mã owner yêu cầu |
| Attestation | Không gắn `sourceFileId`; không có trạng thái `blocked`; gộp expired vào stale |
| Test | Test `apps/api` sẽ import `dist/` cũ ⇒ rủi ro xanh giả |

### Những thành phần **không thay đổi** vì đã đúng
- `vocabulary.ts` — bộ giá trị gốc giữ nguyên, chỉ bổ sung enum mới; hai namespace `blocked` đã tách
  đúng từ Phase 0.
- `provenance.ts` — mặc định preserve ON và literal type `true` đã đủ chặt.
- `assertOutputDoesNotOverwriteSource()` — đã bảo vệ I-1 ở tầng domain; MCP-10 chỉ thêm tầng lưu trữ.
- `worker.ts` — điểm nối cho Python worker/Extension vẫn đúng, không cần đụng.
- Toàn bộ `apps/web` (10 màn) và `design-tokens` — owner decisions không đổi UX foundation; chỉ thêm
  i18n key cho role/block reason/preview.
- `apps/api` route table — vẫn trả 501, chỉ đổi cách lấy status (từ catalogue thay vì số cứng).

---

## 4. Design Choice

- **Storage abstraction**: khoá có cấu trúc `<workspaceId>/<class>/<id><ext>` để `StorageClass` suy
  ra được từ chính khoá; `assertWritableKey()` chặn ghi đè `source` mà không cần tra DB. Domain
  không import SDK vendor nào; R2 chỉ là *mục tiêu ban đầu*, `deploymentReviewStatus: 'pending'`.
- **Media limits**: gom vào `config.ts`; ngữ nghĩa **inclusive**; tách `MCP_VAL_VIDEO_WIDTH_EXCEEDED`
  và `MCP_VAL_VIDEO_HEIGHT_EXCEEDED` để phân biệt đúng 5 nhóm lỗi.
- **Tenancy/permissions**: ma trận liệt kê tường minh (không suy diễn theo thứ hạng role); kiểm tra
  workspace **trước** role; `revealsResourceExistence` buộc caller xử lý đúng chuyện rò rỉ.
- **Terminal blocked**: `ALLOWED_TRANSITIONS.blocked = []` + `assertCanSubmitProviderJob()` trả mã
  riêng `MCP_STATE_JOB_BLOCKED`; `resolveBlockedJob()` nói rõ gỡ block là **tạo entity mới**.
- **Attestation scope/validity**: gắn `assetId` + `sourceFileId`, `status`, và tách EXPIRED/STALE để
  UX nói đúng lý do.
- **Usage lifecycle**: chống double-charge bằng ràng buộc dữ liệu (một reserve + một commit mỗi
  `jobId`) thay vì cờ trong service; hành vi release lấy từ error catalogue.
- **Provider evidence**: harness sinh ma trận toàn `unknown` và có hàm phát hiện số bịa;
  `evaluateReadiness()` là điều kiện kỹ thuật để được phép chọn provider.

---

## 5. Changed Files

**55 file** (15 mới, 40 sửa). Không xoá file nào.

### Backend / contracts (mới)
`packages/contracts/src/config.ts` · `tenancy.ts` · `storage.ts` ·
`storage-adapters/in-memory-adapter.ts` · `benchmark.ts` · `preview.ts`

### Backend / contracts (sửa)
`errors.ts` (27 → 39 mã + metadata) · `media-limits.ts` · `policy.ts` · `job-state-machine.ts` ·
`usage.ts` · `provider.ts` · `entities.ts` · `invariants.ts` (8 → 12) · `api.ts` · `index.ts` ·
`apps/api/src/server.ts`

### Frontend / UX
`packages/i18n/src/locales/vi.json` · `en.json` (107 → **127 key**: 13 mã lỗi mới, 4 nhãn role,
3 nhãn lý do chặn, 1 thông điệp preview; bỏ 1 key của mã lỗi đã thay)

### Config
`vitest.config.ts` (alias `@mediaclear/*` → `src/`, include `apps/**/tests`)

### Schema / migrations
**Không có.** Phase 0 cố ý không tạo migration nào (owner decision Q-01).

### Docs
`PRODUCT_SCOPE.md` · `FEATURES.md` · `ARCH.md` · `API.md` · `POLICY.md` · `DATA_MODEL.md` ·
`UX_FOUNDATION.md` · `PROVIDER_BENCHMARK.md` · `TEST_STRATEGY.md` · `DECISIONS.md` ·
`OPEN_QUESTIONS.md` · `TEST_LOG.md` · `PHASE_0_DECISION_LOG.md` · `PHASE_0_REPORT.md` ·
`mini-specs/MCP-01,02,03,04,07,08.md` (amendment) · **mới**: `mini-specs/MCP-09.md`,
`mini-specs/MCP-10.md`, `PHASE_0_GATE_CLOSURE_REPORT.md`

### Tests
**Mới**: `tenancy.test.ts` · `storage.test.ts` · `benchmark.test.ts` · `preview.test.ts` ·
`error-catalogue.test.ts` · `integration-pipeline.test.ts` · `apps/api/tests/api-contract.test.ts`
**Sửa**: `media-limits.test.ts` · `policy.test.ts` · `usage.test.ts` · `provider.test.ts` ·
`job-state-machine.test.ts` · `invariants.test.ts` · `docs-consistency.test.ts`

---

## 6. New or Updated API/DB/State

### API
- Route mới: `POST /v1/jobs/:jobId/preview` (`planned`, trả 501). Tổng 11 route, 10 route nghiệp vụ
  đều trả **501** với `MCP_NOT_IMPLEMENTED`.
- `httpStatusFor(code)` / `errorDefinition(code)` export qua `api.ts`; `apps/api` không còn hard-code
  số 501.
- `API.md` có bảng mapping đầy đủ 39 mã lỗi: HTTP · retry · release reservation.

### DB
**Không có bảng, không có migration.** PostgreSQL đã được chốt nhưng schema là việc của Phase 1.

### State / enum mới
`WorkspaceRole` (4) · `Permission` (10) · `BlockReasonKind` (3) · `StorageClass` (3) ·
`BenchmarkMetric` (10) · entity `WorkspaceMembership` · `RightsAttestation.status` ·
`ProcessingJob.blockReasonKind` · `ErrorCode` 27 → **39**.

### Contract khác
`ObjectStorageAdapter` (5 method) · `BenchmarkPlan`/`BenchmarkCell` · `PreviewPlan` ·
`canReserveUsage()` · `usageEffectOfError()` · `assertCanSubmitProviderJob()` · `resolveBlockedJob()` ·
`capabilityEvidence()` · `requiresProvider()` · `INVARIANTS` 8 → **12**.

---

## 7. Test Results

| Check | Result | Notes |
|---|---|---|
| Typecheck | **PASS** | `pnpm typecheck` → exit 0 |
| Lint | **PASS** | `pnpm lint` → exit 0 |
| Tests | **PASS** | `pnpm test` → exit 0, **136 pass / 0 fail / 0 skip**, 17 file |
| Build | **PASS** | `pnpm build:web` → exit 0, 11 route |
| Live verification | **PASS** | API `/healthz` 200; `/v1/jobs` và `/v1/jobs/:jobId/preview` trả 501; web 10/10 màn HTTP 200, `lang="vi"` |
| Secret scan | **PASS** | không có API key/secret/`.env` nào trong repo |

Phân loại 136 test: unit/contract **101** · integration **12** (`integration-pipeline` 8 +
`api-contract` 4) · regression invariant **13** · docs consistency **10**.

Mỗi lệnh chạy **riêng** và ghi mã thoát riêng (không gộp thành một lệnh tổng hợp).

Bug thật tìm được ở lượt này: **B-04** — một câu trong `TEST_STRATEGY.md` mô tả chính cơ chế kiểm
tra lại rơi vào diện bị cấm (nhắc tới dấu ẩn mà không mang phủ định); test `docs-consistency` bắt
được, đã viết lại.

---

## 8. Evidence Status

| Hạng mục | Trạng thái |
|---|---|
| Contract vocabulary, state machine, policy, tenancy, validation, usage, storage, preview, provenance | **verified** — có code + test chạy thật |
| Error catalogue (39 mã, HTTP/retry/release, bản dịch vi + en) | **verified** |
| API skeleton + web skeleton chạy được | **verified** — gọi thật, kết quả trong `TEST_LOG.md` |
| Build/lint/typecheck/test | **verified** — exit 0 từng lệnh |
| Docs khớp code | **verified** — 10 kiểm tra tự động |
| Không có secret trong repo | **verified** — đã quét |
| UX foundation (token, i18n, 10 màn) | **partially_verified** — render thật, chưa test responsive/a11y, chưa click-through bằng trình duyệt |
| Bảo toàn metadata/provenance thật | **unconfirmed** — chưa đọc file thật lần nào |
| Storage adapter thật (R2/MinIO) | **unconfirmed** — mới có adapter in-memory cho contract test |
| Chất lượng & chi phí provider | **unknown** — chưa gọi provider nào; toàn bộ ma trận benchmark là `unknown` |
| Queue runtime, auth provider cụ thể, thư viện đọc C2PA | **unknown** — Q-02, Q-14, Q-12 |
| Cách hiểu biên inclusive (Q-13) và cách map static-mask (Q-15) | **unconfirmed** — đã ghi rõ, chờ owner xác nhận, không chặn |
| Benchmark provider | **blocked** — không đo được khi chưa chọn provider (Q-06) và chưa có media mẫu (Q-07) |

---

## 9. Remaining Limits / Follow-ups

Để Phase 1 hoặc phase sau:

- **Production provider selection** — chỉ được chọn sau khi harness có đủ evidence
  (`evaluateReadiness()` hiện `false`).
- **Media processing implementation** — chưa có ffmpeg/probe/inpainting nào.
- **Database migration implementation** — toàn bộ schema (15 entity, unique constraint của usage
  ledger, index theo `workspaceId`).
- **Object storage deployment** — bucket R2/MinIO thật, lifecycle, retention.
- **Full auth provider integration** — session/token/middleware (Q-14).
- **Python worker** — `WorkerJobEnvelope` đã sẵn sàng, chưa có service nào.
- **Chrome Extension** — `ApiClientKind` đã có chỗ, chưa có code.
- **Billing thật** — usage ledger chỉ đo, chưa thu tiền.
- Ngoài ra: Q-02 (queue), Q-05 (quy trình report/abuse đầy đủ), Q-07 (media mẫu), Q-11 (duyệt câu
  chữ pháp lý), Q-12 (thư viện C2PA), Q-13 và Q-15 (hai xác nhận không chặn).

---

## 10. Phase Gate Decision

## **READY_FOR_PHASE_1**

Căn cứ từng điều kiện của gate:

| Điều kiện | Kết quả |
|---|---|
| Owner decisions đã ghi trong docs | ✅ D-017…D-023 + cập nhật D-005/006/007/008/009/015 |
| Không còn blocker decision trong scope Phase 0 | ✅ 7/7 câu hỏi chặn đã đóng; phần còn lại là evidence hoặc implementation decision của Phase 1 |
| Contracts nhất quán với decisions | ✅ 10 kiểm tra docs-consistency + typecheck |
| State machine test | ✅ 9 test (gồm `blocked` terminal mọi hướng) |
| Policy gate test | ✅ 12 test |
| Media validation boundary test | ✅ 10 test (199 MB dưới/đúng/trên, 599 vs 600, 3840 vs 3841) |
| Permission/tenancy test | ✅ 9 test + phần trong policy/integration |
| Usage reserve/commit/release test | ✅ 10 test + luồng integration |
| Provider adapter contract test | ✅ 8 test + 5 test benchmark harness |
| Typecheck · Lint · Test · Build | ✅ exit 0 cả bốn, chạy riêng |
| Docs consistency | ✅ 10 test |
| Không có secret/API key bị commit | ✅ đã quét |
| Không có claim unsupported về SynthID / dấu ẩn | ✅ test quét toàn bộ tài liệu |
| Không có code Phase 1 ngoài scope | ✅ không pipeline, không DB, không provider thật, không billing, không Python service, không Extension |

**Điều kiện đi kèm cho Phase 1**: benchmark provider vẫn `unknown` — đó là **evidence status**, không
phải blocker product decision. Không được đánh dấu bất kỳ provider nào là `verified` trước khi có
run thật.

**Agent không bắt đầu Phase 1 trong lượt này.**

---

## 11. Git

- Commit foundation `cd15e2b` **giữ nguyên**, không sửa lịch sử.
- Commit mới cho lượt đóng blocker: xem `git log -1`.
- **Chưa có remote** — repository chỉ tồn tại local tại
  `/home/coder/workspace/projects/Tool MediaClear Pro`. Không push vì owner chưa cung cấp URL và
  chưa yêu cầu push.
