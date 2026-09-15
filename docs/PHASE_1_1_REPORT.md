# PHASE_1_1_REPORT — MediaClear Pro

- **Date**: 2026-09-15 · **Author**: Nguyễn Thiên Triều (trieunt@matbao.com)
- **Repository**: `/home/coder/workspace/projects/Tool MediaClear Pro`
- **Baseline giữ nguyên**: `cd15e2b`, `f427efc` (Phase 0) và `4572cbd` (Phase 1)

---

## 1. Summary

Phase 1.1 đóng bốn quyết định của owner mà không mở rộng phạm vi: đặt canonical ID có tiền tố phase và
lập index cho MINI-SPEC; cho khoản giữ mức dùng một hạn 30 phút với đường hoàn trả idempotent; chốt
luật lưu giữ dữ liệu theo từng lớp kèm báo cáo **chỉ đếm, không xoá**; và đưa câu chữ hiển thị về đúng
bản owner duyệt, trong đó nội dung xác nhận quyền được **lên phiên bản 2** để giữ nguyên giá trị làm
bằng chứng của các lời khai cũ. Không có xử lý AI production, không có đường xoá dữ liệu nào, và
Phase 2 chưa bắt đầu.

---

## 2. Audit Before Build

**Tài liệu đã đọc**: `MINI_SPEC_PLAYBOOK.md` (bản v2 owner gửi kèm hội thoại) ·
`docs/PHASE_0_GATE_CLOSURE_REPORT.md` · `docs/PHASE_1_REPORT.md` · `docs/TEST_LOG.md` ·
`docs/DECISIONS.md` · `docs/OPEN_QUESTIONS.md` · `docs/API.md` · `docs/DATA_MODEL.md` ·
`docs/POLICY.md` · `docs/UX_FOUNDATION.md` · `docs/mini-specs/MCP-00.md`…`MCP-10.md` ·
`docs/mini-specs/phase-1/MCP-10.md`…`MCP-15.md`. Ngoài tài liệu còn đọc trực tiếp
`packages/contracts/src/{usage,policy,api,errors,config}.ts` và `apps/api/src/services/*`.

### Naming conflict đã tìm thấy

| Phát hiện | Chi tiết |
|---|---|
| **Trùng ID thật** | `MCP-10` tồn tại ở **cả hai** phase: Phase 0 = Object Storage Abstraction, Phase 1 = Authentication & Workspace Boundary |
| Mức lan | riêng chuỗi `MCP-10` xuất hiện **37 lần** trong tài liệu |
| Quy ước thứ ba | mã nguồn dùng `MCP-10-P1` — không khớp cả hai bộ tài liệu |
| `MCP-11`…`MCP-15` | **không** trùng (Phase 0 không có các số này) |
| Index | `docs/MINI_SPEC_INDEX.md` — **not found** |

### Reservation flow đã audit

| Câu hỏi | Kết quả |
|---|---|
| Nơi tạo reservation | **đúng một chỗ**: `services/jobs.ts`, sau khi qua 5 cổng, guard bằng `canReserveUsage()` |
| Nơi hoàn trả | **đúng một chỗ**: huỷ job |
| Nơi commit | `canCommitUsage()` tồn tại nhưng **chưa nơi nào gọi** — đúng thiết kế, Phase 1 không có output đã kiểm chứng |
| Nơi thử lại job | tạo job mới với `idempotencyKey` mới; khoá trùng trả job cũ |
| Trạng thái hiện có | `entryType` là **loại bút toán**, không phải trạng thái; **không** có khái niệm trạng thái reservation |
| Lý do hoàn trả | 5 lý do, **không có `expired`** |
| Hạn | `UsageLedgerEntry` **không có** `expiresAt` |
| Xử lý thời gian | 16 chỗ dùng `ctx.now()` — điều khiển được trong test |
| Khoá chống trùng | `<jobId>:reserve` / `<jobId>:release` + `UNIQUE (job_id, entry_type)` ở DB |
| Sống sót qua restart | **không** — `InMemoryPersistence` là `ephemeral` |

### Retention data đã audit — **`not found` gần như toàn bộ**

