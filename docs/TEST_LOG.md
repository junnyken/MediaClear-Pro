# TEST_LOG — MediaClear Pro

Chỉ ghi những lần chạy **thật**, kèm kết quả thật.

---

## 2026-09-15 — Phase 0 verification run

Môi trường: workspace Coder, Node v22.22.3, pnpm 10.14.0, TypeScript 5.9.3, vitest 2.1.9,
Next.js 15.1.6.

| # | Kiểm tra | Lệnh | Kết quả |
|---|---|---|---|
| 1 | Typecheck | `pnpm typecheck` | **PASS** — exit 0 |
| 2 | Lint | `pnpm lint` | **PASS** — exit 0, 0 lỗi |
| 3 | Lint có thật sự quét `.ts`/`.tsx` không | cài 2 vi phạm cố ý rồi chạy `npx eslint .` | **PASS** — báo đúng 2 lỗi `no-explicit-any` ở cả `.ts` và `.tsx`, exit 1; sau đó xoá file thử |
| 4 | Unit + contract + regression test | `pnpm test` | **PASS** — 72/72 test, 10 file |
| 5 | Build frontend | `pnpm build:web` | **PASS** — 11 route, exit 0 |
| 6 | API skeleton chạy thật | `node dist/server.js` + curl | **PASS** — xem §2 |
| 7 | Web skeleton chạy thật | `next start` + curl 10 màn | **PASS** — xem §3 |
| 8 | Migration / schema validation | — | **KHÔNG CHẠY** — chưa có DB và chưa có migration nào (Q-01) |
| 9 | Integration HTTP + DB | — | **KHÔNG CHẠY** — lý do như trên |
| 10 | Live verification với media thật | — | **KHÔNG CHẠY** — chưa có provider thật, chưa có media mẫu (Q-06, Q-07) |

### Phân bố test (72)

`vocabulary` 4 · `media-limits` 7 · `job-state-machine` 7 · `policy` 9 · `provider` 6 ·
`provenance` 8 · `usage` 8 · `invariants` 9 (regression) · `i18n` 8 · `docs-consistency` 6.

---

## 2. Live verification — API skeleton (thật, không mock)

```
$ PORT=3099 node dist/server.js
$ curl -s -w '%{http_code}' http://127.0.0.1:3099/healthz
{"ok":true,"phase":"phase-0-foundation","productionAiProcessingEnabled":false,"routes":10}  200

$ curl -s -X POST -w '%{http_code}' http://127.0.0.1:3099/v1/jobs
{"ok":false,"error":{"code":"MCP_NOT_IMPLEMENTED","messageKey":"errors.mcp_not_implemented",
 "params":{"route":"/v1/jobs"}}}  501

$ curl -s -w '%{http_code}' http://127.0.0.1:3099/v1/jobs/abc
{...,"params":{"route":"/v1/jobs/:jobId"}}  501
```

Kết luận: đúng như thiết kế — chỉ `/healthz` chạy thật; route nghiệp vụ trả 501 với mã lỗi rõ ràng,
**không** giả vờ thành công.

## 3. Live verification — Web skeleton (thật)

`next start -p 3098`, sau đó gọi từng route:

| Route | HTTP | `<h1>` |
|---|---|---|
| `/` | 200 | Tổng quan |
| `/new-cleanup` | 200 | Tạo yêu cầu mới |
| `/upload-validation` | 200 | Kiểm tra tệp tải lên |
| `/rights` | 200 | Xác nhận quyền sử dụng |
| `/provenance` | 200 | Thông tin gốc của tệp |
| `/usage` | 200 | Mức dùng và hạn mức |
| `/activity` | 200 | Nhật ký hoạt động |
| `/workspace/image` | 200 | Bàn làm việc ảnh |
| `/workspace/video` | 200 | Bàn làm việc video |
| `/projects/p123` | 200 | Chi tiết dự án |

