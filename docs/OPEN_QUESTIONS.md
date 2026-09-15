# OPEN_QUESTIONS — MediaClear Pro (Phase 0)

Những chỗ **thiếu bằng chứng hoặc thiếu quyết định của owner**. Theo guardrail 10, tất cả đang ở
trạng thái `unknown`/`unconfirmed` — không mục nào được giả định là pass.

| ID | Câu hỏi | Ảnh hưởng | Trạng thái | Chặn gì |
|---|---|---|---|---|
| Q-01 | Database và object storage nào? (PostgreSQL + S3-compatible?) | data model, migration, tenant isolation | `unknown` | integration test, migration |
| Q-02 | Queue/worker runtime nào cho video? | ARCH §3 | `unknown` | Phase 1 pipeline |
| Q-03 | Giới hạn pixel cho video, và allowlist định dạng có đúng nhu cầu không? (D-007) | validation contract | `unconfirmed` | chốt MCP-03 |
| Q-04 | Auth scheme (session, JWT, OAuth?) và mô hình quyền trong workspace | API, policy | `unknown` | Phase 1 |
| Q-05 | Quy trình report/abuse ở phase sau trông như thế nào? | POLICY §7 | `unknown` | thiết kế sau MVP |
| Q-06 | Chọn provider AI nào để benchmark trước? | PROVIDER_BENCHMARK | `unknown` | mọi số liệu cost/quality |
| Q-07 | Ai chuẩn bị bộ media mẫu cho 10 kịch bản benchmark? | PROVIDER_BENCHMARK §5 | `unknown` | benchmark |
| Q-08 | `blocked` nên là terminal (D-005) hay cho phép quay lại `validating`? | state machine | `unconfirmed` | MCP-03 |
| Q-09 | Attestation scope chỉ `asset` và hiệu lực 365 ngày có hợp nghiệp vụ không? (D-006, D-015) | policy, UX | `unconfirmed` | MCP-02 |
| Q-10 | Giá/quy đổi đơn vị: preview miễn phí, video làm tròn lên theo phút (D-008, D-009) | usage ledger, pricing | `unconfirmed` | pricing thật |
| Q-11 | Có cần luật sư/BA duyệt câu chữ xác nhận quyền (vi + en) trước khi lên production không? | POLICY §3 | `unknown` | go-live |
| Q-12 | Thư viện nào đọc được C2PA / AI provenance thật? | MCP-05 | `unknown` | `ProvenanceRecord` có số liệu thật |

> Không có câu nào trong bảng này được tự trả lời trong Phase 0.
