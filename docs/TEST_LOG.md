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

---

## 2026-09-15 (lần 6) — Bản vá đóng Q-22 (phạm vi ô tick)

MINI-SPEC `P1.1-Q22-MCP-22` · quyết định `D-035`. Nền: `511498a` (Q-20 closure).

### 1. Bốn lệnh kiểm, chạy RIÊNG từng lệnh

| # | Lệnh | Mã thoát | Kết quả |
|---|---|---|---|
| 1 | `pnpm typecheck` | `0` | `tsc -b --force` 4 package, không lỗi |
| 2 | `pnpm lint` | `0` | `eslint .`, không cảnh báo |
| 3 | `pnpm test` | `0` | **37 tệp / 337 test đạt** (trước Q-22: 36 tệp / 327 test) |
| 4 | `pnpm build:web` | `0` | `✓ Compiled successfully` |

`git diff --check`: sạch, mã thoát `0`.

Mã thoát được ghi ra tệp riêng từng lệnh (`q22_typecheck.log`, `q22_lint.log`, `q22_test.log`,
`q22_build.log`) chứ không đọc `$?` giữa chuỗi lệnh.

Lần chạy đầu `pnpm build` trả `254` vì **không có script tên `build`** ở gốc — tên đúng là
`build:web`. Đây là lỗi gõ lệnh của người chạy, không phải lỗi mã nguồn; ghi lại để lần sau khỏi
tưởng là hồi quy.

### 2. Đối chứng âm — năm phép, mỗi phép tái tạo lỗi rồi khôi phục

| # | Tái tạo lỗi gì | Test phải đỏ | Thực tế |
|---|---|---|---|
| 1 | Trả nhãn ô tick về `rights.attestation.v2.checkbox` ("xác nhận nội dung trên") | `q22-checkbox` | **5 test đỏ** |
| 2 | Đổi **một ký tự** trong văn bản đã ký v2 (`này` → `nầy`) | `q20-wording` freeze | **3 test đỏ** |
| 2b | Đổi **một ký tự** trong văn bản đã ký v1 (`kết` → `kêt`) | `q20-wording` freeze | **1 test đỏ** |
| 3 | Xoá một khoá (`rights.attestation.scope_heading`) khỏi `en.json` | parity + khoá UI | **4 test đỏ** |
| 4 | Cho UI gọi khoá không tồn tại (`…v2.statement_text`) | khoá thô | **7 test đỏ** |
| 5 | Giả vờ đóng Q-21 (`unconfirmed` → `confirmed`) | chốt giữ Q-21 | **1 test đỏ** |

Sau mỗi phép, tệp được khôi phục từ bản sao lưu và toàn bộ 337 test xanh lại. Không phép nào được
"khôi phục" bằng cách nới lỏng test.

### 3. Live verification — bấm tay trên trình duyệt thật

Môi trường: API `:3001` chạy từ `apps/api/dist/server.js` (bản vừa `typecheck` emit), web `:3000`
chạy `next start` trên bản vừa `build:web`. Người dùng `q22@matbao.com`, workspace
`Studio kiểm ô tick Q-22`, dự án `prj_20185b26bb5f4a448743e56367f3a450`.

**Desktop 1280×900** — asset `ast_26bc240c9753478a861bdcfe5b07b27b`:

| Kiểm gì | Quan sát được |
|---|---|
| Tên gọi của ô tick (trình đọc màn hình đọc ra) | "Tôi xác nhận rằng tôi sở hữu nội dung này hoặc có quyền chỉnh sửa nội dung này." |
| Hộp thoại còn đủ 3 mục | Phạm vi hỗ trợ · Xác nhận quyền sử dụng · Phiên bản tuyên bố |
| Số phiên bản lấy từ máy chủ | `v2` |
| Nút xác nhận trước khi tick | `disabled` |
| Ký | thành công, thẻ chuyển sang "Đã xác nhận quyền sử dụng" |
| Lỗi console | **không có** |
| Tràn ngang | `scrollWidth 1280 = clientWidth 1280` |

**Mobile 390×844** — asset `ast_f9bb732314c14798bf11bfe558b181cd`:

| Kiểm gì | Quan sát được |
|---|---|
| Nhãn ô tick | đúng câu canonical, không bị cắt |
| Câu được ký xuất hiện mấy lần trong hộp thoại | **đúng 1 lần** |
| Tràn ngang | `scrollWidth 390 = clientWidth 390`, không phần tử nào vượt biên |
| Hộp thoại có phải cuộn dọc không | không (`scrollHeight 781 = clientHeight 781`) |
| Ký | thành công |
| Lỗi console | **không có** |

### 4. Hồi quy API — đọc từ máy chủ thật, không dựng lại

| Kiểm gì | Kết quả |
|---|---|
| Phiên bản tuyên bố API công bố | `2`, `i18nKey = rights.attestation.v2.statement`, `validityDays = 365` |
| Ký bản **v1** (cũ) | **HTTP 403** `MCP_POLICY_RIGHTS_ATTESTATION_STALE` |
| Ký bản **v2** | HTTP 200, `att_cdad4218…` và `att_494e9b90…` |
| Bản ghi lưu gì | `statementVersion: 2` · `localeShown: "vi"` · `attestationType: "user_self_declared"` · `status: "active"` |
| Lần ký v1 bị chặn có ghi đè bản ghi cũ không | **không** — bản ghi vẫn nguyên `att_cdad4218…`, version 2 |
| Số route | `31` (25 chạy thật · 3 trả 501 · 2 nội bộ tắt mặc định) — **không đổi** |
| Route `DELETE` | **không có** |
| Migration | vẫn `0001`, `0002` — **không thêm bản nào** |

