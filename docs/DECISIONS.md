# DECISIONS — MediaClear Pro

Mỗi quyết định: bối cảnh → quyết định → lý do → hệ quả → trạng thái.
`confirmed` = owner đã chốt. `provisional` = agent chọn tạm, cần owner duyệt.

> **Cập nhật 2026-09-15 (gate closure): không còn mục nào ở trạng thái `provisional`.** Sáu quyết
> định tạm của Phase 0 (D-005, D-006, D-007, D-008, D-009, D-015) đã được owner xác nhận, và bảy
> quyết định mới D-017…D-023 được ghi ở cuối tài liệu.

---

## D-001 — Monorepo TypeScript (pnpm workspace)
- **Bối cảnh**: repository rỗng hoàn toàn, không có framework nào để "bám ngôn ngữ hiện có".
- **Quyết định**: pnpm workspace TypeScript: `packages/contracts`, `packages/design-tokens`,
  `packages/i18n`, `apps/web` (Next.js), `apps/api` (Fastify).
- **Lý do**: prompt Phase 0 viết `MediaProcessingProvider` bằng TypeScript; một ngôn ngữ cho cả
  web/API/contract để state và enum không bị nhân bản.
- **Hệ quả**: chạy được typecheck/lint/test/build ngay trong Phase 0.
- **Trạng thái**: `confirmed` (owner, 2026-09-15).

## D-002 — Lấy nguyên vocabulary trong prompt, không tự chế enum mới
- **Bối cảnh**: guardrail 14 cấm tạo enum trùng nghĩa với vocabulary đã có; audit cho thấy repo
  rỗng → **không có** vocabulary cũ để map.
- **Quyết định**: dùng đúng bộ giá trị trong prompt mục 5B, không thêm không bớt.
- **Hệ quả**: có test so khớp từng danh sách với spec; thêm giá trị mới phải sửa test.
- **Trạng thái**: `confirmed`.

## D-003 — Tài liệu tiếng Việt, vocabulary/API/enum tiếng Anh
- **Quyết định**: văn bản tiếng Việt; tên entity, field, enum, state, provider contract giữ English
  ổn định; UI mặc định tiếng Việt qua i18n key.
- **Trạng thái**: `confirmed` (owner, 2026-09-15).

## D-004 — Tách namespace cho giá trị `blocked`
- **Bối cảnh**: `blocked` xuất hiện ở **cả** `JobState` và `EvidenceStatus` trong spec, hai nghĩa
  khác nhau — đây là nguồn hiểu nhầm kinh điển.
- **Quyết định**: giữ cả hai (không đổi tên, để không lệch spec), nhưng ghi rõ hai namespace và
  **cấm dùng chung một cột DB**. Có test khẳng định hai enum không phải tập con của nhau.
- **Trạng thái**: `confirmed`.

## D-005 — `blocked` là trạng thái terminal
- **Bối cảnh**: cần chọn giữa "blocked → validating khi có attestation" và "blocked là terminal".
- **Quyết định**: terminal. Gỡ block = tạo `ProcessingJob` **mới**.
- **Lý do**: không "rửa" trạng thái cũ; audit trail giữ nguyên sự thật là job đó đã bị chặn.
- **Hệ quả**: `ALLOWED_TRANSITIONS.blocked = []`; invariant I-3 dễ chứng minh hơn.
- **Trạng thái**: `confirmed` — owner chốt Q-08 ngày 2026-09-15: "blocked is terminal for the current ProcessingJob; resolving the issue creates a new ProcessingJob with a new job_id".

## D-006 — Rights attestation chỉ ở scope `asset`
- **Quyết định**: không cho phép xác nhận cấp workspace/project.
- **Lý do**: xác nhận "một lần cho tất cả" biến Rights Guard thành hình thức.
- **Hệ quả**: mỗi asset cần một lần xác nhận; UX phải làm bước này nhẹ nhàng.
- **Trạng thái**: `confirmed` — owner chốt Q-09 ngày 2026-09-15: scope `asset-level`.

## D-007 — Allowlist định dạng và kích thước
- **Bối cảnh**: prompt chốt 10 phút / 200 MB nhưng **không** nói định dạng hay kích thước pixel.
- **Quyết định tạm**: ảnh `jpeg/png/webp`, cạnh 64–8000 px; video `mp4/quicktime/webm`; **chưa**
  đặt giới hạn pixel cho video (để `unknown`, không bịa số).