Kiểm thêm: `<html lang="vi">` có mặt; trang `/rights` render đúng dòng hợp đồng thiết kế
"Chưa xác nhận thì không xử lý" và nhãn "khung thiết kế" (không tự nhận là tính năng đã chạy).

---

## 4. Bug thật tìm được trong Phase 0

| # | Bug | Do đâu phát hiện | Cách sửa |
|---|---|---|---|
| B-01 | `FEATURES.md` mục out-of-scope có một dòng liệt kê năng lực ở **thể khẳng định** (động từ xoá/vô hiệu hoá đứng đầu câu, không kèm phủ định). Trích lẻ dòng đó ra khỏi ngữ cảnh sẽ đọc thành lời hứa về năng lực xử lý dấu ẩn — vi phạm guardrail 4. | test `docs-consistency` (quy tắc: mọi câu nhắc tới watermark vô hình phải tự mang phủ định) | Viết lại thành "Không xoá, không vô hiệu hoá và không cam kết kiểm soát…" — test chuyển xanh |
| B-02 | Chính test `docs-consistency` kiểm **theo dòng**, trong khi markdown xuống dòng cứng cắt câu làm đôi → báo nhầm 3 dòng hợp lệ của `PHASE_0_REPORT.md` là vi phạm (phủ định nằm ở dòng trước). | chạy lại suite sau khi thêm 2 tài liệu mới | Ghép đoạn rồi tách theo **câu** trước khi kiểm; bổ sung dấu hiệu phủ định `vi phạm`/`phủ định` |
| B-03 | `TEST_LOG.md` và `PHASE_0_REPORT.md` khi mô tả B-01 lại **trích nguyên văn** câu vi phạm — tức tái tạo đúng chuỗi mà guardrail 4 cấm. | test `docs-consistency` sau khi sửa B-02 | Diễn đạt lại bằng mô tả thay vì trích dẫn |

Không có bug nào trong contract code được phát hiện ở lần chạy này (cả ba bug đều ở tầng tài liệu/kiểm tra). Toàn bộ contract test xanh ngay lần chạy
đầu; điều đó **không** chứng minh pipeline xử lý media đúng — Phase 0 chưa có pipeline nào để chứng
minh.

## 5. Giới hạn của lần kiểm tra này

- Không có bằng chứng nào về chất lượng/chi phí xử lý AI: chưa gọi provider thật lần nào.
- Không có bằng chứng về bảo toàn metadata thật: chưa đọc file thật lần nào.
- Web skeleton mới được kiểm ở mức server-render (HTTP + nội dung HTML), **chưa** click-through
  bằng trình duyệt thật.

---

## 2026-09-15 (lần 2) — Owner decisions & gate closure run

Sau khi áp dụng 7 owner decision (Q-01, Q-03, Q-04, Q-06, Q-08, Q-09, Q-10). Mỗi lệnh chạy **riêng**
và ghi mã thoát riêng.

| # | Kiểm tra | Lệnh | Kết quả |
|---|---|---|---|
| 1 | Typecheck | `pnpm typecheck` | **PASS** — exit 0 |
| 2 | Lint | `pnpm lint` | **PASS** — exit 0 |
| 3 | Test suite | `pnpm test` | **PASS** — **136/136**, 17 file, 0 fail, 0 skip |
| 4 | Build frontend | `pnpm build:web` | **PASS** — exit 0, 11 route |
| 5 | Live — API | `node apps/api/dist/server.js` + curl | **PASS** — xem §2.2 |
| 6 | Live — Web | `next start` + curl 10 màn | **PASS** — 10/10 HTTP 200, `lang="vi"` |
| 7 | Schema / migration validation | — | **KHÔNG CHẠY** — Phase 0 cố ý không tạo migration nào (owner decision Q-01) |
| 8 | Integration với PostgreSQL thật | — | **KHÔNG CHẠY** — chưa có schema |
| 9 | Storage adapter thật (R2/MinIO) | — | **KHÔNG CHẠY** — mới có adapter in-memory cho contract test |
| 10 | Benchmark provider (10 kịch bản) | — | **KHÔNG CHẠY** — chưa chọn provider (Q-06) và chưa có media mẫu (Q-07); mọi ô vẫn `unknown` |

### 2.1. Phân bố 136 test

| File | Test |
|---|---|
| `invariants.test.ts` (regression, 12 invariant) | 13 |
| `policy.test.ts` | 12 |
| `media-limits.test.ts` | 10 |
| `usage.test.ts` | 10 |
| `docs-consistency.test.ts` | 10 |
| `job-state-machine.test.ts` | 9 |
| `tenancy.test.ts` | 9 |
| `provider.test.ts` | 8 |
| `provenance.test.ts` | 8 |
| `i18n.test.ts` | 8 |
| `integration-pipeline.test.ts` | 8 |
| `storage.test.ts` | 7 |
| `error-catalogue.test.ts` | 7 |
| `benchmark.test.ts` | 5 |
| `preview.test.ts` | 4 |
| `vocabulary.test.ts` | 4 |
| `apps/api/tests/api-contract.test.ts` (HTTP thật) | 4 |

### 2.2. Live verification — API

```
GET  /healthz                 → 200  {"ok":true,...,"productionAiProcessingEnabled":false,"routes":11}
POST /v1/jobs                 → 501  MCP_NOT_IMPLEMENTED  (route "/v1/jobs")
POST /v1/jobs/j1/preview      → 501  MCP_NOT_IMPLEMENTED  (route "/v1/jobs/:jobId/preview")
```

Route mới `preview` cũng trả 501 như thiết kế — **không** đổi 501 thành fake success.

### 2.3. Live verification — Web

10/10 màn trả HTTP 200 với tiêu đề tiếng Việt đúng (Tổng quan, Tạo yêu cầu mới, Kiểm tra tệp tải
lên, Xác nhận quyền sử dụng, Thông tin gốc của tệp, Mức dùng và hạn mức, Nhật ký hoạt động, Bàn làm
việc ảnh, Bàn làm việc video, Chi tiết dự án); `<html lang="vi">` có mặt.

### 2.4. Bug thật tìm được ở lần 2

| # | Bug | Do đâu phát hiện | Cách sửa |
|---|---|---|---|
| B-04 | Một câu trong `TEST_STRATEGY.md` mô tả chính cơ chế kiểm tra lại rơi vào diện bị cấm: câu tự nó nhắc tới dấu ẩn mà không mang phủ định | test `docs-consistency` | Viết lại câu để mang phủ định tường minh |

Không có bug contract nào ở lần chạy này; các contract mới (tenancy, storage, benchmark, preview)
xanh ngay lần chạy đầu. Điều đó **không** chứng minh pipeline xử lý media đúng — vẫn chưa có
pipeline nào để chứng minh.

### 2.5. Thay đổi cách chạy test

`vitest.config.ts` nay alias `@mediaclear/*` về `src/`, để test **luôn** chạy trên source thay vì
`dist/` cũ. Trước đó test của `apps/api` sẽ import bản build cũ và có thể xanh giả.

---

## 2026-09-15 (lần 3) — Phase 1: SaaS Shell & Media Intake

### 1. Lệnh chạy riêng từng cái

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `pnpm typecheck` | exit 0 | `tsc -b` cho contracts + design-tokens + i18n + api |
| `pnpm lint` | exit 0 | eslint toàn repo, 0 cảnh báo |
| `pnpm test` | exit 0 — **214/214 pass**, 25 tệp, 0 skip | Phase 0 có 136 ⇒ Phase 1 thêm **78** |
| `pnpm build:web` | exit 0 | 20 route Next.js |
| Migration trên PostgreSQL sạch | exit 0 | `postgres:16-alpine` mới, tạo 12 bảng |
| Kiểm chứng ràng buộc DB | exit 0 | 6/6 ràng buộc **chặn thật** |

