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


---

# Quyết định Phase 1.1 (2026-09-15)

> Prompt Phase 1.1 gợi ý dùng D-024…D-027, nhưng repository **đã dùng** các ID đó ở Phase 1.
> Theo đúng yêu cầu "không tạo duplicate ID", Phase 1.1 tiếp tục từ **D-029**.

## D-029 — Canonical ID có tiền tố phase cho MINI-SPEC (Q-16)

- **Context**: `MCP-10` đã được publish ở **cả hai** phase với hai nội dung khác nhau (Object Storage
  Abstraction ở Phase 0, Authentication & Workspace Boundary ở Phase 1); riêng chuỗi `MCP-10` xuất
  hiện 37 lần trong tài liệu. Mã nguồn lại dùng quy ước thứ ba (`MCP-10-P1`).
- **Decision**: canonical ID là `P<phase>-MCP-<nn>`; lập `docs/MINI_SPEC_INDEX.md` ánh xạ
  canonical ↔ historical; **giữ nguyên** tên file và nội dung lịch sử; MINI-SPEC mới bắt buộc mang
  tiền tố phase (kể cả trong tên file); `API_ROUTES.mcp` chuyển sang canonical ID.
- **Alternatives considered**: (a) đổi tên 17 file lịch sử cho khớp — bị loại vì phá mọi đường dẫn đã
  trích dẫn trong báo cáo đã publish, tức là sửa lịch sử; (b) giữ nguyên hiện trạng và "nhớ trong
  đầu" — bị loại vì đây chính là thứ đã gây mơ hồ.
- **Consequences**: có một chỗ duy nhất để tra ID; test chặn trùng canonical ID, chặn file không có
  trong index, và chặn `API_ROUTES` trỏ tới MINI-SPEC không tồn tại. Điểm mơ hồ còn lại: `MCP-10`
  đứng một mình trong tài liệu cũ vẫn phải đọc theo thư mục chứa nó.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-030 — Khoản giữ mức dùng hết hạn sau 30 phút (Q-17)

- **Context**: Phase 1 tạo `reserve` mà không có hạn; chưa có worker nên khoản giữ tồn tại vô thời hạn
  và bị đếm là "đang giữ" mãi mãi.
- **Decision**: `USAGE_RESERVATION_TTL_SECONDS = 1800`; `expires_at = reserved_at + TTL`; vòng đời
  `reserved → expired → released` (và `reserved → released`, `reserved → committed`); hoàn trả khi hết
  hạn là **idempotent**; **không** commit khoản đã hết hạn/đã hoàn trả; hết hạn **không** đổi
  `ProcessingJob.state`. Trạng thái khoản giữ được **suy ra** từ sổ mức dùng + đồng hồ, không lưu cột
  trạng thái thứ hai.
- **Alternatives considered**: (a) thêm bảng `usage_reservations` riêng — bị loại vì trùng dữ liệu với
  sổ append-only và tạo khả năng hai nguồn nói khác nhau; (b) để worker tự đổi trạng thái job khi hết
  hạn — bị loại vì trộn hai vòng đời khác nhau.
- **Consequences**: `GET /v1/usage` tách ba nhóm (đang giữ / đã hết hạn giữ / đã tính). Cần ai đó gọi
  lệnh hoàn trả — worker production là follow-up, đã ghi rõ.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-031 — Retention policy v1, chỉ có bản thử, không có đường xoá (Q-18)

- **Context**: Không có `last_accessed_at`, không có trạng thái lưu giữ, không có lệnh dọn nào — audit
  trả về `not found` gần như toàn bộ.
- **Decision**: áp bảng luật theo **lớp dữ liệu** (source/output 30 ngày theo lần truy cập cuối, trung
  gian 7 ngày, xem thử 24 giờ, audit 365 ngày, sổ mức dùng 24 tháng, dấu vết đã xoá 30 ngày); 4 trạng
  thái lưu giữ; thêm 6 field có lý do riêng; chỉ hiện thực **bản thử (dry-run) chỉ đếm**.
  **Không** route xoá, **không** cờ `--force`, **không** xoá dữ liệu trong migration.
- **Alternatives considered**: (a) làm luôn lệnh dọn thật có cờ an toàn — bị loại vì chưa có worker,
  chưa có sao lưu, chưa có luồng khôi phục: bật xoá lúc này là rủi ro dữ liệu không đổi lấy được gì;
  (b) để luật trong truy vấn SQL — bị loại vì không kiểm được ca biên và bản thử sẽ khác bản chạy thật.
- **Consequences**: trả lời được "tệp này giữ tới bao giờ" và "nếu dọn thì dọn gì"; chưa dọn được cái
  nào. Audit event và sổ mức dùng **không bao giờ** bị dọn theo retention của asset.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

## D-032 — Câu chữ tiếng Việt và phiên bản 2 của nội dung xác nhận quyền (Q-19)

- **Context**: Owner duyệt bộ câu chữ chính thức. Câu xác nhận đang dùng (v1) **có thêm** mệnh đề
  trách nhiệm mà bản duyệt không có — tức là đổi nghĩa, không phải sửa chính tả.
- **Decision**: dùng đúng bản owner duyệt; **lên phiên bản 2** cho nội dung xác nhận
  (`RIGHTS_STATEMENT.version = 2`, khoá `rights.attestation.v2.*`); giữ nguyên khoá v1 trong file dịch
  làm dấu vết lịch sử; CTA chính đổi theo bản ưu tiên; mở rộng lớp chặn tài liệu để bắt cả cách gọi mới.