- **Trạng thái**: `confirmed` một phần — owner chốt Q-03 ngày 2026-09-15 giữ nguyên allowlist định dạng; **các con số giới hạn đã đổi**, xem D-018 (199 MB / 09:59 / 3840×3840). Giới hạn ảnh 64–8000 px vẫn giữ.

## D-008 — Preview không tính phí
- **Quyết định**: `PREVIEW_IS_BILLABLE = false`.
- **Lý do**: UX bắt buộc "preview trước export"; tính phí preview sẽ khiến người dùng né bước này.
- **Trạng thái**: `confirmed` — owner chốt Q-10 ngày 2026-09-15: "Preview is free".

## D-009 — `video_minute_unit` làm tròn LÊN theo phút
- **Quyết định**: `quantity = ceil(durationSeconds / 60)`; video 61 giây = 2 đơn vị.
- **Hệ quả**: không biết duration → **không** tính, trả `MCP_USAGE_QUANTITY_UNKNOWN`.
- **Trạng thái**: `confirmed` — owner chốt Q-10 ngày 2026-09-15: "Video usage is rounded up by processing minute".

## D-010 — Thời điểm reserve / commit / release usage
- **Quyết định**: `reserve` khi `validating → queued` (sau khi policy cho qua, trước khi submit
  provider); `commit` khi vào `completed`; `release` ở `failed`/`blocked`/`cancelled`.
- **Chống double charge**: mỗi `jobId` chỉ có **một** entry `commit`; đã `release` thì không commit
  lại; retry dùng lại `jobId` nên không sinh lần tính phí thứ hai.
- **Trạng thái**: `confirmed` (suy trực tiếp từ guardrail + invariant I-7).

## D-011 — Không có Python service và Chrome Extension trong Phase 0, nhưng chừa điểm nối
- **Quyết định**: thêm `WorkerJobEnvelope`/`WorkerResultEnvelope` (JSON thuần, có
  `envelopeVersion`) và `ApiClientKind` (`web` bật, `chrome_extension` mới chỉ có tên).
- **Lý do**: chỉ đạo owner 2026-09-15 — Phase sau phải gắn được mà không phá domain.
- **Trạng thái**: `confirmed` (owner, 2026-09-15).

## D-012 — API trả `messageKey`, không trả text đã dịch
- **Quyết định**: `ApiError = { code, messageKey, params? }`.
- **Lý do**: web hôm nay và extension sau này render cùng thông điệp theo locale của client; BA
  sửa wording ở một chỗ (file locale) mà không phải đụng backend.
- **Trạng thái**: `confirmed`.

## D-013 — Tiền tố mã lỗi `MCP_`
- **Quyết định**: `MCP_<DOMAIN>_<REASON>`; i18n key là `errors.<mã viết thường>`.
- **Hệ quả**: có test khẳng định **mọi** mã trong catalogue đều có bản dịch ở cả `vi` và `en`.
- **Trạng thái**: `confirmed`.

## D-014 — Mock provider phải tự khai không phải production
- **Quyết định**: `MediaProcessingProvider.isProductionProvider`; `ProviderRegistry.listProduction()`
  lọc bỏ mock; `findCapable()` chỉ trả capability `verified`.
- **Lý do**: chặn kịch bản mock lọt vào runtime thật và tạo "kết quả" giả.
- **Trạng thái**: `confirmed`.

## D-015 — Attestation hết hiệu lực sau 365 ngày
- **Quyết định**: `RIGHTS_ATTESTATION_VALIDITY_DAYS = 365` (nay nằm trong `config.ts`); đổi
  `statementVersion` cũng làm attestation cũ hết hiệu lực.
- **Trạng thái**: `confirmed` — owner chốt Q-09 ngày 2026-09-15: "Validity: 365 days".

## D-016 — Project là git repository riêng
- **Bối cảnh**: các project anh em trong workspace (`audit-ads`, `voidmix`, `Translation`, …) đều là
  repo riêng, docs nằm trong `docs/`.
- **Quyết định**: `git init` riêng cho `Tool MediaClear Pro`, theo đúng convention đó.
- **Trạng thái**: `confirmed`.

---

# Owner decisions 2026-09-15 (Phase 0 gate closure)

> Bảy quyết định dưới đây do **owner** chốt trong `MEDIACLEAR_PRO_PHASE_0_OWNER_DECISIONS_PROMPT`.
> ID tiếp tục dãy hiện có (D-001…D-016) để không trùng; bảng đối chiếu với số hiệu D-005…D-011 mà
> prompt đề xuất nằm ở cuối mục này.