### 5. Bug thật tìm được trong lượt này

**#13 — Test bộ khoá v2 của Phase 1.1 khoá cứng một khoá mà Q-22 phải bỏ.** `wording.test.ts` liệt kê
`checkbox` trong danh sách hậu tố bắt buộc của `rights.attestation.v2.*`. Khi Q-22 xoá khoá nhãn mơ hồ,
test này đỏ. *Root cause*: test phát biểu "bộ khoá v2 phải có đủ 9 hậu tố" — đúng ở Phase 1.1, nhưng
đó là mô tả **hiện trạng**, không phải bất biến. *Fix*: bỏ `checkbox` khỏi danh sách và **thêm một test
ngược** khẳng định khoá đó phải **không còn tồn tại**, để việc xoá là có chủ đích chứ không phải sơ suất.
*Regression*: chính hai test đó.

Không có bug sản phẩm nào trong lượt này — thay đổi giới hạn ở nhãn hiển thị và tài liệu.

### 6. Giới hạn của lần kiểm tra này

- Bản **English** của nhãn ô tick chỉ kiểm được ở tầng dữ liệu: giao diện **chưa có nút đổi ngôn ngữ**,
  nên trạng thái bằng chứng của bản en là `partially_verified`, không phải `confirmed`.
- Q-21 vẫn để ngỏ: chữ cuối bản English của câu phạm vi là suy ra từ prompt bị cắt ở "identifying ma".
- Runtime vẫn `ephemeral` — khởi động lại API là mất dữ liệu; hai asset ở trên chỉ tồn tại trong phiên
  kiểm này.
- Mọi giới hạn của Phase 1.1 giữ nguyên: chưa có worker, benchmark provider `unknown`,
  **không có đường xoá dữ liệu nào**.

---

## 2026-09-16 (lần 7) — Ghi nhận trạng thái Q-21 (câu English chưa được duyệt)

MINI-SPEC `P1.1-Q21-MCP-21` · quyết định `D-034`. Nền: `4125966` (Q-22 closure).

Lượt này **không sửa một câu chữ nào**. Nó biến trạng thái "bản English chưa được owner duyệt" từ một
dòng chữ trong tài liệu thành ràng buộc máy kiểm được.

### 1. Bốn lệnh kiểm, chạy RIÊNG từng lệnh

| # | Lệnh | Mã thoát | Kết quả |
|---|---|---|---|
| 1 | `pnpm typecheck` | `0` | `tsc -b --force` 4 package |
| 2 | `pnpm lint` | `0` | `eslint .` |
| 3 | `pnpm test` | `0` | **38 tệp / 348 test đạt** (sau Q-22: 37 tệp / 337) |
| 4 | `pnpm build:web` | `0` | `✓ Compiled successfully` |

`git diff --check`: sạch, mã thoát `0`. Mã thoát ghi ra tệp riêng từng lệnh, không đọc `$?` giữa chuỗi.

### 2. Đối chứng âm — năm phép

Chốt chính của lượt này là **ràng buộc hai chiều**, nên phải chứng minh nó đỏ ở **cả hai** hướng.

| # | Tái tạo lỗi gì | Kết quả |
|---|---|---|
| A | Sửa chuỗi English (`marks` → `signs`) nhưng **giữ** Q-21 `unconfirmed` | **2 đỏ** — "owner đã duyệt thì phải đóng Q-21, chưa duyệt thì không được sửa chuỗi" |
| B | **Đóng** Q-21 thành `confirmed` nhưng chuỗi **không đổi** | **2 đỏ** — "không được tuyên bố owner đã duyệt khi chữ vẫn do agent tự hoàn thành" |
| C | Viết tiếp phần câu bị cắt (`+ " that are visible in the image or video"`) | **3 đỏ**, trong đó chốt độ dài báo `127 ≠ 88` |
| D | Chép nguyên bản tiếng Việt sang `en.json` (quên dịch) | **2 đỏ** — rò rỉ dấu tiếng Việt + `vi === en` ngoài miễn trừ |
| E | Nống trạng thái bằng chứng của giao diện English lên `confirmed` | **1 đỏ** |

Sau mỗi phép, tệp khôi phục từ bản sao lưu và test xanh lại. Không phép nào được xử lý bằng cách nới
lỏng test.

Phép A và B là cặp đối xứng — đây là thứ khiến chốt này khác với một dòng ghi chú: một dòng ghi chú
không thể sai, nên cũng không thể cảnh báo.

### 3. Live verification — bấm tay trên trình duyệt thật

Q-21 không đụng mã giao diện, nhưng vẫn kiểm lại để chắc chắn không làm hỏng thứ Q-22 vừa chốt.

| Kiểm gì | 1280×900 | 390×844 |
|---|---|---|
| Hộp thoại đủ ba mục | đạt | đạt |
| Nhãn ô tick = câu được ký | đạt | đạt |
| Phiên bản tuyên bố lấy từ máy chủ | `v2` | `v2` |
| Ký | thành công | thành công |
| Lỗi console | không có | không có |
| Tràn ngang | không | không |

Số đo thật lấy từ DOM, không phải cảm nhận:

| Phép đo | 1280×900 | 390×844 |
|---|---|---|
| `scrollWidth` vs `clientWidth` | `1280 = 1280` | `390 = 390` |
| Phần tử vượt biên phải | `0` | `0` |
| Tên gọi của ô tick (trình đọc màn hình) | đúng câu canonical | đúng câu canonical |
| Số lần câu được ký xuất hiện trong hộp thoại | `1` | `1` |
| Tiêu đề trong hộp thoại | — | `["Xác nhận quyền sử dụng", "Phạm vi hỗ trợ", "Xác nhận quyền sử dụng"]` |
| Hộp thoại phải cuộn dọc không | — | không |

Bản **English** vẫn **không** kiểm live được: giao diện chưa có nút đổi ngôn ngữ ⇒ trạng thái bằng
chứng là `partially_verified`, và nay có test chặn không cho ai ghi thành `confirmed`.

**Hai sự cố hạ tầng gặp giữa lượt kiểm — không phải lỗi sản phẩm, ghi lại để lần sau khỏi mất giờ:**

1. **Workspace mất gói hệ thống giữa phiên.** Chrome đang chạy thì chết, MCP báo `Target closed`.
   `ldd` trên binary Chrome cho thấy **24 thư viện dùng chung biến mất** (`libnspr4`, `libnss3`,
   `libglib-2.0`, `libgbm1`, …). `playwright install-deps` không chạy được bằng `sudo` vì module
   Python nằm trong không gian của user. Vá bằng `apt-get install` trực tiếp — lưu ý trên Ubuntu 24.04
   tên gói là **`libasound2t64`**, không phải `libasound2` (dùng tên cũ thì cả lệnh hỏng, mã thoát 100).
2. **Tệp mẫu trong `/tmp` bị xoá giữa lượt.** Bấm tải lên thì ứng dụng trả `MCP_VAL_EMPTY_FILE` và
   hiện đúng câu tiếng Việt *"Tệp rỗng hoặc tải lên chưa hoàn tất"*. Đây là **hành vi đúng** — cổng
   kiểm tệp rỗng hoạt động thật; chỉ cần tạo lại tệp mẫu.

### 4. Hồi quy — không đổi gì ở tầng dưới

| Kiểm gì | Kết quả |
|---|---|
| `RIGHTS_STATEMENT.version` | `2` — không tạo v3 |
| Văn bản ký v1/v2 | đóng băng, không đổi một ký tự |
| Nhãn ô tick (D-035) | không đụng |
| Số route | `31` — không đổi |
| Route `DELETE` | không có |
| Migration | vẫn `0001`, `0002` |
| Khoá dịch thô | `0` |
| Parity vi/en | 252/252 |
| Ký bản v1 (cũ) | **HTTP 403** `MCP_POLICY_RIGHTS_ATTESTATION_STALE` |
| Bản ghi sau lần ký v1 bị chặn | **không bị ghi đè** — vẫn `att_86276345…`, version 2 |
| Bản ghi lưu gì | `statementVersion: 2` · `localeShown: "vi"` · `user_self_declared` · `active` |

### 5. Bug thật tìm được trong lượt này

Không có bug sản phẩm. Thứ lượt này tìm ra là một **lỗ hổng quy trình**, không phải lỗi mã: trạng thái
`unconfirmed` của Q-21 trước đây không có gì canh, nên hai kiểu sai im lặng đều có thể xảy ra mà không
ai biết (sửa chữ mà giấu · đóng câu hỏi mà chưa ai duyệt). Đối chứng âm A và B chứng minh cả hai kiểu
sai đó **trước đây không bị chặn** và **bây giờ bị chặn**.

### 6. Giới hạn của lần kiểm tra này

- **Q-21 vẫn mở.** Lượt này đóng *công việc ghi nhận*, không đóng câu hỏi. Chờ owner gửi phần sau
  "identifying ma".
- Bản English vĩnh viễn `partially_verified` cho tới khi giao diện có nút đổi ngôn ngữ.
- Chốt parity "không dấu tiếng Việt trong `en.json`" bắt được lỗi chép nguyên văn, **không** bắt được
  bản dịch sai nghĩa — việc đó cần người đọc.
- Runtime vẫn `ephemeral`; giới hạn Phase 1.1 giữ nguyên, **không có đường xoá dữ liệu nào**.

---

## 2026-09-16 (lần 8) — Đánh số lại ID Q-21/Q-22 theo chỉ đạo owner

Quyết định `D-036`. Nền: `0c711c7`.

**Không thay đổi hành vi sản phẩm.** Lượt này chỉ đổi số hiệu ID và cập nhật tài liệu cho khớp.
Thay đổi mã duy nhất là **ghi chú trong tệp nguồn** (`RightsDialog.tsx` và ba tệp test) nhắc tới ID.

### 1. Phép đổi

| | Trước | Sau |
|---|---|---|
| MINI-SPEC Q-21 | `P1.1-Q21-MCP-22` | `P1.1-Q21-MCP-21` |
| MINI-SPEC Q-22 | `P1.1-Q22-MCP-21` | `P1.1-Q22-MCP-22` |
| Quyết định Q-21 | `D-035` | `D-034` |
| Quyết định Q-22 | `D-034` | `D-035` |

Đây là **phép hoán đổi hai chiều**, nên thay chuỗi trực tiếp sẽ hỏng. Script đi qua ký tự tạm
(`@@A@@`…`@@D@@`) rồi mới thay sang giá trị đích. Tương tự với hai tên tệp: `git mv` qua tên tạm trước
để tránh va chạm. Đổi trong **16 tệp**, đổi tên **2 tệp**.

### 2. Bốn lệnh kiểm, chạy RIÊNG từng lệnh