- **Alternatives considered**: sửa chữ mà giữ nguyên version — bị loại vì hệ thống lưu
  `statementVersion` trên từng lời khai để chứng minh người dùng đã đồng ý với văn bản nào; hai văn bản
  khác nhau cùng mang số 1 sẽ phá chính bằng chứng đó.
- **Consequences**: mọi lời khai ký theo v1 trở thành `stale` và phải xác nhận lại — đúng cơ chế
  Phase 0 đã thiết kế, nay chạy thật lần đầu (đã kiểm chứng live). Câu cảnh báo về dấu hiệu nhận diện
  vô hình trong prompt bị cắt giữa chừng nên chỉ dùng phần đọc được (Q-20).
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro


---

# Quyết định đóng Q-20 (2026-09-15)

> ID tiếp theo chưa dùng sau khi audit toàn bộ decision log (D-001…D-032) là **D-033**.

## D-033 — Câu chữ canonical về phạm vi hỗ trợ và giới hạn dấu hiệu nhận diện (Q-20)

- **Context**: Q-20 mở vì câu cảnh báo trong prompt Phase 1.1 bị cắt giữa chừng, nên hệ thống chỉ
  dùng phần đọc được. Bản vá đóng Q-20 cung cấp bộ câu chữ canonical. Audit cho thấy câu phạm vi
  tiếng Việt và câu xác nhận quyền **đã khớp từng chữ** từ Phase 1.1; thứ còn thiếu là bản English
  đúng từ ngữ owner, câu nói về dữ liệu còn sót trong tệp, và **cấu trúc hiển thị** của hộp thoại.
- **Decision**:
  1. **Không tạo phiên bản tuyên bố mới.** Văn bản được ký vẫn là `rights.attestation.v2.statement`
     và **không đổi một chữ nào**; các đoạn phạm vi/cảnh báo là **ngữ cảnh hiển thị kèm**, không phải
     văn bản ký.
  2. Dùng lại khoá sẵn có cho ba trong năm khoá prompt gợi ý (bảng ánh xạ ở `POLICY.md` §16); chỉ
     thêm ba khoá mới cho tiêu đề mục, nhãn phiên bản và câu về dữ liệu còn sót. Khoá mới **không gắn
     version** vì là nhãn giao diện.
  3. Bản English dùng đúng từ ngữ owner ở phần đọc được (`trademarks`, `identifying ma…`); chữ cuối
     hoàn thành là `marks`, đánh dấu `unconfirmed` (Q-21) thay vì im lặng chọn.
  4. Hộp thoại dựng lại theo ba mục: **Phạm vi hỗ trợ** → **Xác nhận quyền sử dụng** →
     **Phiên bản tuyên bố: vN**.
- **Alternatives considered**: (a) tạo v3 cho tuyên bố — bị loại vì thay đổi không chạm văn bản ký,
  tạo v3 sẽ buộc mọi người dùng ký lại mà không bảo vệ thêm được gì; (b) đổi tên hàng loạt bộ khoá
  `rights.attestation.v2.*` sang tên không gắn version — bị loại vì prompt cảnh báo đúng rủi ro này
  và Phase 1.1 đã trả giá một lần (đổi tiền tố hàng loạt làm lộ khoá thô ra giao diện); (c) tự viết
  tiếp phần câu bị cắt — bị loại vì đó là bịa nội dung pháp lý.
- **Consequences**: bằng chứng của các lời khai đã ký còn nguyên; người dùng đã ký v2 **không** phải
  ký lại; giao diện hiển thị đúng cấu trúc owner yêu cầu. Còn hai điểm chờ owner: chữ cuối bản English
  (Q-21) và có version hoá phần ngữ cảnh hay không (Q-22).
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

---

# Quyết định ghi nhận trạng thái Q-21 (2026-09-16)

> ID tiếp theo chưa dùng sau khi audit toàn bộ decision log (D-001…D-033) là **D-034**.
>
> **Lưu ý thứ tự:** quyết định này mang số nhỏ hơn D-035 nhưng ra đời **sau** một ngày. Số ID
> chạy theo **số hiệu câu hỏi** (Q-21 → D-034, Q-22 → D-035) theo chỉ đạo của owner, không
> chạy theo ngày. Xem D-036.

## D-034 — Câu English của phạm vi hỗ trợ giữ nguyên trạng thái chưa được duyệt (Q-21)

- **Context**: Bản vá Q-20 dùng bản English của câu phạm vi lấy từ prompt owner, nhưng prompt **bị
  cắt ở "identifying ma"**. Repo giữ đúng chữ owner viết ở phần đọc được và hoàn thành chữ cuối thành
  `marks`. Chữ đó là **suy ra**, không phải owner duyệt, và phần bị cắt có thể còn dài hơn một chữ.
  Cho tới lượt này, trạng thái "chưa được duyệt" chỉ tồn tại dưới dạng một dòng chữ trong
  `OPEN_QUESTIONS.md` — không có gì ngăn việc sửa chuỗi mà quên cập nhật dòng đó, hoặc đóng dòng đó
  trong khi chuỗi vẫn là bản agent tự hoàn thành.
- **Decision**:
  1. **Không viết tiếp phần câu bị cắt.** Giữ nguyên chuỗi English hiện tại, không thêm một ký tự nào.
  2. **Không đóng Q-21.** Câu hỏi vẫn `unconfirmed` cho tới khi owner gửi bản đầy đủ.
  3. Dựng **ràng buộc hai chiều có test chấp hành**: chuỗi English bằng bản-suy-ra **khi và chỉ khi**
     Q-21 còn `unconfirmed`. Sửa chuỗi mà quên cập nhật Q-21 ⇒ đỏ. Đóng Q-21 mà chuỗi không đổi ⇒ đỏ.
  4. Ghi trạng thái bằng chứng của giao diện English là **`partially_verified`**, không phải
     `confirmed`: giao diện chưa có nút đổi ngôn ngữ nên bản en không kiểm được bằng mắt.
  5. Bổ sung hai chốt parity bản dịch: không giá trị nào trong `en.json` còn dấu tiếng Việt; không
     khoá nào có `vi === en` ngoài danh sách miễn trừ ghi rõ lý do (`app.name` — tên sản phẩm).
