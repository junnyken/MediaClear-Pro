# OPEN_QUESTIONS — MediaClear Pro

Cập nhật: **2026-09-17** (follow-up gate Phase 3: `Q-P3-09` chốt; **`Q-P3-08` mở lại** ở trạng thái
`owner_decision_required` theo đúng quy định của owner; `Q-23`/`Q-P3-05` đo lại và vẫn chặn;
`Q-P3-04` vẫn cần dữ liệu từ nền tảng).

Quy tắc: một câu hỏi chỉ nằm ở **một** trạng thái. Câu đã chốt chuyển xuống mục "Đã giải quyết" và
**không** còn xuất hiện ở bảng đang mở.

## 1. Đang mở

| ID | Câu hỏi | Ảnh hưởng | Trạng thái | Chặn gì |
|---|---|---|---|---|
| Q-05 | Quy trình report/abuse đầy đủ ở phase sau trông như thế nào? (Phase 0 chỉ mới chốt: asset bị report → attestation `blocked`) | POLICY §7 | `unknown` | thiết kế sau MVP |
| Q-07 | Ai chuẩn bị bộ media mẫu cho 10 kịch bản benchmark? | PROVIDER_BENCHMARK §5 | `unknown` | chạy benchmark |
| Q-11 | Có cần luật sư/BA duyệt câu chữ xác nhận quyền (vi + en) trước khi lên production không? | POLICY §3 | `unknown` | **go-live.** Nay còn rộng hơn: Phase 2 thêm ~30 khoá câu chữ do agent viết (`P2-MCP-29/31/33`) và **chưa khoá nào được owner duyệt** |
| Q-12 | Thư viện nào đọc được C2PA / AI provenance thật? | MCP-05 | `unknown` | **Phần "dấu vết AI" của MỌI biên nhận hiện là `unknown`.** `P2-MCP-30` đã có bộ đo thật cho metadata (EXIF/ICC/XMP/IPTC) nhưng **không có** bộ đọc C2PA, và `D-044` cấm suy ra `verified` từ một phép đo chưa chạy |
| Q-13 | Giới hạn 199 MB / 599 giây / 3840 px đang hiểu là **inclusive** (đúng 199 MB vẫn được nhận). Owner xác nhận cách hiểu này chứ? | MCP-03 | `unconfirmed` | không chặn — contract đã chạy theo cách hiểu inclusive, đổi thì sửa 1 dòng config |
| Q-15 | "Static mask" đang được map vào `blur`/`brand_overlay` trên một vùng cố định thay vì tạo enum mới. Owner xác nhận cách map này chứ? | vocabulary, provider | `unconfirmed` | không chặn |
| Q-21 | Bản English của câu phạm vi trong prompt Q-20 **bị cắt ở "identifying ma"**. Đang dùng đúng chữ owner viết ở phần đọc được và hoàn thành chữ cuối là "marks" — chữ cuối là **suy ra**, không phải owner duyệt. Owner xác nhận chữ cuối và phần sau (nếu còn) chứ? | i18n `policy.visible_identity_scope` (en) | `unconfirmed` | không chặn — sửa một khoá i18n là xong. **D-034** (`P1.1-Q21-MCP-21`) đã dựng chốt hai chiều: đổi chuỗi mà quên cập nhật dòng này, hoặc đóng dòng này mà chuỗi không đổi, đều làm test đỏ |

| Q-23 | Kho object dùng chung cho bản online: dùng Cloudflare R2 hay nhà cung cấp S3 nào? | `P2-MCP-24`, `DEPLOYMENT.md` | `unknown` · `blocked_by_missing_environment` | **Chặn deploy worker VÀ chặn go-live.** **Đo lại `2026-09-16T18:43:20Z`**: `/healthz` online trả `storage.id=local-fs-phase1`, `production=false`; workspace **không có biến storage nào**. Tệp nằm trên đĩa container nên **mất mỗi lần deploy lại**, worker ở container khác **không thấy tệp nguồn**. **Tên biến phải dùng là `MEDIACLEAR_S3_*`** (xem `PHASE_3_CLOSURE.md` §10) — `STORAGE_*` không được mã đọc |
| Q-24 | ~20 nhãn câu chữ cho loại sự kiện ở trang Nhật ký (`processing_job_completed`, `output_download_url_issued`…) — ai viết? | `P2-MCP-33`, giao diện | `answered` (`D-061`) | **Đã có 19 nhãn ở cả hai ngôn ngữ** + phép chắn đọc `AUDIT_EVENTS` thẳng từ mã máy chủ nên thiếu nhãn là test đỏ. Soạn theo uỷ quyền `D-059`, **vẫn thuộc diện owner/BA duyệt** |