## D-017 — PostgreSQL + S3-compatible object storage abstraction (Q-01)
- **Context**: Phase 0 chưa chọn database và object storage; mọi thứ liên quan persistence đều
  `unknown`, chặn cả integration test lẫn migration.
- **Decision**: PostgreSQL là database chính cho domain state (users, workspaces, projects, assets,
  jobs, usage, audit). Object storage đi qua **abstraction S3-compatible**
  (`ObjectStorageAdapter`); mục tiêu production ban đầu là **Cloudflare R2**, còn chờ deployment
  review. Media binary **không bao giờ** nằm trong PostgreSQL. Dev/test dùng adapter local/MinIO.
- **Alternatives considered**: (a) gắn thẳng SDK R2 vào domain — bị loại vì khoá hạ tầng vào một
  vendor; (b) lưu media trong Postgres large object — bị loại vì owner cấm và vì chi phí/scale.
- **Consequences**: domain code không import SDK vendor nào; `STORAGE_TARGET.deploymentReviewStatus`
  giữ `pending` cho tới khi review xong; **Phase 0 không tạo migration nào** — toàn bộ schema là
  việc của Phase 1 (xem `DATA_MODEL.md` §7).
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-018 — Media limits: 199 MB, 09:59, video ≤ 3840×3840 (Q-03)
- **Context**: Phase 0 dùng "dưới 200 MB" và "dưới 10 phút" (strict less-than), chưa có giới hạn
  pixel cho video.
- **Decision**: `MAX_FILE_SIZE_BYTES = 199 MB`, `MAX_VIDEO_DURATION_SECONDS = 599`,
  `MAX_VIDEO_WIDTH = MAX_VIDEO_HEIGHT = 3840`. Định dạng giữ nguyên: ảnh JPEG/PNG/WebP, video
  MP4/MOV/WebM. Tất cả nằm trong `packages/contracts/src/config.ts`, **không** hard-code nơi khác.
- **Alternatives considered**: giữ 200 MB / 10:00 — bị loại vì owner chốt khác; đặt giới hạn pixel
  riêng cho từng định dạng — bị loại vì phức tạp không có bằng chứng cần thiết.
- **Consequences**: các giới hạn là **inclusive** ("maximum" = giá trị lớn nhất còn hợp lệ): đúng
  199 MB và đúng 599 giây vẫn được chấp nhận, 600 giây bị từ chối. Validation phân biệt 5 nhóm lỗi
  riêng (format / size / duration / width / height). Xem Q-13 trong `OPEN_QUESTIONS.md`.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-019 — Tenancy User → Workspace → Project → Asset + 4 role MVP (Q-04)
- **Context**: Phase 0 mới có `workspaceId` trên entity, chưa có role hay ma trận quyền.
- **Decision**: chuỗi sở hữu `User → Workspace → Project → Asset`; role MVP: `owner`, `admin`,
  `member`, `viewer`. Ma trận quyền liệt kê **tường minh** trong `tenancy.ts`. Viewer không tạo
  job; member không quản lý billing/quyền sở hữu; owner quản lý workspace + thành viên; admin quản
  lý project/asset/workflow. Mọi quyết định authorization đều sinh audit event.
- **Alternatives considered**: (a) suy quyền theo thứ hạng role (owner > admin > member > viewer) —
  bị loại vì tạo quyền suy diễn nguy hiểm; (b) chỉ dùng workspace membership không role — bị loại
  vì không tách được viewer.
- **Consequences**: từ chối cross-workspace kiểm tra **trước** role và trả
  `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` (HTTP 404) để không lộ sự tồn tại của tài nguyên; thêm entity
  `WorkspaceMembership`; auth provider cụ thể vẫn là implementation decision (Q-14).
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-020 — Chưa chọn provider AI; crop/blur/static-mask là deterministic fallback (Q-06)
- **Context**: chưa chạy benchmark nào nên chưa có bằng chứng để chọn provider.
- **Decision**: **không** khoá provider production trong Phase 0. Registry giữ provider-agnostic,
  no-op provider chỉ dùng cho contract test, và phải **chuẩn bị benchmark harness trước** khi chọn
  provider. `crop`, `blur` và static-mask là **deterministic fallback**, chạy được không cần provider
  AI. Static-mask không tạo enum mới: nó là `blur`/`brand_overlay` áp lên một `NormalizedRegion` cố
  định (guardrail 14 — map vào vocabulary sẵn có).
