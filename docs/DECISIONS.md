# DECISIONS — MediaClear Pro

Mỗi quyết định: bối cảnh → quyết định → lý do → hệ quả → trạng thái.
`confirmed` = owner đã chốt. `provisional` = tôi chọn để contract dùng được, **cần owner duyệt**
(mỗi mục provisional đều có câu hỏi tương ứng trong `OPEN_QUESTIONS.md`).

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
- **Trạng thái**: `provisional` → Q-08.

## D-006 — Rights attestation chỉ ở scope `asset`
- **Quyết định**: không cho phép xác nhận cấp workspace/project.
- **Lý do**: xác nhận "một lần cho tất cả" biến Rights Guard thành hình thức.
- **Hệ quả**: mỗi asset cần một lần xác nhận; UX phải làm bước này nhẹ nhàng.
- **Trạng thái**: `provisional` → Q-09.

## D-007 — Allowlist định dạng và kích thước
- **Bối cảnh**: prompt chốt 10 phút / 200 MB nhưng **không** nói định dạng hay kích thước pixel.
- **Quyết định tạm**: ảnh `jpeg/png/webp`, cạnh 64–8000 px; video `mp4/quicktime/webm`; **chưa**
  đặt giới hạn pixel cho video (để `unknown`, không bịa số).
- **Trạng thái**: `provisional` → Q-03.

## D-008 — Preview không tính phí
- **Quyết định**: `PREVIEW_IS_BILLABLE = false`.
- **Lý do**: UX bắt buộc "preview trước export"; tính phí preview sẽ khiến người dùng né bước này.
- **Trạng thái**: `provisional` → Q-10.

## D-009 — `video_minute_unit` làm tròn LÊN theo phút
- **Quyết định**: `quantity = ceil(durationSeconds / 60)`; video 61 giây = 2 đơn vị.
- **Hệ quả**: không biết duration → **không** tính, trả `MCP_USAGE_QUANTITY_UNKNOWN`.
- **Trạng thái**: `provisional` → Q-10.

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
- **Quyết định tạm**: `RIGHTS_STATEMENT.validityDays = 365`; đổi `statementVersion` cũng làm
  attestation cũ hết hiệu lực.
- **Trạng thái**: `provisional` → Q-09.

## D-016 — Project là git repository riêng
- **Bối cảnh**: các project anh em trong workspace (`audit-ads`, `voidmix`, `Translation`, …) đều là
  repo riêng, docs nằm trong `docs/`.
- **Quyết định**: `git init` riêng cho `Tool MediaClear Pro`, theo đúng convention đó.
- **Trạng thái**: `confirmed`.