| Cần có | Hiện có |
|---|---|
| `last_accessed_at` · `retention_state` · `scheduled_deletion_at` · `deleted_at` · `legal_hold_at` | **not found** |
| lệnh/worker dọn dữ liệu | **not found** |
| vòng đời object trên storage | chỉ có `putObject`/`deleteObject`, **không ai gọi** `deleteObject` |
| retention cho audit/usage | **not found** |
| output/preview/intermediate | **chưa tồn tại** (Phase 1 không xử lý media) |

> Bẫy từ vựng: `CleanupOperation` trong domain nghĩa là **làm sạch ảnh/video**, không liên quan tới
> dọn dữ liệu. Toàn bộ phần lưu giữ dùng từ "retention"/"ứng viên xoá" để không tạo hai nghĩa.

### UX wording đã audit

| Phát hiện | Chi tiết |
|---|---|
| CTA bị cấm | **không có** chuỗi nào trong toàn repo |
| Câu xác nhận v1 | **có thêm** mệnh đề trách nhiệm mà bản owner duyệt không có ⇒ đổi nghĩa, không phải sửa chính tả |
| Khoá dịch | 235 khoá, vi ↔ en parity tuyệt đối, đã có test chặn lệch |
| Lớp chặn thuật ngữ | đã có, nhưng **chưa** bắt cách gọi mới ("dấu hiệu nhận diện vô hình") |
| Test ràng buộc phiên bản | dùng `RIGHTS_STATEMENT.version`, chỉ 2 fixture hard-code |

---

## 3. MINI-SPECs Completed

| Canonical ID | Tên | Trạng thái |
|---|---|---|
| `P1.1-MCP-16` | MINI-SPEC Identity Index Hardening | **completed** |
| `P1.1-MCP-17` | Usage Reservation TTL & Expiry | **completed** — worker production là follow-up |
| `P1.1-MCP-18` | Data Retention Contract & Dry Run | **completed** — chỉ có bản thử, cố ý không có đường xoá |
| `P1.1-MCP-19` | Vietnamese Policy & UX Wording | **completed** — trừ phần câu bị cắt trong prompt (Q-20) |

---

## 4. Owner Decisions Applied

| Question | Decision | Ghi ở | Status |
|---|---|---|---|
| Q-16 | Canonical ID có tiền tố phase + index ánh xạ, giữ nguyên lịch sử | D-029 | **resolved** |
| Q-17 | TTL 30 phút, vòng đời `reserved → expired → released`, hoàn trả idempotent | D-030 | **resolved** |
| Q-18 | Retention policy v1 theo từng lớp dữ liệu, chỉ dry-run | D-031 | **resolved** |
| Q-19 | Câu chữ owner duyệt; nội dung xác nhận lên phiên bản 2 | D-032 | **resolved** |

Prompt gợi ý D-024…D-027 nhưng repository **đã dùng** các ID đó ở Phase 1, nên Phase 1.1 tiếp tục từ
**D-029** để không tạo ID trùng.

---

## 5. Design Choice

**Naming index** — canonical ID sống ở `docs/MINI_SPEC_INDEX.md` và trong mã nguồn; tên file lịch sử
giữ nguyên. Đổi tên 17 file sẽ phá mọi đường dẫn đã trích dẫn trong báo cáo đã publish, tức là sửa
lịch sử — điều prompt cấm.

**Reservation expiry** — trạng thái khoản giữ được **suy ra** từ sổ mức dùng + đồng hồ, không thêm
bảng và không thêm cột trạng thái. Sổ là append-only và là nguồn sự thật duy nhất; thêm nguồn thứ hai
là tạo khả năng hai nơi nói khác nhau. `expired` là trạng thái dẫn xuất nên không bao giờ "quên cập
nhật"; thứ được ghi xuống là bút toán `release` với lý do `expired`.

**Retention states and dry-run** — luật là **bảng dữ liệu thuần**, quyết định là **hàm thuần** nhận
`as_of`. Nhờ vậy test kiểm được mọi ca biên, và bản dry-run dùng **chính** hàm đó thay vì có một
phiên bản thứ hai — đúng chỗ nguy hiểm nhất với thao tác xoá. Không hiện thực đường xoá nào vì chưa
có worker, chưa có sao lưu, chưa có luồng khôi phục.

