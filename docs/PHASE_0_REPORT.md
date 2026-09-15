# PHASE_0_REPORT — MediaClear Pro

- **Phase**: 0 — Product Foundation, Evidence, Architecture & UX Foundation
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-15
- **Repository**: `/home/coder/workspace/projects/Tool MediaClear Pro`

> **Cập nhật 2026-09-15 (gate closure)**: owner đã quyết cả 7 câu hỏi chặn; phase gate chuyển từ
> `READY_WITH_BLOCKERS` sang **`READY_FOR_PHASE_1`**. Báo cáo này giữ nguyên nội dung của lượt Phase 0
> đầu tiên để không mất lịch sử; những gì thay đổi sau đó nằm ở §10 và trong
> `PHASE_0_GATE_CLOSURE_REPORT.md`.

---

## 1. Summary

Phase 0 dựng foundation cho MediaClear Pro trên một repository **rỗng hoàn toàn**: audit trước
(MCP-00), chốt vocabulary và ranh giới sản phẩm, rồi viết contract cho rights guard, media
validation, provider abstraction, metadata/provenance và usage ledger. Toàn bộ 9 MINI-SPEC
(MCP-00…MCP-08) và 13 tài liệu đã hoàn thành theo Playbook v2. Có skeleton chạy được: web Next.js
10 màn foundation và API Fastify với `/healthz` thật, mọi route nghiệp vụ trả 501. **Không** có xử
lý AI thật, **không** thu tiền, **không** có Python service hay Chrome Extension.

---

## 2. Audit Before Build

### Repository đã kiểm tra
`projects/Tool MediaClear Pro` — **0 file, 0 thư mục** tại thời điểm bắt đầu. Không có `.git`
riêng (git root khi đó là `/home/coder/workspace`).

### View / API / state đã kiểm tra
Không có view, route, entity, enum, state machine, migration, auth, logging hay error-handling nào
để kiểm tra — vì không tồn tại. Đã kiểm chứng bằng `ls -laR`, `find` và đối chiếu convention của
các project anh em trong workspace.

### Gap xác nhận
| Nhóm gap (theo Playbook) | Nội dung |
|---|---|
| Vocabulary | Chưa có bộ từ vựng nào → chốt mới; phát hiện bẫy `blocked` mang hai nghĩa ở hai enum |
| State machine | Chưa có → chốt mới, kèm guard cứng cho `completed` |
| UX wording | Chưa có i18n → nếu không dựng trước, Phase 1 chắc chắn hard-code chuỗi |
| Data & permission | Chưa có ranh giới tenant → đưa `workspaceId` vào mọi entity |
| Observability | Chưa có audit/telemetry → đưa `AuditEvent` + `ProviderRun` vào contract ngay |

### Những thứ **không tìm thấy** (`not found`)
`FEATURES.md` · `ARCH.md` · `API.md` · `TEST_LOG.md` · `README.md` · package manifest · framework ·
lệnh build/test · CI/CD · env vars · deployment · entity/enum/state · design system · component ·
i18n · benchmark provider · test media · giới hạn upload · telemetry · test log · git repo riêng.

Ngoài ra: `projects/audit-ads/MINI_SPEC_PLAYBOOK.md` trong workspace **không phải** Playbook v2 của
dự án này (nội dung khác, viết cho AdsOps) — đã dùng đúng bản v2 owner gửi kèm.

---

## 3. Design Choice

### Kiến trúc được chọn
Monorepo TypeScript (pnpm workspace): `packages/contracts` là nguồn sự thật duy nhất về domain;
`packages/design-tokens` + `packages/i18n` cho UX foundation; `apps/web` (Next.js App Router) và
`apps/api` (Fastify) là skeleton.

### Lý do
- Repo rỗng → không có "ngôn ngữ hiện có" để bám; prompt viết provider interface bằng TypeScript.
- Một ngôn ngữ cho web + API + contract ⇒ enum/state không bị nhân bản giữa hai runtime.
- Đủ để chạy typecheck/lint/test/build **thật** ngay trong Phase 0, thay vì chỉ có tài liệu.

