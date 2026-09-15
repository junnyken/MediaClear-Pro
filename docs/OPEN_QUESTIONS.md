# OPEN_QUESTIONS — MediaClear Pro

Cập nhật: **2026-09-15** (sau bản vá đóng Q-22 của Phase 1.1).

Quy tắc: một câu hỏi chỉ nằm ở **một** trạng thái. Câu đã chốt chuyển xuống mục "Đã giải quyết" và
**không** còn xuất hiện ở bảng đang mở.

## 1. Đang mở

| ID | Câu hỏi | Ảnh hưởng | Trạng thái | Chặn gì |
|---|---|---|---|---|
| Q-02 | Queue/worker runtime nào cho video? | ARCH §3 | `unknown` | Phase 1 pipeline |
| Q-05 | Quy trình report/abuse đầy đủ ở phase sau trông như thế nào? (Phase 0 chỉ mới chốt: asset bị report → attestation `blocked`) | POLICY §7 | `unknown` | thiết kế sau MVP |
| Q-07 | Ai chuẩn bị bộ media mẫu cho 10 kịch bản benchmark? | PROVIDER_BENCHMARK §5 | `unknown` | chạy benchmark |
| Q-11 | Có cần luật sư/BA duyệt câu chữ xác nhận quyền (vi + en) trước khi lên production không? | POLICY §3 | `unknown` | go-live |
| Q-12 | Thư viện nào đọc được C2PA / AI provenance thật? | MCP-05 | `unknown` | `ProvenanceRecord` có số liệu thật |
| Q-13 | Giới hạn 199 MB / 599 giây / 3840 px đang hiểu là **inclusive** (đúng 199 MB vẫn được nhận). Owner xác nhận cách hiểu này chứ? | MCP-03 | `unconfirmed` | không chặn — contract đã chạy theo cách hiểu inclusive, đổi thì sửa 1 dòng config |
| Q-14 | Auth provider/IdP cụ thể (session, JWT, OAuth, vendor nào)? | API, tenancy | `unknown` | Phase 1 — owner đã cho phép để ngỏ ở mức implementation decision |
| Q-15 | "Static mask" đang được map vào `blur`/`brand_overlay` trên một vùng cố định thay vì tạo enum mới. Owner xác nhận cách map này chứ? | vocabulary, provider | `unconfirmed` | không chặn |
| Q-21 | Bản English của câu phạm vi trong prompt Q-20 **bị cắt ở "identifying ma"**. Đang dùng đúng chữ owner viết ở phần đọc được và hoàn thành chữ cuối là "marks". Owner xác nhận chữ cuối và phần sau (nếu còn) chứ? | i18n `policy.visible_identity_scope` (en) | `unconfirmed` | không chặn — sửa một khoá i18n là xong |

> Q-13 và Q-15 là **cách hiểu** của agent khi áp dụng owner decisions, đã ghi rõ trong `DECISIONS.md`
> (D-018, D-020) thay vì tự đoán im lặng. Cả hai đều sửa được bằng một thay đổi nhỏ nếu owner muốn khác.

## 2. Đã giải quyết (owner quyết 2026-09-15)

| ID | Câu hỏi | Quyết định | Ghi ở |
|---|---|---|---|
| Q-01 | Database + object storage | PostgreSQL; object storage S3-compatible abstraction; mục tiêu đầu là Cloudflare R2 (chờ deployment review) | D-017 |
| Q-03 | Định dạng + giới hạn media | JPEG/PNG/WebP, MP4/MOV/WebM; 199 MB; 09:59; video ≤ 3840×3840 | D-018 |
| Q-04 | Auth + mô hình quyền | User → Workspace → Project → Asset; role owner/admin/member/viewer | D-019 |
| Q-06 | Provider AI | Chưa chọn provider production; chuẩn bị benchmark harness trước; crop/blur/static-mask là deterministic fallback | D-020 |
| Q-08 | `blocked` có terminal không | Terminal cho job hiện tại; gỡ block = tạo `ProcessingJob` mới | D-005 |
| Q-09 | Scope + hiệu lực attestation | Asset-level, 365 ngày | D-006, D-015 |
| Q-10 | Preview + cách tính usage | Preview miễn phí; video làm tròn lên theo phút xử lý | D-008, D-009, D-023 |
| Q-16 | Đánh số MINI-SPEC giữa các phase | Canonical ID có tiền tố phase (`P0-`/`P1-`/`P1.1-`); giữ nguyên tên file lịch sử; lập `docs/MINI_SPEC_INDEX.md` | D-029 |
| Q-17 | Khoản giữ mức dùng tồn tại vô thời hạn | TTL 30 phút; vòng đời `reserved → expired → released`; hoàn trả idempotent; không đổi trạng thái job | D-030 |
| Q-18 | Thời hạn lưu giữ dữ liệu | Retention policy v1: source/output 30 ngày theo **lần truy cập cuối**, trung gian 7 ngày, xem thử 24 giờ, audit 365 ngày, sổ mức dùng 24 tháng, dấu vết đã xoá 30 ngày; Phase 1.1 **chỉ có bản thử, không xoá** | D-031 |
| Q-19 | Câu chữ tiếng Việt | Dùng bản owner duyệt; nội dung xác nhận quyền **lên phiên bản 2**; CTA ưu tiên "Làm sạch vùng nhận diện" | D-032 |
| Q-20 | Câu cảnh báo về dấu hiệu nhận diện vô hình bị cắt trong prompt Phase 1.1 | Owner cung cấp bộ câu chữ canonical ở bản vá Q-20; câu phạm vi và câu xác nhận quyền **giữ nguyên** (đã khớp từng chữ từ Phase 1.1); thêm câu về dữ liệu còn sót và dựng lại cấu trúc hộp thoại | D-033 |
| Q-22 | Ô tick ghi "xác nhận nội dung trên" trong khi hệ thống chỉ version hoá một câu | **Không** version hoá phần ngữ cảnh và **không** tạo statement v3. Thay vào đó ô tick hiển thị thẳng chính câu được ký (`rights.attestation.v2.statement`); tiêu đề mục, câu phạm vi hỗ trợ và hai câu cảnh báo được ghi rõ là **ngữ cảnh**, không lưu làm bằng chứng | D-034 |

## 3. Ghi chú về evidence còn `unknown`

Benchmark provider vẫn `unknown` **theo đúng thiết kế**: đó là **evidence status**, không phải
blocker về product decision. Không mục nào trong `PROVIDER_BENCHMARK.md` được đánh `verified` trước
khi có run thật.
