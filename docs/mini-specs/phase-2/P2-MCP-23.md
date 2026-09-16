# P2-MCP-23 — PostgreSQL Persistence Adapter & Migration Runner

- **Canonical ID**: `P2-MCP-23` · **Parent phase**: Phase 2 — mục đầu tiên
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-037`

## Context

Đã đọc trước khi sửa: `MINI_SPEC_PLAYBOOK.md` (bản v2 owner gửi kèm hội thoại) ·
`docs/PHASE_0_GATE_CLOSURE_REPORT.md` · `docs/PHASE_1_REPORT.md` · `docs/PHASE_1_1_REPORT.md` ·
`docs/PHASE_1_1_Q21_Q22_CLOSURE.md` · `docs/PHASE_2_READINESS_ASSESSMENT.md` ·
`docs/FEATURES.md` · `docs/DATA_MODEL.md` · `docs/ARCH.md` · `docs/API.md` · `docs/DECISIONS.md` ·
`docs/OPEN_QUESTIONS.md` · `docs/MINI_SPEC_INDEX.md` ·
`apps/api/src/persistence/port.ts` · `apps/api/src/persistence/in-memory.ts` ·
`apps/api/src/app-context.ts` · `db/migrations/0001_phase1_init.sql` ·
`db/migrations/0002_phase1_1_retention_and_reservation_ttl.sql`.

Commit nền: `4ba10f7`. Gate vào: `READY_FOR_PHASE_2`.

**Vấn đề đang giải.** `/healthz` tự khai `persistence: { id: 'in-memory-phase1', durability:
'ephemeral' }`. Khởi động lại API là mất sạch workspace, project, asset và **lời khai quyền sử dụng**.
Trong các lượt kiểm live của Q-20/Q-22/Q-21, việc này đã xảy ra **ít nhất năm lần**, mỗi lần phải dựng
lại dữ liệu từ đầu.

Hệ quả nghiêm trọng hơn chuyện bất tiện: cả Q-19, Q-20 và Q-22 dựng lên một hệ thống **bằng chứng**
cho lời khai quyền — `statementId` + `statementVersion` + `localeShown` + `attestedAt`. Bằng chứng đó
hiện **không sống sót qua một lần khởi động lại**. Đó là lý do mục này đi trước mọi mục khác của
Phase 2.

## Constraints (Guardrails)

- **Không** đổi `PersistencePort`. Adapter mới phải vừa khít bề mặt đã có.
- **Không** đổi hành vi mặc định: thiếu cấu hình DB thì vẫn chạy in-memory như cũ.
- **Không** đổi API: giữ 31 route, không thêm route `DELETE`, không đổi hình dạng request/response.
- **Không** đụng văn bản đã ký v1/v2; không tạo statement v3; `RIGHTS_STATEMENT.version` giữ `2`.
- **Không** có đường xoá dữ liệu nào. Retention vẫn chỉ dry-run.
- **Không** commit chuỗi kết nối hay mật khẩu.
- Giữ 12 invariant Phase 0 và toàn bộ hồi quy Phase 1 / 1.1.

## Scope

**Trong phạm vi**: trình chạy migration · adapter PostgreSQL hiện thực đủ **33 phương thức** của
`PersistencePort` · bộ test hợp đồng chạy trên **cả hai** adapter · ráp adapter qua biến môi trường ·
`/healthz` khai đúng adapter đang dùng · tài liệu.

**Ngoài phạm vi**: adapter object storage (R2/MinIO) · auth provider production (Q-14) · queue/worker
(Q-02) · ba route còn trả 501 · provider AI · worker dọn dữ liệu · connection pooling tinh chỉnh ·
read replica.

## Audit Before Build

| Mục | Phát hiện |
|---|---|
| Bề mặt phải hiện thực | **33 phương thức** trên 11 nhóm: users · workspaces · memberships · projects · assets · sourceFiles · validations · attestations · jobs · usage · audit |
| Adapter hiện có | `InMemoryPersistence`, 244 dòng, tự khai `durability: 'ephemeral'` |
| Chỗ ráp | `app-context.ts:39` — `overrides.persistence ?? new InMemoryPersistence()` |
| `/healthz` | **đã** lộ `{ id, durability }` — không phải thêm trường mới |
| Lược đồ | `0001` tạo **11 bảng**; `0002` chỉ thêm cột + index, không phá dữ liệu |
| Trình chạy migration | **chưa có** — `PHASE_1_REPORT.md` §11 đã cảnh báo chạy lần hai trên DB có dữ liệu sẽ lỗi |
| Driver `pg` | **chưa có** trong `package.json` |
| Quy ước biến môi trường | `MEDIACLEAR_*` (10 biến đang dùng) |
| PostgreSQL trong workspace | **không có sẵn** — không client, không tiến trình, cổng 5432 từ chối. Dựng PG 16.15 trong Docker để kiểm thật |

## Design Choice

**1. Một bộ test hợp đồng, chạy trên cả hai adapter.**

Rủi ro lớn nhất của việc thêm adapter thứ hai là **hai adapter trôi khác nhau**: test viết cho
in-memory vẫn xanh trong khi PostgreSQL hành xử khác (thứ tự, `null`, kiểu ngày, ràng buộc). Vì vậy
bộ test được viết **một lần**, nhận adapter làm tham số, và chạy hai lượt. Adapter nào lệch thì đỏ.

| Phương án | Kết quả |
|---|---|
| Viết test riêng cho adapter PostgreSQL | **Loại.** Hai bộ test = hai định nghĩa về "đúng"; chúng sẽ trôi khác nhau |
| Chỉ test adapter PostgreSQL, bỏ in-memory | **Loại.** In-memory vẫn là mặc định khi chạy không có DB |
| **Một bộ hợp đồng, tham số hoá adapter** | **Chọn** |

**2. Trình chạy migration tự ghi sổ, có tổng kiểm.**

Bảng `schema_migrations` lưu tên tệp, thời điểm áp dụng và **tổng kiểm SHA-256** của nội dung. Chạy
lại: bỏ qua bản đã áp dụng (idempotent). Nếu tệp đã áp dụng mà **nội dung đổi** ⇒ **dừng và báo lỗi**,
không im lặng chạy lại — sửa migration đã phát hành là lỗi quy trình, không phải việc để tự xử lý.

Mỗi migration chạy trong **một giao dịch**: lỗi giữa chừng thì không để lại lược đồ nửa vời.

**3. Mặc định không đổi.**

Không có `MEDIACLEAR_DATABASE_URL` ⇒ dùng in-memory y như trước. Có ⇒ dùng PostgreSQL. Không có
chế độ "tự đoán". `/healthz` khai đúng adapter đang chạy, nên không bao giờ phải suy luận từ log.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| Hợp đồng 33 phương thức, chạy trên **cả hai** adapter | hai adapter trôi khác nhau |
| `durability` của adapter PostgreSQL là `'durable'` | khai sai năng lực |
| Migration chạy hai lần liên tiếp ⇒ lần hai không làm gì | đúng lỗi `PHASE_1_REPORT` §11 cảnh báo |
| Migration đã áp dụng bị sửa nội dung ⇒ **dừng, báo lỗi** | sửa lén migration đã phát hành |
| Migration lỗi giữa chừng ⇒ không để lại lược đồ nửa vời | giao dịch không bao bọc |
| Cô lập workspace: đọc nhầm workspace ⇒ `null` | vỡ bất biến tenancy trên adapter mới |
| `markStored` lần hai bị từ chối | vỡ bất biến I-1 (tệp gốc bất biến) |
| Lời khai quyền **append-only**, ký lại tạo bản ghi mới | mất lịch sử bằng chứng |
| `statementVersion`/`localeShown` đi qua DB không đổi | mất bằng chứng khi đổi tầng lưu |
| Sổ mức dùng không double-charge | vỡ ràng buộc `UNIQUE (job_id, entry_type)` |

**Đối chứng âm** cho mỗi chốt mới: tái tạo lỗi ⇒ test phải đỏ ⇒ khôi phục ⇒ xanh lại.

## Live Verification

Phép kiểm quyết định của mục này, và là lý do nó tồn tại:

> Ký lời khai quyền → **khởi động lại API** → lời khai **vẫn còn**, đúng `statementVersion` và
> `localeShown`.

Trước mục này, phép đó **luôn thất bại**. Kèm kiểm giao diện 1280×900 và 390×844 như mọi lượt.

## Success Criteria

- 33/33 phương thức qua bộ hợp đồng trên **cả hai** adapter.
- `/healthz` khai `durability: 'durable'` khi chạy với PostgreSQL.
- Lời khai quyền **sống sót qua khởi động lại**, có bằng chứng bấm tay.
- Migration chạy lại được, và **chặn** việc sửa migration đã phát hành.
- Bốn lệnh kiểm chạy **riêng**, đều thoát 0. Không đổi số route, không route `DELETE`.

## Remaining Limits / Follow-ups

- Chưa có pooling tinh chỉnh, chưa có read replica, chưa đo hiệu năng dưới tải.
- Object storage vẫn là đĩa local — tệp gốc vẫn nằm trên một máy (mục Phase 2 kế tiếp).
- `DevIdentityProvider` vẫn là dev; Q-14 chưa chốt nên chưa thay được.
- PostgreSQL trong lượt này chạy bằng Docker để kiểm; **chưa có** hạ tầng production.