### Những hướng bị loại bỏ
| Hướng | Lý do loại |
|---|---|
| Next.js + FastAPI (Python) ngay Phase 0 | Hai toolchain nhân đôi chi phí kiểm chứng khi chưa xử lý media thật; owner chỉ đạo không thêm Python service ở Phase 0 |
| Docs-only, không code | Không chạy được build/lint/typecheck/test ⇒ phase gate bắt buộc phải là `READY_WITH_BLOCKERS` vì lý do thủ tục, không phải vì rủi ro thật |
| Cho `blocked` quay lại `validating` | "Rửa" trạng thái làm mất dấu vết việc job từng bị chặn |

### Cách reuse thành phần hiện có
Không có thành phần nào trong project để reuse (repo rỗng). Những gì **đã** reuse từ môi trường:
convention của workspace (mỗi project là git repo riêng, docs nằm trong `docs/`), toolchain có sẵn
(Node 22, pnpm 10), và quy ước nhận diện người dùng theo `CLAUDE.md` (`$CODER_USER_EMAIL` →
`trieunt@matbao.com` cho git author).

---

## 4. Changed Files

Tổng: **84 file mới**, không sửa/xoá file nào (repo rỗng trước đó).

### Backend / contracts (13 + 2)
`packages/contracts/src/`: `vocabulary.ts` · `entities.ts` · `errors.ts` · `media-limits.ts` ·
`job-state-machine.ts` · `policy.ts` · `provider.ts` · `providers/noop-provider.ts` ·
`provenance.ts` · `usage.ts` · `worker.ts` · `api.ts` · `invariants.ts` · `index.ts`
(+ `package.json`, `tsconfig.json`)

`apps/api/`: `src/server.ts` · `package.json` · `tsconfig.json`

### Frontend (18)
`apps/web/app/`: `layout.tsx` · `_components/Shell.tsx` · `_components/ScreenPlaceholder.tsx` +
10 file `page.tsx` (dashboard, new-cleanup, upload-validation, projects/[projectId],
workspace/image, workspace/video, rights, provenance, usage, activity)
(+ `next.config.mjs`, `next-env.d.ts`, `package.json`, `tsconfig.json`)

`packages/design-tokens/`: `src/index.ts` · `src/tokens.css` (+ 2 file cấu hình)
`packages/i18n/`: `src/index.ts` · `src/locales/vi.json` · `src/locales/en.json` (+ 2 file cấu hình)

### Schema / migrations
**Không có.** Phase 0 không tạo migration nào (xem §5).

### Docs (12 + 9 MINI-SPEC + README)
`docs/`: `PRODUCT_SCOPE.md` · `FEATURES.md` · `ARCH.md` · `API.md` · `POLICY.md` · `DATA_MODEL.md` ·
`UX_FOUNDATION.md` · `PROVIDER_BENCHMARK.md` · `TEST_STRATEGY.md` · `DECISIONS.md` · `TEST_LOG.md` ·
`OPEN_QUESTIONS.md` (+ `PHASE_0_REPORT.md`, `PHASE_0_DECISION_LOG.md`)
`docs/mini-specs/`: `MCP-00.md` … `MCP-08.md`
`README.md`

### Tests (10)
`packages/contracts/tests/`: `vocabulary` · `media-limits` · `job-state-machine` · `policy` ·
`provider` · `provenance` · `usage` · `invariants` · `docs-consistency`
`packages/i18n/tests/i18n.test.ts`

### Cấu hình gốc (7)
`package.json` · `pnpm-workspace.yaml` · `pnpm-lock.yaml` · `tsconfig.base.json` ·
`vitest.config.ts` · `eslint.config.mjs` · `.gitignore`

---

## 5. New API / DB / State

### API
| Endpoint | Trạng thái thật |
|---|---|
| `GET /healthz` | **implemented** — trả `{ok, phase, productionAiProcessingEnabled:false, routes}` |
| 9 route `/v1/*` (uploads, validate, attestations, jobs, job detail, estimate, receipt, usage, audit-events) | **contract đã chốt**, handler trả **501 `MCP_NOT_IMPLEMENTED`** |

### DB
**Không có bảng, không có migration nào được tạo.** `DATA_MODEL.md` là contract TypeScript, chưa
phải schema. DB chưa được chọn (Q-01).