- **Alternatives considered**: (a) tự hoàn thiện câu English cho đủ nghĩa — **loại**, đó là bịa nội
  dung pháp lý, và prompt owner đã bị cắt tới lần thứ ba; (b) xoá hẳn câu English — **loại**, người
  dùng English mất thông tin phạm vi, mất nhiều hơn được; (c) chỉ thêm ghi chú vào tài liệu — **loại**,
  đó đúng là hiện trạng và hiện trạng không chặn được gì; (d) đánh dấu `confirmed` vì "chữ `marks` gần
  như chắc chắn đúng" — **loại**, "gần như chắc chắn" không phải chữ ký của owner.
- **Consequences**: Q-21 **vẫn mở** — lượt này đóng *công việc ghi nhận và canh giữ*, không đóng câu
  hỏi. Khi owner gửi bản English đầy đủ, việc sửa khoá i18n và việc cập nhật Q-21 buộc phải xảy ra
  **cùng lúc**, nếu không test đỏ. Không đụng tới D-035 (nhãn ô tick Q-22), không đụng văn bản đã ký.
- **Status**: `confirmed` (đây là quyết định về **cách xử lý** trạng thái chưa rõ, không phải quyết
  định về nội dung câu chữ) · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro


---

# Quyết định đóng Q-22 (2026-09-15)

> ID tiếp theo chưa dùng sau khi audit toàn bộ decision log (D-001…D-034) là **D-035**.

## D-035 — Ô tick xác nhận quyền hiển thị thẳng câu được ký (Q-22)

- **Context**: Sau bản vá Q-20, hộp thoại xác nhận quyền hiển thị bốn đoạn văn: câu phạm vi hỗ trợ,
  câu về dữ liệu nguồn gốc còn sót, câu về giới hạn dấu hiệu nhận diện không nhìn thấy được, và câu
  xác nhận quyền. Nhưng ô tick ghi *"Tôi đã đọc và xác nhận **nội dung trên**"* — chữ "nội dung trên"
  trỏ vào cả bốn đoạn, trong khi hệ thống chỉ version hoá và chỉ lưu **một câu duy nhất**
  (`rights.attestation.v2.statement`) làm bằng chứng. Người dùng tick vào một phạm vi rộng hơn thứ họ
  thực sự ký, còn bản ghi lưu lại thì hẹp hơn thứ giao diện ngụ ý.
- **Decision**:
  1. **Nhãn ô tick chính là câu được ký.** Hộp thoại không còn nhãn tóm tắt riêng; `<label>` của ô
     tick render trực tiếp `rights.attestation.v2.statement`.
  2. Câu được ký **chỉ xuất hiện đúng một chỗ** trong hộp thoại. Thẻ `<p>` riêng chứa câu này bị bỏ,
     nên nhãn hiển thị và văn bản lưu làm bằng chứng không thể lệch nhau.
  3. **Không** version hoá phần ngữ cảnh. Ghi rõ ranh giới trong `POLICY.md`: chỉ câu xác nhận quyền
     là bằng chứng có version; tiêu đề mục, câu phạm vi và hai câu cảnh báo là ngữ cảnh hiển thị.
  4. **Không tạo statement v3.** `RIGHTS_STATEMENT.version` giữ nguyên `2` vì văn bản được ký không
     đổi một ký tự nào.
  5. Khoá nhãn cũ `rights.attestation.v2.checkbox` bị **xoá khỏi cả hai locale** để nhãn mơ hồ không
     quay lại được. Khoá lịch sử `rights.attestation.v1.checkbox` **giữ nguyên** làm dấu vết hộp
     thoại v1.
- **Alternatives considered**: (a) đổi nội dung khoá `v2.checkbox` thành câu canonical — bị loại vì
  cùng một câu nằm ở hai khoá, sau này sửa một khoá quên khoá kia thì nhãn ô tick và văn bản ký lệch
  nhau trong im lặng, đúng loại lỗi Q-22 muốn chặn; (b) version hoá cả bộ ngữ cảnh thành v3 — bị loại
  vì buộc mọi người đã ký v2 phải ký lại dù câu họ ký không đổi, và owner cấm tạo v3; (c) giữ nhãn cũ
  và chỉ thêm giải thích bên dưới — bị loại vì không sửa được chỗ mơ hồ, chỉ thêm chữ.
- **Consequences**: lời khai đã ký còn nguyên, không ai phải ký lại; thứ người dùng tick bằng đúng
  thứ hệ thống lưu; API, schema, số route và migration không đổi. Q-21 (chữ cuối bản English của câu
  phạm vi) **vẫn để ngỏ** — Q-22 không đụng tới khoá đó.
- **Status**: `confirmed` · **Date**: 2026-09-15 · **Owner**: Owner MediaClear Pro

---

# Quyết định về cách đánh số ID (2026-09-16)

> ID tiếp theo chưa dùng sau khi audit toàn bộ decision log (D-001…D-035) là **D-036**.

## D-036 — Đánh số ID theo số hiệu câu hỏi, và ngoại lệ đánh số lại cho Q-21/Q-22