**User-facing wording** — lên phiên bản 2 thay vì sửa chữ tại chỗ, để `statementVersion` trên từng lời
khai vẫn chứng minh được người dùng đã đồng ý với văn bản nào.

---

## 6. Changed Files

**Contracts**: `config.ts` (7 hằng số mới), `usage.ts` (`expired`, `expiresAt`, chặn commit sau hết
hạn), `usage-reservation.ts` **(mới)**, `retention.ts` **(mới)**, `errors.ts`
(`MCP_USAGE_RESERVATION_EXPIRED` → 46 mã), `entities.ts` (`UsageLedgerEntry.expiresAt`), `policy.ts`
(`RIGHTS_STATEMENT` v2), `api.ts` (canonical ID + 3 route + status `internal`), `index.ts`.

**Services**: `usage.ts` (`expireReservations`, tách "đã hết hạn giữ"), `retention.ts` **(mới)**,
`jobs.ts` (gắn hạn, lộ trạng thái khoản giữ), `assets.ts` (trường lưu giữ + ghi nhận truy cập),
`audit.ts` (`usage_reservation_expired`), `auth/identity.ts` (**sửa lỗi đồng hồ**),
`app-context.ts` (một đồng hồ duy nhất), `persistence/{types,port,in-memory}.ts`.

**Config**: `config/env.ts` (`internalApiToken`).

**Schema/migrations**: `db/migrations/0002_phase1_1_retention_and_reservation_ttl.sql` **(mới)**,
`db/verify-migration-0002.sql` **(mới)**.

**UI/i18n**: `RightsDialog.tsx` (bộ khoá v2 + câu chính sách), `jobs/[jobId]/page.tsx` (hạn giữ),
`usage/page.tsx` (mục đã hết hạn giữ), `assets/[assetId]/page.tsx`, `new-cleanup/page.tsx`;
`vi.json`/`en.json` 235 → **250 khoá**, parity tuyệt đối.

**Tests** (mới): `usage-reservation.test.ts`, `retention.test.ts`, `mini-spec-index.test.ts`,
`wording.test.ts`, `phase11-reservation.test.ts`, `phase11-retention.test.ts`,
`wording-usage.test.ts`, `i18n-keys.test.ts`. (sửa): `helpers.ts`, `phase1-auth-tenancy.test.ts`.

**Docs**: `MINI_SPEC_INDEX.md` **(mới)**, 4 MINI-SPEC `P1.1-MCP-16…19` **(mới)**, `API.md` (sinh lại
từ mã nguồn), `ARCH.md`, `DATA_MODEL.md`, `POLICY.md`, `FEATURES.md`, `TEST_LOG.md`,
`DECISIONS.md`, `OPEN_QUESTIONS.md`, `PHASE_1_REPORT.md` (trỏ dẫn), `PHASE_1_1_REPORT.md` **(mới)**.

---

## 7. New API/DB/State

**API** — 31 route: 25 implemented · 3 planned (vẫn 501) · 1 dev_only · **2 internal (tắt mặc định)**.
Mới: `GET /v1/assets/:assetId/retention`, `POST /v1/internal/usage-reservations/expire`,
`POST /v1/internal/retention/dry-run`.

Hai route mà prompt nêu là "có thể cần" **không** được tạo, kèm lý do: trạng thái khoản giữ đã có sẵn
trong `GET /v1/jobs/:jobId`, và đường hoàn trả thủ công đã là `POST /v1/jobs/:jobId/cancel`.

**State** — `UsageReservation.state` = `reserved | expired | released | committed`, **tách bạch** với
`ProcessingJob.state`. `RetentionState` = `active | scheduled_for_deletion | deleted | legal_hold`,
**không** gộp vào state của job.

**DB** — migration `0002` chỉ thêm 7 cột và 4 ràng buộc; không DROP, không DELETE, không UPDATE dữ liệu.

**Error** — thêm `MCP_USAGE_RESERVATION_EXPIRED` (409), có bản dịch vi + en.

---

## 8. Tests

| Check | Result | Notes |
|---|---|---|
| Typecheck | **exit 0** | chạy riêng |
| Lint | **exit 0** | chạy riêng |
| Tests | **299/299 pass**, 33 tệp, 0 fail, 0 skip | Phase 1: 214 ⇒ **+85** |
| Build | **exit 0** | `pnpm build:web` |
| DB/schema | **exit 0** | `0002` trên DB sạch **và** trên DB đã có dữ liệu; 5/5 ràng buộc chặn thật; số bản ghi trước/sau bằng nhau |
| Live verification | **đạt** | chi tiết ở `TEST_LOG.md` mục 3–4 |

Phân bố test mới: đánh số 9 · hạn khoản giữ 18 (đơn vị) + 11 (HTTP) · lưu giữ 18 (đơn vị) + 11 (HTTP) ·
câu chữ 11 + 3 · khoá dịch UI 3 · đồng hồ phiên đăng nhập 1.

---

## 9. Bugs Found and Fixed

**#9 — Phiên đăng nhập bị coi là hết hạn ngay khi đồng hồ được tua.**
*Reproduction*: tạo app với đồng hồ giả ở mốc tương lai → đăng nhập → gọi `/v1/me` → 401.
*Root cause*: `DevIdentityProvider` dùng `Date.now()` thay vì đồng hồ của ứng dụng ⇒ **hai nguồn thời
gian trong một tiến trình**: phiên tạo theo đồng hồ hệ thống nhưng được kiểm theo đồng hồ ứng dụng.
*Fix*: tiêm `ctx.now()` vào identity provider; `createAppContext` dựng **một** đồng hồ cho cả tiến
trình. *Regression test*: "phiên tính hạn theo đồng hồ của ứng dụng" — **đã kiểm đối chứng âm**
(dựng lại lỗi thì test đỏ).

**#10 — Hộp thoại xác nhận quyền hiện khoá dịch thô.**
*Reproduction*: mở hộp thoại trên trình duyệt → thấy chuỗi `rights.attestation.v2.visible_scope_note`.
*Root cause*: đổi tiền tố khoá v1→v2 hàng loạt, nhưng câu đó đã chuyển sang khoá chính sách mới nên
khoá v2 tương ứng không tồn tại; `t()` rơi về trả chính khoá. *Fix*: dùng
`policy.visible_identity_scope`. *Regression test*: **mọi** khoá UI gọi phải tồn tại ở cả hai locale —
**đã kiểm đối chứng âm**.

**#11 — Kỳ vọng sai trong chính test lưu giữ.** Bản ghi cũ nhất đang `legal_hold` nên không phải ứng
viên; kỳ vọng ban đầu của tôi sai, mã nguồn đúng. Đã sửa kỳ vọng và ghi lý do ngay trong test.

Cả #9 và #10 đều **không** bị 214 test của Phase 1 bắt được.

---

## 10. Evidence Status

| Hạng mục | Trạng thái |
|---|---|
| Canonical ID, index, chặn trùng và chặn tham chiếu mồ côi | **verified** |
| Hạn 30 phút, bảng transition, chặn commit sau hết hạn | **verified** — có ca biên 1799/1800/1801 giây và ca múi giờ |
| Hoàn trả idempotent (chạy lại không sinh thêm bút toán) | **verified** — test HTTP với đồng hồ điều khiển được |
| Hết hạn **không** đổi trạng thái job | **verified** |
| Luật lưu giữ từng lớp, legal hold loại trừ, audit/sổ mức dùng không bị dọn theo asset | **verified** |
| Báo cáo lưu giữ không xoá gì | **verified** — byte và checksum không đổi sau khi chạy |
| Route nội bộ tắt mặc định, sai khoá cũng 404 | **verified** |
| Câu chữ owner duyệt, phiên bản 2, lời khai v1 thành `stale` | **verified** — kiểm trên server thật và trên trình duyệt |
| Migration `0002` không phá dữ liệu | **verified** — chạy trên DB đã có dữ liệu, số bản ghi không đổi |
| Hoàn trả **tại đúng mốc 30 phút** trên môi trường thật | **partially_verified** — live chỉ xác nhận lệnh chạy được và báo 0 khoản quá hạn; biên do test với đồng hồ điều khiển được đảm nhiệm |
| **Dọn dữ liệu thật theo luật lưu giữ** | **unconfirmed** — chưa từng chạy; Phase 1.1 cố ý không có đường xoá |
| Worker hoàn trả / worker lưu giữ chạy tự động | **unconfirmed** — chưa tồn tại |
| Adapter PostgreSQL / R2 / IdP production | **unconfirmed** — chưa tồn tại |
| Chất lượng & chi phí provider | **unknown** — **toàn bộ ma trận benchmark vẫn `unknown`** |
| Phần câu cảnh báo bị cắt trong prompt | **unconfirmed** — chờ owner (Q-20) |