| # | Lệnh | Mã thoát |
|---|---|---|
| 1 | `pnpm typecheck` | `0` |
| 2 | `pnpm lint` | `0` |
| 3 | `pnpm test` | `0` — **38 tệp / 348 test đạt** |
| 4 | `pnpm build:web` | `0` |

`git diff --check`: sạch, mã thoát `0`.

Test canh index (`mini-spec-index.test.ts`, 9 test) vẫn xanh — nó khẳng định mọi spec trên đĩa đều có
trong index và không canonical ID nào trùng. Đây là chốt xác nhận phép đổi tên không để lại tệp mồ côi.

### 3. Ba chỗ phải sửa tay sau phép hoán đổi

Thay chuỗi hàng loạt làm hỏng đúng ba chỗ mang **ngữ nghĩa thứ tự**, không phải chỉ mang tên:

1. **Thứ tự khối trong `DECISIONS.md`** — sau khi đổi số, log đọc thành D-035 rồi D-034 (giảm dần).
   Đã đảo vị trí hai khối để log giữ **số tăng dần**. Ngày trong từng mục **giữ nguyên ngày thật**,
   nên D-034 (16-09) nay đứng trước D-035 (15-09). Có ghi chú giải thích ngay tại chỗ.
2. **Hai dòng "ID tiếp theo chưa dùng"** — chúng nhắc tới *dải* ID (`D-001…D-033`), nên phép hoán đổi
   biến chúng thành sai. Đã sửa tay cả hai.
3. **`MINI_SPEC_INDEX.md` và `PHASE_1_1_Q21_Q22_CLOSURE.md` §2** — hai chỗ này *giải thích* quy ước
   đánh số cũ ("số chạy theo thứ tự hoàn thành"). Sau phép đổi, lời giải thích thành ngược. Đã viết
   lại theo quy ước mới và thay bằng **bảng đối chiếu cũ ↔ mới**.

Bài học: thay chuỗi hàng loạt an toàn với *tên*, nhưng nguy hiểm với *câu văn nói về* cái tên đó.

### 4. Live verification — bấm tay, trên bản vừa build

Web được **khởi động lại** trước khi kiểm (tiến trình cũ đang chạy bản build trước đó — `lstart`
09:06, trong khi build mới chạy lúc 09:37).

| Phép đo | 1280×900 | 390×844 |
|---|---|---|
| `scrollWidth` vs `clientWidth` | `1280 = 1280` | `390 = 390` |
| Phần tử vượt biên phải | `0` | `0` |
| Ba mục trong hộp thoại | đủ | đủ |
| Nhãn ô tick | đúng câu canonical | đúng câu canonical |
| Số lần câu ký xuất hiện | `1` | `1` |
| Phiên bản hiển thị | `v2` | `v2` |
| Nút xác nhận trước khi tick | `disabled` | `disabled` |
| Ký | thành công | thành công |
| Lỗi console | không có | không có |

Asset dùng để kiểm: `ast_d7bd24c242014dc89c6107cdf67bc898` (desktop) ·
`ast_85ff21960b7543ff859f033867af32ce` (mobile).

### 5. Điều KHÔNG đổi

Văn bản ký v1/v2 · `RIGHTS_STATEMENT.version = 2` · nhãn ô tick · trạng thái Q-21 (`unconfirmed`) ·
trạng thái Q-22 (đã giải quyết) · 31 route · không route `DELETE` · không migration mới · `0` khoá
dịch thô · parity 252/252 · gate `READY_FOR_PHASE_2`.

### 6. Giới hạn

- Thông điệp commit của `4125966` và `0bd8420` **vẫn nhắc ID cũ**. Git không sửa được, và cũng không
  nên sửa. Bảng đối chiếu ở `PHASE_1_1_Q21_Q22_CLOSURE.md` §2 là chỗ tra khi đọc hai commit đó.
- Việc đánh số lại là **ngoại lệ một lần** đối với D-029, chỉ hợp lệ vì repo chưa push. Từ đây về sau
  ID đã phát hành không được đánh số lại.

---

## 2026-09-16 (lần 9) — Phase 2 mục đầu: adapter PostgreSQL + trình chạy migration

MINI-SPEC `P2-MCP-23` · quyết định `D-037`. Nền: `4ba10f7`.

### 1. Bốn lệnh kiểm, chạy RIÊNG từng lệnh

| # | Lệnh | Mã thoát | Kết quả |
|---|---|---|---|
| 1 | `pnpm typecheck` | `0` | |
| 2 | `pnpm lint` | `0` | |
| 3 | `pnpm test` (không PostgreSQL) | `0` | **40 tệp · 370 đạt · 4 bỏ qua** |
| 3b | `pnpm test` (**có** PostgreSQL) | `0` | **40 tệp · 392 đạt · 0 bỏ qua** |
| 4 | `pnpm build:web` | `0` | |

Chênh **22 test** giữa hai lần chạy chính là phần chạy thật trên PostgreSQL: 18 test hợp đồng + 4 test
trình chạy migration. Con số này là chốt chống "xanh vì không chạy gì": thiếu DB thì số test **giảm
thấy được**, không im lặng.

Môi trường: PostgreSQL **16.15** trong Docker (`postgres:16`), cổng 55432. Workspace không có sẵn
PostgreSQL — không client, không tiến trình, cổng 5432 từ chối.

### 2. Bộ test hợp đồng chạy trên CẢ HAI adapter

18 ca, viết **một lần**, chạy hai lượt: `InMemoryPersistence` và `PostgresPersistence`. Đây là chốt
chống hai adapter trôi khác nhau. Nó lập tức trả công:

| # | Khác biệt bị lộ ra | Ai đúng |
|---|---|---|
| 1 | **PostgreSQL ép toàn vẹn tham chiếu, in-memory thì không.** Test tạo được bản ghi con thiếu cha — PostgreSQL từ chối 15/18 ca | **PostgreSQL đúng.** Test được sửa cho khớp mô hình dữ liệu thật (users → workspaces → projects → assets → source_files → jobs) |
| 2 | DB có `CHECK (attempt_count >= 1)`, in-memory nhận `0` | **DB đúng** — và mã thật (`services/jobs.ts:184`) vốn đã dùng `1`. Chỉ fixture của tôi sai, **không phải lỗi sản phẩm** |
| 3 | `UPDATE` truyền 18 tham số nhưng chỉ dùng 12 ⇒ `could not determine data type of parameter $3` | **Lỗi của tôi** trong adapter; đã dùng danh sách tham số riêng cho `UPDATE` |

Nếu chỉ viết test riêng cho adapter mới, cả ba chỗ này đều sẽ không lộ ra.

### 3. Trình chạy migration — 8 test trên PostgreSQL thật

| Kiểm | Kết quả |
|---|---|
| Chạy lần đầu: áp dụng cả 3 migration | đạt |
| **Chạy lần hai: không làm gì** — đúng lỗi `PHASE_1_REPORT` §11 cảnh báo | đạt |
| Sửa migration **đã phát hành** ⇒ dừng, ném `MigrationChecksumError` | đạt |
| Migration lỗi giữa chừng ⇒ **không để lại lược đồ nửa vời**, không ghi sổ | đạt |

**Phát hiện thật khi dựng:** hai migration đã phát hành **tự mở giao dịch** (`BEGIN; … COMMIT;`) và
**tự ghi sổ** vào `schema_migrations(version)`. Thiết kế đầu của tôi dựng sổ riêng tên `name/checksum`
nên đụng ngay: `column "version" of relation "schema_migrations" does not exist`. Đã sửa hướng: dùng
**chính** bảng đó làm nguồn sự thật, tổng kiểm để bảng riêng, và **không bọc thêm giao dịch** cho tệp
đã tự mở giao dịch.

### 4. Migration `0003` — ba chỗ lược đồ thiếu so với kiểu miền

`source_files.project_id` · `source_files.declared_media_type` · `validation_results.errors` (jsonb).
Chỉ thêm cột, có backfill, không xoá gì. Chi tiết ở `DATA_MODEL.md` §17.

### 5. Live verification — phép thử quyết định

> Ký lời khai quyền → **khởi động lại API** → lời khai vẫn còn.

**Trước mục này phép thử đó luôn thất bại.**

| Bước | Kết quả |
|---|---|
| `/healthz` khi chạy PostgreSQL | `{ id: 'postgres-phase2', durability: 'durable' }` — **lần đầu tiên** |
| Log khởi động | `migration: ap dung 3, bo qua 0` rồi lần sau `ap dung 0, bo qua 3` |
| Ký qua giao diện thật | `att_ecf4b708a07f4415bb71b5db3520c04c`, `statementVersion: 2`, `localeShown: vi` |
| Đối chiếu **thẳng trong database** (không qua API) | 1 dòng, `statement_version = 2`, `locale_shown = vi`, `status = active` |
| **Khởi động lại API** | |
| Bản ghi sau khởi động lại | **cùng id**, cùng `statementVersion`, cùng `attestedAt` |
| Giao diện sau khởi động lại | hiện "Đã xác nhận quyền sử dụng"; tên tệp và SHA-256 còn nguyên |
| Lỗi console | không có |

**Nhưng phải nói rõ một nửa còn lại:** **phiên đăng nhập KHÔNG sống sót.** `DevIdentityProvider` giữ
phiên trong một mảng bộ nhớ (`auth/identity.ts:44`), lược đồ cũng không có bảng `sessions`. Sau khi
khởi động lại, giao diện hiện "Bạn cần đăng nhập để tiếp tục"; đăng nhập lại thì **toàn bộ dữ liệu
còn nguyên**. Đây là Q-14 (auth provider production), ngoài phạm vi `P2-MCP-23` — ghi lại để không ai
đọc mục này rồi tưởng đã hết chuyện mất trạng thái khi restart.

### 6. Giới hạn của lần kiểm tra này

- PostgreSQL chạy bằng **Docker để kiểm**; **chưa có** hạ tầng production.
- Chưa tinh chỉnh pool, chưa có read replica, **chưa đo hiệu năng dưới tải**.
- Object storage vẫn là đĩa local — tệp gốc vẫn nằm trên một máy.
- Phiên đăng nhập vẫn mất khi restart (Q-14).
- Giới hạn Phase 1.1 giữ nguyên: chưa có worker, benchmark provider `unknown`, chưa có provider AI
  production, **không có đường xoá dữ liệu nào**.

---

## 2026-09-16 (lần 10) — Phase 2: adapter object storage S3-compatible

MINI-SPEC `P2-MCP-24` · quyết định `D-038`. Nền: `6451612`.

### 1. Bốn lệnh kiểm, chạy RIÊNG từng lệnh

| # | Lệnh | Mã thoát | Kết quả |
|---|---|---|---|
| 1 | `pnpm typecheck` | `0` | |
| 2 | `pnpm lint` | `0` | |
| 3 | `pnpm test` (không hạ tầng) | `0` | **41 tệp · 383 đạt · 4 bỏ qua** |
| 3b | `pnpm test` (**có** PostgreSQL + MinIO) | `0` | **41 tệp · 418 đạt · 0 bỏ qua** |
| 4 | `pnpm build:web` | `0` | |

`git diff --check`: sạch. Chênh **35 test** giữa hai lần chạy là phần chạy thật trên hạ tầng:
22 (PostgreSQL) + 13 (MinIO).

Môi trường: MinIO `quay.io/minio/minio:latest` trong Docker, cổng 59000. Ảnh `minio/minio` trên
Docker Hub **kéo không được** (exit 7) — phải dùng `quay.io`.

### 2. Bộ hợp đồng storage chạy trên CẢ HAI adapter

13 ca, viết một lần, chạy hai lượt: `LocalFsStorageAdapter` và `S3CompatibleStorageAdapter`. Cùng
khuôn đã trả công ở `P2-MCP-23`. Ca đáng giá nhất:

> **Bất biến I-1 trên S3**: ghi đè object class `source` bị từ chối, **và** bản gốc phải còn
> nguyên vẹn (không bị sửa một phần). Trước đây bất biến này chỉ được ép ở đĩa local.

### 3. Lỗi thật lint bắt được

Sau khi chuyển route download từ `objectPath()` + `readFile(path)` sang `getObject()`, import
`readFile` trong `server.ts` thành thừa. `pnpm lint` báo đỏ, đã bỏ. Nhỏ, nhưng đúng loại rác mà
việc đổi tầng hay để lại.

### 4. Hai nhánh khởi động — kiểm riêng từng nhánh

| Nhánh | Kết quả |
|---|---|
| Bucket không tồn tại, **không** cho tạo | server **từ chối khởi động**, exit `1`, in rõ: `Bucket "…" khong ton tai … dat MEDIACLEAR_S3_CREATE_BUCKET=1 neu muon he thong tu tao` |
| Có cờ cho phép | `da tao bucket "mediaclear-live"` rồi mới nhận request |

Đây là chủ ý: gõ nhầm tên bucket mà hệ thống tự tạo thì lỗi cấu hình sẽ thành "chạy được", và người
vận hành phát hiện ra khi đã muộn.

### 5. Live verification — byte có THẬT SỰ nằm trong MinIO không

`/healthz` khai `storage: { id: 's3-compatible-phase2', production: true }` — **lần đầu tiên** adapter
lưu trữ tự khai là production.

Tải một tệp PNG 240×160 qua **giao diện thật**, rồi đọc **thẳng từ MinIO** (không qua API):

| Phép đo | Giá trị |
|---|---|
| Số object trong bucket | `1` |
| Khoá | `mediaclear-phase1/workspaces/wsp_4813d85c…/projects/prj_4c370186…/assets/ast_5448fd29…/source/src_802aaeda….png` |
| Kích thước | `44101` byte — khớp tệp gốc |
| `content-type` | `image/png` |
| sha256 **lưu kèm object** | `67f50b02c98181351e240d234b45c093e376b6f00bd599700c0c95ea7df590ea` |
| sha256 **tính lại từ byte thật trong MinIO** | chuỗi y hệt |
| sha256 tệp gốc (tính **trước** khi tải lên) | chuỗi y hệt |

Tải xuống qua API: HTTP `200`, `image/png`, `44101` byte, sha256 **vẫn khớp**. Vòng tròn khép kín.

### 6. Điều KHÔNG đổi

31 route · không route `DELETE` · không migration mới · biên upload/download vẫn là ticket HMAC qua
API · văn bản ký v1/v2 · `RIGHTS_STATEMENT.version = 2` · lời khai quyền vẫn sống sót restart.

### 7. Giới hạn của lần kiểm tra này

- **Chưa kiểm trên Cloudflare R2 thật.** Mới MinIO. R2 khác ở `region` và virtual-host style; cần một
  lượt kiểm riêng khi có khoá R2 — **đừng coi mục này là đã sẵn sàng cho R2**.
- Byte vẫn **đi qua API**, chưa tải thẳng từ trình duyệt lên S3.
- Chưa có CDN, chưa có vòng đời object, chưa đo hiệu năng dưới tải.
- `deleteObject` có trên adapter nhưng **không đường nào gọi** — đúng theo quyết định giữ dry-run.

---

## 2026-09-16 (lần 11) — Phase 2: xác thực bằng mật khẩu + phiên lưu DB (đóng Q-14)

MINI-SPEC `P2-MCP-25` · quyết định `D-039`. Nền: `9469ef0`.

### 1. Bốn lệnh kiểm, chạy RIÊNG từng lệnh

| # | Lệnh | Mã thoát | Kết quả |
|---|---|---|---|
| 1 | `pnpm typecheck` | `0` | |
| 2 | `pnpm lint` | `0` | |
| 3 | `pnpm test` (không hạ tầng) | `0` | **43 tệp · 401 đạt · 4 bỏ qua** |
| 3b | `pnpm test` (**có** PostgreSQL + MinIO) | `0` | **43 tệp · 447 đạt · 0 bỏ qua** |
| 4 | `pnpm build:web` | `0` | |

`git diff --check`: sạch.

**Một lượt build thất bại rồi tự hết.** Lần chạy đầu `build:web` thoát `1` dù Next in đủ bảng route;
chạy lại sạch thì thoát `0` và log không còn dòng lỗi nào. Nguyên nhân: lần đầu tôi chạy build **song
song** với việc giết/khởi động lại API trong cùng một lệnh. Không phải lỗi mã — nhưng ghi lại vì
"build hỏng rồi tự hết" là thứ dễ bị bỏ qua.

### 2. Test mới

| Bộ | Số ca | Ghi chú |
|---|---|---|
| `p2-password` | 7 | băm mật khẩu |
| `p2-password-identity` | 11 × 2 adapter = **22** | đăng ký / đăng nhập / phiên |

Ca quan trọng nhất — **phiên sống sót "khởi động lại"**: một thể hiện `PasswordIdentityProvider`
**mới** (mô phỏng tiến trình vừa khởi động) đọc được phiên do thể hiện **cũ** cấp. Trước `P2-MCP-25`
phép này **luôn thất bại**.

Bộ băm mật khẩu có một ca đáng chú ý: **mọi dạng chuỗi băm hỏng** (rỗng · sai định dạng · tham số
không phải số · muối rỗng · thuật toán khác · thiếu đoạn) đều phải trả `false`, **không ném lỗi** —
chuỗi hỏng không được biến thành đường vào qua một tầng bắt lỗi ở trên.

### 3. Lỗi thiết kế của tôi mà TEST bắt được

Bản đầu tôi chỉ bật `PasswordIdentityProvider` khi có `MEDIACLEAR_DATABASE_URL`, lý luận rằng "xác
thực thật mà phiên bay mỗi lần restart là lừa người dùng".

`api-contract.test.ts` báo đỏ: **route khai `implemented` lại trả `501`** khi chạy không DB — tức là
nói dối về chính nó.

Sửa đúng: độ bền của phiên là việc của **tầng lưu trữ**, đã tự khai ở `/healthz` qua
`persistence.durability`. Cổng xác thực chỉ lo chứng minh danh tính. Provider nay **luôn bật**; chạy
in-memory thì phiên bay theo restart **đúng như mọi dữ liệu khác**.

Lỗi thứ hai: tôi **thay** `DevIdentityProvider` bằng provider mới ⇒ **73 test đỏ**, vì
`/v1/auth/dev-session` gọi vào provider mật khẩu và bị ném lỗi. Sửa bằng `CompositeIdentityProvider`
giữ cả hai đường; `isProductionProvider` chỉ `true` khi **cửa dev đã đóng**.

### 4. Live verification

Chạy với `MEDIACLEAR_DEV_AUTH=0` (cửa dev đóng). `/healthz` khai **cả ba cổng là production** —
lần đầu tiên:

```
identity:    { id: 'password-phase2',      production: true }
persistence: { id: 'postgres-phase2',      durability: 'durable' }
storage:     { id: 's3-compatible-phase2', production: true }
routes: 33
```

Thí nghiệm có kiểm soát trên email hoàn toàn mới:

| Bước | Kết quả |
|---|---|
| Đăng ký email mới | `ok: true` |
| Đăng ký **trùng** email đó | `MCP_AUTH_INVALID_CREDENTIALS` |
| Đăng nhập đúng mật khẩu | `ok: true`, có token |
| Đăng nhập **sai** mật khẩu | `MCP_AUTH_INVALID_CREDENTIALS` — **cùng mã** với trùng email |

**Phép thử quyết định:**

| Bước | Kết quả |
|---|---|
| Đăng nhập, gọi `/v1/me` | `ok: true`, `owner2@matbao.com` |
| **Khởi động lại API** | |
| Dùng **lại token cũ** gọi `/v1/me` | `ok: true`, `owner2@matbao.com` |

Giao diện: trang đăng nhập nay có ô **Mật khẩu** và nút chuyển sang **Tạo tài khoản mới**. Đăng nhập
bằng mật khẩu thật qua trình duyệt → vào được `/workspaces`, **không lỗi console**.

### 5. Giới hạn của lần kiểm tra này

- **Chưa có giới hạn tần suất, chưa khoá tài khoản sau N lần sai.** Hiện **không có gì chặn thử mật
  khẩu hàng loạt** — phải có trước khi mở cho người ngoài.
- Chưa có đặt lại mật khẩu, chưa có xác minh email.
- Tài khoản tạo ở thời dev không đăng nhập bằng mật khẩu được (không có mật khẩu).
- Q-11 (BA/pháp lý duyệt câu chữ) vẫn chặn go-live.

---

## 2026-09-16 (lần 11) — Phase 2: xác thực bằng mật khẩu, phiên lưu database

MINI-SPEC `P2-MCP-25` · quyết định `D-039` · **đóng Q-14**. Nền: `9469ef0`.

### 1. Bốn lệnh kiểm, chạy RIÊNG từng lệnh

| # | Lệnh | Mã thoát | Kết quả |
|---|---|---|---|
| 1 | `pnpm typecheck` | `0` | |
| 2 | `pnpm lint` | `0` | |
| 3 | `pnpm test` (không hạ tầng) | `0` | **43 tệp · 401 đạt · 4 bỏ qua** |
| 3b | `pnpm test` (**có** PostgreSQL + MinIO) | `0` | **43 tệp · 447 đạt · 0 bỏ qua** |
| 4 | `pnpm build:web` | `0` | |

`git diff --check`: sạch.

**Một ghi chú về build:** lượt chạy đầu `build:web` trả `1` **sau khi** Next đã in xong bảng route.
Chạy lại sạch thì `0`, log không còn dòng lỗi nào. Nguyên nhân là tranh chấp tài nguyên vì tôi khởi
động lại API song song trong cùng lệnh, **không phải lỗi mã**. Ghi lại vì đây đúng kiểu "hỏng một lần
rồi thôi" dễ bị bỏ qua hoặc bị quy oan cho mã nguồn.

### 2. Test băm mật khẩu — 7 ca

Đây là lớp chắn duy nhất giữa một email và toàn bộ dữ liệu của người đó, nên mọi dạng hỏng phải trả
`false` chứ không được ném lỗi rồi để tầng trên bắt nhầm thành "cho qua":

| Ca | Kết quả |
|---|---|
| Chuỗi băm **không chứa** mật khẩu thường | đạt |
| Hai lần băm cùng mật khẩu ra **hai chuỗi khác nhau** (có muối) | đạt |
| Tài khoản chưa đặt mật khẩu (`null`) ⇒ không đăng nhập được | đạt |
| 6 dạng chuỗi băm hỏng (rỗng · sai định dạng · tham số không phải số · muối rỗng · thuật toán khác · thiếu đoạn) | **đều trả `false`, không ném lỗi** |

### 3. Test cổng xác thực — 11 ca, chạy trên CẢ HAI adapter (22 lượt)

| Ca đáng chú ý | Kết quả |
|---|---|
| **Phiên sống sót qua "khởi động lại"** — thể hiện provider **mới** đọc được phiên do thể hiện cũ cấp | đạt |
| Email không tồn tại và mật khẩu sai trả **cùng** mã lỗi | đạt |
| Đăng ký trùng email cũng trả mã đó (không xác nhận email tồn tại) | đạt |
| Database **chỉ lưu hash**, không lưu token rõ | đạt |
| Thu hồi rồi thì token hết tác dụng | đạt |
| Phiên hết hạn không dùng được | đạt |

### 4. Lỗi thiết kế của tôi, do test bắt được

Bản đầu tôi chỉ bật `PasswordIdentityProvider` khi có `MEDIACLEAR_DATABASE_URL`, lý do nghĩ ra lúc đó:
"xác thực thật mà phiên bay mỗi lần restart là lừa người dùng".

Test `api-contract` bắt ngay: **route khai `implemented` lại trả `501`** khi chạy không DB — tức là
nói dối về chính nó. Sửa: provider luôn bật; độ bền của phiên là việc của **tầng lưu trữ**, đã tự khai
ở `/healthz` qua `persistence.durability`.

Lần thứ hai: tôi **thay** `DevIdentityProvider` bằng provider mới ⇒ **73 test đỏ**, vì
`/v1/auth/dev-session` gọi vào provider mật khẩu và bị ném lỗi. Sửa bằng `CompositeIdentityProvider`
giữ cả hai đường, và `isProductionProvider` chỉ `true` khi **cửa dev đã đóng**.

### 5. Live verification

`/healthz` khi chạy với `MEDIACLEAR_DEV_AUTH=0`:

```
identity:    { id: 'password-phase2', production: true }
persistence: { id: 'postgres-phase2', durability: 'durable' }
storage:     { id: 's3-compatible-phase2', production: true }
routes: 33
```

**Lần đầu tiên cả ba cổng cùng tự khai production.**

Thí nghiệm có kiểm soát trên API thật (email sinh theo thời gian để chắc chắn là mới):

| Bước | Kết quả |
|---|---|
| Đăng ký email mới | `ok: true`, có token |
| Đăng ký **trùng** email đó | `ok: false`, `MCP_AUTH_INVALID_CREDENTIALS` |
| Đăng nhập đúng mật khẩu | `ok: true`, có token |
| Đăng nhập **sai** mật khẩu | `ok: false`, **cùng** mã lỗi trên |

**Phép thử quyết định — phiên sống sót khởi động lại:**

| Bước | Kết quả |
|---|---|
| Đăng nhập, gọi `/v1/me` | `ok: true`, `owner2@matbao.com` |
| **Khởi động lại API** | |
| Dùng **lại token cũ** gọi `/v1/me` | `ok: true`, `owner2@matbao.com` |

Giao diện: trang đăng nhập nay có ô **Mật khẩu** và nút chuyển sang **Tạo tài khoản mới**. Đăng nhập
bằng mật khẩu thật qua giao diện: vào được `/workspaces`, **không lỗi console**.

Một điểm suýt kết luận sai: một lời gọi đăng ký trả `401` làm tôi tưởng có lỗi. Kiểm ra thì email đó
**đã được tạo bởi một tiến trình API tôi khởi động trước đó** (log khác), nên đây là **trùng email** —
đúng hành vi đã thiết kế. Thí nghiệm có kiểm soát ở trên là cách xác nhận, thay vì suy đoán từ log.

### 6. Giới hạn của lần kiểm tra này

- **Chưa có**: đặt lại mật khẩu, xác minh email, khoá tài khoản sau N lần sai, giới hạn tần suất.
  Hiện **không có gì chặn thử mật khẩu hàng loạt** — ba thứ cuối nên có **trước khi mở cho người ngoài**.
- Tài khoản tạo ở thời dev không có mật khẩu ⇒ không đăng nhập bằng mật khẩu được.
- `/v1/auth/dev-session` **vẫn còn** cho môi trường dev; ở production phải đặt `MEDIACLEAR_DEV_AUTH=0`,
  nếu không `isProductionProvider` sẽ tự khai `false` (đúng sự thật, vì vẫn còn cửa không mật khẩu).
- Q-11 (BA/pháp lý duyệt câu chữ) vẫn chặn go-live.