### State / enum mới
`MediaType` (2) · `CleanupOperation` (8) · `JobState` (9) · `EvidenceStatus` (5) ·
`CapabilityStatus` (4) · `Presence` (3) · `PreservationResult` (4) · `UnitType` (2) ·
`UsageEntryType` (3) · `ReleaseReason` (5) · `ApiClientKind` (2) · `ErrorCode` (27 mã).

State machine `ProcessingJob` với 4 terminal state và guard cứng tại `→ completed`.

### Contract khác đã chốt
`MediaProcessingProvider` (6 method) · `WorkerJobEnvelope`/`WorkerResultEnvelope` (điểm nối cho
Python worker tương lai) · `UsageLedgerEntry` reserve/commit/release · `INVARIANTS` (8 mục).

---

## 6. Tests

| Loại | Số lượng | Kết quả |
|---|---|---|
| Unit / contract | 57 | PASS |
| Regression (invariant) | 9 | PASS |
| Docs consistency | 6 | PASS |
| **Tổng vitest** | **72** | **72/72 PASS** |
| Typecheck (`tsc -b`) | — | PASS, exit 0 |
| Lint (eslint) | — | PASS, exit 0 (đã kiểm chứng lint thật sự quét `.ts` và `.tsx` bằng 2 vi phạm cố ý) |
| Build FE (`next build`) | 11 route | PASS, exit 0 |
| Live — API skeleton | `/healthz` 200, `/v1/jobs` 501 | PASS |
| Live — Web skeleton | 10/10 màn HTTP 200, tiêu đề tiếng Việt đúng | PASS |

### Bug thật tìm được (3)
**B-01** — `FEATURES.md` có một dòng out-of-scope viết ở **thể khẳng định** (động từ xoá/vô hiệu
hoá đứng đầu câu, không kèm phủ định); trích lẻ ra khỏi ngữ cảnh sẽ đọc thành lời hứa về năng lực
xử lý dấu ẩn, vi phạm guardrail 4. Phát hiện bởi test
`docs-consistency` (quy tắc: mọi câu nhắc tới watermark vô hình phải tự mang phủ định). Đã sửa
thành "Không xoá, không vô hiệu hoá và không cam kết kiểm soát…".

**B-02** — chính test `docs-consistency` kiểm theo **dòng**, trong khi markdown xuống dòng cứng cắt
câu làm đôi ⇒ báo nhầm 3 dòng hợp lệ là vi phạm. Sửa: ghép đoạn rồi tách theo **câu**.

**B-03** — phần mô tả B-01 trong `TEST_LOG.md` và chính báo cáo này lại trích **nguyên văn** câu vi
phạm, tức tái tạo đúng chuỗi mà guardrail 4 cấm. Sửa: diễn đạt lại thay vì trích dẫn.

Cả ba bug đều nằm ở tầng tài liệu/kiểm tra, không phải ở contract.

### Test chưa chạy và lý do
| Chưa chạy | Lý do |
|---|---|
| Integration HTTP + DB | Chưa chọn DB, chưa có schema (Q-01) |
| Migration trên DB sạch | Chưa có migration nào |
| Live verification với media thật | Chưa có provider AI thật (Q-06) và chưa có bộ media mẫu (Q-07) |
| Benchmark provider (10 kịch bản) | Như trên — mọi ô trong `PROVIDER_BENCHMARK.md` vẫn là `unknown` |
| E2E click-through bằng trình duyệt | Phase 0 chỉ có skeleton; mới kiểm ở mức HTTP + nội dung HTML |
| Kiểm tra contrast/a11y tự động | Chưa có component library |

---

## 7. Evidence Status

| Hạng mục | Trạng thái |
|---|---|
| Contract vocabulary / state machine / policy / validation / usage / provenance | **verified** — có code + test chạy thật |
| Skeleton web + API chạy được | **verified** — đã gọi thật, kết quả trong `TEST_LOG.md` |
| Build/lint/typecheck/test | **verified** — exit 0, log thật |
| Docs khớp code | **verified** — test tự động đối chiếu |
| UX foundation (token, i18n, 10 màn) | **partially_verified** — render thật nhưng chưa có nghiệp vụ, chưa test responsive/a11y |
| Bảo toàn metadata/provenance thật | **unconfirmed** — chưa đọc file thật lần nào |
| Chất lượng & chi phí provider | **unknown** — chưa gọi provider nào (Q-06, Q-07) |
| DB / storage / queue / auth | **unknown** — chưa chọn (Q-01, Q-02, Q-04) |
| 5 quyết định tạm (D-005, D-006, D-007, D-008/009, D-015) | **unconfirmed** — chờ owner duyệt |
| Câu chữ pháp lý của attestation | **unknown** — chưa ai duyệt (Q-11) |
| Benchmark provider | **blocked** — không thể đo khi chưa chọn provider và chưa có media mẫu |