### 2. Test theo nhóm

| Nhóm | Số test | Nội dung |
|---|---|---|
| Đọc media thật | 12 | PNG/JPEG/WebP (lossy + lossless), MP4 có/không tiếng, MOV, WebM, file rỗng, file hỏng; đối chứng với `ffprobe` |
| Auth + tenancy | 11 | 401, workspace của người khác, header giả mạo, ma trận quyền, audit khi bị từ chối |
| Nhập liệu + lưu trữ | 14 | upload byte thật, checksum, chống ghi đè, ticket giả mạo, biên 199 MB/599 s/3840 px, khai sai MIME |
| Ranh giới job + usage | 13 | 5 cổng, idempotency, `blocked` terminal, huỷ, làm tròn phút |
| Hồi quy R-1…R-12 | 11 | 12 invariant mới của Phase 1 |
| Quan sát + audit | 7 | trường bắt buộc, che thông tin nhạy cảm |
| Khoá object | 4 | dạng khoá, traversal, tương thích khoá Phase 0 |
| Cấu trúc UI | 4 | chặn tái diễn lỗi tìm được khi bấm tay |
| Bảng route ↔ server | 6 | route khai `implemented` phải có handler và **không** trả 501 |

### 3. Live verification — API chạy từ bản đã build (`node apps/api/dist/server.js`)

| Bước | Kết quả thật |
|---|---|
| `GET /healthz` | 200 · `phase-1-saas-shell` · `productionAiProcessingEnabled: false` · `productionProviders: 0` |
| Đăng nhập + tạo workspace + project | 200, vai trò `owner` |
| `upload-intent` + `PUT` video 599 giây (9.861 byte) | 200 · SHA-256 `107d60cc…c435` **khớp tuyệt đối** file gốc |
| `validate` | 200 · `valid: true` (đo được 599 s từ chính byte) |
| Tạo job khi **chưa** xác nhận quyền | 403 `MCP_POLICY_RIGHTS_ATTESTATION_MISSING`, job `blocked`, ledger rỗng |
| Xác nhận quyền rồi tạo lại | 200 · job `queued` · `usage: video_minute_unit × 10 (reserved)` |
| Gửi lại cùng `idempotencyKey` | cùng `jobId`, ledger vẫn 1 bản ghi |
| Người khác đọc asset | 404 |
| `POST /v1/jobs/:id/preview` | 501 `MCP_NOT_IMPLEMENTED` |
| Tải lại file gốc qua download URL | SHA-256 khớp lại `107d60cc…c435` |
| Audit | 9 sự kiện đúng thứ tự nghiệp vụ |
| Nhật ký máy chủ | **0** lần xuất hiện token/`Bearer` |

### 4. Live verification — giao diện, bấm tay trên Chrome thật

Đăng nhập → tạo workspace → tạo dự án → chọn tệp → tải lên → kiểm tra → xác nhận quyền → tạo lượt
xử lý → xem trạng thái → huỷ. **0 lỗi console** trên toàn luồng.

Điểm đáng ghi:
- Màn kiểm tra hiện **số đo đọc từ byte**: video 320×240, 2 giây, 20.830 byte (khớp `ffprobe`).
- Với ảnh, ô "giây" hiện **"Chưa xác định"**, không hiện `0`.
- Trang trạng thái hiện đủ: "đã được tiếp nhận" · "chưa bật xử lý AI production" · "không hiển thị
  kết quả giả". Không nơi nào có chữ "thành công".
- Huỷ lượt ⇒ trạng thái "Đã huỷ", mức dùng "Đã hoàn lại".

### 5. Bug THẬT tìm được và đã sửa