---

## 11. Remaining Limits / Follow-ups

- **Runtime vẫn `ephemeral`**: chưa nối PostgreSQL, chưa nối object storage thật.
- **Chưa có worker hoàn trả khoản giữ quá hạn** — phải có ai đó gọi route nội bộ.
- **Chưa có worker dọn dữ liệu**, và **chưa có đường xoá nào** — cố ý.
- **Provider benchmark vẫn `unknown`** — chưa chạy lần nào.
- Chưa có giao diện hiển thị hạn lưu giữ cho người dùng (API đã có).
- Chưa có luồng khôi phục tệp đã xoá, chưa có sao lưu — là lý do chưa mở đường xoá.
- `MCP-10` đứng một mình trong tài liệu đã publish vẫn phải đọc theo thư mục chứa nó.
- Câu cảnh báo về dấu hiệu nhận diện vô hình mới dùng phần đọc được từ prompt (Q-20).
- **Phase 2 chưa bắt đầu.**

---

## 12. Phase Gate Decision

## **READY_FOR_PHASE_2**

| Điều kiện để giữ `READY_FOR_PHASE_2` | Kết quả |
|---|---|
| Bốn quyết định đã được áp dụng | ✅ Q-16/Q-17/Q-18/Q-19 → D-029…D-032 |
| Tests pass | ✅ 299/299; typecheck, lint, build đều exit 0 |
| Không có contract regression | ✅ toàn bộ test Phase 0 và Phase 1 vẫn xanh; 12 invariant Phase 0 và R-1…R-12 của Phase 1 không đổi |
| Destructive cleanup chưa được bật production | ✅ **không tồn tại đường xoá nào**; có test khẳng định bảng route không có method `DELETE` |
| Giới hạn vận hành còn lại được ghi rõ | ✅ mục 11 |

Kiểm riêng các mục mà prompt yêu cầu bảo vệ đặc biệt: `blocked` là trạng thái cuối ✅ · `completed`
bắt buộc có output đã kiểm chứng ✅ · tệp gốc bất biến ✅ · cách ly workspace ✅ · không lộ lỗi nội bộ ✅ ·
không có thành công giả từ provider ✅ · không double-charge ✅ · bảo toàn metadata/provenance mặc định
bật ✅.

Hardening lần này **không** phát hiện blocker nào về an toàn dữ liệu, phân quyền, tính tiền trùng hay
vượt rào trạng thái. Hai lỗi tìm được (đồng hồ của phiên đăng nhập, khoá dịch thô) đã sửa và đã có
chốt chặn kiểm đối chứng âm.

**Agent dừng tại đây, không bắt đầu Phase 2.**

---

> **Cập nhật sau bản vá đóng Q-20** (2026-09-15): Q-20 đã đóng (D-033). Câu chữ canonical được xác
> nhận khớp từng chữ, bản English dùng đúng từ ngữ owner, hộp thoại xác nhận quyền được dựng lại theo
> cấu trúc ba mục, và **văn bản tuyên bố v1/v2 không bị sửa** (có test đóng băng).
> Hai câu hỏi mới phát sinh: Q-21 (chữ cuối bản English) và Q-22 (có version hoá phần ngữ cảnh không).
> Chi tiết: `docs/PHASE_1_1_Q20_CLOSURE.md` và MINI-SPEC `P1.1-Q20-MCP-20`.
> Số test sau bản vá: **327/327**.