---

## 8. Remaining Limits / Follow-ups

### Cố ý chưa làm trong Phase 0
Xử lý AI thật · video render worker · thu tiền · scraping · Chrome Extension · Python media worker ·
motion tracking / keyframe repair / temporal consistency · component library · migration.

### MINI-SPEC tiếp theo đề xuất (Phase 1)
1. **MCP-09 — Storage & Upload Pipeline**: chốt Q-01, upload thật + probe thật (ffprobe/exif), nối
   `validateMedia` vào dữ liệu thật.
2. **MCP-10 — Persistence & Tenant Enforcement**: DB schema + migration cho 14 entity, ràng buộc
   unique cho usage ledger, kiểm chứng cách ly workspace.
3. **MCP-11 — Provider Pilot & First Benchmark**: chọn 1 provider (Q-06), chuẩn bị media mẫu (Q-07),
   chạy đủ 10 kịch bản, điền `PROVIDER_BENCHMARK.md` bằng số thật.
4. **MCP-12 — Rights Guard Runtime**: đưa policy gate từ contract vào route thật + audit trail có
   lưu trữ.

### Cần owner quyết trước khi Phase 1 chạm vào contract
Q-01 (DB/storage) · Q-03 (giới hạn định dạng/pixel) · Q-04 (auth) · Q-06 (provider) · Q-08
(`blocked` terminal?) · Q-09 (scope attestation) · Q-10 (đơn vị tính phí).

---

## 9. Phase Gate Decision (lượt đầu, 2026-09-15 sáng)

## **READY_WITH_BLOCKERS** — *đã được thay thế, xem §10*

**Vì sao không phải `NOT_READY`**: mọi tiêu chí Definition of Done về foundation đã đạt — có audit
trước build, scope và vocabulary đã chốt, có policy/rights guard contract, có media validation
contract, có provider abstraction + benchmark plan, có metadata/provenance contract, có UX
token/navigation, có usage ledger contract, có test strategy + invariant test, docs đầy đủ, và
build/lint/typecheck/test đều chạy thật và xanh.

**Vì sao không phải `READY_FOR_PHASE_1` lúc đó**: còn 7 blocker cần owner quyết (Q-01, Q-03, Q-04,
Q-06, Q-08, Q-09, Q-10) và 5 quyết định tạm đang chống đỡ các contract quan trọng.

---

## 10. Gate closure (2026-09-15, sau owner decisions)

Owner đã quyết cả 7 câu hỏi chặn. Các quyết định được áp dụng vào contract/config/docs/test, chạy
lại toàn bộ kiểm tra, và gate được đánh giá lại.

| | Lượt đầu | Sau gate closure |
|---|---|---|
| Câu hỏi chặn | 7 | **0** |
| Quyết định `provisional` | 5 | **0** |
| Error code | 27 | **39** (kèm HTTP/retry/release) |
| Entity | 14 | **15** |
| Invariant | 8 | **12** |
| Test | 72 | **136** (17 file, 0 fail, 0 skip) |
| i18n key | 107 | **127** |
| Route API | 10 | **11** (10 route nghiệp vụ vẫn trả 501) |
| MINI-SPEC | MCP-00…08 | + **MCP-09** (tenancy), **MCP-10** (storage) |
| Giới hạn media | < 200 MB, < 10:00, không giới hạn pixel video | **≤ 199 MB, ≤ 09:59, ≤ 3840×3840** |

### Phase Gate Decision hiện hành

## **READY_FOR_PHASE_1**

Chi tiết căn cứ từng điều kiện, danh sách file thay đổi, kết quả test và giới hạn còn lại:
**`PHASE_0_GATE_CLOSURE_REPORT.md`**.

**Agent không bắt đầu Phase 1.**