- **Alternatives considered**: chọn tạm một provider để có số — bị loại vì sẽ tạo ra số liệu không
  có bằng chứng; thêm enum `static_mask` — bị loại vì trùng nghĩa với vocabulary đã có.
- **Consequences**: `benchmark.ts` sinh ma trận 10 kịch bản × 10 metric toàn `unknown`;
  `evaluateReadiness()` chỉ cho phép chọn provider khi không còn ô `unknown`; có hàm phát hiện số
  liệu bịa.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-021 — Error catalogue mang metadata (HTTP / retry / release)
- **Context**: owner yêu cầu mỗi error code phải có machine code, translation key, HTTP mapping,
  có được retry không, và có giải phóng usage reservation không.
- **Decision**: `ERROR_CATALOGUE` trong `errors.ts` là nguồn duy nhất; API lấy status qua
  `httpStatusFor(code)`, usage lấy hành vi qua `usageEffectOfError(code)`.
- **Alternatives considered**: bảng mapping riêng ở tầng API — bị loại vì sẽ trôi khỏi domain.
- **Consequences**: 39 error code, mỗi code có đủ 5 thuộc tính và bản dịch `vi` + `en`; đổi hành vi
  chỉ sửa một chỗ. `MCP_POLICY_WORKSPACE_MISMATCH` **bị thay** bằng
  `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` để không có hai mã trùng nghĩa.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-022 — Preview chạy trên bản proxy và không tính phí (Q-03 + Q-10)
- **Context**: owner yêu cầu "video preview phải có proxy-processing direction; không thay đổi
  source asset" và "preview không tạo nhiều provider job không cần thiết".
- **Decision**: `planPreview()` luôn trả `mode: 'proxy'`, `writesToSourceFile: false`,
  `billable: false`, và **ngân sách provider job**: 0 cho thao tác deterministic, tối đa 1 cho thao
  tác cần AI.
- **Alternatives considered**: preview chạy trên bản gốc để chính xác hơn — bị loại vì rủi ro đụng
  file gốc và chi phí; mỗi operation một provider job — bị loại vì đốt chi phí vô ích.
- **Consequences**: preview không bao giờ xuất hiện trong usage ledger; UI có thông điệp
  `preview.proxy_notice`.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-023 — Vòng đời usage: reserve khi nhận job, commit khi output verified (Q-10)
- **Context**: Phase 0 đã có reserve/commit/release nhưng chưa chốt điểm neo theo vòng đời owner mô tả.
- **Decision**: `accepted job submission → reserve → provider processing → verified output → commit`;
  provider failure hoặc user-caused validation failure → `release` theo error policy. Một `jobId`
  chỉ có một `reserve` và một `commit`.
- **Alternatives considered**: commit ngay khi submit — bị loại vì sẽ tính tiền cả job thất bại.
- **Consequences**: thêm `canReserveUsage()` (chặn `MCP_USAGE_RESERVATION_CONFLICT`) và
  `usageEffectOfError()`; job fail trước khi provider chạy thì không có reserve nên không thể commit.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## Đối chiếu số hiệu với prompt của owner

| Prompt đề xuất | ID thực dùng trong repo | Lý do |
|---|---|---|
| D-005 PostgreSQL + S3 | **D-017** | D-005 đã tồn tại (blocked terminal) |
| D-006 Media limits | **D-018** | D-006 đã tồn tại (attestation scope) |
| D-007 Tenancy + roles | **D-019** | D-007 đã tồn tại (allowlist định dạng) |
| D-008 Provider chưa chọn | **D-020** | D-008 đã tồn tại (preview miễn phí) |
| D-009 blocked terminal | **D-005** (cập nhật sang `confirmed`) | quyết định này đã có sẵn từ Phase 0 |
| D-010 Attestation 365 ngày | **D-006 + D-015** (cập nhật sang `confirmed`) | đã có sẵn |
| D-011 Preview free + làm tròn phút | **D-008 + D-009** (cập nhật sang `confirmed`) | đã có sẵn |


---

# Quyết định Phase 1 (2026-09-15)

## D-024 — Bảng route Phase 1 thay các path 'planned' của Phase 0

- **Context**: Phase 0 khai 10 route `planned` (vd `POST /v1/jobs`), chưa route nào được hiện thực.
  Prompt Phase 1 mục 8 yêu cầu bộ path lồng tài nguyên (`/v1/assets/:assetId/jobs`).
