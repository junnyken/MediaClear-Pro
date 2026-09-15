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