| Q-P3-04 | Preset nào đã có bằng chứng **platform-specific** (TikTok/Reels/Shorts)? | `P3-MCP-34` | `unknown` (đối chiếu lại `2026-09-17`) | không chặn — **ba phần tách riêng**: (a) **bằng chứng pipeline nội bộ**: tỉ lệ 9:16/16:9/1:1, `h264`, `aac`, MP4 — **đo được, có test** (`p3-presets.test.ts`); (b) **bằng chứng từ nền tảng**: **không có**, và **không đo được từ repo** — phải hỏi chính nền tảng; (c) **trường unknown**: `maxDurationSeconds`/`maxFileSizeBytes`/`targetResolution` = `null` ở cả 5 preset. Mọi preset giữ `partially_verified`. Tên thương hiệu là **nhãn gợi ý tỉ lệ, không phải cam kết tương thích** |
| Q-P3-05 | Kho object dùng chung (Q-23) đã xác minh online chưa? | `Q-23`, `DEPLOYMENT.md` | **`blocked`** | **đo lại `2026-09-16T18:43:20Z`**: `/healthz` online vẫn `storage: local-fs-phase1`, `production: false`. **Chặn mọi xác minh online** của Phase 3. **Phát hiện mới**: bản online còn chạy **build cũ hơn Phase 2** (`routes=35/28 implemented/3 planned` so với `46/42/0` của mã hiện tại) ⇒ **kể cả có kho object vẫn phải deploy lại trước**, nếu không sẽ đo nhầm build không chứa Phase 3 |

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
| Q-P3-08 | Khoá câu chữ nào của Phase 3 đã được owner duyệt | **`owner_decision_required` — MỞ LẠI** (`D-063`). Việc **rà** đã xong (`D-059`: 77 khoá, 5 phép kiểm, tìm+sửa 1 lỗi thật là lọt thuật ngữ `C2PA` ra màn hình) nhưng **rà ≠ duyệt**: duyệt là thẩm quyền owner/BA. **100 khoá đang chờ duyệt**, liệt kê kèm nơi giao diện dùng ở `PHASE_3_CLOSURE.md` §12 — gồm 19 nhãn `audit_event.*` mới (`D-061`), khoá `provenance.limitation.no_c2pa_reader` viết lại, 3 nhãn preset mang tên thương hiệu, và 77 khoá Phase 3. **KHÔNG bao gồm** câu chữ xác nhận quyền — đó là `Q-11`, cần người chịu trách nhiệm pháp lý | D-059, D-063 |
| Q-P3-09 | Quy ước ID `P3-MCP-30…34` | **Owner xác nhận.** ID canonical là **chuỗi đầy đủ** (D-029) nên `P3-MCP-30` ≠ `P2-MCP-30`; không ID lịch sử nào bị đổi | D-059 |
| Q-P3-01 | Giới hạn duration / size / định dạng video Phase 3 | **Đã có sẵn trong repo, Phase 3 dùng đúng, không tự mở rộng**: 199 MB · 599 giây · ≤ 3840×3840 · MP4/MOV/WebM | D-018 |
| Q-P3-02 | Codec/container proxy và export mà pipeline **thật sự** làm được | **Đo bằng `ffprobe` trên byte thật**: container `mov,mp4,m4a,3gp,3g2,mj2` (họ MP4) · video `h264` · audio `aac` — **giống nhau cho nguồn, kết quả và proxy**. Không lấy từ tài liệu quảng cáo | D-056 |
| Q-P3-03 | Dung sai lệch thời lượng audio | **`0,25` giây, có cơ sở đo được**. 12 lượt render: `mask`/`blur`/`crop` (mọi tỉ lệ) lệch **đúng 0.000000s** vì dùng `-c:a copy`; chỉ đường **proxy** (mã hoá lại) lệch `0.021995s`. Dung sai ≈ **11 lần** biên độ lớn nhất. Có test ghim cả hai con số | D-056 |
| Q-P3-06 | Việc dọn dữ liệu / lưu giữ đã chạy thật lần nào chưa | **CHƯA, và không có đường nào để chạy**: `source_files` có **0** bản `deleted_at`, **0** bản `scheduled_for_deletion`, và `retention.ts` **không gọi `deleteObject()`** ở bất kỳ đâu. Đây là câu trả lời **phủ định có bằng chứng**, không phải "chưa biết" | D-056 |
| Q-P3-07 | Provider AI nào được phép gọi, ở môi trường nào | **Phase 3 KHÔNG gọi provider AI nào.** Đo được: **0** provider tự khai `usesAiModel = true`; `/healthz` khai `productionAiProcessingEnabled: false` với 2 provider production (đều tất định). Việc **chọn** provider AI vẫn là quyết định của owner — xem Q-06 | D-056 |
| Q-02 | Queue/worker runtime nào cho video | **Hàng đợi nằm trên PostgreSQL** bằng `FOR UPDATE SKIP LOCKED`, worker là vai thứ ba của cùng ảnh Docker (`MEDIACLEAR_ROLE=worker`). Không thêm Redis: cơ sở dữ liệu đã có sẵn và Vibe Host không có Redis. **Video vẫn chưa xử lý được** — đó là Q-06, không phải Q-02 | D-042 |
| Q-14 | Auth provider/IdP cụ thể cho production | **Tự làm**: email + mật khẩu băm bằng `scrypt` (có sẵn trong Node, không native module), phiên lưu bảng `sessions` trong PostgreSQL nên **sống sót khởi động lại**. Không dùng vendor ngoài | D-039 |
| Q-22 | Ô tick ghi "xác nhận nội dung trên" trong khi hệ thống chỉ version hoá một câu | **Không** version hoá phần ngữ cảnh và **không** tạo statement v3. Thay vào đó ô tick hiển thị thẳng chính câu được ký (`rights.attestation.v2.statement`); tiêu đề mục, câu phạm vi hỗ trợ và hai câu cảnh báo được ghi rõ là **ngữ cảnh**, không lưu làm bằng chứng | D-035 |

## 3. Ghi chú về evidence còn `unknown`

Benchmark provider vẫn `unknown` **theo đúng thiết kế**: đó là **evidence status**, không phải
blocker về product decision. Không mục nào trong `PROVIDER_BENCHMARK.md` được đánh `verified` trước
khi có run thật.
