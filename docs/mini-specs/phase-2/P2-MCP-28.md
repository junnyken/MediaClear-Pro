# P2-MCP-28 — Job Worker on PostgreSQL

- **Canonical ID**: `P2-MCP-28` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-042` · **Đóng một phần**: Q-02

## Context

Đã đọc: `P2-MCP-23` (adapter PostgreSQL) · `P2-MCP-26` (container) · `P2-MCP-27` (xử lý ảnh tất
định) · `docs/DECISIONS.md` (D-005, D-020, D-040, D-041) · `apps/api/src/services/run-job.ts` ·
`apps/api/src/persistence/port.ts`. Commit nền: `170b244`.

**Vấn đề.** `P2-MCP-27` đã làm job chạy được tới `completed` — nhưng **chỉ khi có người gọi tay**
route nội bộ `POST /internal/jobs/:jobId/run`. Job do người dùng tạo qua API nằm `queued` mãi mãi cho
tới khi ai đó nhớ ra và gọi. Với người dùng thật, đó là một sản phẩm **không chạy**: họ tải tệp lên,
bấm xử lý, rồi không có gì xảy ra.

Mục này làm job **tự chạy**.

## Constraints (Guardrails)

- **Không double-charge.** Hai worker chạy song song mà cùng nhận một job thì tệp bị xử lý hai lần và
  mức dùng bị tính hai lần. Đây là ràng buộc **cứng**, không phải mong muốn.
- **Bất biến I-2**: thứ tự `queued → processing → xử lý → lưu → ĐỌC LẠI và đo lại → completed → tính
  mức dùng` không được đổi. Worker phải đi qua **đúng** đường đó.
- **Một job hỏng không được làm chết worker** — những job còn lại vẫn phải chạy.
- Worker **không mở cổng mạng** và **không chạy migration**.
- `blocked` là terminal (D-005) — worker không được nhận lại job đã `blocked`.

## Design Choice

**1. Hàng đợi nằm trên PostgreSQL, không phải Redis.**

Cơ sở dữ liệu **đã có sẵn** và đã bền vững (`P2-MCP-23`). Thêm Redis chỉ để xếp hàng là thêm một thứ
có thể chết riêng, phải sao lưu riêng, phải giải thích cho người vận hành riêng — và Vibe Host hiện
**không có** Redis. `FOR UPDATE SKIP LOCKED` đủ cho mức dùng MVP. Đổi sang Redis sau vẫn được vì cổng
`claimQueued` không lộ ra bên trong nó dùng gì.

**2. `FOR UPDATE SKIP LOCKED` — một câu lệnh, không có khe hở.**

```sql
UPDATE processing_jobs SET state = 'processing', attempt_count = attempt_count + 1, updated_at = $1
  WHERE id = (
    SELECT id FROM processing_jobs
     WHERE state = 'queued'
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED
  )
  RETURNING *
```

Hai chi tiết quyết định tính đúng:

- **Chọn và đổi trạng thái nằm trong MỘT câu lệnh.** Nếu tách làm hai (`SELECT` rồi `UPDATE`), giữa
  chúng có một khe hở mà worker khác chen vào được.
- **`SKIP LOCKED` chứ không phải chờ khoá.** Nếu chờ, worker thứ hai sẽ **chờ rồi cũng nhận đúng job
  đó** sau khi worker thứ nhất nhả khoá — tức là vẫn xử lý hai lần, chỉ chậm hơn. `SKIP LOCKED` biến
  hàng đợi thành thứ mà nhiều worker **chia nhau được thật sự**.

**3. Worker không viết lại logic xử lý.**

`run-job.ts` được tách làm hai:

| Hàm | Vai trò | Ai gọi |
|---|---|---|
| `runJob(ctx, workspaceId, jobId)` | tìm job, chuyển `queued → processing`, rồi uỷ quyền | route nội bộ |
| `executeClaimedJob(ctx, job)` | làm việc trên job **đã ở `processing`** | worker, và `runJob` |

Worker đã nhận job bằng `claimQueued` (câu lệnh trên **đã** chuyển sang `processing`), nên nó vào
thẳng `executeClaimedJob`. Hai đường dùng **cùng một** thân logic. Nếu chép làm hai bản, chỗ trôi khác
nhau sẽ là chỗ tính mức dùng.

**4. Tiến trình riêng, không nằm trong API.**

Một job nặng không được làm chậm đường phục vụ người dùng, và tắt worker để bảo trì không được làm sập
API. Container dùng chung một ảnh, ba vai qua `MEDIACLEAR_ROLE` (`api` | `web` | `worker`) — theo
đúng D-040.

**5. Worker cảnh báo to khi lưu trữ không bền vững.**

Worker chạy **tiến trình riêng**. Nếu lưu trữ là in-memory, nó nhìn vào một kho **rỗng khác hẳn** của
API và sẽ không bao giờ thấy job nào — trong im lặng. Đây đúng là loại lỗi tự-im-lặng mà dự án này
phải chặn, nên worker nói ngay lúc khởi động.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| worker tự nhận job `queued` và chạy xong, **không gọi tay** | vẫn phải gọi tay |
| hết việc thì trả `null`, không quay vòng | đốt CPU khi rảnh |
| nhận rồi thì job **không còn** ở hàng đợi | nhận hai lần |
| **hai worker song song, chỉ một bên nhận được** | double-charge |
| `stop()` dừng **sau khi** xong job hiện tại | bỏ job giữa chừng |
| một job hỏng **không** làm chết worker | một lỗi giết cả hàng đợi |
| **PostgreSQL thật**: worker chạy xong job | chỉ đúng trên in-memory |
| **PostgreSQL thật**: ba worker song song, đúng một bên nhận được, mức dùng tính **đúng một lần** | `SKIP LOCKED` không thật sự nguyên tử |

Hai test cuối chạy trên PostgreSQL **thật** (bỏ qua nếu không có `TEST_DATABASE_URL`), vì `SKIP LOCKED`
là hành vi của máy chủ cơ sở dữ liệu — adapter in-memory **không thể** chứng minh nó đúng. Đây là lý do
tồn tại của bộ test hai-adapter.

## Success Criteria

- Job tạo **thuần qua API**, không gọi tay gì, tự chạy tới `completed`.
- Ba worker song song trên PostgreSQL thật: đúng một bên nhận, **một** bản ghi mức dùng.
- Worker sống sót qua job hỏng.
- `MEDIACLEAR_ROLE=worker` khởi động được trong container.

## Verified (chạy thật)

Chi tiết đầy đủ ở `TEST_LOG.md` lần 16. PostgreSQL 16.15 + MinIO thật, API chạy với
**`internalApiEnabled: false`** — tức **không tồn tại đường nào** gọi tay job.

**Đối chứng âm trước:** job tạo thuần qua API, chưa bật worker, sau 5 giây vẫn `queued`.

**Bật worker (tiến trình riêng):**

```
[mediaclear-worker] bat dau · luu tru postgres-phase2 (durable) · kho s3-compatible-phase2
  sau 1s: completed
[worker] job_b01232670d1f473194d45c6efe382031 -> completed
```

Đọc thẳng từ PostgreSQL và MinIO, không qua API:

| Phép đo | Kết quả |
|---|---|
| Bản ghi `output_assets` | **1** dòng, `validated = t`, 5421 byte |
| **Mức dùng** | đúng **1** `reserve` + **1** `commit` — không tính hai lần |
| Checksum trong DB | khớp byte thật trong MinIO |
| **Tệp gốc** | sha256 y hệt lúc tải lên (bất biến I-1) |
| Vùng được chọn làm mờ | lệch **78.39**/kênh |
| Vùng không được chọn | lệch **0.00** — giống hệt từng byte |

`SIGTERM` dừng êm: in `nhan SIGTERM, dung sau khi xong job hien tai` rồi thoát sạch.

## Remaining Limits / Follow-ups

- **Không có retry.** `attempt_count` được tăng nhưng job hỏng đi thẳng tới `failed`/`blocked` và
  nằm đó. Backoff + giới hạn số lần thử là việc của mục sau.
- **Không có job bị kẹt được cứu.** Nếu worker chết **giữa lúc** đang xử lý, job nằm `processing`
  vĩnh viễn — chưa có cơ chế đòi lại theo thời gian chờ (`visibility timeout`).
- **Không ưu tiên.** Hàng đợi là FIFO theo `created_at`, một workspace tải lên 1000 tệp sẽ chặn mọi
  người phía sau.
- **Một job một lần cho mỗi worker.** Chưa chạy song song trong cùng một tiến trình.
- Chưa có số đo (metric) về độ dài hàng đợi hay thời gian chờ.
- **Chưa triển khai lên Vibe Host.** Vai `worker` đã chạy đúng trong **ảnh Docker thật dựng từ git**,
  nhưng website worker trên Vibe Host cần **chung cơ sở dữ liệu** với API, mà cổng quản trị chỉ trả
  **tên** biến chứ không trả giá trị — chuỗi kết nối của `mediaclear-api-db` chỉ chủ tài khoản lấy
  được. Tạo website worker với cơ sở dữ liệu trống tự cấp sẽ cho ra một worker `online` mà im lặng
  không xử lý gì, nên không làm.
