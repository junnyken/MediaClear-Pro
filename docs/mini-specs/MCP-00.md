# MCP-00 — Repository & Capability Audit

| | |
|---|---|
| **ID** | MCP-00 |
| **Name** | Repository & Capability Audit |
| **Parent phase** | Phase 0 — Product Foundation, Evidence, Architecture & UX Foundation |
| **Author** | Nguyễn Thiên Triều (trieunt@matbao.com) |
| **Date** | 2026-09-15 |

## Context
- Tài liệu bắt buộc: `MINI_SPEC_PLAYBOOK` (bản v2 do owner gửi kèm — **không** phải bản
  `MINI_SPEC_PLAYBOOK.md` cũ hơn nằm trong `projects/audit-ads/`), prompt Phase 0.
- Trạng thái hệ thống: thư mục `projects/Tool MediaClear Pro` **rỗng hoàn toàn** tại thời điểm bắt
  đầu (0 file, 0 thư mục con).
- Quyết định phải giữ: không rebuild thứ đang chạy; nhưng ở đây **không có gì đang chạy**, nên
  "additive-first" trở thành "tạo tối thiểu, không xây cả ứng dụng".

## Goal
Xác định chính xác foundation hiện có và các gap đã được chứng minh, trước khi thay đổi hệ thống.

## Constraints
1. Không code feature. Output là audit + decision log.
2. Không invent rằng thành phần nào đó đã tồn tại; thiếu thì ghi `not found`.
3. Không suy ra framework/convention từ project khác trong workspace rồi coi như của project này.
4. Thiếu bằng chứng → `unknown`/`unconfirmed`, không giả định pass.
5. Không bắt đầu Phase 1.

## Scope
- **A. Domain model**: kiểm tra xem đã có entity/enum/state nào chưa. → không có.
- **B. Services/engine**: kiểm tra pipeline/worker/provider hiện có. → không có.
- **C. API contract**: kiểm tra route/OpenAPI hiện có. → không có.
- **D. UI surfaces**: kiểm tra design system/component/i18n hiện có. → không có.
- **E. Tests**: kiểm tra test infra hiện có. → không có.

## Audit Before Build

### Repository
| Hạng mục | Kết quả |
|---|---|
| Cấu trúc frontend/backend | `not found` — thư mục rỗng |
| Framework / package manager / runtime | `not found` trong project; workspace có sẵn Node v22.22.3, npm 10.9.8, pnpm 10.14.0, Python 3.12.3, Go 1.25.9 |
| Lệnh build/test | `not found` |
| Quy ước routing / API / database / migrations / auth / logging / error handling | `not found` |
| `FEATURES.md`, `ARCH.md`, `API.md`, `TEST_LOG.md`, `README.md` | `not found` (cả 5) |
| CI/CD, environment variables, deployment assumptions | `not found` |
| Git | `not found` — không có `.git` riêng; git root là `/home/coder/workspace` |

### Domain and state
| Câu hỏi | Kết quả |
|---|---|
| Đã có entity user/workspace/project/asset/upload/job/output/usage/policy/audit chưa? | `not found` — không có entity nào |
| Đã có state machine hoặc enum liên quan chưa? | `not found` |
| Có state dễ gây hiểu nhầm giữa `uploaded`/`processing`/`completed`/`failed`/`blocked` không? | Không có state cũ để nhầm; **nhưng** phát hiện bẫy trong chính spec: `blocked` xuất hiện ở cả `JobState` và `EvidenceStatus` với hai nghĩa khác nhau → D-004 |
| Có thể tái sử dụng state/permission/audit framework hiện có không? | Không — `not found` |

### UX
| Câu hỏi | Kết quả |
|---|---|
| Layout / design system | `not found` |
| Component, color token, typography, spacing, form, modal, toast, empty state | `not found` |
| Responsive behavior | `not found` |
| i18n / localization | `not found` |

### Operational evidence
| Câu hỏi | Kết quả |
|---|---|
| Benchmark provider hoặc test media | `not found` |
| Giới hạn upload hiện tại | `not found` |
| Telemetry / job tracking | `not found` |
| Lỗi thực tế hoặc test log | `not found` |

### Gap đã xác nhận
- **Vocabulary**: chưa tồn tại → phải chốt mới (MCP-01). Không có nguy cơ trùng nghĩa với enum cũ.
- **State machine**: chưa tồn tại → phải chốt mới (MCP-03).
- **Data & permission**: chưa có ranh giới tenant nào → phải đưa `workspaceId` vào mọi entity.
- **UX wording**: chưa có → phải dựng i18n ngay từ đầu để không sinh chuỗi hard-code (MCP-06).
- **Observability**: chưa có → `AuditEvent` + `ProviderRun` phải nằm trong contract từ Phase 0.

### Ghi chú về Playbook
Trong workspace có `projects/audit-ads/MINI_SPEC_PLAYBOOK.md` nhưng **nội dung khác** (52 dòng, viết
cho AdsOps Control Center). Bản được tuân thủ là bản v2 owner gửi kèm hội thoại. Không trộn hai bản.

## Design Choice
Vì mọi thứ đều `not found`, hướng được chọn là **tạo foundation tối thiểu nhưng chạy được**:
contract + docs + skeleton, đủ để chạy typecheck/lint/test/build thật. Loại bỏ hướng "chỉ viết
docs" vì sẽ không có bằng chứng nào chứng minh contract dùng được.

## Test Plan
Không áp dụng — MINI-SPEC này không tạo code.

## Live Verification
Không áp dụng.

## Success Criteria
1. Mọi câu hỏi trong mục 4 của prompt đều có câu trả lời `found`/`not found` kèm bằng chứng.
2. Không có chỗ nào ghi "đã có sẵn" mà không chỉ ra được file.
3. Gap được phân loại theo 5 nhóm của Playbook.

## Remaining Limits
- Audit chỉ phản ánh trạng thái lúc 2026-09-15; mọi kết luận "not found" cần kiểm lại nếu có người
  khác đẩy code vào trước Phase 1.