- **Context**: D-029 quy định canonical ID là **ổn định — không đổi, không tái sử dụng**. Bản vá Q-22
  hoàn thành trước (commit `4125966`) nên ban đầu nhận `P1.1-Q22-MCP-21` và `D-034`; bản vá Q-21 hoàn
  thành sau (commit `0bd8420`) nhận `P1.1-Q21-MCP-22` và `D-035` — tức số chạy theo **thứ tự hoàn
  thành**. Owner sau đó chỉ định rõ, **hai lần**, cách đánh số khác: `P1.1-Q21-MCP-21` + `D-034` cho
  Q-21 và `P1.1-Q22-MCP-22` + `D-035` cho Q-22 — tức số chạy theo **số hiệu câu hỏi**.
- **Decision**:
  1. **Quy ước đánh số**: số cuối của canonical ID và số decision chạy theo **số hiệu câu hỏi**, không
     theo thứ tự hoàn thành. Q-21 → `P1.1-Q21-MCP-21`, `D-034`. Q-22 → `P1.1-Q22-MCP-22`, `D-035`.
  2. **Ngoại lệ một lần đối với D-029**: bốn ID đã phát hành ở hai commit trên được **đánh số lại**
     theo quy ước trên. Đây là ngoại lệ có chủ đích, không phải tiền lệ: nó chỉ được phép vì repo
     **chưa có remote, chưa push**, nên bốn ID đó chưa bao giờ rời khỏi máy này.
  3. **D-029 vẫn còn hiệu lực** cho mọi ID khác và cho mọi ID từ đây về sau. Từ giờ ID đã phát hành
     không được đánh số lại nữa; thay vào đó ID phải được chọn đúng ngay từ đầu theo quy ước ở (1).
  4. Decision log giữ **thứ tự số tăng dần**, nên D-034 (Q-21, 16-09) đứng trước D-035 (Q-22, 15-09).
     Ngày trong từng mục là ngày thật, **không** bị sửa cho khớp thứ tự.
- **Alternatives considered**: (a) giữ nguyên số cũ và giải thích chênh lệch trong báo cáo — bị loại vì
  owner đã chỉ định cách đánh số hai lần, và đây là quy ước của chủ dự án; (b) đánh số lại nhưng cũng
  sửa ngày cho khớp thứ tự — **bị loại**, sửa ngày là làm sai hồ sơ; (c) bỏ hẳn D-029 — bị loại, quy
  tắc ổn định ID vẫn đúng và vẫn cần, chỉ cần một ngoại lệ có ghi chép.
- **Consequences**: thông điệp commit của `4125966` và `0bd8420` vẫn nhắc ID **cũ** — git không sửa
  lại được và cũng không nên sửa. Bảng đối chiếu cũ ↔ mới nằm ở `docs/PHASE_1_1_Q21_Q22_CLOSURE.md` §2,
  đó là chỗ tra khi đọc hai commit đó.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

# Quyết định Phase 2 (2026-09-16)

> ID tiếp theo chưa dùng sau khi audit toàn bộ decision log (D-001…D-036) là **D-037**.

## D-037 — Lưu trữ bền vững bằng PostgreSQL, có trình chạy migration (P2-MCP-23)

- **Context**: `/healthz` tự khai `persistence: { durability: 'ephemeral' }`. Khởi động lại API là
  mất sạch workspace, project, asset và **lời khai quyền sử dụng** — đúng thứ mà Q-19, Q-20, Q-22
  dựng lên làm **bằng chứng**. Trong các lượt kiểm live trước, việc này đã xảy ra ít nhất năm lần.
  `PHASE_1_REPORT.md` §11 còn ghi rõ: chưa có trình chạy migration, nên chạy migration lần hai trên
  DB có dữ liệu sẽ lỗi.
- **Decision**:
  1. Thêm `PostgresPersistence` hiện thực đủ **33 phương thức** của `PersistencePort`, tự khai
     `durability: 'durable'`.
  2. **Một bộ test hợp đồng, chạy trên CẢ HAI adapter.** Rủi ro lớn nhất khi có adapter thứ hai là
     hai adapter trôi khác nhau; viết hai bộ test là tạo ra hai định nghĩa về "đúng".
  3. Thêm trình chạy migration ghi sổ có **tổng kiểm SHA-256**. Chạy lại: không làm gì. Migration đã
     phát hành mà bị sửa nội dung: **dừng và báo lỗi**, không im lặng chạy lên.
  4. Trình chạy **tôn trọng** hai migration đã phát hành: chúng tự mở giao dịch và tự ghi sổ vào
     `schema_migrations(version)`, nên trình chạy dùng chính bảng đó làm nguồn sự thật thay vì dựng
     sổ thứ hai rồi để hai sổ nói khác nhau. Tổng kiểm nằm ở bảng riêng.
  5. **Mặc định không đổi**: không có `MEDIACLEAR_DATABASE_URL` thì vẫn chạy in-memory y như trước.
     Không có chế độ tự đoán.
  6. Migration chạy **trước khi** server nhận request đầu tiên.
- **Alternatives considered**: (a) dùng ORM (Drizzle/Prisma) — bị loại ở lượt này vì `PersistencePort`
  đã là ranh giới rõ, thêm ORM là thêm một tầng ánh xạ nữa mà chưa giải quyết thêm vấn đề nào; (b)
  bỏ in-memory, chỉ còn PostgreSQL — bị loại vì test và môi trường dev không nên bắt buộc có DB; (c)
  sửa `0001`/`0002` cho hợp trình chạy — **bị loại**, sửa migration đã phát hành đúng là thứ mà trình
  chạy này đi chặn.
- **Consequences**: lời khai quyền **sống sót qua khởi động lại** — đã kiểm bằng tay và đối chiếu
  thẳng trong database. Phát sinh migration `0003` vá ba chỗ lược đồ thiếu so với kiểu miền
  (`source_files.project_id`, `source_files.declared_media_type`, `validation_results.errors`).
  **Phiên đăng nhập VẪN mất khi khởi động lại** vì `DevIdentityProvider` giữ phiên trong bộ nhớ —
  đó là Q-14, ngoài phạm vi mục này.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-038 — Object storage S3-compatible, giữ biên upload qua API (P2-MCP-24)

- **Context**: Tệp gốc của người dùng nằm trên đĩa của đúng một máy (`local-fs-phase1`,
  `production: false`). Mất máy là mất tệp. Owner decision Q-01 đã chốt từ Phase 0: object storage là
  trừu tượng S3-compatible, đích production đầu tiên là Cloudflare R2.
- **Decision**:
  1. Thêm `S3CompatibleStorageAdapter` (R2 / MinIO / S3), tự khai `isProductionAdapter: true`.
  2. **Giữ biên upload/download qua API bằng ticket HMAC.** Không đổi sang presigned URL tải thẳng ở
     lượt này: đó là đổi kiến trúc biên, kéo theo CORS và **làm mất điểm kiểm** giới hạn kích thước
     cùng bất biến I-1 vốn đang nằm gọn một chỗ.
  3. Thêm `getObject` + `contentTypeOf` vào hợp đồng `ObjectStorageAdapter`. Route download trước đây
     đọc bằng **đường dẫn tệp** — khái niệm chỉ tồn tại với đĩa local; hợp đồng chung phải là **byte**.
  4. Tách phần ký ticket ra `upload-ticket.ts` dùng chung. Để nguyên trong adapter local thì adapter
     thứ hai chỉ còn hai lối, đều tệ: chép đôi logic ký, hoặc kế thừa adapter local.
  5. **Không tự tạo bucket** ở đường khởi động mặc định. Thiếu bucket ⇒ từ chối khởi động kèm hướng
     dẫn. Chỉ tạo khi `MEDIACLEAR_S3_CREATE_BUCKET=1`.
  6. Cấu hình **thiếu một mảnh bắt buộc thì coi như không cấu hình** ⇒ chạy đĩa local. Một cấu hình
     thiếu một nửa còn nguy hiểm hơn không cấu hình: nó chạy được một lúc rồi hỏng giữa chừng.
- **Alternatives considered**: (a) presigned URL tải thẳng lên S3 — hoãn, là MINI-SPEC riêng, lý do ở
  (2); (b) dùng `@aws-sdk` hay tự ký SigV4 — chọn `@aws-sdk/client-s3`: SigV4 tự viết dễ sai ở chỗ
  khó thấy, và đây là đường đi của **byte người dùng**; (c) bỏ adapter local — loại, dev và test không
  nên bắt buộc có S3.
- **Consequences**: byte nằm trên kho object thật, nhiều tiến trình API dùng chung được. Hợp đồng
  storage rộng thêm hai phương thức. **Chưa kiểm trên R2 thật** — mới MinIO. `deleteObject` vẫn
  không đường nào gọi, đúng theo quyết định giữ dry-run.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-039 — Xác thực bằng mật khẩu, phiên lưu trong database (P2-MCP-25, đóng Q-14)

- **Context**: Q-14 (auth provider production) mở từ Phase 1. Hệ thống chỉ có
  `DevIdentityProvider`: gõ **bất kỳ email nào** là vào được, không mật khẩu. Ở `P2-MCP-23` còn
  phát hiện phiên nằm trong một mảng bộ nhớ nên **mất mỗi lần khởi động lại**, và lược đồ không có
  bảng `sessions`. Đây đồng thời là cửa chặn đưa lên mạng: `NODE_ENV=production` thì `devAuthEnabled`
  tự tắt ⇒ không ai đăng nhập được; bật lên thì URL công khai ai gõ email nào cũng vào.
  Owner chốt Q-14 (2026-09-16): **tự làm, phiên lưu DB**.
- **Decision**:
  1. `PasswordIdentityProvider`: email + mật khẩu, phiên lưu bảng `sessions` (migration `0004`).
  2. **`scrypt` có sẵn trong Node, không argon2.** Mọi bản argon2 cho Node là **native module**,
     sẽ làm hỏng build Docker trên nền tảng không có toolchain C. Một hàm băm tốt mà chạy được ở
     mọi nơi an toàn hơn một hàm băm tốt hơn mà build hỏng — vì khi build hỏng người ta tìm đường tắt.
  3. **Chuỗi băm nằm NGOÀI kiểu `User`.** `User` đi thẳng ra API response; nếu chuỗi băm là một
     trường của nó thì chỉ cần một lần quên loại bỏ là lộ. Cổng có `users.findPasswordHash()` riêng.
  4. **Một mã lỗi duy nhất** `MCP_AUTH_INVALID_CREDENTIALS` cho: sai mật khẩu · email không tồn tại ·
     đăng ký trùng email. Tách ra là tạo kênh **dò email**. Đường đăng nhập còn luôn chạy hàm kiểm
     kể cả khi email không tồn tại, để thời gian trả lời không tố ra điều đó.
  5. **Chỉ lưu hash của token phiên.** Dump database không lộ token dùng được.
  6. Thu hồi phiên là **ghi mốc** `revoked_at`, không xoá dòng — nhất quán với nguyên tắc append-only.
  7. `CompositeIdentityProvider` giữ **cả hai** đường: `/v1/auth/dev-session` (dev_only) và
     `/v1/auth/sign-in` (thật). `isProductionProvider` chỉ `true` khi **cửa dev đã đóng** — còn cửa
     dev mở thì dù có mật khẩu, hệ thống không được tự nhận là xác thực production.
- **Alternatives considered**: (a) argon2 — loại, lý do ở (2); (b) chỉ bật xác thực thật khi có
  `MEDIACLEAR_DATABASE_URL` — **đã thử và bị test bắt là sai**: route khai `implemented` lại trả `501`
  khi chạy không DB, tức nói dối về chính nó. Độ bền của phiên là việc của **tầng lưu trữ** (đã tự
  khai ở `/healthz`), không phải việc của cổng xác thực; (c) bỏ `DevIdentityProvider` — loại, mọi test
  hiện có dùng nó để đăng nhập.
- **Consequences**: đăng nhập cần mật khẩu; phiên **sống sót khởi động lại** (kiểm bằng tay). Tài
  khoản tạo ở thời dev **không có mật khẩu** nên không đăng nhập bằng mật khẩu được — không đặt mật
  khẩu mặc định cho họ vì một mật khẩu ai cũng đoán được còn tệ hơn không có.
  **Chưa có**: đặt lại mật khẩu, xác minh email, khoá sau N lần sai, giới hạn tần suất — ba thứ cuối
  nên có **trước khi mở cho người ngoài**.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-040 — Một ảnh Docker hai vai, cấu hình đọc lúc chạy (P2-MCP-26)

- **Context**: Đưa hệ thống lên Vibe Host. Repo chưa có Dockerfile; là monorepo pnpm nên build riêng
  `apps/api` sẽ hỏng vì gói workspace nằm ở gốc. Địa chỉ API lại bị nhúng vào bundle lúc build.
- **Decision**:
  1. **Một** Dockerfile build cả workspace; chọn vai lúc chạy bằng `MEDIACLEAR_ROLE` (`api` | `web`).
     Hai website trên Vibe Host dùng chung repo, chung ảnh, khác biến môi trường.
  2. Địa chỉ API đọc **lúc chạy**: layout tiêm `window.__MCP_API_BASE__` từ `MEDIACLEAR_API_BASE_URL`.
  3. **`force-dynamic` ở layout gốc** — bắt buộc, vì Next prerender tĩnh sẽ chốt giá trị ngay lúc
     build. Đã kiểm thật: không có dòng này thì HTML tĩnh mang `__MCP_API_BASE__=""`.
  4. `ENV MEDIACLEAR_DEV_AUTH=0` **trong ảnh**, không phụ thuộc người vận hành nhớ đặt.
  5. Không chạy bằng `root`.
- **Alternatives considered**: (a) hai Dockerfile + `subdir` — loại, `subdir` đổi ngữ cảnh build nên
  mất gói workspace; (b) truyền địa chỉ API bằng build arg — loại, đổi địa chỉ là phải build lại,
  đúng thứ cần tránh; (c) giữ prerender tĩnh cho nhanh — loại, một trang tĩnh không gọi được API nào
  thì nhanh cũng vô nghĩa.
- **Consequences**: deploy được lên bất kỳ nền tảng nào nhận Dockerfile. Mất tối ưu tĩnh của Next.
  **Vibe Host không có S3** nên chạy ở đó object storage là đĩa container, **mất khi redeploy**.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-041 — Xử lý ảnh tất định bằng libvips, tách "production" khỏi "dùng AI" (P2-MCP-27)

- **Context**: Từ Phase 1 tới nay **không job nào tới `completed`**. Ba thứ cùng thiếu: không provider
  production nào được đăng ký; **không có bảng lưu kết quả** (ràng buộc
  `CHECK (state <> 'completed' OR output_asset_id IS NOT NULL)` khiến `completed` là bất khả thi);
  và không có hàm nào đưa job đi tiếp từ `queued`. Owner chốt Q-06: **làm thao tác tất định trước**.
- **Decision**:
  1. `DeterministicImageProvider` dùng **libvips (sharp)**: `crop` · `blur` · `brand_overlay` trên ảnh.
     Không gọi mô hình AI nào, không tốn tiền mỗi lần chạy, kết quả **lặp lại được**.
  2. **Tách `usesAiModel` khỏi `isProductionProvider`.** Hai khái niệm này vốn trùng nhau nên
     `/healthz` suy ra "đã bật xử lý AI" từ việc có provider production. Nay không còn trùng: provider
     tất định phục vụ traffic thật mà **không có AI**. Gộp chung sẽ khiến hệ thống **báo đã bật AI
     trong khi không hề có AI**.
  3. **Lưu `regions`** (migration `0005`). Trước đây vùng người dùng chọn bị **kiểm rồi vứt đi** —
     `ProcessingJobRequest` không có chỗ lưu, nên lựa chọn của họ biến mất trong im lặng.
  4. Bảng `output_assets`, `UNIQUE (job_id)`: mỗi job đúng một bản kết quả. Chạy lại = job **mới** (D-005).
  5. `runJob` là **hàm riêng**, không nằm trong route — worker của `P2-MCP-28` sẽ gọi đúng hàm này.
     Trigger hiện tại là route **nội bộ**, tắt mặc định.
  6. Thứ tự bắt buộc: `queued → processing → xử lý → lưu → ĐỌC LẠI và đo lại → completed → tính mức
     dùng`. Đọc lại trước khi báo xong là **bất biến I-2**.
  7. **Hệ quả hành vi**: job xin thao tác **cần AI** nay bị **chặn ngay** thay vì nằm `queued` vĩnh
     viễn. Đây là cải thiện: nói ngay "chưa làm được" tốt hơn nhận một việc không bao giờ chạy và giữ
     mức dùng của người ta.
- **Alternatives considered**: (a) chạy đồng bộ ngay khi tạo job — loại, worker sẽ phải chép lại logic;
  (b) xử lý toàn ảnh, bỏ qua `regions` — loại, đó là âm thầm bỏ lựa chọn của người dùng; (c) để
  `isProductionProvider` kiêm luôn nghĩa "có AI" — loại, xem (2).
- **Consequences**: job **tới `completed`** với kết quả thật — lần đầu tiên. `sharp` là native module,
  nhưng có bản dựng sẵn cho linux-x64/glibc nên **đã kiểm build Docker thành công**. Ảnh kết quả có
  **4 kênh** (thêm alpha) do phép ghép, trong khi ảnh gốc 3 kênh — khác biệt có thật, đã ghi lại.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-042 — Hàng đợi job trên PostgreSQL bằng `FOR UPDATE SKIP LOCKED` (P2-MCP-28)

- **Context**: `P2-MCP-27` làm job chạy được tới `completed`, nhưng **chỉ khi có người gọi tay** route
  nội bộ. Job do người dùng tạo nằm `queued` mãi mãi. Với người dùng thật thì đó là sản phẩm không
  chạy: tải tệp lên, bấm xử lý, rồi không có gì xảy ra.
- **Decision**:
  1. **Hàng đợi nằm trên PostgreSQL**, không thêm Redis. Cơ sở dữ liệu đã có sẵn và đã bền vững
     (D-038); Vibe Host **không có** Redis. Thêm một hạ tầng nữa chỉ để xếp hàng là thêm một thứ có
     thể chết riêng, phải sao lưu riêng, phải giải thích cho người vận hành riêng.
  2. Nhận job bằng **`FOR UPDATE SKIP LOCKED` trong MỘT câu lệnh** `UPDATE … WHERE id = (SELECT …)`.
     Tách làm hai câu (`SELECT` rồi `UPDATE`) để lại một khe hở mà worker khác chen vào được.
     **`SKIP LOCKED` chứ không phải chờ khoá**: nếu chờ, worker thứ hai vẫn nhận đúng job đó sau khi
     khoá được nhả — tức là vẫn xử lý hai lần, chỉ chậm hơn.
  3. **Worker không chép lại logic xử lý.** `run-job.ts` tách thành `runJob` (tìm + chuyển trạng thái
     + uỷ quyền, cho route nội bộ) và `executeClaimedJob` (làm việc trên job **đã** `processing`, cho
     cả worker lẫn `runJob`). Hai bản logic sẽ trôi khác nhau, và chỗ trôi sẽ là chỗ tính mức dùng.
  4. **Tiến trình riêng**, vai thứ ba của cùng một ảnh Docker (`MEDIACLEAR_ROLE=worker`, theo D-040).
     Job nặng không được làm chậm đường phục vụ người dùng; tắt worker để bảo trì không được làm sập
     API. Worker **không mở cổng mạng** và **không chạy migration** (migration thuộc về API — hai tiến
     trình cùng chạy migration lúc khởi động sẽ đâm vào nhau).
  5. **Một job hỏng không được làm chết worker.** Bắt lỗi trong vòng lặp, nghỉ một nhịp rồi đi tiếp —
     nếu không, một lỗi lặp lại sẽ thành vòng quay chết đốt CPU và làm đầy nhật ký.
  6. Worker **cảnh báo to** khi lưu trữ không bền vững: chạy tiến trình riêng với in-memory nghĩa là
     nó nhìn vào một kho rỗng khác hẳn của API và **không bao giờ thấy job nào**, trong im lặng.
- **Alternatives considered**: (a) Redis / BullMQ — loại, xem (1); (b) `LISTEN/NOTIFY` thay cho polling —
  hoãn, tiết kiệm được vài giây độ trễ nhưng mất job nếu worker đang ngắt kết nối lúc có `NOTIFY`, nên
  vẫn phải có polling làm nền; (c) chạy worker trong cùng tiến trình API bằng `setInterval` — loại, một
  job nặng sẽ làm chậm mọi request; (d) `SELECT … FOR UPDATE` (chờ khoá) — loại, vẫn double-charge.
- **Consequences**: job **tự chạy** không cần gọi tay — lần đầu tiên. Chưa có **retry có backoff**,
  chưa có cơ chế **cứu job kẹt ở `processing`** khi worker chết giữa chừng, chưa có ưu tiên (FIFO
  thuần, một workspace tải 1000 tệp sẽ chặn người phía sau). `SKIP LOCKED` chỉ chứng minh được trên
  PostgreSQL thật — adapter in-memory không thể chứng minh nó đúng, nên hai test then chốt bỏ qua khi
  không có `TEST_DATABASE_URL`.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-043 — Đường lấy bản kết quả về, tách hẳn khỏi đường tải tệp nguồn (P2-MCP-29)

- **Context**: `P2-MCP-27` làm job tới `completed` và ghi bản kết quả vào kho, `P2-MCP-28` làm nó tự
  chạy — nhưng **không đường nào dẫn tới tệp đó**. `/v1/assets/:assetId/download-url` luôn trả tệp
  **nguồn** (nó tra `asset.sourceFileId`), giao diện đọc `outputAssetId` mà không hiển thị ở đâu, và
  job đã xong vẫn hiện câu dẫn người dùng hiểu là chưa có gì xảy ra. Tôi chỉ chứng minh được tệp tồn
  tại bằng cách đọc thẳng MinIO. **Lấy được tệp đã làm sạch chính là sản phẩm.**
- **Decision**:
  1. **Hai route tách rời**: `GET /v1/jobs/:jobId/output` (thông tin) và
     `GET /v1/jobs/:jobId/output/download-url` (URL đã ký, hạn ngắn). Gộp một sẽ khiến mỗi lần xem
     trang lại đúc ra một URL tải mới — thừa, và làm dấu vết "đã phát quyền tải" mất nghĩa.
  2. **Đặt dưới `jobs/`**, không tạo tài nguyên `outputs/` cấp trên: `UNIQUE (job_id)` nên quan hệ là
     1–1, `jobId` đủ định danh, và giao diện đã có sẵn nó.
  3. **Hai đường tải không bao giờ nhập một** (bất biến I-1). Có test đối chứng âm khẳng định
     `download-url` của asset vẫn trả tệp nguồn.
  4. **`validated` là cổng cuối cùng, đọc thật chứ không suy ra.** Ràng buộc lược đồ đã chặn job
     `completed` khi chưa validated, nhưng cổng này không dựa vào giả định đó — đây là chỗ cuối cùng
     trước khi tệp tới tay người dùng.
  5. **`head()` trước khi ký URL**: cơ sở dữ liệu có thể còn dòng trong khi kho đã mất tệp (Vibe Host
     không có S3, đĩa container mất mỗi lần redeploy — D-040).
  6. **Trả lại `checksumSha256` + `byteSize` cho người tải** để họ tự đối chiếu, thay vì phải tin lời
     hệ thống.
  7. **Ghi dấu vết ở lúc PHÁT URL**, không phải lúc tải xong: kho phục vụ byte trực tiếp nên API không
     nhìn thấy lượt tải. Nói "đã phát quyền tải" là điều biết chắc; nói "đã tải về" thì không.
  8. **Giao diện**: job `completed` hiện thẻ kết quả thay cho thẻ "đã tiếp nhận". **Không sửa câu chữ
     owner đã duyệt** — câu `no_production_engine` chỉ thôi xuất hiện ở trạng thái nó gây hiểu nhầm.
     URL đúc khi người dùng **bấm**, không phải khi mở trang (hạn ngắn).
- **Alternatives considered**: (a) cho `/v1/assets/:assetId/download-url` nhận luôn id `out_…` — loại,
  làm mờ ranh giới nguồn/kết quả, đúng thứ bất biến I-1 tồn tại để giữ; (b) trả thẳng byte thay vì URL
  ký — loại, đẩy toàn bộ băng thông qua API và bỏ mất lợi thế của kho; (c) gộp thông tin + URL vào một
  route — loại, xem (1); (d) ghi dấu vết lúc tải xong — **không làm được**, API không thấy lượt tải đó.
- **Consequences**: người dùng lần đầu tiên lấy được tệp đã xử lý **qua API**. Chưa có `lastAccessedAt`
  cho bản kết quả nên luật lưu giữ lớp `output_asset` chưa tính được theo lần đọc gần nhất. 8 khoá
  i18n mới là **tôi viết, chưa được owner duyệt** — cần rà lại như đã làm với Q-20/Q-22. Dấu vết đếm
  URL đã phát, nên một URL không ai dùng vẫn được tính.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-044 — `unknown` không bao giờ được thành `verified` trong đánh giá bảo toàn (sửa lỗi Phase 0)

- **Context**: Tìm ra khi chuẩn bị làm biên nhận (`P2-MCP-30`). `evaluatePreservation()` của MCP-05
  gộp `'unknown'` chung với `'absent'` ở điều kiện
  `provenanceHeld = before.ai !== 'present' || after.ai === 'present'`. **Đo thật cho ra:**

  ```
  ai=unknown cả hai phía        -> {"result":"preserved","evidenceStatus":"verified"}
  ai trước=unknown, sau=absent  -> {"result":"preserved","evidenceStatus":"verified"}
  ```

  Dòng thứ hai là nặng nhất: bộ đo **đã thấy dấu vết AI biến mất** sau khi xử lý, nhưng vì trước đó
  không đọc được nên hệ thống vẫn đóng dấu *"đã kiểm chứng: giữ nguyên"*. 8 test cũ **không ca nào**
  chạm tới `'unknown'`.
- **Vì sao nó sắp gây hậu quả thật**: hệ thống **không đọc được C2PA** (Q-12 còn mở), nên bộ đo thật
  **luôn** trả `aiProvenancePresence: 'unknown'`. Nối thẳng vào hàm này thì **mọi biên nhận** sẽ mang
  một lời khai "đã kiểm chứng" không có cơ sở nào — đúng điều tệ nhất sản phẩm này có thể làm.
- **Decision**: `'unknown'` ở **bất kỳ phía nào** của `aiProvenancePresence` ⇒ `result: 'unknown'`,
  `evidenceStatus: 'unknown'`. Ý định gốc *"không có gì thì không mất gì"* **được giữ**, nhưng phải
  **đo được** là không có (`'absent'`) mới kết luận được. Phát hiện thật vẫn phải nói: metadata mất
  vẫn báo `'lost'` kể cả khi dấu vết AI không đo được.
- **Alternatives considered**: (a) để nguyên và mô tả giới hạn trong tài liệu — loại, người dùng đọc
  biên nhận chứ không đọc tài liệu; (b) ép bộ đo trả `'absent'` khi không có bộ đọc C2PA — loại, đó là
  bịa ra một phép đo chưa từng chạy; (c) bỏ hẳn trường dấu vết AI khỏi biên nhận — loại, im lặng còn
  khó hiểu hơn nói "chưa đo được".
- **Consequences**: đây là sửa **logic hợp đồng Phase 0 đã ký**, owner duyệt ngày 2026-09-16. Thêm 5
  test cho các ca `'unknown'` trước đây không được kiểm. Ba test cũ liên quan **vẫn đạt** — bằng chứng
  ý định gốc còn nguyên. Hệ quả nhìn thấy được: biên nhận sẽ nói *"chưa đo được dấu vết AI"* thay vì
  *"đã kiểm chứng"*, cho tới khi Q-12 (thư viện đọc C2PA) được chốt.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro
