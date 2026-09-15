# FEATURES — MediaClear Pro

- **Date**: 2026-09-15 · **Phase**: 0

Bảng dưới là **trạng thái thật trong repository này**, không phải kế hoạch bán hàng.
`implemented` = có code chạy được và có test trong repo.

## 1. Đã có trong repo (`implemented`)

| Capability | Nơi ở | Bằng chứng |
|---|---|---|
| Config tập trung mọi giới hạn (199 MB, 09:59, 3840×3840, 365 ngày) | `packages/contracts/src/config.ts` | kiểm qua 10 test media-limits + 12 test policy |
| Stable vocabulary (media type, cleanup operation, job state, evidence status) | `src/vocabulary.ts` | 4 test |
| Domain entity contracts (15 entity) | `src/entities.ts` | typecheck |
| Media limits & validation, phân biệt format/size/duration/width/height | `src/media-limits.ts` | 10 test |
| Job state machine + guard `completed` + `blocked` terminal | `src/job-state-machine.ts` | 9 test |
| Rights Guard / policy gate (attestation missing/expired/stale/blocked) | `src/policy.ts` | 12 test |
| Tenancy + ma trận quyền 4 role, chặn rò rỉ existence | `src/tenancy.ts` | 9 test |
| Object storage abstraction S3-compatible + adapter in-memory | `src/storage.ts`, `src/storage-adapters/` | 7 test |
| Provider abstraction + registry + deterministic fallback | `src/provider.ts` | 8 test |
| Benchmark harness (10 kịch bản × 10 metric, chặn số bịa) | `src/benchmark.ts` | 5 test |
| Preview contract (proxy, miễn phí, ngân sách provider job) | `src/preview.ts` | 4 test |
| Metadata / provenance evaluation | `src/provenance.ts` | 8 test |
| Usage ledger (reserve/commit/release, chống double charge & conflict) | `src/usage.ts` | 10 test |
| Invariant registry 12 mục + regression test | `src/invariants.ts` | 13 test |
| Error catalogue 39 mã kèm HTTP/retry/release | `src/errors.ts` | 7 test |
| Design tokens (màu, spacing, a11y) | `packages/design-tokens/` | web build |
| i18n vi (mặc định) + en, 127 key, parity test | `packages/i18n/` | 8 test |
| Web skeleton 11 route (10 màn foundation) | `apps/web/` | `next build` xanh |
| API skeleton: `/healthz` thật, 10 route nghiệp vụ trả 501 | `apps/api/` | 4 test HTTP thật |

## 2. Đã chốt contract, chưa code (`planned`)

Upload thật + adapter R2/MinIO thật · Probe media thật (ffprobe/exif) · Queue + worker · Gọi provider AI
thật · Preview render · Export · Brand overlay · Usage ledger persistence · Audit event
persistence · Auth/tenant enforcement · Migrations.

## 3. Chưa có bằng chứng (`unknown`)

Provider AI nào đủ chất lượng · Giá thật mỗi ảnh / mỗi phút video · Tỷ lệ fail/retry thực tế ·
Khả năng đọc C2PA/AI provenance của thư viện nào · Queue runtime · Auth provider cụ thể.

## 4. Cố ý không làm (`out_of_scope`)

Không xoá, không vô hiệu hoá và không cam kết kiểm soát watermark vô hình (gồm SynthID) ·
Tự động thu thập media từ website bên thứ ba · Chrome Extension · Python media service.