- **Decision**: dùng bộ path của Phase 1 làm chính thức; các path Phase 0 bị thay được ghi ở bảng đối
  chiếu trong `API.md` §1.1. Route nào Phase 1 chưa làm (`estimate`, `preview`, `receipt`) vẫn trả 501.
- **Alternatives considered**: (a) giữ cả hai dạng path làm alias — bị loại vì tạo hai đường làm cùng
  một việc, tài liệu và test phải nhân đôi; (b) giữ nguyên path Phase 0 — bị loại vì trái yêu cầu mới
  của owner, mà path cũ chưa có client nào dùng.
- **Consequences**: không phá vỡ gì đang chạy (chưa từng có route nào hoạt động). Test docs-consistency
  nay so **từng dòng** bảng route giữa `API.md` và `API_ROUTES`.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-025 — Phase 1 chạy trên bộ nhớ, PostgreSQL dừng ở mức schema đã kiểm chứng

- **Context**: Phase 1 cần chạy thật và test được ngay; môi trường build/test không có sẵn PostgreSQL.
- **Decision**: runtime dùng `InMemoryPersistence` (tự khai `durability: 'ephemeral'`, lộ ở `/healthz`);
  đồng thời viết `db/migrations/0001_phase1_init.sql` và **chạy thật trên một PostgreSQL 16 sạch** để
  chứng minh schema dựng được và các ràng buộc chặn thật.
- **Alternatives considered**: (a) viết adapter PostgreSQL luôn — bị loại vì test sẽ phụ thuộc DB ngoài
  và scope Phase 1 phình ra; (b) không thiết kế schema — bị loại vì sẽ nợ thiết kế đúng chỗ khó nhất.
- **Consequences**: dữ liệu mất khi restart — chấp nhận được cho Phase 1 và được nói rõ, không giấu.
  Adapter PostgreSQL là việc đầu tiên của phase sau.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-026 — Upload qua ticket ký HMAC trỏ về chính API

- **Context**: Chưa có R2/MinIO, nhưng contract `ObjectStorageAdapter` đã có `createUploadUrl`.
- **Decision**: adapter local sinh URL có chữ ký HMAC, ràng buộc bucket/khoá/content-type/trần dung
  lượng/hạn dùng, trỏ về `PUT /v1/storage/upload/:token`. Route này xác thực **bằng ticket**, không
  bằng session — đúng hợp đồng của presigned URL.
- **Alternatives considered**: (a) upload thẳng qua route có session — bị loại vì khi đổi sang R2 thì
  luồng client phải viết lại; (b) multipart form — bị loại vì thêm phụ thuộc mà không giải quyết gì thêm.
- **Consequences**: đổi sang R2/MinIO chỉ cần thay implementation của cùng port. Giới hạn đã biết:
  upload nạp vào bộ nhớ, chưa resumable.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-027 — Job bị chặn vẫn được ghi lại, nhưng từ chối quyền thì không

- **Context**: Prompt yêu cầu "job không tạo được nếu policy/media/permission fail", đồng thời yêu cầu
  có sự kiện `processing_job_blocked` và "gỡ xong tạo job mới".
- **Decision**: chặn vì **validation/attestation/provider** ⇒ ghi một `ProcessingJob` ở trạng thái
  `blocked` (có lý do, **không** giữ mức dùng) và trả lỗi kèm `jobId`. Chặn vì **quyền** ⇒ không ghi
  job nào.
- **Alternatives considered**: (a) không ghi gì cả — bị loại vì mất dấu vết và sự kiện audit bắt buộc
  sẽ không bao giờ xảy ra; (b) ghi cả khi từ chối quyền — bị loại vì cho phép người ngoài tạo rác
  trong workspace của người khác.
- **Consequences**: người dùng có màn hình "bị dừng" để tra cứu; job bị chặn là trạng thái cuối.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-028 — `/healthz` giữ dạng phẳng, không bọc envelope

- **Context**: Mọi route `/v1/*` dùng `{ok, data}`. `/healthz` là probe hạ tầng.
- **Decision**: giữ `/healthz` phẳng để công cụ giám sát đọc trực tiếp; client web có hàm riêng
  `fetchHealth()`.
- **Alternatives considered**: bọc envelope cho đồng nhất — bị loại vì probe hạ tầng thường được đọc
  bởi công cụ ngoài, không nên bắt chúng hiểu envelope của ứng dụng.
- **Consequences**: đã ghi rõ ngoại lệ này trong `API.md` §3. (Chính chỗ này từng làm giao diện kẹt ở
  trạng thái "đang tải" — xem `TEST_LOG.md`.)
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro
