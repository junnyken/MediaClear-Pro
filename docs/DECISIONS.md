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

---

## D-045 — Đo dấu vết nguồn gốc trên byte thật và ghi biên nhận (P2-MCP-30)

- **Context**: `ProcessingReceipt` bắt buộc có `provenanceBeforeId` (không nhận null), nhưng repo
  **không có bảng provenance nào** và **không chỗ nào ghi provenance** — biên nhận là bất khả thi về
  mặt cấu trúc, đúng dạng lỗi `output_assets` từng mắc trước D-041.
- **Decision**:
  1. **Bộ đo chạy trên byte thật** (`libvips-metadata-v1`): đọc EXIF/ICC/XMP/IPTC để kết luận
     `originalMetadataPresence`. `aiProvenancePresence` **luôn `'unknown'`** vì hệ thống không có bộ
     đọc C2PA (Q-12). Trả `'absent'` ở đây là bịa ra một phép đo chưa từng chạy.
  2. **Đo TRƯỚC khi động vào byte**, và **đo lại trên byte đọc về từ kho** — không phải trên buffer
     trong bộ nhớ. Biên nhận phải nói về **tệp người dùng sẽ nhận**.
  3. **Tệp hỏng ⇒ `'unknown'`**, không phải `'absent'`: phép đo thất bại không phải bằng chứng.
  4. **Ràng buộc D-044 đặt luôn ở tầng dữ liệu** (`provenance_unknown_never_verified`): logic đã sửa ở
     hợp đồng, ràng buộc này chặn thêm một lần ở chỗ không đi vòng được.
  5. **Biên nhận trả CẢ hai bản ghi đo**, không chỉ id: một biên nhận trỏ tới hai id mà người đọc
     không tra cứu được thì không phải bằng chứng.
  6. **Provenance và biên nhận chỉ có `create` + `find`** — ghi xong không sửa, vì sửa nó là sửa bằng chứng.
- **Phát hiện kèm theo (đo được, không suy đoán)**: `.withMetadata()` của libvips **tự thêm** hồ sơ màu
  ICC (480 byte) và khối EXIF (180 byte) vào tệp kết quả **dù tệp gốc không có gì**
  (`NGUON exif:0 icc:0` → `KET QUA exif:180 icc:480`). Với ảnh không metadata, biên nhận ghi
  `trước=absent, sau=present` — **cả hai đều đúng**, và chênh lệch chính là thông tin người dùng cần
  biết. `evidenceStatus` vẫn `'unknown'`, không nhận vơ là đã bảo toàn thứ vốn không tồn tại. Có test
  ghim con số lại.
- **Alternatives considered**: (a) suy ra provenance từ lời khai của client — loại, đó là cái contract
  tồn tại để chống; (b) bỏ trường dấu vết AI khỏi biên nhận cho gọn — loại, im lặng khó hiểu hơn nói
  "chưa đo được"; (c) chỉ đo một lần sau khi xử lý — loại, không có số trước thì không so sánh được gì.
- **Consequences**: biên nhận đọc được qua API lần đầu tiên. Phần "dấu vết AI" của **mọi** biên nhận
  hiện là `unknown` cho tới khi Q-12 được chốt — đúng sự thật. Video chưa đo được metadata.
  `providerRunIds` luôn rỗng (bản tất định chạy trong tiến trình). **Chưa có giao diện xem biên nhận.**
  Công cụ vẫn thêm hồ sơ màu vào tệp kết quả và **chưa nói điều đó với người dùng trên giao diện**.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-046 — Ước tính không có giá vẫn phải trả lời thật, và preview không để lại rác (P2-MCP-31)

- **Context**: hai route 501 cuối cùng. Sau mục này **không route nào trong bảng còn trả 501**.
- **Decision**:
  1. **`estimatedCostUsd` luôn `null`, không bao giờ `0`.** Chưa chọn provider AI (Q-06) và chưa có bộ
     media mẫu để đo giá (Q-07) ⇒ không tồn tại bảng giá nào. `0` sẽ bị hiểu là **miễn phí** — nói dối
     theo hướng nguy hiểm nhất. Kèm `costEvidence` nói rõ lý do. Hình dạng này **đã có sẵn trong hợp
     đồng Phase 0**, chỉ chưa ai nối vào.
  2. **Số đơn vị thì đo được thật** và có ích: tính từ `measured` trên byte, bằng **chính hàm**
     `createJob` dùng. Hai đường tính khác nhau sớm muộn sẽ lệch, và người dùng bị trừ khác số đã báo.
  3. **Preview KHÔNG lưu vào kho** — trả thẳng data URI. Một object không có luật lưu giữ nào áp lên
     sẽ nằm đó mãi mãi; preview là thứ dùng một lần.
  4. **Thu nhỏ TRƯỚC khi xử lý.** Xử lý ảnh gốc rồi mới thu nhỏ thì preview "miễn phí" vẫn tốn đúng
     công suất một lượt thật — đúng thứ Q-03 muốn tránh.
  5. **`billable` / `providerJobBudget` nằm trong response**: lời tự khai kiểm tra được từ bên ngoài.
  6. **`ApiRouteStatus` khai riêng, không suy ra từ `API_ROUTES`.** Lỗi lộ ra ở mục này: khi bảng
     không còn route `'planned'` nào, kiểu đó **mất luôn** giá trị `'planned'` và mọi phép so sánh
     thành lỗi biên dịch — "các trạng thái **có thể** có" bị định nghĩa bằng "các trạng thái **đang**
     có". Vòng lặp trả 501 được **giữ lại** dù không chạy lần nào: xoá đi thì route `'planned'` tiếp
     theo sẽ lặng lẽ trả 404, tức là nói sai rằng đường đó không tồn tại.
  7. **R-11 giữ ý định, bỏ chi tiết lỗi thời.** Test cũ khẳng định preview trả 501; nay preview chạy
     thật nên chi tiết đó sai, nhưng ý định *"preview không được tính tiền"* còn nguyên giá trị và
     **quan trọng hơn trước**. Viết lại thành phép đo bút toán trước/sau trên job thật.
- **Alternatives considered**: (a) trả `estimatedCostUsd: 0` cho "gọn" — loại, xem (1); (b) lưu bản
  preview vào kho để tải lại — loại, tạo object không ai dọn; (c) xoá vòng lặp 501 vì không còn dùng —
  loại, xem (6); (d) xoá R-11 vì đã lỗi thời — loại, ý định của nó nay quan trọng hơn.
- **Consequences**: `/healthz` nay khai `plannedRoutes: 0` — vẫn **đếm** chứ không ghi cứng 0, vì hằng
  số sẽ nói dối ngay lần đầu có route `'planned'` mới. `estimatedCostUsd` còn `null` tới khi Q-06/Q-07
  chốt. Preview **chưa có giới hạn tần suất** dù mỗi lượt tốn CPU thật. Ước tính chỉ dùng được **sau**
  khi job đã tạo, tức sau khi mức dùng đã bị giữ — ước tính trước khi tạo job chưa có đường nào.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-047 — Phân trang nhật ký kiểm toán, và khoá phụ `id` là bắt buộc (P2-MCP-32)

- **Context**: `audit.listByWorkspace` chỉ có `limit` và trả mảng ⇒ nhật ký dài hơn `limit` thì phần
  còn lại **không có đường nào đọc tới**. Một bản ghi tồn tại để đối chiếu về sau mà không đọc tới
  được thì không dùng được — và nó hỏng đúng lúc cần nhất: khi có nhiều hoạt động để rà.
- **Decision**:
  1. Đổi sang **con trỏ** như các danh sách khác: `listByWorkspace(workspaceId, query?: PageQuery)`
     trả `Page<AuditEvent>`, **mới nhất trước**.
  2. **Sắp xếp theo `(occurredAt, id)` giảm dần — khoá phụ `id` là bắt buộc.** Hai sự kiện cùng mốc
     thời gian mà không có khoá phụ thì thứ tự tuỳ ý và con trỏ sẽ nhảy qua hoặc lặp lại mục. Nhật ký
     kiểm toán là nơi chuyện này xảy ra thường xuyên (một job hoàn tất ghi nhiều bút toán trong cùng
     mili-giây).
  3. **`paginateDesc` tách riêng khỏi `paginate`**: nhét hai chiều vào một hàm bằng một cờ sẽ khiến
     mỗi lần đọc phải tự hỏi "lần này chiều nào".
  4. **Con trỏ hỏng ⇒ đọc từ đầu**, không ném lỗi, không trả rỗng. Trả rỗng sẽ bị hiểu là "không có
     nhật ký nào" — sai nguy hiểm hơn nhiều.
- **Lỗi tìm ra khi làm**: hai adapter **đã lệch nhau sẵn**. PostgreSQL sắp xếp `occurred_at DESC, id
  DESC`; in-memory chỉ `b.occurredAt.localeCompare(a.occurredAt)` — **không** khoá phụ. Sắp xếp ổn
  định của V8 giữ thứ tự chèn nên hai mục cùng mốc ra id **tăng** dần, ngược hẳn PostgreSQL. Bộ test
  hai-adapter sinh ra để bắt đúng loại này.
- **Alternatives considered**: (a) tăng `limit` mặc định lên thật lớn — loại, chỉ đẩy vấn đề đi xa
  hơn; (b) phân trang theo offset — loại, nhật ký luôn có mục mới chèn vào đầu nên offset sẽ trượt;
  (c) ký con trỏ — hoãn, hiện con trỏ chỉ chứa mốc thời gian và id, không rò dữ liệu workspace khác.
- **Consequences**: đọc được toàn bộ nhật ký qua nhiều trang. **Chưa có lọc** theo loại sự kiện /
  người thực hiện / khoảng thời gian — với nhật ký dài, phân trang không thay thế được lọc. Chưa có
  giao diện xem nhật ký. Con trỏ **không ký** nên người dùng sửa tay được (vô hại, nhưng ghi lại).
- **Phát hiện kèm theo**: route này đổi `data` từ **mảng** thành `{items, nextCursor}`, và giao diện
  `activity/page.tsx` đọc nó bằng `apiFetch<AuditRow[]>`. `apiFetch<T>` chỉ là **khẳng định kiểu** —
  kiểu máy chủ và kiểu giao diện là hai khai báo **rời nhau**, nên `tsc` hai bên đều xanh trong khi
  trang Hoạt động hỏng **lúc chạy** và hiện rỗng **không báo lỗi gì**. Tôi bắt được vì đi tìm mọi nơi
  đọc route, **không phải** vì công cụ báo. Đã sửa trang đó (gom trang + nút "xem thêm"), nhưng **lỗ
  hổng kiến trúc còn nguyên**: chưa có gì buộc hai khai báo khớp nhau.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-048 — Nối ba tính năng đã chạy vào giao diện, và bốn lỗi chỉ bấm tay mới thấy (P2-MCP-33)

- **Context**: xem trước, biên nhận và hạn lưu giữ đều đã chạy thật ở tầng API nhưng **không có đường
  nào trên giao diện** — route có, test xanh, người dùng không bấm tới được.
- **Decision**:
  1. **Xem trước chỉ hiện khi job chưa xong**; xong rồi thì tệp kết quả thật có ích hơn bản proxy.
     URL đúc khi **bấm**, không phải khi mở trang (URL có hạn ngắn).
  2. **Biên nhận hiện cả phần chưa đo được** — giấu đi sẽ khiến người dùng tưởng mọi thứ đã được kiểm
     chứng.
  3. **Hạn lưu giữ**: khi tệp đã tới hạn, câu chữ phải nói rõ **hệ thống chưa xoá gì**.
- **Bốn lỗi chỉ lộ ra khi BẤM TAY** (cả bốn lọt qua 528 test, `tsc`, `eslint`):
  1. **`formatBytes` hiện "0 MB" cho tệp 5421 byte** — hàm luôn chia cho 1 MB nên **mọi** tệp dưới
     ~50 KB đều là "0 MB". Người dùng nhìn thẻ "Tệp kết quả" và hiểu rằng tệp của họ rỗng. Test duy
     nhất của hàm chỉ kiểm ca `null`. Sửa thành đổi đơn vị B/KB/MB/GB.
  2. **Câu giới hạn hiện ra là chuỗi tiếng Việt KHÔNG DẤU** viết thẳng trong mã nguồn và đi thẳng ra
     màn hình. Đổi thành **khoá i18n**; câu có dấu nằm trong tệp ngôn ngữ.
  3. **Nút "Tải tệp kết quả" mở ảnh trong tab** thay vì tải — thiếu `Content-Disposition`, và tên tệp
     khi lưu là **cả chuỗi vé đã ký**. Thêm `attachment; filename="<tên object>"`.
  4. **Mốc thời gian trang Nhật ký hiện dạng ISO thô**.
- **Alternatives considered**: (a) chỉ viết test cho giao diện thay vì bấm tay — loại, **cả bốn lỗi
  trên đều xanh hết mọi lệnh kiểm**; (b) tự chế ~20 nhãn cho loại sự kiện — loại, câu chữ là việc của
  BA/owner, DEV không tự chế.
- **Consequences**: ba tính năng nay dùng được thật. **Loại sự kiện trên trang Nhật ký vẫn hiện chuỗi
  tiếng Anh `snake_case`** — chờ câu chữ được duyệt. Toàn bộ câu chữ mới của `P2-MCP-29/31/33` **chưa
  được owner duyệt**. Chưa bấm trên màn hình nhỏ, chưa kiểm bằng trình đọc màn hình.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-049 — Tài liệu OpenAPI sinh từ bảng route, và cố ý không khai schema không kiểm được (P2-MCP-34)

- **Context**: không có tài liệu API nào máy đọc được. `docs/API.md` là bảng cho người đọc.
- **Decision**:
  1. **Sinh từ `API_ROUTES`, không viết tay.** Tài liệu viết tay sẽ trôi khỏi mã nguồn, và tài liệu
     mô tả một API **khác** với API thật thì **tệ hơn không có tài liệu** — người đọc tin nó.
  2. **CỐ Ý không mô tả schema riêng cho từng route.** Hiện không có gì kiểm chứng được những schema
     đó; viết ra là khai một thứ không ai đo — đúng lỗi `D-047` vừa vấp (kiểu giao diện và kiểu máy
     chủ là hai khai báo rời nhau nên cả hai đều "xanh" trong khi thực tế lệch). Tài liệu khai thứ
     **kiểm chứng được**: đường dẫn, phương thức, trạng thái, yêu cầu xác thực, vỏ bọc chung, và toàn
     bộ danh mục mã lỗi. Giới hạn này được nói thẳng trong `info.description` của chính tài liệu.
  3. **Route `planned` vẫn xuất hiện**, kèm câu nói rõ nó trả 501 — giấu đi sẽ khiến người đọc tưởng
     đường đó không tồn tại.
  4. **Trả ở mức gốc, không bọc `{ok, data}`**: công cụ đọc OpenAPI mong đợi thế. Ngoại lệ có chủ đích
     với quy ước vỏ bọc, giống `/healthz`.
- **Alternatives considered**: (a) viết tay schema đầy đủ cho 38 route — loại, không ai kiểm được,
  và nó sẽ trôi; (b) dùng `@fastify/swagger` sinh từ JSON Schema của từng route — hoãn, sẽ tốt hơn
  nhưng đòi khai lại schema cho toàn bộ route trước đã; (c) giấu route `planned` — loại, xem (3).
- **Consequences**: client ngoài đọc được danh sách đường dẫn và danh mục lỗi. **Không có schema thân
  request/response** — client vẫn phải đọc `docs/API.md` hoặc mã nguồn. Chưa có trang đọc tài liệu,
  chưa mô tả tham số truy vấn (`cursor`/`limit`) lẫn header `x-workspace-id`. Tài liệu chưa qua bộ
  xác thực OpenAPI chuẩn.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-050 — Tải lên nhiều mảnh, nối lại được, và mảnh không bao giờ chạm lớp `source` (P2-MCP-35)

- **Context**: một lượt tải lên là **một request `PUT` duy nhất**. Mất kết nối giữa chừng là mất toàn
  bộ. Với trần 199 MB trên đường truyền kém, đó là chuyện **thường xuyên**, không phải ca hiếm.
- **Decision**:
  1. **Lớp lưu trữ mới `staging`** cho các mảnh. Mảnh là thứ **tạm**: ghi đè được (tải lại một mảnh
     hỏng là bình thường) và bị xoá sau khi ghép. Chúng **không bao giờ** là `source`, nên
     `assertWritableKey` vẫn bảo vệ I-1 nguyên vẹn.
  2. **`receivedChunks` là thứ duy nhất làm cho "nối lại" có thật.** Không có nó, client không biết
     tải tiếp từ đâu và "nối lại được" chỉ là một cái tên.
  3. **`recordChunk` phải NGUYÊN TỬ** — trên PostgreSQL là **một câu lệnh** `UPDATE … jsonb_agg(...)`.
     Hai mảnh gửi song song mà đọc-sửa-ghi thì một trong hai **biến mất khỏi danh sách** và lượt tải
     lên "thiếu mảnh" mà không ai biết vì sao. Cùng họ với `FOR UPDATE SKIP LOCKED` của D-042.
  4. **Kiểm cỡ mảnh ngay lúc nhận**, không đợi tới lúc ghép: một mảnh thiếu byte sẽ làm tệp ghép ra
     sai, và nó chỉ lộ ở bước đo cuối cùng — lúc đã tốn công tải hết mọi thứ.
  5. **Đo lại tổng số byte trước khi ghi vào `source`**: ghi bừa vào khoá đó là **không sửa được**.
  6. **Xoá mảnh SAU KHI đã ghi và đã đánh dấu xong.** Xoá trước thì một sự cố giữa chừng làm mất **cả
     mảnh lẫn tệp gốc**. Xoá thất bại **không** làm lượt tải lên thất bại.
  7. **Mở lại phiên đã có ⇒ trả nguyên trạng thái**, không tạo phiên mới, không xoá mảnh đã gửi — đây
     chính là đường client dùng sau khi mất kết nối.
- **Alternatives considered**: (a) dùng `multipart upload` của S3 — tốt hơn hẳn về bộ nhớ nhưng đòi
  thêm phương thức vào cổng lưu trữ và **không chạy được trên adapter đĩa local**, nên hoãn; (b) ghi
  nối tiếp vào một object tạm — loại, không phải kho nào cũng cho ghi nối; (c) giữ mảnh trong cơ sở
  dữ liệu — loại, đó là việc của kho.
- **Consequences**: đứt giữa chừng rồi nối lại cho ra tệp **khớp từng byte**. **Ghép trong bộ nhớ**
  (`Buffer.concat`) — chịu được với trần 199 MB nhưng là đỉnh bộ nhớ thật mỗi lượt và **chưa đo dưới
  tải**. **Chưa có việc dọn phiên quá hạn**: phiên hết hạn bị từ chối nhưng **không ai xoá mảnh thừa**.
  **Chưa có checksum cho từng mảnh** — một mảnh hỏng đúng cỡ sẽ lọt tới bước đo cuối. **Chưa nối vào
  giao diện**; giao diện vẫn dùng đường tải lên một lần.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-051 — Hợp đồng dùng chung + kiểm lúc chạy tại biên (đóng D-047 trong phạm vi Phase 3)

- **Context**: `D-047` ghi nhận kiểu của giao diện và kiểu của máy chủ là **hai khai báo rời nhau**;
  `tsc` hai bên đều xanh trong khi trang hỏng lúc chạy. Đề bài Phase 3 bắt xử lý lỗ hổng này **trước**
  khi mở rộng job flow.
- **Decision**: chọn **phương án 3** của đề bài — canonical contract trong module dùng chung — vì
  `apps/web` **đã** phụ thuộc `@mediaclear/contracts`. Không tách package mới, **không thêm thư viện
  kiểm** (cùng lý do đã chọn `scrypt` thay `argon2` ở D-039: thêm phụ thuộc là thêm thứ có thể hỏng
  khi dựng ảnh).
  1. `schema.ts`: bộ kiểm lúc chạy viết tay, **kiểu SUY RA từ chính lịch kiểm** (`Infer<typeof …>`).
     Không thể sửa một bên mà quên bên kia **vì chúng không phải hai bên**.
  2. `JOB_STATE_SCHEMA` đọc **thẳng** từ `JOB_STATES` — không chép lại danh sách.
  3. `checkEnvelope` là **chỗ duy nhất** giao diện được phép tin dữ liệu từ máy chủ.
  4. Trường **thừa bị bỏ qua** (máy chủ thêm field không làm hỏng giao diện cũ); trường **thiếu báo
     lỗi** — đó mới là thứ phá giao diện.
  5. **Không dùng `as` để che lệch, không nới kiểu thành `any`.**
- **Consequences**: đóng lỗ hổng **cho các endpoint Phase 3**. **25 interface do giao diện tự khai**
  ở các màn hình cũ **vẫn còn** — phạm vi đó nằm ngoài Phase 3, ghi rõ ở `PHASE_3_CLOSURE.md`.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-052 — ffmpeg là phụ thuộc bắt buộc, và thiếu nó là `blocked` chứ không phải `failed`

- **Context**: toàn bộ Phase 3 là video; kho chỉ có `sharp` (**chỉ ảnh**). `ffmpeg` **không có** trong
  môi trường **lẫn** trong ảnh Docker.
- **Decision**:
  1. Thêm `ffmpeg` vào **chặng `runtime`** của `Dockerfile` (không phải chặng build) — worker mới là
     thứ cần nó. Thiếu nó thì worker nhận job video rồi **hỏng ngay** trên bản online.
  2. Hỏi `ffmpegAvailable()` **TRƯỚC khi nhận job**, không phải giữa chừng.
  3. Thiếu `ffmpeg` ⇒ job thành **`blocked`** (phụ thuộc thiếu), **không** phải `failed` (xử lý thất
     bại). Gộp hai cái làm người vận hành đi sai hướng.
  4. `probeVideo` trả `unreadable: true` khi không đọc được — **không** suy ra là "không có gì".
- **Đo được, không suy đoán**: `ffprobe` **vẫn đọc được** `corrupt.png` (`png,video`). "Đọc được bằng
  ffprobe" **không** đồng nghĩa "là video hợp lệ" — cổng kiểm media của hệ thống mới quyết định điều đó.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-053 — Ba chế độ tất định trên video, và hai lỗi chỉ lộ ra khi render

- **Decision**: `mask` (= `brand_overlay` trên vùng cố định, **đúng cách Q-15 đã chốt** — không tạo
  enum mới) · `crop` (lấy giữa, làm tròn về số chẵn cho `yuv420p`) · `blur` (làm mờ **đúng vùng**,
  không mờ toàn khung). Không cái nào là "AI cleanup", và có test khẳng định điều đó.
- **Hai lỗi thật, không thể bắt bằng đọc mã**:
  1. `boxblur` bán kính **cố định 12** bị ffmpeg từ chối trên vùng nhỏ: *"Invalid chroma_param radius
     value 12, must be >= 0 and <= 7"* — giới hạn tính theo mặt phẳng **chroma** (chỉ bằng nửa luma
     với `yuv420p`). Bán kính phải **co theo kích thước vùng**.
  2. **Một vùng thì chạy, hai vùng thì hỏng**: nhãn đầu ra của bộ lọc (`[step0]`) chỉ được **tiêu thụ
     một lần**, khác nhãn luồng (`[0:v]`) mà ffmpeg tự nhân bản. Phải chèn `split`.
  Cả hai đã có test hồi quy.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-054 — Audio là một CỔNG, không phải một trường ghi cho vui

- **Context**: đề bài nói *"không xuất video nếu audio bị mất ngoài ý muốn"*.
- **Decision**: kết luận audio **quyết định** job đi đâu — `lost` ⇒ **`failed`**; `duration_drift` /
  `unknown` / `changed_by_preset` ⇒ **`review_required`**; `preserved` / `absent_by_design` ⇒
  `completed`.
  1. **Phân biệt `absent_by_design` với `lost`** là điều quan trọng nhất: gộp hai cái biến một lỗi
     thật thành chuyện bình thường — cùng họ với `D-044`.
  2. Đo trên **byte đã đọc lại từ kho**, không trên buffer trong bộ nhớ: cái người dùng nhận được là
     tệp trong kho.
  3. Mọi đường ghi dùng `-c:a copy` — không mã hoá lại thì không thể mất tiếng vì encode hỏng.
  4. Dung sai thời lượng **`0,25` giây** (`Q-P3-03`) — **mặc định của agent, chưa được owner duyệt**.
- **Consequences**: **chưa so nội dung tiếng** — một bản render giữ đúng độ dài nhưng **tiếng bị méo**
  sẽ lọt qua. Chưa đo số kênh sau render (stereo bị ép mono).
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-055 — Preset nói về pipeline, KHÔNG nói về nền tảng

- **Decision**: `status` của preset nói về điều **hệ thống tự đo được** (tỉ lệ, codec, container mà
  pipeline thật sự sinh ra), **không** nói về việc nền tảng có chấp nhận tệp hay không.
  1. **Không preset nào mang `verified`** — tất cả `partially_verified`.
  2. `maxDurationSeconds` / `maxFileSizeBytes` đều **`null`**: giới hạn nền tảng là thứ **không đo
     được** từ repo này. Điền số lấy từ tài liệu quảng cáo chính là thứ đề bài cấm (`Q-P3-04`).
  3. `evidence` của mọi preset trỏ tới **bộ test chứng minh** pipeline sinh đúng giá trị đã khai.
  4. Tên "TikTok/Reels/Shorts" là **nhãn gợi ý** về tỉ lệ, **không phải** cam kết tương thích.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-056 — Trả lời năm câu hỏi Phase 3 bằng ĐO, không bằng phỏng đoán

- **Context**: đóng Phase 3 với `Q-P3-01`…`Q-P3-09`, trong đó vài câu được đánh `unknown` chỉ vì
  **chưa ai đi đo**, chứ không phải vì không đo được. Owner cho phép đi tìm lời giải.
- **Cách làm**: với mỗi câu, hỏi trước *"điều này đo được từ repo không?"*. Nếu được thì **đo**; nếu
  không thì nói rõ **vì sao không đo được** thay vì để một chữ `unknown` trần.

| Câu | Đo được? | Kết quả |
|---|---|---|
| `Q-P3-01` giới hạn video | **có** — đã nằm sẵn trong `MCP-03`/D-018 | 199 MB · 599 s · ≤ 3840 px · MP4/MOV/WebM |
| `Q-P3-02` codec/container thật | **có** — `ffprobe` trên byte thật | họ MP4 · `h264` · `aac`, giống nhau cho nguồn / kết quả / proxy |
| `Q-P3-03` dung sai audio | **có** — 12 lượt render | render `-c:a copy` lệch **0.000000s**; proxy (mã hoá lại) lệch `0.021995s` |
| `Q-P3-06` đã dọn dữ liệu chưa | **có** — truy vấn + đọc mã | **chưa**, và `retention.ts` **không có** lệnh xoá nào |
| `Q-P3-07` provider AI nào | **có** — đếm provider | **0** provider khai `usesAiModel`; Phase 3 không gọi AI nào |
| `Q-P3-04` tuân thủ nền tảng | **không** | phải hỏi chính nền tảng; **không** suy ra từ repo |
| `Q-P3-05` kho object chung | **không** | bản online vẫn `local-fs-phase1` ⇒ `blocked` |
| `Q-P3-08` duyệt câu chữ | **không** | quyết định của owner |
| `Q-P3-09` quy ước ID `P3-` | **không** | cách hiểu của agent, chờ owner xác nhận |

- **Phát hiện đáng giá nhất — `Q-P3-03`**: dung sai `0,25s` ban đầu là **con số agent tự đặt**. Đo
  thật cho thấy mọi đường render lệch **đúng bằng không**, vì `-c:a copy` **sao chép nguyên luồng
  tiếng** chứ không mã hoá lại. **Chỉ đường proxy** mới lệch, và chỉ `0.022s`. Nghĩa là dung sai chỉ
  có ý nghĩa với đường mã hoá lại, và `0,25s` là **≈ 11 lần** biên độ lớn nhất đo được. Con số giữ
  nguyên nhưng **nay có cơ sở**, kèm test ghim cả hai giá trị.
- **`Q-P3-06` là câu trả lời PHỦ ĐỊNH có bằng chứng**, không phải "chưa biết": `0` bản ghi bị xoá,
  `0` bản hẹn xoá, và **không dòng mã nào** gọi `deleteObject()` trong luồng lưu giữ. Phân biệt hai
  thứ này quan trọng — "chưa biết" mời người ta đi tìm, "đã đo và chưa từng chạy" thì nói thẳng rằng
  tính năng đó **chưa tồn tại**.
- **Bốn câu còn mở đều có lý do cụ thể**, không câu nào mở vì lười: hai câu cần **dữ liệu ngoài
  repo** (nền tảng, kho object của owner), hai câu là **quyết định của owner** (câu chữ, quy ước ID).
- **Consequences**: `Q-P3-04` được **thu hẹp** chứ không đóng — phần pipeline tự sinh **đã có bằng
  chứng và test**; phần chưa có là *nền tảng có chấp nhận tệp hay không*. Vì vậy preset giữ
  `partially_verified` và hai trường giới hạn vẫn `null`.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-057 — Đóng lỗ hổng số kênh tiếng, và CỐ Ý không vá một ca không xảy ra ngoài đời

- **Context**: hai giới hạn tự ghi ở `P3-MCP-30` và `P3-MCP-33`. Đi kiểm cả hai bằng đo, và **kết
  luận hai hướng khác nhau** — vì dữ liệu nói khác nhau.

**1. Số kênh tiếng — CÓ lỗ hổng thật, đã đóng.**

`channelCount` có trong lược đồ từ đầu nhưng `compareAudio` **không dùng lần nào** (đếm được: 0).
Hậu quả: stereo bị ép về mono thì tiếng **vẫn còn**, thời lượng **vẫn đúng**, nên mọi phép kiểm khác
đều qua và hệ thống báo **`preserved`** cho một bản đã mất một kênh tiếng.

Thêm kết luận `channel_changed` ⇒ **không cho phép `completed`**. Đường render hiện dùng `-c:a copy`
nên không đổi kênh (đo: 1→1, và stereo 2→2), nhưng cổng phải chặn được **bất kể** đường nào trong
tương lai làm nó đổi. Fixture stereo thật + **đối chứng âm** (ép `-ac 1` ⇒ test đỏ đúng chỗ).

`null` vẫn là "chưa đo", **không** suy ra là "không đổi" — cùng nguyên tắc `D-044`.

**2. Proxy lớn hơn bản gốc — KHÔNG vá, và đây là quyết định có cơ sở.**

| Đầu vào | Nguồn | Proxy | Tỉ lệ |
|---|---|---|---|
| fixture test (`crf 40`, 144×256) | 9 658 B | 15 908 B | **165 %** |
| video kiểu điện thoại (`crf 20`, 1080×1920) | 3 395 254 B | 59 022 B | **2 %** |

Ca "proxy lớn hơn" **chỉ xuất hiện ở fixture nén ở mức không ai dùng thật**. Với đầu vào thật proxy
nhỏ hơn **~50 lần**. Thêm phép chắn ở đây là viết mã cho một nhánh **không chạy tới ngoài đời** — mà
mã không chạy tới là mã không ai kiểm được, và nó vẫn phải được đọc, hiểu và bảo trì mãi.

**Ghi lại số đo thay vì viết mã** là câu trả lời đúng cho trường hợp này. Giới hạn trong `P3-MCP-30`
nay là một bảng số liệu chứ không phải một câu cảnh báo mơ hồ.

- **Nguyên tắc rút ra**: *"đã ghi vào phần giới hạn"* không có nghĩa *"phải vá"*. Đi đo trước; có
  cái đáng vá, có cái chỉ đáng **nói cho chính xác**.
- **Status**: `confirmed` · **Date**: 2026-09-16 · **Owner**: Owner MediaClear Pro

---

## D-058 — Đóng NỐT lỗ hổng D-047 trên toàn bộ giao diện, và dựng chốt để nó không mở lại

- **Context**: `D-051` đóng lỗ hổng cho các endpoint Phase 3. Phần còn lại — **29 lời gọi** ở 16 màn
  hình — vẫn đọc phản hồi bằng `apiFetch<T>`, tức là một **lời khẳng định kiểu không ai kiểm**.
- **Bằng chứng lỗ hổng có thật, không phải lo xa**. Đếm được trong mã trước khi sửa:

  | Thứ | Số khai báo | Khác nhau ra sao |
  |---|---|---|
  | `MeResponse` | **3** | có `email` ở `page.tsx`, không có ở `Shell.tsx` |
  | `UsageResponse` | **2** | 4 trường ở `page.tsx`, 7 trường ở `usage/page.tsx` |
  | `AssetView` | **3** | mỗi màn hình khai một mẩu khác nhau |

  Không bản nào được đối chiếu với máy chủ. Đây đúng là hình dạng đã làm trang Hoạt động hỏng **lúc
  chạy** trong khi `tsc` hai bên đều xanh.

- **Decision**:
  1. Khai **một lịch kiểm cho mỗi endpoint** trong `api-schemas.ts`; kiểu **suy ra** từ chính lịch
     kiểm. Gỡ bỏ toàn bộ `interface` tự khai ở giao diện — chúng thành mã chết, và `eslint` **tự chỉ
     ra đủ 30 chỗ**.
  2. Gỡ luôn `MeResponse` **viết tay trong `api.ts`** — nó là khai báo thứ hai cho cùng một thứ,
     đúng thứ `D-047` tồn tại để chặn.
  3. **Chốt vĩnh viễn** (`apps/web/tests/contract-boundary.test.ts`): không màn hình nào được đọc
     phản hồi bằng `apiFetch<T>`; mọi `apiFetchChecked` phải nhận một lịch kiểm; lịch kiểm phải đến
     từ `@mediaclear/contracts`, **không** khai tại chỗ. Sửa một lần không giữ được gì — chỉ cần một
     người viết `apiFetch<T>` mới là lỗ hổng trở lại, **và `tsc` vẫn xanh**.
- **Ba lỗi lộ ra ngay khi bật phép kiểm** — bằng chứng rằng nó làm việc thật:
  1. `POST /v1/workspaces` và `POST .../projects` trả object **phẳng**, không bọc trong
     `workspace:`/`project:` như tôi khai. Một `interface` viết tay sẽ **im lặng chấp nhận** hình
     dạng sai cho tới khi người dùng bấm vào.
  2. Giao diện khai `subjectId: string` trong khi máy chủ trả được **`null`** — lệch thật, chưa ai
     phát hiện vì không có gì đối chiếu hai bên.
  3. `apiFetchChecked` ban đầu nhận kiểu **cấu trúc** nên TypeScript không suy ra được `T` và mọi
     phản hồi thành `{}` — tức là mất đúng thứ đang đi sửa. Phải nhận thẳng `schema.Schema<T>`.
- **Phép chắn của tôi cũng từng báo sai**: biểu thức đầu tiên cắt ở ngoặc đóng của
  `encodeURIComponent(...)` lồng bên trong ⇒ **dương tính giả**. Đổi sang quét **cân bằng ngoặc**.
  Một phép chắn báo sai thì chẳng bao lâu sẽ bị người ta bỏ qua.
- **Đối chứng âm đã chạy**: đưa lại một `apiFetch<T>` ⇒ chốt **đỏ** ngay; khôi phục ⇒ xanh.
- **Consequences**: **0** lời gọi chưa kiểm trên toàn giao diện (trước: 29). Lỗ hổng kiến trúc ghi ở
  `D-047` **đóng hoàn toàn**, không còn "trong phạm vi Phase 3" nữa. Bấm tay lại sau khi đổi cả 30
  lời gọi: mọi trang trả `200`, biên nhận/cách xử lý/tiếng/nút quay lại tệp gốc đều hiện đúng,
  **console sạch**.
- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-059 — Rà soát câu chữ Phase 2 + Phase 3, và chốt quy ước ID `P3-`

**A. `Q-P3-08` — câu chữ.** Owner giao agent rà 77 khoá thêm từ `170b244`. Chi tiết ở
`docs/WORDING_REVIEW_P3.md`.

- Rà bằng **năm phép kiểm chạy được** trên toàn bộ 77 khoá, không đọc bằng mắt rồi kết luận.
- **Một lỗi thật**: `provenance.limitation.no_c2pa_reader` để lọt `C2PA / Content Credentials` ra
  màn hình. Tên chuẩn chính xác với người trong nghề nhưng **không mang thông tin gì** cho người
  dùng cuối, và làm câu khó đọc nên người ta bỏ qua đúng phần quan trọng nhất — *"phần này chưa được
  kiểm tra"*. Đã viết lại bằng lời thường.
- **Mở rộng phép chắn** (`i18n.test.ts`): danh sách thuật ngữ cấm nay thêm `C2PA`,
  `Content Credentials`, `checksum`, `codec`, `proxy`, `token`, `SHA-256`, `JSON`, `API`. Đối chứng
  âm đã chạy.
- **0** câu khai quá năng lực · **0** thiếu bản dịch · 2 chuỗi trùng đều **cố ý** (cùng khái niệm ở
  hai màn hình thì phải cùng từ).
- **Giới hạn của việc rà này, nói thẳng**: agent rà được **tính rõ ràng, nhất quán và trung thực**
  của câu chữ giao diện. Agent **không thay thế được** người chịu trách nhiệm pháp lý. Vì vậy
  `rights.attestation.*` / `policy.*` **không nằm trong đợt này** — đó là `Q-11`, **vẫn mở**, và
  `Rights Statement v1/v2` **không bị đụng vào**.
- **Còn một mục cần owner quyết**: dùng tên thương hiệu (`TikTok`/`Reels`/`Shorts`) làm nhãn preset
  có thể bị hiểu là cam kết tương thích. Hiện đã có câu đính chính ngay bên cạnh; nếu owner muốn bỏ
  hẳn tên thương hiệu thì đổi 5 khoá là xong.

**B. `Q-P3-09` — quy ước ID.** Owner **xác nhận**: Phase 3 dùng `P3-MCP-30` … `P3-MCP-34`.

Theo luật canonical `D-029`, ID là **chuỗi đầy đủ** chứ không phải con số cuối, nên `P3-MCP-30` và
`P2-MCP-30` là **hai ID khác nhau và không bao giờ đụng nhau**. **Không ID lịch sử nào bị đổi**, không
tài liệu cũ nào bị đánh số lại. Quy ước *"phase sau bắt đầu từ số kế tiếp"* chỉ là **trợ giúp cho
người đọc lướt**, không phải ràng buộc kỹ thuật — và đề bài Phase 3 đặt tên `MCP-30…34` nên giữ đúng
số của đề bài là cách đọc trung thực nhất với **cả hai** ràng buộc.

Phép kiểm định dạng canonical ID cũng đã được sửa trong Phase 3 vì nó **ghim cứng** danh sách phase
`0|1|1.1|2` — cùng dạng lỗi với `ApiRouteStatus` (`D-046`): *"các giá trị **có thể** có"* bị định
nghĩa bằng *"các giá trị **đang** có"*.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-060 — Cứu job kẹt ở `processing`: nhịp tim + nhận lại + trần số lần thử

**Lỗ hổng.** `FEATURES.md` đã ghi sẵn: *"chưa có cơ chế cứu job kẹt ở `processing` khi worker chết
giữa chừng"*. Worker chết — hết bộ nhớ, container bị thay, máy khởi động lại — thì job nó đang cầm
nằm ở `processing` **vĩnh viễn**: `claimQueued` chỉ nhìn `queued` nên không worker nào nhận lại, và
không có gì đánh dấu nó thất bại. Người dùng thấy *"đang xử lý"* mãi mãi, và **phần mức dùng đã giữ
không bao giờ được trả lại**.

**Ba mảnh, và cả ba đều cần — bỏ mảnh nào cũng sinh lỗi mới.**

1. **`claimStale(now, staleBefore)`** — nhận lại job `processing` đã im lặng quá lâu. Nguyên tử đúng
   như `claimQueued` (`FOR UPDATE SKIP LOCKED`): hai worker cùng cứu một job thì tệp bị render hai lần.
2. **`touch(workspaceId, id, now)` — nhịp tim.** Nếu chỉ có (1) thì **bản thân nó là lỗi mới**: một
   job video render lâu hơn ngưỡng sẽ bị worker thứ hai cướp mất **trong khi worker thứ nhất vẫn đang
   chạy**. Đây không phải khả năng lý thuyết — mini-spec Phase 3 để `maxDuration = null`, tức **không
   có trần** thời lượng video, nên **mọi** ngưỡng cố định đều có thể bị vượt một cách hợp lệ. Nhịp tim
   biến `updated_at` từ *"lần cuối đổi trạng thái"* thành *"lần cuối còn worker sống cầm job"* — nó là
   thứ làm **"im lặng lâu" khác hẳn "đang làm việc lâu"**. Chỉ chạm khi job **vẫn** `processing`, nên
   nhịp đến muộn không thể làm một job đã dừng trông như đang chạy.
3. **Trần `maxAttempts` (mặc định 3).** Job kẹt vì mất điện thì lần hai đã xong. Job kẹt vì **chính
   nó** làm worker chết thì mỗi lần cứu lại **giết thêm một worker** — trần là thứ chặn vòng đó.
   `attemptCount` tăng **bên trong** câu lệnh `claimStale`, **trước** khi chạy, nên một job độc vẫn bị
   đếm lên kể cả khi nó lại làm worker chết. Đếm sau khi chạy xong thì nó lặp vô tận.

**Tham số.** Nhịp 30 giây, coi là kẹt sau 5 phút ⇒ phải lỡ **mười** nhịp liên tiếp mới bị nhận lại.

**Vì sao chạy lại được mà không hỏng gì.** Đã kiểm chứ không suy đoán: mỗi lượt chạy sinh `outputId`
**mới** và khoá kho **mới** (bất biến I-1 không bị đụng), còn `commitUsage`/`releaseUsage` khoá theo
`${job.id}:commit` ở tầng dữ liệu nên **không thể** tính tiền hai lần. Có một test dựng đúng cảnh
*"chết ngay sau khi đã tính tiền"* và khẳng định sổ vẫn đúng **một** bút toán.

**Thứ tự ưu tiên.** Job `queued` được lấy **trước** job kẹt: việc đang chờ là việc **chắc chắn** chưa
ai làm, còn job kẹt chỉ là **nghi ngờ**.

**Mã lỗi mới** `MCP_JOB_MAX_ATTEMPTS_EXCEEDED` (500, `retryAllowed = false`,
`releasesUsageReservation = true`): hệ thống đã tự thử đủ số lần rồi, bảo người dùng bấm lại **chính
job này** là nói dối; và không bao giờ giữ tiền cho một việc không làm được. **Sự kiện audit mới**
`processing_job_reclaimed` — đây là việc hệ thống tự làm sau lưng người dùng, không có dấu vết thì
không ai biết một job đã chạy hai lần.

**Bằng chứng.** 8 test mới (`p3-stuck-job.test.ts`) + 3 test hợp đồng chạy trên **cả hai** adapter,
trong đó bản PostgreSQL thật mới kiểm được `SKIP LOCKED`. **Năm đối chứng âm** đã chạy, mỗi cái làm
đỏ đúng những test nó phải làm đỏ: bỏ `claimStale` (5 đỏ) · bỏ trần (1) · bỏ nhịp tim (1) · đảo thứ
tự ưu tiên (3) · hạ ngưỡng kẹt về 0 (1 — test *"job đang chạy bình thường không bị cướp"*).

**Còn lại, nói thẳng:** vẫn **chưa có** retry có backoff cho job `failed` vì lý do tạm thời — đó là
việc khác và chưa làm.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-061 — `Q-24`: nhãn câu chữ cho loại sự kiện ở trang Nhật ký

Trang Nhật ký hiện nguyên chuỗi máy `snake_case` (`processing_job_completed`,
`output_download_url_issued`…) cho **người dùng Việt**. Nay có **19 nhãn** `audit_event.*` ở cả hai
ngôn ngữ và trang Nhật ký đọc qua `translate()`.

**Phép chắn mới quan trọng hơn bản thân 19 chuỗi**: test đọc `AUDIT_EVENTS` **thẳng từ mã nguồn máy
chủ** (`apps/api/src/services/audit.ts`) và bắt buộc mọi loại sự kiện phải có nhãn ở **cả hai** ngôn
ngữ. Nhờ vậy, thêm một loại sự kiện mới mà quên nhãn thì **test đỏ**, thay vì âm thầm hiện chuỗi thô
ra màn hình. Phép chắn này đã tự bắt `processing_job_reclaimed` của `D-060` ngay trong lượt làm —
**đối chứng âm miễn phí**, không phải do tôi dựng.

**Giới hạn — giữ nguyên ranh giới BA ⇄ DEV.** Câu chữ do agent soạn theo **đúng uỷ quyền owner đã
cho ở `D-059`**, và **vẫn thuộc diện owner/BA duyệt**. Đây là nhãn mô tả thao tác hệ thống, **không
phải** câu chữ pháp lý: `rights.attestation.*` / `policy.*` vẫn là `Q-11` và **không bị đụng vào**.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-062 — Worker tự chạy việc hoàn trả khoản giữ quá hạn

**Lỗ hổng — đúng dạng lỗ hổng `P2-MCP-28` đã đóng cho job.** `expireReservations()` đã có từ
`P1.1-MCP-17`, đã đúng và đã idempotent. Nhưng đường **duy nhất** gọi tới nó là một **route nội bộ
gọi tay**. Trên máy thật **không ai gọi**. Hệ quả: người dùng bỏ dở một job thì phần mức dùng bị giữ
**cho tới khi có ai đó nhớ ra mà gọi** — tức là không bao giờ.

Đây là cùng một dạng sai đã gặp ba lần trong dự án này: **thứ đúng nằm đó mà không có đường nào dẫn
tới nó**. Test xanh không phát hiện được, vì test *gọi thẳng hàm*.

**Cách làm.** Thêm một nhịp bảo trì định kỳ vào vòng lặp worker (mặc định **60 giây**; khoản giữ hết
hạn sau 30 phút nên một phút là thừa nhanh). Chạy ngay ở vòng đầu để dọn phần còn lại sau một lần
khởi động lại.

**An toàn để chạy lặp** — đã kiểm chứ không suy đoán: `expireReservations` **không xoá gì**, nó chỉ
ghi thêm bút toán hoàn trả, và khoá `<jobId>:release` chặn trùng ở **tầng dữ liệu**.

**Bảo trì có khối `try` RIÊNG.** Bản đầu tôi viết nó nằm chung khối `try` với việc chạy job, và
**chú thích của tôi nói sai về chính mã của mình**: một lỗi khi đọc sổ mức dùng sẽ làm worker bỏ luôn
lượt nhận job của vòng đó — lấy một việc hỏng kéo theo một việc đang tốt. Đã sửa **mã** cho khớp với
ý định thay vì sửa chú thích cho nhẹ đi. Đối chứng âm `B` chính là phép kiểm cho điều này.

**Ranh giới — không tự ý mở rộng.** Hai việc bảo trì còn lại trong mục `planned` (**dọn dữ liệu theo
luật lưu giữ**, **dọn phiên tải lên quá hạn**) **cố ý KHÔNG làm trong đợt này**: cả hai đều **xoá
byte thật**, và ràng buộc owner đặt ra là *"không thêm route DELETE hoặc đường xoá dữ liệu destructive
nếu policy hiện tại chưa cho phép"*. Chúng cần owner cho phép trước. `retentionDryRunReport` hiện chỉ
báo cáo, **không xoá** — giữ nguyên như vậy.

**Bằng chứng.** 4 test mới (`p3-worker-maintenance.test.ts`) + **3 đối chứng âm**, mỗi cái làm đỏ
đúng phần nó phải làm đỏ: bỏ lời gọi bảo trì (4 đỏ) · bỏ khối `try` riêng (1) · bỏ tôn trọng chu kỳ (1).

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-063 — Follow-up gate Phase 3: mở lại `Q-P3-08`, đặt gate vào mã, và một lỗ rò khoá thô

Thực hiện theo prompt follow-up của owner. **Không** làm lại Phase 3, **không** bắt đầu Phase 4,
**không** đụng `Rights Statement v1/v2`, **không** tạo route xoá.

**A. `Q-P3-08` mở lại — `owner_decision_required`.** Owner quy định rõ: *"Không tự đóng `Q-P3-08`
nếu chưa có wording được owner duyệt"*. Trước lượt này tài liệu ghi **"`Q-P3-08` đóng"**, trong khi
**chính §18 của cùng tài liệu** vẫn liệt *"câu chữ chưa duyệt"* là blocker go-live — tài liệu **tự
mâu thuẫn**. Phân biệt đã thiếu: **rà ≠ duyệt**. Agent rà được (và `D-059` đã tìm ra một lỗi thật),
nhưng **duyệt là thẩm quyền owner/BA**, không phải thứ agent tự cấp cho mình. `D-059` **giữ nguyên,
không viết lại lịch sử**; chỉ **trạng thái** của câu hỏi đổi. **100 khoá** đang chờ duyệt, liệt kê
kèm nơi giao diện dùng ở `PHASE_3_CLOSURE.md` §12.

**B. `Q-P3-09` giữ đã chốt.** Owner **đã xác nhận trực tiếp** quy ước ID `P3-`. Đây là điều kiện mà
follow-up đòi (*"không ghi resolved nếu chưa có xác nhận owner"*) và nó **có**. Không ID lịch sử nào
bị đổi, không MINI-SPEC nào bị đổi tên.

**C. Gate chuyển từ CHỮ sang MÃ.** Trước lượt này gate chỉ tồn tại dưới dạng câu văn trong
`PHASE_3_CLOSURE.md` — sửa lúc nào cũng được, không ai đối chiếu. Nay `PHASE_3_GATE` nằm trong
`packages/contracts/src/phase3-gate.ts`, và `phase3-gate.test.ts` bắt tài liệu khớp mã **hai chiều**.
`gateViolations()` chặn thẳng các tổ hợp bị cấm: `GO_LIVE` khi online chưa `VERIFIED`,
`READY_FOR_PHASE_4` trần khi online chưa `VERIFIED`, `GO_LIVE` khi câu chữ chưa được duyệt.

*Một chi tiết đáng ghi*: bản đầu của phép chắn quét **cả tài liệu** tìm `READY_FOR_PHASE_4` trần —
và nó **bắt oan chính câu trung thực** ở §17 (*"không khai `READY_FOR_PHASE_4` trần"*), một câu **nói
về** token chứ không phải lời khai. Đây là lần thứ ba dự án gặp dạng lỗi *"liệt kê từ khoá cũng bị
tính là vi phạm"*. Đã đổi sang đọc **đúng một khối khai báo**.

**D. Lỗ rò raw translation key — lỗi thật, tìm ra trong lượt này.** `recordAudit` nhận
`eventType: string` chứ không phải union, còn `t()` **trả về chính khoá** khi thiếu. Nên một loại sự
kiện lạ — dòng audit cũ trong cơ sở dữ liệu, hoặc một chỗ gọi mới quên thêm nhãn — sẽ hiện nguyên
`audit_event.<gì đó>` ra màn hình người dùng. Đã chứng minh cụ thể: khoá `audit_event.rights.attested`
(tên đang được dùng làm fixture thật trong `p2-persistence-contract.test.ts`) **không có** trong từ
điển. Phép chắn i18n của `D-061` **không đủ**: nó soi danh sách `AUDIT_EVENTS` *đang* có trong mã,
không bảo vệ được lúc chạy. Đã thêm `auditEventLabel()` có đường lui + `audit_event.unknown` ×2 ngôn
ngữ + test, có đối chứng âm. Vi phạm guardrail *"Không raw translation key"* nay **không còn đường
xảy ra**.

**E. Q-23 / Q-P3-05 — `blocked_by_missing_environment`, và một phát hiện mới.** Đo lại
`2026-09-16T18:43:20Z`: `/healthz` online trả `storage.id=local-fs-phase1`, `production=false`;
workspace **không có biến storage nào**. Ngoài ra, cùng lượt đo cho thấy **bản online đang chạy build
cũ hơn Phase 2** (`routes=35/28/3 planned` so với `46/42/0` của mã hiện tại) ⇒ **kể cả khi có kho
object, xác minh online vẫn sẽ đo nhầm một build không chứa Phase 3**; phải deploy lại trước. Trường
`phase` của `/healthz` trả `phase-1-saas-shell` **không phải** bằng chứng build cũ — đó là hằng số
cứng còn sót trong mã hiện tại; đã kiểm trước khi kết luận.

**F. Tên biến storage trong follow-up không khớp mã.** Follow-up liệt `STORAGE_ENDPOINT`,
`STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`. Mã đọc `MEDIACLEAR_S3_*`
(`apps/api/src/config/env.ts`). Đặt theo tên trong follow-up sẽ **không có tác dụng gì**. Bảng tên
đúng ở `PHASE_3_CLOSURE.md` §10. **Không secret nào được ghi vào repo, tài liệu hay log.**

**G. `Q-P3-04` giữ mở.** Đối chiếu lại: bằng chứng **pipeline nội bộ** đo được và có test; bằng
chứng **từ nền tảng** không có và **không đo được từ repo**; các trường `maxDuration`/`maxFileSize`/
`targetResolution` = `null` ở cả 5 preset. Không suy giới hạn từ tài liệu quảng cáo.

**Gate sau lượt này — không đổi**: `READY_FOR_PHASE_4_EXCEPT_ONLINE` · `BLOCKED_BY_Q23` ·
`NOT_READY_FOR_GO_LIVE`.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-064 — Owner duyệt câu chữ `Q-P3-08`, và 6 lỗi giao diện chỉ bấm tay mới thấy

**A. `Q-P3-08` — owner đã duyệt.** Owner duyệt **100 khoá** liệt kê ở `PHASE_3_CLOSURE.md` §12 vào
`2026-09-17`. Ghi nhận đúng thẩm quyền: duyệt là của owner, không phải agent tự cấp.

**B. Bấm tay bản HIỆN TẠI trên Chrome thật** (`1280×900` + `390×844`, tài khoản mới, video thật
`sample-with-audio.mp4`, console sạch). Owner báo *"giao diện rất xấu, tính năng không dùng được,
không giống như có thể tải ảnh hay video lên"*. **Lời chê đúng**, và nguyên nhân chia làm hai:

**B1. Bản online là build PHASE 1** — không liên quan tới thiết kế. Dò trực tiếp: `/v1/auth/sign-in`
và `/v1/auth/register` trả **404**, `/v1/export-presets` **404**, `/openapi.json` **404**; chỉ
`/v1/me`, `/v1/workspaces` trả 401. **Bản online không có cả đường đăng nhập bằng mật khẩu**
(`P2-MCP-25`) nên không ai đăng nhập được, và toàn bộ Phase 2 + Phase 3 chưa từng được deploy. Đây
là lý do chính khiến "tính năng không dùng được".

*Lưu ý cách đo*: lần đầu tôi lấy `/v1/openapi.json`, nó trả 404, và bảng so sánh sinh ra **41 route
"thiếu"** — con số đó là **giả tạo do fetch hỏng**, không phải kết quả so sánh. Đã bỏ và dò lại từng
route. Ghi ra đây vì suýt nữa thành một lời khai sai.

**B2. Sáu lỗi có thật trong mã hiện tại** — không test nào bắt được:

| # | Lỗi | Vì sao test không thấy |
|---|---|---|
| 1 | Ô chọn tệp là `<input type="file">` thô: nút xám + chữ **tiếng Anh** "Choose File"/"No file chosen" giữa giao diện tiếng Việt nền tối | chữ do **trình duyệt** vẽ, không nằm trong từ điển i18n |
| 2 | Nhãn **`MIME`** và **`SHA-256`** hiện thẳng cho người dùng | viết thẳng `label="MIME"` trong JSX ⇒ **lách mọi phép chắn câu chữ** |
| 3 | Nhãn hàng là **đơn vị** (`px`, `giây`, `byte`) thay vì tên chỉ số | không phép chắn nào soi ngữ nghĩa nhãn |
| 4 | Dung lượng hiện **`9658`** thô, dù `formatBytes` đã có sẵn và đã từng sửa đúng lỗi này | `formatBytes` có test riêng, màn hình này không gọi nó |
| 5 | Nhãn hàng dùng lại **tiêu đề thẻ** ⇒ "Tệp gốc / Tệp gốc", "Giới hạn tệp / Giới hạn tệp" | khoá hợp lệ, chỉ dùng sai chỗ |
| 6 | Giá trị định dạng là chuỗi máy `image/jpeg, video/quicktime` | như trên |

**C. Hai phép chắn mới — quan trọng hơn sáu bản vá.**

1. **Cấm viết thẳng nhãn hiển thị vào JSX.** Phép chắn thuật ngữ của `D-059` soi **giá trị trong từ
   điển i18n**; từ điển có **0** khoá chứa `MIME`/`SHA-256` nên nó **vẫn xanh** trong khi cả hai hiện
   rõ ra màn hình. Chuỗi viết thẳng cũng **không bao giờ dịch được** sang `en`.
2. **Cấm dùng token CSS chưa khai báo.** *Lỗi này là của chính tôi trong lượt này*: ô chọn tệp dùng
   ba tên **không tồn tại** — `--mcp-border`, `--mcp-surface-2`, `--mcp-accent`. Trình duyệt gặp
   `var(--không-tồn-tại)` không có giá trị dự phòng thì **bỏ luôn thuộc tính**: không lỗi, không cảnh
   báo. `tsc`, `eslint`, toàn bộ test và `next build` **đều xanh**, và tôi chỉ phát hiện khi **nhìn
   ảnh chụp** thấy ô chọn tệp không có viền. Phép chắn đọc tên token **thẳng từ `tokens.css`**.

**D. Chưa làm — cố ý.** Phần **thiết kế** (nhịp thị giác, phân cấp, thanh điều hướng mobile chiếm
trọn ~350px đầu trang, màn hình chưa đăng nhập chào bằng **thẻ lỗi đỏ**) **không** sửa trong lượt
này: đó là quyết định thiết kế, và quy ước tổ chức là UI dựng qua `agy`/`/mb-frontend` rồi Claude ráp
và review. Cần owner chốt hướng trước.

**E. `wordingOwnerApproved` vẫn `false`** — **không phải** vì bỏ qua quyết định của owner, mà vì lượt
này **thêm 11 khoá mới** (`field.*`, `screen.asset_upload.pick_button`,
`screen.asset_upload.no_file_chosen`) **sau** thời điểm duyệt. 100 khoá cũ: **đã duyệt**. 11 khoá
mới: chờ một câu xác nhận.

**Bằng chứng.** 5 test mới + **3 đối chứng âm**. Bấm tay lại sau khi sửa: tải lên vẫn chạy, bảng
thông số hiện *"Kích thước khung hình 320 × 240 px · Thời lượng 0:02 · Dung lượng 20,3 KB"*.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-065 — Owner duyệt câu chữ Phase 3: `Q-P3-08` đóng

Owner duyệt vào `2026-09-17`: **100 khoá** liệt kê ở `PHASE_3_CLOSURE.md` §12, **và 11 khoá** thêm
trong cùng ngày bởi `D-064` (`field.max_file_size`, `field.video_limits`, `field.accepted_types`,
`field.frame_size`, `field.duration`, `field.file_size`, `field.file_format`,
`field.file_fingerprint`, `field.file_name`, `screen.asset_upload.pick_button`,
`screen.asset_upload.no_file_chosen`).

`wordingOwnerApproved` trong `packages/contracts/src/phase3-gate.ts` chuyển sang **`true`**, và phép
chắn `phase3-gate.test.ts` đòi hàng `Q-P3-08` **thôi** ghi `owner_decision_required` — **hai chiều**,
nên sai bên nào cũng đỏ.

**Ràng buộc còn lại, nói rõ để không hiểu nhầm phạm vi duyệt này:**

- Thêm khoá câu chữ **mới** sau mốc này ⇒ đặt lại `wordingOwnerApproved = false` và xin duyệt lại.
  Đây chính là tình huống đã xảy ra giữa `D-063` và `D-064`.
- **`Q-11` — câu chữ xác nhận quyền — VẪN MỞ.** Nó có sức nặng pháp lý và cần người chịu trách nhiệm
  đọc, không nằm trong đợt duyệt này. `Rights Statement v1/v2` **không bị đụng vào, không tạo v3**.
- `Q-P3-08` **thôi** là blocker go-live; ba blocker còn lại (`Q-23`, dấu vết AI `unknown`, chưa dọn
  dữ liệu lần nào) và `Q-11` **vẫn còn**. Gate go-live **không đổi**.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-066 — Hai lỗi chỉ lộ khi chạy THẬT trên PostgreSQL + kho S3, và cả hai đều IM LẶNG

Tìm ra khi chạy `Q23_DEPLOY_AND_VERIFY_PROMPT.md` **tại chỗ** với PostgreSQL thật + MinIO thật
(`Q-23` trên Vibe Host vẫn chặn — xem §D). Cả hai lỗi **đi qua trọn vẹn 611 test**.

**A. Job video bị chặn thì KHÔNG GHI ĐƯỢC, và kẹt ở `processing` vĩnh viễn.**

`blockJob` đặt `reasonCode` nhưng **quên `blockReasonKind`**. Ràng buộc
`processing_jobs_blocked_requires_reason` (migration `0001`) đòi **cả hai**. Hệ quả trên PostgreSQL:
mỗi lần chặn job đều ném lỗi, worker nuốt lỗi ở vòng lặp, **job nằm `processing` mãi mãi** — đúng
cảnh người dùng thấy *"đang xử lý"* không bao giờ dứt.

Thêm một tầng nữa: `blockReasonKindFor()` trả **`null`** cho nhóm lỗi `storage`, nên kể cả dùng hàm
chuẩn vẫn vi phạm. Nay: không phân loại được thành lý do **chặn** thì đó **không phải** "phụ thuộc
chưa sẵn sàng" — chuyển sang `failed`, trung thực hơn.

**B. Job thất bại KHÔNG được hoàn trả khoản giữ. Đây là lỗi tiền bạc.**

`usage_ledger_release_reason_known` (migration `0002`) đòi `reason_code` của bút toán `release` thuộc
từ vựng `RELEASE_REASONS` (`provider_error`, `user_error`, `validation_failed`, `cancelled`,
`blocked`, `expired`). Mã lại truyền **mã lỗi** (`MCP_PROVIDER_SUBMIT_FAILED`). PostgreSQL từ chối,
`catch {}` **nuốt lỗi**, và suất của người dùng **không bao giờ được trả lại**. Chỉ có đợt quét hết
hạn 30 phút (`D-062`) mới vớt được — nên nó không thành thảm hoạ, nhưng vẫn sai và vẫn im lặng.

Nguyên nhân cho phép nó tồn tại: `releaseUsage(..., reasonCode: string)` nhận **chuỗi tuỳ ý**. Nay có
`releaseReasonFor(code)` trong contracts và tham số siết thành `ReleaseReason`.

**C. Vì sao 611 test đều xanh — đây mới là bài học.**

1. **Adapter in-memory không ép ràng buộc nào của PostgreSQL.** Nó im lặng nhận đúng những dòng mà
   bản thật từ chối. Bộ test hợp đồng chỉ bắt được lệch khi **cả hai** adapter cùng bị đòi hỏi như
   nhau — nay in-memory ép cả hai luật này.
2. **Toàn bộ test video `skipIf(!hasFfmpeg)`** — mà nhánh hỏng lại **chính là** nhánh "thiếu ffmpeg".
   Test mới (`p3-block-video-job.test.ts`) **không** phụ thuộc ffmpeg thật: nó dựng cảnh
   `provider.ready() === false`, nên nó chạy **vì** ffmpeg vắng mặt chứ không bị bỏ qua.
3. **Hai khối `catch` nuốt lỗi** (`assets.ts` write_failed, `releaseUsage`) biến lỗi tầng dữ liệu
   thành im lặng. Phép chắn thay thế là kiểu + từ vựng + ép ở cả hai adapter.

**D. Trạng thái `Q-23` không đổi.** Mọi thứ trên chạy trên **kho cục bộ**, không phải Vibe Host.
`MEDIACLEAR_S3_*` vẫn **chưa có** trên Vibe Host, vẫn **chưa có** dịch vụ worker, bản online vẫn là
build Phase 1. `Q-23` và `Q-P3-05` giữ `blocked`. Giá trị của lượt này là: khi owner cấp khoá thật,
**hai lỗi chặn đường đã được gỡ trước**.

**Bằng chứng.** 2 phép kiểm hợp đồng mới chạy trên **cả hai** adapter + 2 test mới cho đường chặn
job + **4 đối chứng âm**, mỗi cái làm đỏ đúng phần nó phải làm đỏ. Kiểm lại trên bản chạy thật sau
khi sửa: job hỏng nay sinh `release / provider_error` trong PostgreSQL.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-067 — `Q-11`: bản nháp câu chữ pháp lý, chưa có hiệu lực

Owner yêu cầu soạn nháp để luật/BA duyệt. Đặt ở `docs/Q11_LEGAL_WORDING_DRAFT.md`.

**Không** sửa `Rights Statement v1/v2` một ký tự, **không** tạo v3, **không** đụng mã nguồn. Bản nháp
nêu **ba rủi ro** kèm câu đề xuất song ngữ: (1) câu được ký không tự nói lên phạm vi *tệp này, thời
điểm này*; (2) v2 đã **bỏ** vế trách nhiệm về việc sử dụng kết quả mà v1 từng có — người duyệt cần
quyết định đó là cố ý hay mất mát; (3) việc hệ thống **không thẩm định** quyền chưa nằm trong chuỗi
được ký.

**Cập nhật cùng ngày — owner bỏ giới hạn phạm vi và yêu cầu soạn thêm bốn phần**, nay có ở §4:
**giới hạn trách nhiệm** · **bồi thường** · **luật áp dụng và cơ quan giải quyết tranh chấp** ·
**dữ liệu cá nhân và hình ảnh người thật**. Ban đầu tôi đã nêu lý do không đụng vào; owner quyết
khác, và đây là quyết định của owner.

Phần **4.4 là phần nặng nhất và nó liên quan tới hệ thống ngay hôm nay**, không phải tương lai: hệ
thống **không** chỉnh sửa khuôn mặt, nhưng tệp người dùng tải lên **vẫn có thể chứa hình ảnh người
thật** và hệ thống **lưu trữ 365 ngày** (`D-019`) — lưu trữ đã là một hoạt động xử lý dữ liệu cá
nhân. Bản nháp nêu bốn điểm để luật sư xác nhận (trong đó có Nghị định **13/2023/NĐ-CP**) và **không
kết luận thay** họ.

**Chỗ để trống `«…»` là cố ý**: tên pháp nhân, địa chỉ, mức trần trách nhiệm, toà án cụ thể — agent
**không có nguồn** để lấy. Điền bừa sẽ tạo ra một văn bản trông như thật nhưng **sai chủ thể**, đúng
dạng lỗi mà luật không-bịa-dữ-liệu cấm. Đây là giới hạn **kỹ thuật** (thiếu dữ liệu), không phải né
việc.

`Q-11` **vẫn mở** cho tới khi có người chịu trách nhiệm ghi duyệt/sửa/bác cho từng mục. Nếu họ bác
toàn bộ, `Q-11` vẫn đóng được — bằng một câu xác nhận rằng v2 đã đủ.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-068 — `Q-11` đóng bằng QUYẾT ĐỊNH của owner, không phải bằng thẩm định pháp lý

`Q-11` hỏi: *"Có cần luật sư/BA duyệt câu chữ xác nhận quyền (vi + en) trước khi lên production
không?"* Đây là câu hỏi **thuộc thẩm quyền owner**, và `2026-09-17` owner trả lời: **không cần**.
Owner cũng bỏ yêu cầu điền các chỗ `«…»` trong bản nháp.

Đó là một câu trả lời hợp lệ cho đúng câu hỏi đã đặt ra, nên `Q-11` chuyển sang `answered` và
**thôi** là blocker go-live.

**Ghi rõ để không ai đọc nhầm về sau — đây là phần quan trọng nhất của quyết định này:**

- `Q-11` đóng vì **owner quyết định không cần**, **KHÔNG** vì câu chữ đã được thẩm định.
- **Chưa có ai có chuyên môn pháp lý đọc** `rights.attestation.*` hay `policy.*`. Trạng thái đó
  **không đổi** sau quyết định này; chỉ có *yêu cầu* phải thẩm định là được bỏ.
- Rủi ro pháp lý còn nguyên và **thuộc về owner**. Agent đã nêu một lần, owner quyết, agent ghi lại.

**Không áp dụng bản nháp.** `D-067` (`docs/Q11_LEGAL_WORDING_DRAFT.md`) chuyển sang **KHÔNG ÁP DỤNG,
giữ làm tham khảo**. `Rights Statement v1/v2` **giữ nguyên từng ký tự**, **không tạo v3**, mã nguồn
**không** đổi. Giữ tài liệu thay vì xoá vì nó ghi lại **những rủi ro đã được nêu ra và đã bị bỏ qua
có ý thức** — trong đó có mục nặng nhất: hệ thống **lưu trữ 365 ngày** tệp **có thể chứa hình ảnh
người thật**, mà câu xác nhận hiện tại **không nói gì về người trong ảnh**.

**Không viết lại lịch sử.** Các báo cáo cũ (`PHASE_0_REPORT`, `PHASE_2_REPORT`, `WORDING_REVIEW_P3`,
`D-059`/`D-061`/`D-065`) vẫn ghi `Q-11` đang mở — **đúng tại thời điểm viết**, nên giữ nguyên. Chỉ ba
tài liệu nói về **trạng thái hiện tại** được cập nhật: `OPEN_QUESTIONS.md`, `PHASE_3_CLOSURE.md` §18,
`DEPLOYMENT.md`.

**Gate go-live vẫn `NOT_READY_FOR_GO_LIVE`** — ba blocker còn lại: kho object dùng chung (`Q-23`) ·
dấu vết AI vẫn `unknown` · chưa có việc dọn dữ liệu nào chạy thật.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-069 — `Q-12`: tự viết bộ dò dấu hiệu AI thay vì thêm thư viện

**Câu hỏi gốc:** *"Thư viện nào đọc được C2PA / AI provenance thật?"* **Trả lời: không dùng thư viện
nào.** Đã tự viết `apps/api/src/media/c2pa-probe.ts`.

**Vì sao không thêm thư viện.** Bộ đọc C2PA đầy đủ kéo theo native binding — đúng loại phụ thuộc đã
làm hỏng build Docker một lần (`D-039`, argon2 → đổi sang `scrypt` có sẵn trong Node). Và phần đắt
nhất của thư viện đó là **xác thực chữ ký**, thứ hệ thống này **không cần**: `evaluatePreservation`
chỉ hỏi *"dấu hiệu có còn không"*, không hỏi *"dấu hiệu có thật không"*.

**Phạm vi — nói rõ để không ai đọc quá.** Bộ dò trả lời **đúng một câu hỏi**: trong tệp có bản khai
theo chuẩn Content Credentials / C2PA hay không. Nó **không** kiểm chữ ký, **không** xác thực chuỗi
tin cậy, **không** đọc nội dung bản khai. *"Có dấu hiệu"* khác hẳn *"dấu hiệu thật và còn nguyên
vẹn"* — nên có **khoá câu chữ riêng** (`provenance.limitation.presence_only`), không dùng lại khoá
cũ: *"chưa đọc được"* và *"đọc được nhưng không xác minh"* là hai sự thật khác nhau.

**Chỗ nào dám nói `absent`, chỗ nào không — đây là phần tuân thủ `D-044`.** `absent` nghĩa là *"đã
tìm và không thấy"*, chỉ đúng khi đã duyệt **hết** chỗ có thể chứa. Các container dạng thẻ nối tiếp
thẻ thì duyệt hết thẻ là duyệt hết chỗ:

| Container | Chỗ chứa | Kết luận khi không thấy |
|---|---|---|
| JPEG | đoạn `APP11` | `absent` |
| PNG | thẻ `caBX` | `absent` |
| WebP | thẻ `C2PA` trong RIFF | `absent` |
| MP4 / MOV | box `uuid` ở mức gốc | `absent` |
| **WebM / Matroska** | cấu trúc EBML khác hẳn | **`unknown`** |
| không nhận dạng được / tệp hỏng | — | **`unknown`** |

**Hằng số UUID của BMFF lấy từ hiểu biết về chuẩn, không từ tệp thật.** Nếu nó sai thì đường đọc thứ
nhất trượt — và test của chính nó **cũng không phát hiện được**, vì fixture dựng từ cùng hằng số đó.
Vì vậy `detectBmff` tìm **cả** nhãn ASCII `c2pa` bên trong box `uuid`: hai đường độc lập, sai một
đường vẫn còn đường kia. Có test riêng ép UUID sai để chứng minh đường thứ hai bắt được.

**Giới hạn lớn nhất, ghi ra để không tự lừa mình:** bộ dò **chưa từng được đối chiếu với tệp do công
cụ C2PA thật sinh ra**. Ca *"không có dấu hiệu"* dùng **tệp thật trong repo** (đó là bằng chứng thật:
không kêu nhầm). Ca *"có dấu hiệu"* dùng tệp thật **đã được chèn thêm** thẻ do tôi dựng theo chuẩn.
Nếu hiểu biết đó sai, test vẫn xanh mà bản thật vẫn trượt. **Việc còn lại:** chạy một tệp do
`c2patool` hoặc một công cụ AI thật sinh ra qua bộ dò.

**Hệ quả lên biên nhận — đây là thứ `Q-12` mở ra.** Trước đây `evidenceStatus` **luôn** là `unknown`
vì phép đo chưa bao giờ chạy. Nay nó chạy thật, nên `verified` trở thành lời khai **có cơ sở**. Ba
phép kiểm trong `p2-receipt.test.ts` từng khẳng định *"không đọc được nên luôn unknown"* đã được viết
lại: chúng mô tả **hiện trạng cũ**, không phải bất biến. Bất biến `D-044` vẫn được canh **đầy đủ ở
tầng hợp đồng** (`packages/contracts/tests/provenance.test.ts`) và nay thêm một ca ở tầng biên nhận
cho WebM.

**Guardrail 4 không bị đụng tới.** Bản khai C2PA nằm **công khai trong container**, không phải dấu ẩn
trong pixel. Hệ thống vẫn **không** phát hiện, **không** gỡ, **không** cam kết kiểm soát dấu ẩn vô
hình (kể cả SynthID) — câu miễn trừ vẫn đi kèm mọi biên nhận, và có test đòi đúng điều đó.

**Bằng chứng.** 6 phép kiểm mới + **4 đối chứng âm** (bỏ quét APP11 · bỏ quét `caBX` · trả `absent`
cho Matroska · trả `absent` cho container lạ) — hai cái sau là phép kiểm trực tiếp cho `D-044`.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-070 — Mở đường DỌN DỮ LIỆU: thứ duy nhất trong repo thực sự xoá byte

Owner cho phép (`2026-09-17`). Cho tới lúc này, luật lưu giữ **chỉ có đường "thử mà không xoá"**
(`P1.1-MCP-18`, `D-031`) vì chưa ai cho phép xoá. Đường xoá nay tồn tại — và được dựng với giả định
rằng **chính nó là thứ nguy hiểm nhất trong repo này**.

**Năm lớp chặn, mỗi lớp chặn một kiểu hỏng khác nhau:**

| # | Lớp chặn | Chặn kiểu hỏng nào |
|---|---|---|
| 1 | `dryRun` mặc định **`true`** | quên một tham số ⇒ mất dữ liệu |
| 2 | Worker chỉ xoá thật khi `MEDIACLEAR_CLEANUP_ENABLED=1` (đúng chuỗi `'1'`) | bật nhầm vì gõ `true`/`yes` |
| 3 | Trần mỗi lượt (mặc định 50) | một lỗi logic quét sạch kho |
| 4 | **Hỏi lại luật ngay trước khi xoá từng bản ghi** | danh sách dựng lúc T, xoá lúc T+n — giữ-theo-pháp-lý vừa được đặt trong khoảng đó |
| 5 | **Xoá byte TRƯỚC, đánh dấu bản ghi SAU** | sự cố giữa chừng để lại hồ sơ nói "đã xoá" trong khi byte vẫn nằm đó |

**Không bao giờ `DELETE FROM`.** Bản ghi ở lại làm **bia mộ**: `retention_state='deleted'` +
`deleted_at`. Xoá dòng là xoá luôn bằng chứng rằng tệp từng tồn tại và đã bị dọn theo luật nào. Bản
PostgreSQL còn có `WHERE retention_state <> 'deleted'` nên mốc `deleted_at` **chỉ ghi được một lần**
— gọi lại không đè lên mốc thật.

**Luật không nằm ở đây.** `runRetentionCleanup` không tự quyết định gì: nó lấy dữ liệu, hỏi
`retentionDecisionFor` của contract, rồi thi hành. Giữ-theo-pháp-lý được chính luật đó loại ra
**trước mọi điều kiện khác**, và ở lớp 4 còn được hỏi lại lần nữa.

**Hai việc dọn, hai mức nguy hiểm khác nhau.** Dọn theo luật lưu giữ đụng vào **tệp gốc của người
dùng**. Dọn phiên tải lên quá hạn chỉ đụng **mảnh `staging` của một lượt tải chưa bao giờ xong** —
nhẹ hơn hẳn, nhưng vẫn giữ nguyên `dryRun` mặc định và trần mỗi lượt: *"ít nguy hiểm hơn"* không phải
*"vô hại"*. Bản dọn phiên chỉ xoá **những mảnh đã nhận**, không đi hết `totalChunks` — đi hết sẽ gọi
xoá lên cả khoá chưa từng được ghi, biến mọi lượt dọn thành một tràng lỗi giả.

**Chạy thử VẪN chạy khi công tắc tắt** — có chủ đích. Nó cho người vận hành thấy trước **có bao nhiêu
tệp sắp bị dọn**, trước khi họ bật công tắc. Bật một công tắc xoá mà không biết nó sẽ xoá bao nhiêu
là cách để mất dữ liệu. `stats.cleanupCandidates` đếm cả khi chỉ chạy thử.

**Migration `0009`.** Hai loại chủ thể audit mới (`source_file`, `upload_session`). Ràng buộc
`subject_type` ở `0001` không có chúng ⇒ **mọi dòng audit của việc dọn đều sẽ bị từ chối** — đúng
dạng lỗi `D-066` vừa gặp. **Không** ép vào `'asset'` cho đủ field: chú thích ở `entities.ts` cấm điều
đó, và nó đúng. Đã kiểm trên PostgreSQL thật: hai loại mới ghi được, `'asset'` không hỏng, và một giá
trị lạ **vẫn bị từ chối** — tức `DROP` + `ADD` không làm mất răng của ràng buộc.

**Bằng chứng.** 9 test mới + **4 đối chứng âm**. Hai đối chứng đầu (`dryRun` mặc định, hỏi lại luật)
đỏ ngay. **Hai đối chứng sau — đảo thứ tự xoá, và đảo công tắc worker — lúc đầu KHÔNG đỏ**: hai lớp
chặn đó chưa có test nào canh. Đã viết thêm hai phép kiểm, rồi chạy lại: cả hai đỏ đúng chỗ. Đây là
giá trị thật của đối chứng âm — nó chỉ ra chỗ *tôi tưởng đã được bảo vệ mà thực ra chưa*.

**Chưa chạy thật trên bản online, và không thể chạy được lúc này**: bản online chưa có dịch vụ worker
và chưa có kho dùng chung (`Q-23`). Công tắc mặc định **tắt**.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-071 — Phase 4: frame timeline, tracking, correction, temporal check, quality gate

### Bước 0 — khảo sát TRƯỚC khi viết mã (kết quả đo, không suy đoán)

| Câu hỏi | Trả lời | Bằng chứng |
|---|---|---|
| Provider AI tracking nào khả dụng? | **Không có** | `providers/` chỉ có `deterministic-image`, `deterministic-video`, `noop-contract`; không biến môi trường nào |
| Đã benchmark chưa? | **Chưa** | `PROVIDER_BENCHMARK.md`: *"CHƯA CHẠY BENCHMARK NÀO"*, mọi ô `unknown` |
| Rủi ro native binding? | **Có, nếu chọn provider thật** | OpenCV binding / ONNX runtime — đúng dạng `D-039` (argon2 → scrypt). Bản giả **không có phụ thuộc native nào** |
| Ngưỡng confidence? | `0.6`, **ước lượng** | Chưa có provider thật ⇒ chưa có phân bố thật. `Q-P4-02` để đo lại |

Kết luận: **không dừng Phase 4**. Dựng cổng `MotionTrackingProvider`, chạy bằng
`DeterministicTrackingProvider` tất định, ghi provider thật là **`blocked`**.

### Điều quan trọng nhất của Phase 4

**Số frame kỳ vọng đến từ `P4-MCP-40` (đếm trên tệp thật), KHÔNG từ kết quả tracking.** Nếu lấy số
kỳ vọng từ chính kết quả thì phép so sánh vô nghĩa — nó sẽ luôn khớp với chính nó, và một frame biến
mất sẽ **không bao giờ** bị phát hiện. Bất biến *"không frame nào bị bỏ sót"* đứng hay đổ ở đúng chỗ này.

Đo thật cho thấy vì sao phải **đếm** chứ không **suy**: `video-vfr.mp4` có `r_frame_rate = 10` và
thời lượng ~2s ⇒ `duration × fps` cho ~20 frame, trong khi số thật là **26**.

Và vì sao `expectedFrameCount` lấy số container **khai** chứ không lấy số **giải mã được**:
`video-corrupt-frame.mp4` khai 10, giải mã được 9. Lấy số giải mã thì frame hỏng tự động "không tồn
tại" — yêu cầu *"frame lỗi decode phải được ghi nhận, không bị bỏ qua khỏi tổng số"* thất bại trong
im lặng.

### Ba số ƯỚC LƯỢNG, nói rõ để không ai đọc thành số đo

`FRAME_CONFIDENCE_THRESHOLD = 0.6` · `MAX_MASK_SPEED_PER_SECOND = 1.5`. Cả hai nằm **tường minh một
chỗ**, không ẩn trong logic, và có `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED = false` ghi đúng trạng
thái. Phase 3 đã làm đúng việc này một lần theo hướng ngược lại: dung sai audio `0.25s` (`Q-P3-03`)
được **đo** bằng 12 lượt render rồi mới ghim. Ở đây chưa đo được — `Q-P4-02` để đo lại.

### Không viết lại phần đã có

Kiểm audio dùng **lại** `compareAudio`/`audioAllowsCompletion` của Phase 3 (`P3-MCP-33`), không viết
bản thứ hai. Hai bản logic audio sẽ trôi khác nhau, và chỗ trôi sẽ là chỗ bất biến *"không xuất video
nếu audio mất"* thất bại.

### Chín đối chứng âm — chạy hết, không chọn tượng trưng

Bài học `D-070` (hai lớp chặn không có test canh) áp dụng trực tiếp. **9/9 đỏ đúng chỗ.** Đáng chú ý:
đột biến #9 (gate bỏ qua frame confidence) làm đỏ **3** test ở ba tầng khác nhau — dấu hiệu bất biến
đó được canh ở nhiều lớp chứ không chỉ một.

### CHƯA làm, nói thẳng

- **Màn hình cho `P4-MCP-42`/`44`**: hợp đồng dùng chung và kiểm lúc chạy **đã có** (`D-047` áp dụng
  lại, có test sai enum + thiếu trường), nhưng **chưa dựng màn hình** cho việc sửa keyframe và hiển
  thị lý do review. Đây là phần còn nợ, không phải phần đã xong.
- **Chưa nối vào đường job thật**: logic Phase 4 hoàn chỉnh và có test, nhưng chưa thay thế đường
  `run-video-job` của Phase 3. Nối vào là bước sau.
- **Provider thật**: `blocked` (`Q-P4-01`).

### Ranh giới đã tôn trọng

Không bật `MEDIACLEAR_CLEANUP_ENABLED` · không đóng `Q-23` · không nới go-live · không sửa Rights
Statement · không đánh số lại ID lịch sử · không ghi đè asset gốc (có test riêng cho `P4-MCP-40`).

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-072 — Phase 4 completion patch: UI MCP-42/44 và nối vào `run-video-job`

Ba việc `D-071` ghi là **còn nợ**, nay đã làm: màn hình sửa keyframe, màn hình cổng chất lượng, và
nối `P4-MCP-40…44` vào đường job thật.

### Hai lỗi của chính tôi, và cả hai đều thuộc đúng loại Phase 4 tồn tại để chặn

**1. `canTransition` bị bỏ qua trong im lặng.** Hàm này ép bất biến **I-2** (không `completed` khi
chưa có output đã kiểm) qua một `TransitionContext` mà tôi **quên truyền**. Tệ hơn: mã của tôi viết
`if (allowed) update(...)` — chuyển đổi bị từ chối, lệnh cập nhật **bị bỏ qua im lặng**, job nằm lại
`processing` **vĩnh viễn** trong khi hàm vẫn trả về `completed`. Đó **chính là** *"báo hoàn tất trong
khi thực tế không"*. Nay không còn `if` im lặng: bị từ chối thì nói thật, và có test canh.

**2. Cổng chất lượng đọc "chưa đo được audio" thành "audio bị mất".** Khi frame chưa đạt, đường xử
lý **cố ý không render**, nên audio chưa có gì để đo. Tôi truyền `'unknown'`, và cổng tính đó là một
vấn đề audio ⇒ trả `failed` trong khi lý do thật chỉ là một frame độ tin cậy thấp. Một job đáng lẽ
`review_required` bị báo `failed`.

Nay `audioVerdict` nhận `AudioVerdict | null`. `null` **không** tính là vấn đề audio (nên **lý do**
báo đúng), nhưng nó **chặn `completed`** tuyệt đối — vế thứ hai này là thứ giữ bất biến 3 nguyên vẹn:
**chưa đo được audio thì không bao giờ `completed`**.

### `tracked_inpaint` được nhận vào như thế nào, và vì sao KHÔNG phải nới lỏng

Trước patch, mọi job `tracked_inpaint` bị chặn bởi `MCP_PROVIDER_CAPABILITY_UNSUPPORTED` — **đúng**,
vì `DeterministicVideoProvider` thật sự không làm được việc đó.

Nay năng lực này được đánh giá theo `ctx.trackingProvider`, **không** theo `ProviderRegistry` (registry
đó dành cho provider *biến đổi byte*; tracking trả về *toạ độ*). Bằng chứng trả về là **`unknown`**,
đúng luật đã có sẵn của chính hàm đó: *"chưa có provider production nào ⇒ evidence `unknown`, job vẫn
được nhận"*. Bộ tracking hiện tại là bản **giả tất định** (`isProductionProvider = false`), nên
`unknown` là lời khai đúng — **không bao giờ** được thành `verified`. Cổng chặn thật của đường này là
`P4-MCP-44`, không phải bước tạo job.

### Bảy đối chứng âm — và cái thứ tư lại lộ ra một lỗ hổng

**6/7 đỏ ngay. Số 4 ("correction làm mất audit trail") VẪN XANH.** Lý do: `applyCorrection` ở tầng
service thuần đã có test, nhưng đường **API** (`correctJobFrame`, ghi xuống cơ sở dữ liệu) là một bản
hiện thực **khác** và **chưa có test nào canh**. Đã viết `p4-correction-api.test.ts` (5 phép kiểm),
chạy lại: **7/7 đỏ đúng chỗ**.

Đây là lần thứ ba trong dự án đối chứng âm chỉ ra *"lớp chặn tôi tưởng đã được bảo vệ mà thực ra
chưa"* (`D-070`, `D-071`, nay `D-072`). Một lớp chặn không có test canh là một lớp chặn **chưa tồn tại**.

### Bấm tay trên Chrome thật — và nó tìm ra hai lỗi nữa

- **Nhãn trợ năng sai**: nút chọn frame đọc thành *"Tổng số khung hình 4 — Độ tin cậy thấp"* vì tôi
  dùng lại nhầm khoá. Người dùng trình đọc màn hình sẽ nghe một câu vô nghĩa. Chỉ nhìn **cây trợ
  năng** mới thấy, ảnh chụp không lộ ra.
- **Thân yêu cầu mã hoá hai lần**: `apiFetchChecked` nhận `body` là **đối tượng** và tự `stringify`;
  tôi truyền chuỗi đã `JSON.stringify` ⇒ máy chủ trả **400**. `curl` thẳng vào endpoint thì chạy —
  nên nếu chỉ test bằng `curl` sẽ không bao giờ thấy.

Một điều đẹp quan sát được khi bấm tay: sửa frame 4 sang `x=0.42` trong khi lân cận ở `0.1` thì
**`P4-MCP-43` lập tức báo** *"Vùng che nhảy bất thường, cần xem lại — 2"*. Sửa một vấn đề và hệ thống
phát hiện ngay vấn đề nó vừa tạo ra.

### Không đụng tới

Provider thật vẫn **`blocked`** (`Q-P4-01`) · ngưỡng `0.6` **không đổi**,
`FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED` vẫn **`false`** (`Q-P4-02`) · `MEDIACLEAR_CLEANUP_ENABLED`
vẫn **tắt** (nhật ký worker xác nhận: *"dọn dữ liệu: tắt (chỉ chạy thử)"*) · `Q-23` vẫn **blocked** ·
Rights Statement **không đổi một ký tự** · không route DELETE mới · không đánh số lại ID lịch sử ·
tệp gốc **không bị ghi đè** (có test riêng).

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-073 — Cổng chất lượng phải sống ở máy chủ, và màn hình phải có đường đi tới

**Bối cảnh**: Bước xác nhận đóng Phase 4. Toàn bộ `TSC/LINT/TEST/BUILD/WS` xanh, 12/12 đối chứng âm
đỏ đúng chỗ, mã sản phẩm không đổi một byte so với `d439899`. Theo mọi phép đo tự động thì Phase 4
đã xong. Việc còn lại tưởng chỉ là bấm tay xác nhận cho đủ thủ tục.

**Bấm tay tìm ra hai lỗi mà không phép đo tự động nào chạm tới.**

### Lỗi 1 — `P4-MCP-44` chỉ là một cái nút bị làm mờ

Màn hình `/jobs/:id/frames` khoá đúng nút *"Chưa tải về được"* khi cổng nói `failed`. Nhưng gọi thẳng
API, bỏ qua trình duyệt:

```
GET /v1/jobs/<id>/output/download-url   →  200  +  URL đã ký
GET <URL đã ký>                          →  200  +  16344 byte THẬT
```

Cổng chất lượng lúc đó nói `failed`, lý do `frames_failed`. Tức là **ai không dùng giao diện thì vẫn
lấy được bản chưa đạt chất lượng**. `P4-MCP-44` khi ấy không phải một cổng chặn — nó là một quy ước
của trình duyệt.

**Vì sao lỗ này tồn tại**: `run-tracked-video-job` ghi bản kết quả và đánh dấu `validated` **trước**
khi hỏi cổng chặn. Nên một job `review_required`/`failed` vẫn có sẵn một bản kết quả đã kiểm byte —
vượt qua phép kiểm `validated` một cách hoàn toàn hợp lệ. Phép kiểm `validated` (bất biến `I-2`,
*"đã đọc lại byte chưa"*) và cổng chất lượng (*"kết quả có đạt không"*) đo **hai điều khác nhau** và
không thay thế được cho nhau. Trước `D-073` chỉ có phép kiểm thứ nhất.

**Đã sửa**: `createJobOutputDownloadUrl` từ chối khi `job.state !== 'completed'`, bằng mã lỗi
**mới** `MCP_STATE_QUALITY_REVIEW_REQUIRED` (409). Không mượn `MCP_STATE_OUTPUT_NOT_VERIFIED`: báo
sai lý do cũng là một kiểu nói dối. Thứ tự có chủ ý — `I-2` trước, cổng chất lượng sau — để job
`queued` chưa kiểm byte vẫn báo đúng *"chưa kiểm chứng"*.

**Đo lại trên máy chủ thật, một biến duy nhất là trạng thái job:**

| `job.state` | HTTP | Kết quả |
|---|---|---|
| `completed` | 200 | có URL ký · tải về 16344 byte |
| `review_required` | 409 | `MCP_STATE_QUALITY_REVIEW_REQUIRED` · không URL |

### Lỗi 2 — Màn hình chạy đúng nhưng không ai tới được

Thẻ *"Kết quả cần bạn xem lại"* bảo người dùng xem lại, nhưng **không một liên kết nào trong toàn bộ
ứng dụng** trỏ tới `/jobs/:id/frames`. Cách duy nhất vào được màn hình đó là gõ tay URL — đúng thứ
tôi đã làm suốt quá trình kiểm, nên tôi không hề nhận ra. `P4-MCP-42` và `P4-MCP-44` hoạt động hoàn
hảo với một người dùng không có cách nào mở chúng.

Không test nào bắt được vì không test nào hỏi *"người dùng đi tới đây bằng cách nào"*.

**Đã sửa**: thêm `LinkButton` vào đúng nhánh `review_required` — chỗ người dùng đang bị chặn.

### Phép chặn đi kèm (cả hai đều đã thử đối chứng âm)

| Phép chặn | Gỡ lớp chặn ra ⇒ |
|---|---|
| `p2-output-download.test.ts` · 3 phép kiểm `D-073` | **3 đỏ**, 10 xanh (gồm đối chứng dương `completed` → 200) |
| `p4-ui-contract.test.ts` · liên kết tới `/frames` | **1 đỏ**, 7 xanh |

Phép kiểm thứ ba của nhóm đầu canh một điều riêng: **bị từ chối thì không được ghi dấu vết "đã phát
URL tải về"** — hồ sơ không được nói dối về việc chưa từng xảy ra.

### Điều đáng ghi lại

Đây là lần thứ tư đối chứng âm/bấm tay chỉ ra một lớp chặn chưa thật sự tồn tại (`D-070`, `D-071`,
`D-072`, nay `D-073`). Nhưng `D-073` khác ba lần trước ở một điểm đáng lo hơn: ba lần trước là *test
thiếu*, lần này là **phép đo tự động đã đầy đủ và vẫn xanh hết** — vì cả bộ test đều đi qua cùng một
cửa mà giao diện đi. Câu hỏi không ai hỏi là *"nếu bỏ qua giao diện thì sao"* và *"làm sao tới được
màn hình này"*. Cả hai đều chỉ lộ ra khi có người thật bấm và thử đi vòng.

### Không đụng tới

Provider thật vẫn **`blocked`** (`Q-P4-01`) · `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED` vẫn **`false`**
(`Q-P4-02`) · `MEDIACLEAR_CLEANUP_ENABLED` vẫn **tắt** · `Q-23` vẫn **blocked** · Rights Statement
không đổi một ký tự · không route DELETE mới · không đánh số lại ID lịch sử · **chưa bắt đầu Phase 5**.

- **Status**: `confirmed` · **Date**: 2026-09-17 · **Owner**: Owner MediaClear Pro

---

## D-074 — Một luật duy nhất cho một lần sửa keyframe (đóng `Q-P4-05`)

**Bối cảnh**: `Q-P4-05` ghi một điểm lệch đã đo được: `applyCorrection` (hàm thuần) tính lại frame
lân cận, còn `correctJobFrame` (đường API) ghi `reinterpolated: []` và **không tính lại gì**. Cùng
một thao tác của người dùng cho hai kết quả khác nhau tuỳ nó đi qua đường nào.

Yêu cầu là hội tụ hai đường. Nhưng trước khi hội tụ, phải **đo hàm đích** — và phép đo lộ ra rằng
hàm được chọn làm chuẩn cũng đang sai.

### Đo trước khi tin

Timeline 7 frame, frame 2 và 4 ở `frame_low_confidence` (0.21). Sửa **frame 3** một lần:

| | `ok` | `lowConfidence` | `canComplete` |
|---|---|---|---|
| Trước | 5 | **2** | **false** |
| Sau | 7 | **0** | **true** |

Một thao tác trên frame 3 đã **xoá cờ review của frame 2 và 4** — hai frame người dùng chưa hề nhìn
— và lật `canComplete` thành `true`. Nội suy làm hộp mượt hơn; nó **không** trả lời được câu hỏi
"frame này có đúng không". Đây là một đường vòng qua cổng chặn chất lượng, mở bằng một thao tác
không liên quan.

Kèm theo: confidence cũ (`0.21`) được giữ nguyên trong khi hộp đã đổi — con số đang mô tả một hộp
**không còn tồn tại**. Đó là lỗi `D-044` ở một tầng khác.

**Không test nào khẳng định hành vi này** — nó là tai nạn, không phải thiết kế. Hội tụ đường API vào
hàm đó sẽ **nhân rộng** lỗi thay vì sửa nó.

### Luật canonical — `planFrameCorrection`

Hàm **thuần**, nằm ở `packages/contracts/src/phase4.ts`. Cả `applyCorrection` lẫn `correctJobFrame`
đều gọi nó và không đường nào tự tính lấy.

| # | Luật | Ghi chú |
|---|---|---|
| 1 | Frame sửa trực tiếp → `manual` · `frame_correction_applied` · `confidence: null` | không đổi |
| 2 | Lân cận bán kính 2, nội suy tuyến tính `t = bước/(bán kính+1)`, đánh dấu `interpolated` | không đổi |
| 3 | Confidence của frame nội suy → **`null`** | **SỬA**: giữ số cũ = mô tả một hộp không tồn tại |
| 4 | Lân cận **đang bị gắn cờ** giữ nguyên trạng thái, chỉ cập nhật hộp | **SỬA**: chống đường vòng ở trên |
| 5 | `frame_failed` không có mask → bỏ qua, ghi lý do | không đổi |
| 6 | Gặp frame `manual` → dừng hẳn về phía đó | không đổi |

`CORRECTION_NEIGHBOUR_RADIUS = 2` được **thừa kế** từ tham số mặc định cũ, không phải số đo. Đánh
dấu `CORRECTION_NEIGHBOUR_RADIUS_IS_MEASURED = false`, cùng cách xử lý `FRAME_CONFIDENCE_THRESHOLD`.

### Ghi là MỘT giao dịch

Một lần sửa nay động tới nhiều dòng (frame được sửa + 4 frame lân cận + 1 dòng hồ sơ). Ghi rời rạc
sẽ để lại timeline nửa cũ nửa mới. Thêm `applyCorrectionAtomically` vào cổng lưu trữ; PostgreSQL
dùng `BEGIN/COMMIT/ROLLBACK`, bản trong bộ nhớ dùng bản sao rồi mới hoán đổi — **cả hai** đều có
phép chắn trong bộ đối chiếu hai bản lưu trữ.

Migration `0011` thêm `neighbours jsonb`, `flicker_before/after`, `gate_verdict_before/after`. Chỉ
thêm cột. Bảng vẫn APPEND-ONLY.

### Đo lại trên hệ thống chạy thật

Timeline 10 frame, frame 2/4/6 ở `frame_low_confidence`. Sửa frame 4 → `x = 0.16`:

```
frame 2  frame_low_confidence  interpolated  conf=null  x=0.12   ← GIỮ cờ
frame 3  frame_correction_applied interpolated conf=null x=0.14
frame 4  frame_correction_applied manual      conf=null  x=0.16
frame 5  frame_correction_applied interpolated conf=null x=0.14
frame 6  frame_low_confidence  interpolated  conf=null  x=0.12   ← GIỮ cờ
```

Màn hình: `Độ tin cậy thấp: 3 → 2`, **không phải 0**. Nút tải về vẫn khoá. Nội suy đúng công thức:
bước 1 → `0.16 − 0.06/3 = 0.14`, bước 2 → `0.16 − 0.12/3 = 0.12`.

Sửa tiếp frame 4 → `x = 0.65` (tạo cú nhảy): cổng chạy lại, báo *"Vùng che nhảy bất thường — 6"*,
và hồ sơ ghi **`0 trước · 6 sau`** — nói thẳng rằng chính lần sửa đó làm tình hình xấu đi.

### Hai phép thử của chính tôi bị đối chứng âm bác bỏ

- **`NC5`** (gỡ `detectFlicker` khỏi đường ghi hồ sơ) **vẫn xanh**: tôi chỉ khẳng định
  `.not.toBeNull()`, mà `[].length` là `0` chứ không phải `null`. Đã siết lại thành một con số có
  nghĩa (`flickerAfter > 0` khi cú nhảy được tạo ra).
- **`NC9`** (gỡ `resource.reload()` sau khi lưu) **vẫn xanh**: không phép chắn nào hỏi *"sau khi lưu,
  màn hình có còn đúng không"*. Đã thêm phép chắn đọc mã nguồn nhánh lưu thành công.

Lần thứ năm liên tiếp đối chứng âm chỉ ra một lớp chặn chưa thật sự tồn tại (`D-070`…`D-074`).

### Không đụng tới

Provider thật vẫn **`blocked`** (`Q-P4-01`) · `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED` vẫn **`false`**
(`Q-P4-02`) · `MEDIACLEAR_CLEANUP_ENABLED` vẫn **tắt** (nhật ký worker xác nhận *"dọn dữ liệu: tắt
(chỉ chạy thử)"*) · `Q-23` vẫn **blocked** · go-live vẫn **`NOT_READY_FOR_GO_LIVE`** · Rights
Statement không đổi một ký tự · không route DELETE mới · không đánh số lại ID lịch sử ·
**Phase 5 vẫn `NOT_STARTED`**.

- **Status**: `confirmed` · **Date**: 2026-09-18 · **Owner**: Owner MediaClear Pro

---

## D-075 — Phase 5: Provenance & Brand Kit (MCP-50…54)

### Quyết định nền: KHÔNG có nguồn sự thật thứ hai

`MCP-50` **không** tạo bảng `provenance_events`. Dòng thời gian dựng từ các nguồn đã có: tệp gốc,
bản xem trước, job, biên nhận, lịch sử sửa khung hình, ảnh chụp thông tin kèm theo, nhật ký.

Một bảng sự kiện riêng sẽ lập tức trở thành nguồn sự thật thứ hai, và hai nguồn sẽ lệch nhau
(`D-047`). Đổi lại, quan hệ cha–con phải **tự dựng** — và mục nào trỏ tới cha không tồn tại thì
**lộ ra** ở `orphanIds`, đi qua được biên giới API **có chủ đích**. Lọc ở máy chủ sẽ làm dòng thời
gian trông như đã đầy đủ.

### `MCP-51` — đo theo TỪNG TRƯỜNG, không kết luận chung chung

`"metadata preserved"` sau khi chỉ kiểm vài trường là một lỗ hổng quen thuộc: nó đúng với những
trường đã kiểm và **nói dối về phần còn lại**. `compareMetadata` lấy **hợp** của hai phía làm tập
khoá, và mọi khoá đều phải có một trạng thái. Còn bất kỳ `unknown` nào ⇒ verdict là `unknown`.

`removed_by_policy` **tách riêng** khỏi `removed`: một bên là quyết định, một bên là mất mát.

**Giới hạn thật, ghi rõ**: ảnh đọc EXIF bằng bộ duyệt TIFF/IFD tự viết cho **danh sách đóng 5 thẻ**
(không thêm thư viện — `D-039`). Thẻ ngoài danh sách không được đọc, và vì vậy **không** được báo
cáo là "không có". Xem `Q-P5-04`.

### `MCP-54` — ba điều không bao giờ được làm

1. `absent` của bộ dò **không** thành `ai_not_used`. Một tệp do AI tạo rồi bị gỡ thông tin sẽ cho
   `absent` — kết luận "không phải AI" từ đó sai theo hướng nguy hiểm nhất.
2. `unknown` **không** thành một kết luận.
3. `present` **không** thành "đã xác minh" — bộ dò không kiểm chữ ký nào (`D-069`).

Trạng thái **dịch vụ xử lý** được trả lời **trước**: chưa có dịch vụ thật thì mọi kết luận về AI
đều chưa có cơ sở. Thực tế hiện nay: `provider_blocked`, và đó là **kết luận đúng**.

### `MCP-53` — sửa là tạo phiên bản, không có đường xoá

Biên nhận trỏ tới `(brandKitId, version)`. Sửa trực tiếp sẽ làm biên nhận cũ trỏ tới một thứ **khác**
với cái đã thật sự được áp dụng. Bảng phiên bản không có đường `UPDATE`. Bộ không dùng nữa thì
`archived` — xoá dòng là xoá luôn bằng chứng.

**Không hàm nào tự điền `brandKitId` vào biên nhận.** Bản xuất chỉ mang lớp phủ khi người dùng chọn.

Quyền: đọc `asset.read`, sửa `project.manage`. **Không thêm quyền mới** — ma trận quyền là quyết
định của owner (`Q-04`).

### Một lỗi mà 806 phép kiểm không bắt được

Một **dấu phẩy đôi** trong mảng tham số SQL (`receipt.reviewReason,,`) tạo một **lỗ thưa**: mảng dài
thêm một phần tử `undefined`, và **mọi tham số phía sau bị đẩy lệch một ô**.

`typecheck` xanh · `lint` xanh · **806 phép kiểm xanh** — vì mọi test chạm tới biên nhận đều chạy
trên bản trong bộ nhớ. Bộ đối chiếu hai bản lưu trữ **không hề có** phép kiểm nào cho biên nhận.
Chỉ một lượt chạy **thật** trên PostgreSQL mới lộ ra (job đổ với `MCP_PROVIDER_SUBMIT_FAILED`, lỗi
thật bị `catch` bắt-tất-cả nuốt).

**Hai phép chắn mới**, đã thử đối chứng âm: `no-sparse-arrays` (lint đỏ) và phép kiểm biên nhận đi
tròn **từng trường** trên cả hai adapter (test đỏ). Lần thứ hai bộ đối chiếu phải mở rộng vì cùng
một lý do (`D-066`).

### Xung đột chính sách — không tự quyết

`preserveOriginalMetadata` là `true` **cố định** theo **guardrail 6/7**. Đo thật: `exif.Make` đi
nguyên vẹn vào bản xuất. Chính sách gỡ vị trí/thiết bị **mâu thuẫn** với cam kết đó.

Mã được sửa để **không khai một chính sách nó không thi hành**:
`METADATA_CATEGORIES_STRIPPED_BY_DEFAULT = []`. Xem `Q-P5-02`.

### Ba lỗi chỉ bấm tay mới thấy

1. Khoá dịch **thô** hiện ra cho người dùng đọc — phép chắn i18n chỉ quét chuỗi **tĩnh**, nhãn động
   nằm ngoài tầm. Sửa: máy chủ nói rõ giá trị nào là khoá dịch (`valueKey`), giao diện không đoán.
2. Ô nhập màu là **một dòng** nhưng hướng dẫn bảo "mỗi màu một dòng" ⇒ hai mã dính lại, nút lưu
   khoá **vĩnh viễn** mà người dùng không hiểu vì sao.
3. Mã kiểm tra 64 ký tự **đẩy tràn** màn hình ở khổ `390px`.

Cả ba đều có phép chắn mới trong `p5-ui-contract.test.ts`.

### Không đụng tới

Provider thật **`blocked`** (`Q-P4-01`) · `MEDIACLEAR_CLEANUP_ENABLED` **tắt** · `Q-23` **blocked** ·
go-live **`NOT_READY_FOR_GO_LIVE`** · Rights Statement v1/v2 **không đổi một ký tự**, **không có
v3** · không route DELETE · không đánh số lại ID lịch sử · **không mở Phase 6, không billing, không
tiện ích trình duyệt**.

- **Status**: `confirmed` · **Date**: 2026-09-18 · **Owner**: Owner MediaClear Pro

---

## D-076 — Chính sách thông tin kèm theo tệp: GIỮ NGUYÊN (đóng `Q-P5-02`)

### Quyết định

```
Chính sách mặc định: GIỮ NGUYÊN thông tin gốc.
KHÔNG tự động gỡ vị trí / thiết bị / GPS.
Xoá thông tin nhạy cảm là một THAO TÁC RIÊNG do người dùng yêu cầu, được ghi riêng.
Trường chưa đo được là `unknown` — không phải "không có", không phải "đã giữ".
```

`Q-P5-02` mở ra vì `D-075` khai một danh sách gỡ mà đường xử lý **không** thi hành. Đo thật:
`preserveOriginalMetadata` là `true` **cố định** theo **guardrail 6/7**, và `exif.Make = 'MatBao'`
đi nguyên vẹn từ tệp vào sang bản xuất. Nay mã nói đúng điều nó làm.

`METADATA_POLICIES = ['preserve']` — **không có** giá trị `redact`. Thêm một giá trị mà đường xử lý
chưa thi hành chính là cách `Q-P5-02` đã sinh ra.

### Luật thứ nhất: chưa đo là `unknown`

Đây là chỗ dễ nói dối nhất trong cả Phase 5. Bộ đọc EXIF chỉ phủ **danh sách đóng 5 thẻ**
(`Q-P5-04`). Nếu những thẻ ngoài danh sách đơn giản là **vắng mặt** khỏi ảnh chụp, phép đối chiếu sẽ
không bao giờ nhắc tới chúng — và báo cáo *"đã giữ nguyên"* sẽ đúng về những thẻ đã đo rồi **im
lặng** về phần còn lại.

`MetadataSnapshot.unmeasuredKeys` liệt kê chúng **tường minh**, và `compareMetadata` lấy **hợp của
ba nguồn** làm tập khoá. Sự im lặng biến thành một câu trả lời: `unknown`.

### Luật thứ hai: tách KẾT LUẬN khỏi ĐỘ PHỦ

Lần cài đặt đầu kéo `unknown` vào verdict — và **mọi** phép đối chiếu lập tức thành `unknown`, vì
bộ đọc luôn có thể kể ra thẻ nó không đọc. Một kết luận luôn giống nhau thì không còn là kết luận.

- `verdict` tính trên **phần đã đo**.
- `unmeasuredCount` nói **độ phủ**.
- `evidenceStatus`: `verified` **chỉ khi** không còn trường chưa đo; còn lại là `partially_verified`.

Gọi một báo cáo phủ 5/15 trường là `verified` chính là cách dễ nhất để tự phong cấp bằng chứng.

### Luật thứ ba: đổi phải nói được VÌ SAO

`MetadataFieldComparison.changeReason` — `container_conversion` (đổi định dạng) ·
`pipeline_render` (vẽ lại điểm ảnh) · `unattributed`. Một trường đổi mà báo cáo không nói được vì
sao thì đó chỉ là một cảnh báo trống.

- **Status**: `confirmed` · **Date**: 2026-09-18 · **Owner**: Owner MediaClear Pro

---

## D-077 — Dán lớp phủ nhận diện và công bố AI vào bản xuất (đóng phần ảnh của `Q-P5-03`)

### KHÔNG nhầm với thao tác `brand_overlay` đã có

`brand_overlay` trong `operations` là **mặt nạ xám đặc** tô kín một vùng (`Q-15`) — nó **xoá** thông
tin. `D-077` **thêm** thông tin lên trên. Hai việc ngược nhau; dùng lại một tên cho cả hai sẽ làm
biên nhận nói sai về việc đã làm gì với tệp của người dùng.

Nên lựa chọn lớp phủ là một trường **riêng** (`ProcessingJobRequest.branding`), không phải một
`operation`.

### Bốn điều bắt buộc

1. **Không bao giờ tự dán.** `branding` mặc định `null`. Không đường nào trong mã tự điền giá trị.
   Giao diện chỉ gửi trường này khi người dùng bật một trong hai ô.
2. **Ghim PHIÊN BẢN người dùng đã chọn**, không lấy "phiên bản đang hiệu lực". Một lần sửa bộ nhận
   diện giữa lúc người dùng bấm sẽ làm bản xuất mang nội dung khác với cái họ vừa xem trước.
3. **Dán NGAY SAU render, NGAY TRƯỚC khi ghi.** Dán sau khi ghi sẽ làm checksum trong `outputs` mô
   tả một tệp khác với tệp trong kho, và bất biến `I-2` sẽ đỏ oan.
4. **Ghi cái ĐO ĐƯỢC, không ghi lời khai.** `brandOverlayApplied` lấy từ kết quả thật của bước dán;
   logo hỏng thì nó là `false` và `brandLogoAssetId` là `null`.

`brandOverlayApplied` là một cột **riêng**, không suy từ `brandKitId !== null`: người dùng có thể
chọn một bộ nhận diện rồi **tắt** lớp phủ.

### Lỗi đo được: dải công bố TRỐNG RUỘT

Sau một lần khởi động lại, workspace mất **sạch font** (`fc-list` trả về 0). Thư viện vẽ SVG vẫn trả
về một ảnh **hợp lệ** — chỉ là không có chữ. Bản xuất sẽ mang một dải tối màu trống ruột: trông như
một dấu có chủ định nhưng không nói gì, và biên nhận khai rằng **đã công bố**.

**Một công bố trống còn tệ hơn không công bố.**

`renderDisclosureBand` nay tự chạy một **đối chứng âm lúc chạy**: vẽ dải với câu chữ thật, vẽ lại
với chuỗi rỗng, rồi so byte. Giống nhau ⇒ chữ không lên được pixel nào ⇒ **không dán gì** và
`disclosureApplied` là `false`.

Không kiểm "có font không" — phép kiểm đó trả lời một câu khác. Font có thể có mặt mà vẫn không vẽ
được chữ Việt có dấu; điều duy nhất đáng tin là đối chiếu **pixel**.

### Tải tệp logo

Đo trên **byte thật** (`content-type` của client chỉ để đối chiếu) · qua tầng trừu tượng kho ·
**không ghi đè** (mỗi lần tải là một khoá kho mới) · gán logo = **tạo phiên bản mới**.

`BrandLogoView.sharedStorage` đi qua biên giới API **có chủ đích**: `false` nghĩa là tệp nằm trên
kho **cục bộ** của container, **không phải** kho dùng chung, và **không được gọi là** đã lưu trữ ở
mức production (`Q-23`).

### Chưa làm

Lớp phủ cho **video** chưa có — xem `Q-P5-03`. Không giả lập: biên nhận của một lượt video ghi
`brandOverlayApplied: false`, và đó là sự thật.

- **Status**: `confirmed` · **Date**: 2026-09-18 · **Owner**: Owner MediaClear Pro

---

## D-078 — Dấu "tệp do AI tạo ra" biến mất qua đường xử lý, và màn hình phải nói ra

### Câu hỏi người dùng đặt ra

*"Nếu tôi dùng ảnh từ ChatGPT tạo ra, công cụ này có xoá được xác nhận ảnh đó tạo từ AI không?"*

Câu hỏi đúng chỗ, và câu trả lời phải đến từ **phép đo**, không từ lời hứa trong tài liệu.

### Đo được

Dựng một PNG có chunk `caBX` (nơi bản khai C2PA nằm), cho chạy qua đúng đường xử lý:

```
tep vao           : presence = present   (png:caBX)
sau  blur         : presence = absent
sau  crop         : presence = absent
sau  brand_overlay: presence = absent
```

Chạy trọn vẹn qua hệ thống thật (PostgreSQL + worker), bản ghi nguồn gốc:

```
truoc: ai_provenance_presence = present
sau  : ai_provenance_presence = absent
preservation_result = partial · evidence_status = partially_verified
```

**Vậy: trên thực tế dấu C2PA BIẾN MẤT.** Không phải một tính năng — `sharp` ghi lại tệp PNG và
không mang theo chunk `caBX`. Nhưng hệ quả thì có thật, và người dùng có quyền biết.

### Guardrail 4 **không** bị đụng tới

Guardrail 4 nói về **dấu ẩn** (SynthID, watermark vô hình) — hệ thống không phát hiện, không gỡ,
không cam kết kiểm soát. Điều đó **vẫn đúng** — bản khai C2PA nằm **công khai trong container**,
không phải dấu ẩn trong điểm ảnh. Hệ thống không hề đụng tới lớp ẩn.

### Chỗ sai thật: màn hình GIẤU điều mà biên nhận ĐÃ GHI

`evaluatePreservation` đã trả `partial` / `partially_verified` từ Phase 2 — **luật thì trung thực**.
Nhưng màn hình chỉ hiện `originalMetadataPresence` trước/sau, **không hiện** `aiProvenancePresence`.

Người dùng không có cách nào thấy rằng dấu đó đã biến mất. Một sự thật quan trọng bị ghi vào hồ sơ
rồi để nằm ngoài tầm mắt — về mặt thực tế thì không khác gì không ghi.

### Đã sửa

- Màn hình biên nhận hiện **dấu AI trước/sau**, cạnh metadata gốc.
- Khi `present → absent`, hiện một cảnh báo `role="alert"` nói thẳng: *"Tệp gốc của bạn có kèm dấu
  cho biết nó do AI tạo ra, nhưng bản kết quả không còn dấu đó. Đây là hệ quả của việc ghi lại tệp,
  **không phải một tính năng**. Nếu bạn cần giữ dấu này, đừng dùng bản kết quả để thay thế tệp gốc."*
- Fixture `image-c2pa-present.png` + 2 phép chắn.

### Phép chắn thứ hai có chủ đích

Phép kiểm khẳng định dấu hiệu **biến mất**. Nếu về sau ai đó làm đường xử lý **giữ** được dấu, phép
kiểm sẽ **đỏ** và bắt phải đọc lại quyết định này — đó là một thay đổi **tốt**, nhưng nó phải được
nhìn thấy chứ không tự trôi qua, vì câu chữ cảnh báo cho người dùng sẽ phải đổi theo.

### Việc còn mở

Đường xử lý **chưa** cố giữ bản khai C2PA. Giữ được nó là việc đáng làm (`preserveAiProvenance` là
`true` cố định theo guardrail 7), nhưng cần một thư viện đọc/ghi C2PA thật — cùng phụ thuộc mà
`Q-12` đang chờ. Ghi thành `Q-P5-05`.

- **Status**: `confirmed` · **Date**: 2026-09-18 · **Owner**: Owner MediaClear Pro

---

## D-079 — Mọi đường do máy chủ trả về phải được kéo về đúng gốc mà trình duyệt đang nói chuyện

### Người dùng thấy gì

Chọn một tệp để tải lên, giao diện báo **"Không kết nối được máy chủ"**. Đăng nhập được, danh sách
dự án hiện ra bình thường — chỉ riêng lúc tải tệp thì hỏng.

### Đo được gì

`POST /v1/projects/:id/assets/upload-intent` trả về:

```
uploadUrl = http://127.0.0.1:3301/v1/storage/upload/eyJidWNrZXQiOiJtZWRpYWNsZWFy...
```

Địa chỉ này **đúng ở bên trong máy chủ** và **sai ở trình duyệt người dùng**, vì `127.0.0.1` khi đó
là máy **của họ** — nơi không có gì chạy ở cổng 3301.

### Vì sao lần sửa trước không chạm tới

`D-079` là **lớp lỗi thứ hai** của cùng một gốc. Lần trước đã sửa `apiBaseUrl()` nên mọi lời gọi
API đều đi đúng. Nhưng đường tải lên **không đi qua `apiBaseUrl()`**: nó là một địa chỉ **tuyệt đối
do máy chủ tự đặt ra** (`MEDIACLEAR_PUBLIC_BASE_URL`). Sửa một đường không có nghĩa là đã sửa cả lớp.

### Bài học đắt nhất: đi tìm cả lớp trước khi vá một chỗ

Sau khi tìm ra lỗi ở đường tải lên, việc đúng là quét xem **còn chỗ nào khác** nhận URL từ máy chủ.
Quét ra thêm **ba chỗ**, trong đó có nút **"Tải tệp kết quả"** — tức là người dùng sẽ gặp lại đúng
lỗi này ở **bước cuối cùng**, sau khi đã chờ xử lý xong. Vá từng chỗ một sẽ đẩy lỗi ra xa hơn chứ
không làm nó biến mất.

| Chỗ | Người dùng đang làm gì |
|---|---|
| `apiUpload` | tải tệp nguồn lên |
| `jobs/[jobId]` | bấm **Tải tệp kết quả** |
| `assets/[assetId]` | tải bản gốc về |
| `assets/[assetId]/video` | phát thử video |

### Cách sửa

`serverUrlForClient(url)` — giữ lại `pathname` + `search`, ghép vào `apiBaseUrl()`.

**Ranh giới phải giữ:** chỉ viết lại khi đường đó trỏ tới **chính API** (`/v1/...`). Khi hệ thống
dùng kho đối tượng thật (S3/R2), máy chủ sẽ trả một đường đã ký trỏ tới **một dịch vụ khác** mà
trình duyệt gọi thẳng được — viết lại đường đó sẽ làm hỏng thật.

### Một lỗi thứ hai lộ ra khi viết phép kiểm

Bản đầu của hàm dùng `window.location.href` làm gốc phân tích. Ở nơi `window.location` không có,
lệnh đó **ném lỗi**, rơi vào `catch`, và hàm **trả về đúng cái URL hỏng** — lớp bảo vệ tự tắt chính
nó mà không kể gì. Ba phép kiểm đỏ ngay vì chúng đo **chuỗi trả ra**, không đo "hàm có chạy không".
Đã bỏ hẳn phụ thuộc đó: đường tương đối thì vốn đã cùng gốc.

### Phép chắn

`apps/web/tests/server-url-for-client.test.ts` quét **toàn bộ** `apps/web/app` tìm chỗ đọc
`data.url` mà không qua `serverUrlForClient`, và **tự kiểm chính phép quét** (đếm số chỗ chạm tới
phải ≥ 3) để một lần đổi tên trường không làm phép quét mất tác dụng trong im lặng.

Đối chứng âm đã chạy: bỏ `serverUrlForClient` ở nút **Tải tệp kết quả** ⇒ phép kiểm đỏ, gọi đúng
`jobs/[jobId]/page.tsx:131`.

### Chạy thật (chỉ qua cổng 3302, không đụng 3301)

| Đường | Kết quả đo |
|---|---|
| `PUT /v1/storage/upload/...` | `HTTP 200` · 14405 byte · `detectedMimeType: image/png` |
| `GET /v1/storage/download/...` | `HTTP 200` · 1584 byte · `image/png` · magic `\x89PNG` đúng |

- **Status**: `confirmed` · **Date**: 2026-09-18 · **Owner**: Owner MediaClear Pro
