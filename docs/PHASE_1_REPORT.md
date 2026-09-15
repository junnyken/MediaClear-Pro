# PHASE_1_REPORT — MediaClear Pro

- **Date**: 2026-09-15 · **Author**: Nguyễn Thiên Triều (trieunt@matbao.com)
- **Repository**: `/home/coder/workspace/projects/Tool MediaClear Pro`
- **Baseline**: Phase 0 đóng ở `READY_FOR_PHASE_1`, commit `f427efc` (trên `cd15e2b`) — **giữ nguyên**

---

## 1. Summary

Phase 1 dựng lớp SaaS và đường nhập liệu media chạy thật: đăng nhập → chọn/tạo workspace → tạo
project → tải tệp lên → đo và kiểm tra tệp từ chính byte → xác nhận quyền sử dụng → tạo lượt xử lý
qua năm cổng → xem trạng thái và mức dùng. Bốn ranh giới hạ tầng (danh tính, lưu trữ dữ liệu, lưu trữ
object, đo media) đều là cổng thay thế được và **tự khai** mình chưa phải bản production.
Phase 1 **không** có xử lý AI production: không job nào đạt `completed`, không có output nào, không
provider production nào được đăng ký.

---

## 2. Audit Before Build

**Tài liệu đã đọc**: `MINI_SPEC_PLAYBOOK.md` (bản v2 owner gửi kèm hội thoại) ·
`docs/PHASE_0_GATE_CLOSURE_REPORT.md` · `docs/PHASE_0_REPORT.md` · `docs/DECISIONS.md` ·
`docs/OPEN_QUESTIONS.md` · `docs/FEATURES.md` · `docs/ARCH.md` · `docs/API.md` ·
`docs/DATA_MODEL.md` · `docs/POLICY.md` · `docs/UX_FOUNDATION.md` · `docs/PROVIDER_BENCHMARK.md` ·
`docs/TEST_STRATEGY.md` · `docs/TEST_LOG.md` · `docs/mini-specs/MCP-00.md` … `MCP-10.md`.
Ngoài tài liệu, đã đọc **toàn bộ mã nguồn** `packages/contracts/src/*` và `apps/api/src/server.ts`.

**Repository state trước khi làm**: 2 commit, cây làm việc sạch, không remote, 136 test xanh,
không migration/SQL nào, chỉ `/healthz` chạy thật.

**Đã có sẵn và được dùng lại nguyên vẹn** (reuse-first): `authorize()` + ma trận quyền ·
`evaluateProcessingPolicy()` + luật attestation · `canTransition()` + guard `completed` +
`blocked` terminal · `validateMedia()` + `MEDIA_LIMITS` · `canReserveUsage/canCommitUsage/
computeUsageQuantity` · `ProviderRegistry` + `NoopContractProvider` · `ObjectStorageAdapter` +
`assertWritableKey` · catalogue lỗi · 12 invariant.

**Gap đã xác nhận trước khi viết dòng code nào**:

| Nhóm | Gap |
|---|---|
| Danh tính | Không có session, không có nơi gắn workspace vào request |
| Dữ liệu | Không có tầng lưu trữ nào; không có contract phân trang |
| Nhập liệu | `MediaProbe` luôn do test dựng tay — **chưa từng đọc một file thật nào** |
| Lưu trữ | Chỉ có adapter in-memory; `storageClassOf()` đọc `split('/')[1]` nên **khoá lồng sẽ trả `null`**, làm `assertWritableKey()` im lặng mất tác dụng |
| Trạng thái | Không có service nào chạy chuỗi cổng tạo job |
| Provider | `findCapable()` trả rỗng cho **cả hai** trường hợp "chưa biết" và "không hỗ trợ" |
| Giao diện | 10 màn đều là khung tĩnh, chưa gọi API lần nào |

---

## 3. MINI-SPECs Completed

Đặt tại `docs/mini-specs/phase-1/` (xem mục 11 về va chạm ID với Phase 0).

| ID | Tên | Trạng thái |
|---|---|---|
| `MCP-10` | Authentication & Workspace Boundary | **completed** — trừ IdP production (Q-14) |
| `MCP-11` | Project & Asset Library | **completed** |
| `MCP-12` | Media Intake Validation | **completed** |
| `MCP-13` | Asset Rights Attestation Gate | **completed** |
| `MCP-14` | Processing Job Creation Boundary | **completed** — dừng đúng ở `queued` vì chưa có provider |
| `MCP-15` | Upload Storage Adapter | **completed cho adapter local**; R2/MinIO là `planned`, schema PostgreSQL đã chạy thử |

---

## 4. Design Choice

- **Auth/workspace**: một composition root dựng sẵn cổng; `session → workspace context → authorize()`
  của Phase 0, không viết engine quyền thứ hai. Thứ tự **workspace trước, role sau** là một phần
  contract, không phải chi tiết nội bộ.
- **Tenancy**: mọi method của `PersistencePort` bắt buộc nhận `workspaceId`; không có `findById(id)` trần.
- **Storage**: giữ nguyên `ObjectStorageAdapter`, **mở rộng** `storageClassOf()` để nhận cả khoá phẳng
  (Phase 0) lẫn khoá lồng (Phase 1) — nếu không, lớp bảo vệ I-1 ở tầng lưu trữ sẽ im lặng biến mất.
  Upload qua ticket ký HMAC, đúng hợp đồng presigned URL (D-026).
- **Upload validation**: parser **thuần TypeScript** đọc header (PNG IHDR, JPEG SOFn, WebP VP8/VP8L/VP8X,
  ISO-BMFF `moov/mvhd/tkhd/hdlr`, EBML `Info`/`Tracks`), đọc theo đoạn chứ không nạp cả file. Không phụ
  thuộc ffmpeg lúc chạy; đúng sai được đối chứng bằng `ffprobe` trong test.
- **Rights Attestation**: append-only, bản hiệu lực là bản mới nhất khớp `(assetId, sourceFileId)`.
- **Job boundary**: một hàm chạy năm cổng theo thứ tự cố định; mỗi cổng trả `ApiError` của Phase 0 nên
  HTTP status/retry/release tự suy ra từ catalogue.
- **Usage ledger**: reserve đúng một lần mỗi job; `commit` chỉ khi có output đã kiểm chứng — Phase 1
  **chưa từng** xảy ra. Khoản đang giữ hiển thị tách khỏi khoản đã tính.
- **Provider**: phân biệt "chưa có provider production nào" (⇒ capability `unknown`, job vẫn nhận) với
  "có provider nhưng không làm được" (⇒ `provider_block`).
- **Persistence**: in-memory cho runtime, schema PostgreSQL được viết và **chạy thật trên DB sạch** (D-025).

---

## 5. Changed Files

**Backend** (mới): `app-context.ts`, `ids.ts`, `config/env.ts`, `auth/identity.ts`,
`persistence/{types,port,in-memory}.ts`, `storage/{object-key,local-fs-adapter}.ts`,
`media/{byte-source,probe,header-probe}.ts`, `observability/request-log.ts`,
`services/{result,access,audit,workspaces,projects,assets,attestations,jobs,usage}.ts`.
**Backend** (sửa): `server.ts` (viết lại thành server Phase 1: 24 route thật, xử lý lỗi, CORS, nhật ký).

**Contracts** (sửa, additive): `errors.ts` (+6 mã → 45), `api.ts` (bảng route Phase 1 + kiểu request/
response), `entities.ts` (`AuditEvent.subjectType` thêm workspace/project/membership/audit),
`storage.ts` (`storageClassOf` nhận cả hai dạng khoá).

**Frontend** (mới): `_lib/{api,use-resource}.ts`, `_components/{Ui,RightsDialog}.tsx`,
`sign-in/`, `workspaces/`, `workspaces/new/`, `projects/`, `projects/new/`,
`projects/[projectId]/upload/`, `assets/[assetId]/`, `assets/[assetId]/new-job/`, `jobs/[jobId]/`.
**Frontend** (sửa): `Shell.tsx`, `page.tsx`, `projects/[projectId]/page.tsx`, `usage/page.tsx`,
`activity/page.tsx`, `new-cleanup/page.tsx`.

**Database**: `db/migrations/0001_phase1_init.sql`, `db/verify-migration.sql`.

**Tests** (mới): `media-probe`, `phase1-auth-tenancy`, `phase1-intake`, `phase1-jobs-usage`,
`phase1-observability`, `phase1-regression`, `storage-key`, `helpers`, `apps/web/tests/ui-structure`,
và **bộ fixture media thật** `apps/api/tests/fixtures/media/` (14 tệp do ffmpeg/PIL sinh).
**Tests** (sửa): `api-contract` (đối chiếu bảng route với server thật), `docs-consistency` (so từng
dòng bảng route giữa docs và code).

**Docs**: `API.md` (viết lại, bảng sinh từ mã nguồn), `ARCH.md`, `DATA_MODEL.md`, `POLICY.md`,
`FEATURES.md`, `TEST_LOG.md`, `TEST_STRATEGY.md`, `OPEN_QUESTIONS.md`, `DECISIONS.md`,
`PROVIDER_BENCHMARK.md`, `PHASE_1_REPORT.md`, 6 MINI-SPEC.

**Config**: `package.json` (`build:packages`, `build:web` build gói trước — xem bug #3).

---

## 6. New API/DB/State

**API**: 28 route trong bảng — **24 implemented**, 3 planned (`estimate`, `preview`, `receipt` vẫn 501),
1 dev_only (`POST /v1/auth/dev-session`). Chi tiết ở `API.md` §1.

**Mã lỗi mới (6)**: `MCP_AUTHZ_SESSION_REQUIRED` (401) · `MCP_RESOURCE_NOT_FOUND` (404) ·
`MCP_VAL_REQUEST_INVALID` (400) · `MCP_VAL_NOT_VALIDATED` (409) ·
`MCP_STORAGE_UPLOAD_TICKET_INVALID` (403) · `MCP_JOB_IDEMPOTENCY_CONFLICT` (409).
Mỗi mã có đủ HTTP/retry/release và bản dịch vi + en.

**DB**: 12 bảng trong `0001_phase1_init.sql`, 6 ràng buộc bảo vệ invariant ở tầng dữ liệu
(chi tiết `DATA_MODEL.md` §9).

**State**: không thêm state mới. `ProcessingJob` đi `uploaded → validating → queued` (hoặc `→ blocked`)
qua đúng state machine của Phase 0. Không đường nào tới `completed`.

**i18n**: 127 → **235 khoá**, vi và en parity tuyệt đối.

---

## 7. Tests

| Hạng mục | Kết quả | Ghi chú |
|---|---|---|
| Unit | trong tổng số dưới | ma trận quyền, biên media, khoá object, redaction, state machine |
| Integration | trong tổng số dưới | HTTP thật qua Fastify: auth, upload byte thật, validate, attestation, job, usage |
| Regression | 11 test (R-1…R-12) + 13 test invariant Phase 0 | |
| **Tổng** | **214/214 pass**, 25 tệp, 0 fail, 0 skip | Phase 0: 136 ⇒ **+78** |
| Typecheck | exit 0 | |
| Lint | exit 0 | |
| Build (web) | exit 0 | 20 route |
| Migration trên DB sạch | exit 0 | 12 bảng, 6/6 ràng buộc chặn thật |

---

## 8. Live Verification

Chạy trên **bản đã build** (`node apps/api/dist/server.js`) + `next start`, không phải chạy từ mã nguồn.

| Kiểm | Kết quả |
|---|---|
| `GET /healthz` | 200, tự khai: identity `dev-in-memory` (không production), persistence `ephemeral`, storage `local-fs` (không production), `productionProviders: 0` |
| Auth/workspace | đăng nhập, tạo workspace (vai trò `owner`), tạo project — tất cả 200 |
| Upload validation | video **599 giây** thật: SHA-256 khớp tuyệt đối khi lưu và khi tải lại; `valid: true` |
| Permission | người dùng khác đọc asset ⇒ **404**; viewer tạo job ⇒ **403** |
| Rights gate | chưa xác nhận ⇒ **403** + job `blocked`, ledger **rỗng**; xác nhận rồi ⇒ job `queued` |
| Job creation | `queued`, `outputAssetId: null`, `providerCapability: unknown`, `productionProcessingEnabled: false` |
| Usage | `video_minute_unit × 10` (599 s làm tròn lên) ở trạng thái **đang giữ**; đã tính = 0 |
| Route chưa làm | `POST /v1/jobs/:id/preview` ⇒ **501** |
| Giao diện | bấm tay hết luồng trên Chrome thật, **0 lỗi console**; ô "giây" của ảnh hiện "Chưa xác định", không hiện 0 |
| Nhật ký | 0 lần xuất hiện token trong log máy chủ; audit 9 sự kiện đúng nghiệp vụ |

**Chưa verify được**: hành vi ở tải cao · upload đứt giữa chừng · đọc màn hình (screen reader) ·
adapter PostgreSQL/R2 thật (chưa tồn tại) · chất lượng xử lý media (chưa xử lý lần nào).

---

## 9. Evidence Status

| Hạng mục | Trạng thái |
|---|---|
| Auth boundary, tenancy, ma trận quyền | **verified** — test HTTP thật + bấm tay |
| Project/asset library, phân trang | **verified** |
| Upload byte thật, checksum, chống ghi đè, chống traversal | **verified** |
| Đo media thật (6 định dạng) và biên 199 MB / 599 s / 3840 px | **verified** — trên file thật, đối chứng `ffprobe` |
| Rights attestation gate | **verified** |
| Job boundary, `blocked` terminal, idempotency, usage reserve/release | **verified** |
| Nhật ký/audit không lộ bí mật | **verified** |
| Schema PostgreSQL | **verified** — chạy trên DB sạch; nhưng **chưa** nối vào runtime |
| Giao diện 16 màn | **partially_verified** — bấm tay hết luồng chính; chưa có test trình duyệt tự động, chưa kiểm accessibility đầy đủ |
| Bảo toàn metadata/provenance | **unconfirmed** — chưa xử lý media lần nào |
| Adapter R2/MinIO, adapter PostgreSQL, IdP production | **unconfirmed** — chưa tồn tại |
| Chất lượng & chi phí provider | **unknown** — chưa gọi provider nào; **toàn bộ ma trận benchmark vẫn `unknown`** |
| Queue runtime (Q-02), thư viện C2PA (Q-12), auth provider (Q-14), media mẫu (Q-07) | **unknown** |
| Benchmark provider | **blocked** — thiếu provider được duyệt và media mẫu |

---

## 10. Bugs Found and Fixed

Tám lỗi thật, chi tiết reproduction/nguyên nhân/cách sửa ở `TEST_LOG.md` §5. Tóm tắt:

1. **414 trên mọi upload** — `maxParamLength` mặc định 100 ký tự (test bắt).
2. **Server live chạy mã cũ** — test chạy `src`, server chạy `dist` chưa build lại (live bắt).
3. **Giao diện hiện khoá dịch thô** — `build:web` không build gói workspace trước nên Next đóng gói
   bản i18n cũ 127 khoá (bấm tay bắt).
4. **Thẻ giới hạn kẹt "Đang tải…" vĩnh viễn** — `/healthz` phẳng còn client đọc theo envelope (bấm tay bắt).
5. **API lộ lỗi nội bộ `FST_ERR_CTP_EMPTY_JSON_BODY`** — vi phạm cả contract lẫn guardrail; 200+ test
   không bắt, bấm tay bắt. Đã thêm `setErrorHandler`/`setNotFoundHandler` và mở rộng R-12.
6. **Nút bấm không đi đâu** — `<Button>` lồng trong `<Link>`; đã thêm `LinkButton` và test cấu trúc
   UI **có đối chứng âm**.
7. **Thanh bên không cập nhật sau đăng nhập** — chỉ đọc `/v1/me` lúc mount.
8. **Fixture ảnh 64×48 bị từ chối** — không phải lỗi code: cạnh nhỏ nhất hợp lệ là 64 px, fixture sai.

---

## 11. Remaining Limits / Follow-ups

- **Provider benchmark**: chưa chạy, mọi ô `unknown` (Q-06, Q-07).
- **Xử lý AI production**: chưa có — không job nào `completed`, không có output.
- **Pipeline khung hình video, bám chuyển động, trình sửa khung hình**: chưa có.
- **Adapter PostgreSQL**: schema đã chạy thử, adapter là việc đầu tiên của phase sau. Chạy migration
  lần hai trên DB đã có sẽ lỗi vì **chưa có trình chạy migration**.
- **Adapter R2/MinIO**, **IdP production (Q-14)**, **queue/worker (Q-02)**: chưa có.
- **Billing thật**: không có; ledger chỉ đo.
- **Google Drive, Chrome Extension, API công khai**: ngoài phạm vi.
- **i18n**: mới vi + en.
- **Câu hỏi mới phát sinh**: Q-16 (đánh số MINI-SPEC), Q-17 (khoản giữ mức dùng tồn tại vô thời hạn khi
  chưa có worker), Q-18 (retention), Q-19 (BA duyệt cách diễn đạt câu chữ).
- **Va chạm ID MINI-SPEC**: Phase 0 đã dùng `MCP-10` cho Object Storage Abstraction; prompt Phase 1 gán
  `MCP-10` cho Auth & Workspace. Không sửa tài liệu Phase 0; bộ Phase 1 nằm ở `docs/mini-specs/phase-1/`.
  Chờ owner quyết cách đánh số (Q-16).

---

## 12. Phase Gate Decision

## **READY_FOR_PHASE_2**

Đối chiếu từng điều kiện loại trừ của prompt mục 15:

| Điều kiện không được vi phạm | Kết quả |
|---|---|
| Build/typecheck/lint/test fail | ✅ cả bốn exit 0; 214/214 test |
| Có lỗi truy cập chéo workspace | ✅ không — R-1, R-2 và kiểm live đều 404 |
| Có output "đã hoàn thành" giả | ✅ không — không job nào tới `completed`, `outputAssetId` luôn `null` |
| Có double-charge mức dùng | ✅ không — R-10, ràng buộc `UNIQUE (job_id, entry_type)` ở DB |
| Có đường vòng qua trạng thái `blocked` | ✅ không — R-7 |
| Có ghi đè file gốc | ✅ không — R-9, chặn ở cả tầng ứng dụng lẫn tầng lưu trữ |
| Có secret bị commit | ✅ không — đã quét; khoá ký đọc từ env, thiếu thì sinh ngẫu nhiên theo phiên |
| Có contract quan trọng không có test | ✅ không — mỗi cổng và mỗi invariant đều có test gọi tên |

**Điều kiện đi kèm**: benchmark provider vẫn `unknown` — đó là **evidence status**, không phải blocker
về product decision. Không provider nào được đánh `verified` trước khi có run thật.

**Agent dừng tại đây, không bắt đầu Phase 2.**
