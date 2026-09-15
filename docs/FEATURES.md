# FEATURES — MediaClear Pro

- **Date**: 2026-09-15 · **Phase**: 0

Bảng dưới là **trạng thái thật trong repository này**, không phải kế hoạch bán hàng.
`implemented` = có code chạy được và có test trong repo.

## 1. Đã có trong repo (`implemented`)

| Capability | Nơi ở | Bằng chứng |
|---|---|---|
| Stable vocabulary (media type, cleanup operation, job state, evidence status) | `packages/contracts/src/vocabulary.ts` | 4 test |
| Domain entity contracts (14 entity) | `packages/contracts/src/entities.ts` | typecheck |
| Media limits & validation (10 phút / 200 MB / format / kích thước) | `packages/contracts/src/media-limits.ts` | 7 test |
| Job state machine + guard `completed` | `packages/contracts/src/job-state-machine.ts` | 7 test |
| Rights Guard / policy gate | `packages/contracts/src/policy.ts` | 9 test |
| Provider abstraction + registry + no-op contract provider | `packages/contracts/src/provider.ts` | 6 test |
| Metadata / provenance evaluation | `packages/contracts/src/provenance.ts` | 8 test |
| Usage ledger contract (reserve/commit/release, chống double charge) | `packages/contracts/src/usage.ts` | 8 test |
| Invariant registry + regression test | `packages/contracts/src/invariants.ts` | 9 test |
| Error code catalogue (27 mã) | `packages/contracts/src/errors.ts` | test i18n |
| Design tokens (màu, spacing, a11y) | `packages/design-tokens/` | web build |
| i18n vi (mặc định) + en, 107 key, parity test | `packages/i18n/` | 8 test |
| Web skeleton 11 route (10 màn foundation) | `apps/web/` | `next build` xanh |
| API skeleton: `/healthz` thật, 9 route nghiệp vụ trả 501 | `apps/api/` | chạy thật, xem TEST_LOG |

## 2. Đã chốt contract, chưa code (`planned`)

Upload thật + object storage · Probe media thật (ffprobe/exif) · Queue + worker · Gọi provider AI
thật · Preview render · Export · Brand overlay · Usage ledger persistence · Audit event
persistence · Auth/tenant enforcement · Migrations.

## 3. Chưa có bằng chứng (`unknown`)

Provider AI nào đủ chất lượng · Giá thật mỗi ảnh / mỗi phút video · Tỷ lệ fail/retry thực tế ·
Khả năng đọc C2PA/AI provenance của thư viện nào · Giới hạn pixel cho video.

## 4. Cố ý không làm (`out_of_scope`)

Không xoá, không vô hiệu hoá và không cam kết kiểm soát watermark vô hình (gồm SynthID) ·
Tự động thu thập media từ website bên thứ ba · Chrome Extension · Python media service.