| # | Bug | Tìm ra bằng | Nguyên nhân gốc | Cách sửa | Chốt chặn tái diễn |
|---|---|---|---|---|---|
| 1 | Mọi upload trả **414 URI Too Long** | test tích hợp | `maxParamLength` mặc định của Fastify là 100 ký tự, ngắn hơn upload ticket | `routerOptions: { maxParamLength: 4096 }` | 14 test nhập liệu |
| 2 | Server live chạy **mã cũ** | live verification | test chạy trên `src` (alias vitest), còn server chạy `dist`; `dist` chưa build lại | luôn `pnpm typecheck` (có emit) trước khi chạy live | ghi vào quy trình ở mục 7 |
| 3 | Giao diện hiện **khoá dịch thô** thay vì tiếng Việt | bấm tay | `build:web` không build gói workspace trước ⇒ Next đóng gói bản `dist` i18n cũ (127 khoá thay vì 235) | `build:web = build:packages && next build` | build lại là thấy ngay; ghi ở `package.json` |
| 4 | Thẻ "Giới hạn tệp" **kẹt ở "Đang tải…" vĩnh viễn** | bấm tay | `/healthz` trả đối tượng phẳng, client lại đọc theo bao `{ok,data}` ⇒ `data` là `undefined` | thêm `fetchHealth()` đọc đúng dạng; ghi ngoại lệ vào `API.md` §3 (D-028) | — |
| 5 | API trả **lỗi nội bộ thô** `FST_ERR_CTP_EMPTY_JSON_BODY` | bấm tay | POST không body nhưng khai `application/json`; parser mặc định ném lỗi và Fastify trả nguyên dạng lỗi framework | `setErrorHandler` + parser chấp nhận body rỗng + `setNotFoundHandler`; client chỉ khai content-type khi có body | R-12 mở rộng: body rỗng, JSON hỏng, route lạ — đều phải ra `ApiError` |
| 6 | Có nút bấm **không đi đâu cả** | bấm tay | `<Button>` lồng trong `<Link>` — lồng hai phần tử tương tác là HTML không hợp lệ | thêm `LinkButton` (thẻ `a` tạo dáng nút), thay 9 chỗ | test cấu trúc UI, **đã kiểm đối chứng âm**: dựng lại lỗi ⇒ test đỏ, gỡ ⇒ xanh |
| 7 | Thanh bên vẫn hiện "Đăng nhập" sau khi đã đăng nhập | bấm tay | `Shell` chỉ đọc `/v1/me` một lần lúc mount | đọc lại theo mỗi lần đổi trang | — |
| 8 | Ảnh mẫu 64×48 bị từ chối | test | **không phải lỗi code**: `MIN_IMAGE_DIMENSION_PX = 64` nên cạnh 48 px là không hợp lệ — fixture sai, bộ kiểm tra đúng | đổi fixture thành 200×120 | — |

### 6. Giới hạn của lần kiểm tra này

- Chạy migration **lần hai** trên cùng database sẽ **lỗi** (`relation "users" already exists`) vì chưa
  có trình chạy migration đọc `schema_migrations`. Trên database sạch thì đúng.
- Chưa test tải cao, chưa test upload đứt giữa chừng, chưa test đọc màn hình (screen reader).
- Giao diện chỉ có test **cấu trúc tĩnh**; phần hành vi được bảo chứng bằng bấm tay, chưa có test
  trình duyệt tự động.
- Chưa chạy benchmark provider nào (Q-06/Q-07) — mọi ô vẫn `unknown`.

### 7. Quy tắc rút ra (áp dụng từ nay)

1. Test chạy trên `src`, người dùng chạy trên `dist`/bundle. **Verify live phải chạy trên bản đã build**.
2. Gói workspace phải được build **trước** khi bundler đóng gói; nếu không, bản dịch/contract cũ lọt
   vào mà không ai báo lỗi.
3. Bấm tay tìm ra 5/8 bug trong lượt này, trong đó có một lỗi rò rỉ lỗi nội bộ mà 200+ test không bắt.

---

## 2026-09-15 (lần 4) — Phase 1.1: Hardening

### 1. Lệnh chạy riêng từng cái

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `pnpm typecheck` | exit 0 | |
| `pnpm lint` | exit 0 | |
| `pnpm test` | exit 0 — **299/299 pass**, 33 tệp, 0 skip | Phase 1 có 214 ⇒ Phase 1.1 thêm **85** |
| `pnpm build:web` | exit 0 | |
| Migration `0002` trên DB sạch (sau `0001`) | exit 0 | 5/5 ràng buộc mới **chặn thật** |
| Migration `0002` trên DB **đã có dữ liệu** | exit 0 | số bản ghi trước/sau **bằng nhau**; hàng cũ nhận mặc định `active`/`policy_v=1` |

### 2. Test thêm theo nhóm

| Nhóm | Số test | Nội dung |
|---|---|---|
| Đánh số MINI-SPEC | 9 | không trùng canonical ID, file trên đĩa đều có trong index, `API_ROUTES` không trỏ mồ côi |
| Hạn khoản giữ (đơn vị) | 18 | biên 1799/1800/1801 giây, múi giờ, bảng transition, chặn commit sau hết hạn |
| Hạn khoản giữ (HTTP) | 11 | hết hạn không đổi trạng thái job, hoàn trả đúng 1 lần, chạy lại không sinh thêm, thử lại tạo khoản mới |
| Lưu giữ dữ liệu (đơn vị) | 18 | từng luật một, biên hai phía, legal hold, audit/sổ mức dùng không bị dọn theo asset |
| Lưu giữ dữ liệu (HTTP) | 11 | báo cáo chỉ đếm, route nội bộ bị chặn, không route xoá nào tồn tại |
| Câu chữ | 11 + 3 | khớp từng chữ bản owner duyệt, không CTA cấm, v1 giữ làm lịch sử |
| Khoá dịch UI | 3 | **mọi** khoá UI gọi đều tồn tại ở cả hai locale |

### 3. Live verification (server chạy từ `dist`, có khoá nội bộ)

| Kiểm | Kết quả |
|---|---|
| `/healthz` | 31 route · 25 implemented · 3 planned · 2 internal · TTL 1800 giây · retention policy v1 · statement v2 |
| Luồng Phase 1 | không regress: upload → validate → job đều 200 |
| Ký xác nhận bằng **bản v1** | **403 `MCP_POLICY_RIGHTS_ATTESTATION_STALE`** — lần đầu cơ chế phiên bản chạy thật |
| Ký bằng v2 | 200, `statementVersion: 2` |
| Tạo job | khoản giữ có `expiresAt` = lúc tạo + 30 phút |
| Hạn lưu giữ của tệp | giữ tới +30 ngày, chưa phải ứng viên, lý do `within_retention` |
| Route nội bộ **không khoá** | 404 `MCP_RESOURCE_NOT_FOUND` |
| Route nội bộ **sai khoá** | 404 — không phân biệt được với đường dẫn lạ |
| Báo cáo lưu giữ, mốc hôm nay | quét 1, ứng viên **0** |
| Báo cáo lưu giữ, nhìn tới +31 ngày | ứng viên **1**, lý do `source_inactive_30d`, 391 byte (kích thước thật của tệp) |
| Sau báo cáo | tệp vẫn đọc được (HTTP 200) — **không xoá gì** |
| Lệnh hoàn trả khoản quá hạn | quét 1, quá hạn **0** (chưa khoản nào đủ 30 phút) |
| Mức dùng | tách rõ đang giữ / đã hết hạn giữ / đã tính |

### 4. Live verification — giao diện (bấm tay trên Chrome thật)

Đăng nhập → tạo workspace → tạo dự án → tải ảnh thật → mở hộp thoại xác nhận quyền → ký → tạo lượt
xử lý. **0 lỗi console**.

- Hộp thoại hiện **đủ 4 câu chính thức** và ghi `rights_attestation v2`.
- CTA hiện đúng bản ưu tiên: "Làm sạch vùng nhận diện" (tổng quan, chi tiết tệp) và
  "Xử lý vùng logo và dấu hiệu nhận diện" (màn xác nhận trước khi xử lý).
- Màn trạng thái hiện "Giữ mức dùng đến 18:56:12 15/9/2026".

### 5. Bug THẬT tìm được và đã sửa

| # | Bug | Tìm ra bằng | Nguyên nhân gốc | Cách sửa | Chốt chặn tái diễn |
|---|---|---|---|---|---|
| 9 | Phiên đăng nhập bị coi là **hết hạn ngay** khi đồng hồ được tua | test lưu giữ (tua 20 ngày) | `DevIdentityProvider` dùng `Date.now()` thay vì đồng hồ của ứng dụng ⇒ **hai nguồn thời gian trong một tiến trình**: phiên tạo theo đồng hồ này nhưng kiểm theo đồng hồ kia | tiêm `ctx.now()` vào identity provider; cả tiến trình dùng một đồng hồ | test "phiên tính hạn theo đồng hồ của ứng dụng", **đã kiểm đối chứng âm** |
| 10 | Hộp thoại xác nhận quyền hiện **khoá dịch thô** `rights.attestation.v2.visible_scope_note` | bấm tay | đổi tiền tố khoá v1→v2 hàng loạt, nhưng câu đó đã chuyển sang khoá chính sách mới ⇒ khoá v2 tương ứng không tồn tại | dùng `policy.visible_identity_scope` | test mới: **mọi** khoá UI gọi phải tồn tại ở cả hai locale, **đã kiểm đối chứng âm** |
| 11 | Kỳ vọng sai trong chính test lưu giữ | test | bản ghi cũ nhất đang `legal_hold` nên **không** phải ứng viên; tôi kỳ vọng nhầm nó là ứng viên cũ nhất | sửa kỳ vọng, ghi chú lý do ngay trong test | — |

Lỗi #9 và #10 đều **không** bị 214 test của Phase 1 bắt được: #9 chỉ lộ khi có test điều khiển đồng
hồ, #10 chỉ lộ khi mở hộp thoại bằng mắt.

### 6. Giới hạn của lần kiểm tra này

- Hành vi hoàn trả **tại đúng mốc 30 phút** được kiểm bằng đồng hồ điều khiển được trong test; live
  chỉ xác nhận lệnh chạy được, bị chặn đúng, và báo 0 khoản quá hạn (chưa khoản nào đủ 30 phút).
  ⇒ live ở mức `partially_verified`.
- **Chưa từng chạy dọn dữ liệu thật** — Phase 1.1 cố ý không có đường xoá nào.
- Runtime vẫn `ephemeral`; báo cáo lưu giữ trên máy chỉ thấy dữ liệu của phiên hiện tại.
- Chưa có worker tự chạy hai việc vận hành trên.

---

## 2026-09-15 (lần 5) — Bản vá đóng Q-20 (câu chữ)

### 1. Lệnh chạy riêng từng cái

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `pnpm typecheck` | exit 0 | |
| `pnpm lint` | exit 0 | |
| `pnpm test` | exit 0 — **327/327 pass**, 36 tệp, 0 skip | Phase 1.1 có 299 ⇒ **+28** |
| `pnpm build:web` | exit 0 | `dist` của gói i18n đồng bộ với `src` (253/253), bundle chứa câu canonical |
| Migration | **không chạy migration mới** — bản vá này không đụng schema |

### 2. Test thêm

| Nhóm | Số test | Nội dung |
|---|---|---|
| Câu chữ canonical + đóng băng văn bản | 13 | khớp từng chữ; **văn bản v1/v2 không đổi**; không câu nào hứa xoá/kiểm soát dấu hiệu vô hình; không giá trị nào trông như khoá thô; không lệch nội suy |
| Phiên bản tuyên bố qua HTTP | 6 | API công bố đúng v2; ký v1 ⇒ `STALE`; ký v2 ⇒ nhận, lưu đủ `statementId/version/locale/type`; hồ sơ cũ **không** bị tự cập nhật; ký lại tạo bản ghi mới (append-only) |
| Cấu trúc hộp thoại | 9 | đủ ba mục; dùng đúng văn bản được ký; giữ đủ bốn thông điệp Phase 1; số phiên bản lấy từ máy chủ; có nhãn cho trình đọc màn hình |

### 3. Live verification — API (server chạy từ `dist`)

| Kiểm | Kết quả |
|---|---|
| API công bố tuyên bố | `rights_attestation` **v2**, `i18nKey = rights.attestation.v2.statement`, hiệu lực 365 ngày |
| Ký bằng **v1** | **403 `MCP_POLICY_RIGHTS_ATTESTATION_STALE`** |
| Ký bằng **v2** | 200 · lưu `statementVersion: 2`, `localeShown: vi`, `attestationType: user_self_declared` |
| Tạo job sau khi ký | `queued`, mức dùng `reserved` |
| Bảng route | **31 route — không đổi** so với Phase 1.1 (không thêm route nào ngoài phạm vi) |

### 4. Live verification — giao diện (Chrome thật)

Mở hộp thoại xác nhận quyền và đọc lại từng câu:

- **Phạm vi hỗ trợ** → đúng câu canonical + câu dữ liệu còn sót + câu giới hạn.
- **Xác nhận quyền sử dụng** → đủ hai lưu ý + **văn bản được ký** + ô tick.
- **Phiên bản tuyên bố: v2 · hiệu lực 365 ngày**.
- **Không còn khoá thô**; nút xác nhận khoá cho tới khi tick; **0 lỗi console**.
- CTA hiển thị "Làm sạch vùng nhận diện".
- Khổ điện thoại **390×844**: đo 12 phần tử chữ ⇒ **0 tràn, 0 bị cắt**, không cuộn ngang; ký thành công ở khổ này.

**Chưa kiểm được**: giao diện **chưa có bộ chuyển ngôn ngữ** (tiếng Việt là mặc định), nên bản English
chỉ được kiểm ở tầng dữ liệu bằng test ⇒ ghi `partially_verified`, **không** ghi `verified`.

### 5. Bug thật tìm được

**#12 — Test index MINI-SPEC hiểu sai chính ý định của nó.** Khi thêm hàng `P1.1-Q20-MCP-20`
(phase ghi là "Phase 1.1 (Q-20 closure)"), test "historical ID không bị xoá" lọc bằng
`phase !== 'Phase 1.1'` nên coi hàng mới là hàng cũ và đòi nó phải có historical ID.
*Root cause*: điều kiện lọc bám vào chuỗi phase thay vì bám vào ý định "hàng nào có ID lịch sử".
*Fix*: lọc theo `phase.startsWith('Phase 1.1')` và khẳng định rõ số hàng cũ tối thiểu.
*Regression*: chính test đó, nay phát biểu đúng ý định.

Không có bug sản phẩm nào trong lượt này — thay đổi giới hạn ở câu chữ và cấu trúc hiển thị.

### 6. Giới hạn của lần kiểm tra này

- Bản English mới chỉ kiểm ở tầng dữ liệu (chưa có bộ chuyển ngôn ngữ trên giao diện).
- Chữ cuối của bản English là suy ra từ bản bị cắt trong prompt (Q-21).
- Câu thứ hai của tooltip trong prompt vẫn không đọc được — **không viết tiếp**.
- Mọi giới hạn của Phase 1.1 giữ nguyên: runtime `ephemeral`, chưa có worker, benchmark `unknown`,
  **không có đường xoá dữ liệu nào**.
