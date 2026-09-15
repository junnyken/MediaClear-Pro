# PRODUCT_SCOPE — MediaClear Pro

- **Phase**: 0 — Product Foundation, Evidence, Architecture & UX Foundation
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com)
- **Date**: 2026-09-15
- **Trạng thái tài liệu**: chốt cho Phase 0

> Quy ước trạng thái dùng trong mọi tài liệu: `implemented` (đã có code chạy được trong repo
> này) · `planned` (đã chốt contract, chưa code) · `unknown` (chưa có bằng chứng) ·
> `out_of_scope` (cố ý không làm).

## 1. Sản phẩm là gì

MediaClear Pro là SaaS đa tenant cho creator, affiliate marketer, shop online và agency, hỗ trợ
làm sạch / phục hồi / chuẩn hoá / tái nhận diện ảnh và video **mà người dùng sở hữu hoặc có
quyền chỉnh sửa**.

Người dùng chỉ thấy **một sản phẩm**. Năm module nội bộ (Cleanup Studio, Frame Repair, Rights
Guard, Provenance Center, Brand Overlay) là cách tổ chức bên trong, **không** được trưng ra UX
như năm sản phẩm hay năm extension riêng.

## 2. Ranh giới sản phẩm

### 2.1. In scope for MVP

| Hạng mục | Trạng thái hôm nay |
|---|---|
| Web app | `planned` (đã có skeleton Next.js, chưa có nghiệp vụ) |
| Image visible-region cleanup | `planned` |
| Video dưới 10 phút và dưới 200 MB | `planned` (contract validate đã `implemented`) |
| TikTok / Reels / Shorts presets | `planned` |
| Crop, blur, static mask, provider-based inpainting | `planned` |
| Preview trước export | `planned` |
| Metadata preservation mặc định | `planned` (contract + default ON đã `implemented`) |
| Rights confirmation | `planned` (policy gate đã `implemented` ở tầng contract) |
| Usage measurement theo ảnh và phút video | `planned` (contract đã `implemented`) |
| Brand overlay cơ bản | `planned` |
| Provider abstraction | `implemented` (interface + registry + no-op test provider) |

### 2.2. Planned later

Motion tracking · Keyframe repair · Temporal consistency scoring · Chrome Extension · Team roles
nâng cao · Google Drive integration · International billing · API public cho khách hàng.

> Theo chỉ đạo owner (2026-09-15): Chrome Extension **không** được xây trong Phase 0, nhưng
> contract phải để sẵn chỗ (`ApiClientKind`, `ENABLED_API_CLIENT_KINDS`) để gắn vào sau mà không
> phá domain. Extension tương lai **dùng chung API**, không có engine riêng.

### 2.3. Out of scope for Phase 0

Production AI processing · Video render worker hoàn chỉnh · Payment collection · Automatic
scraping from third-party websites · Provenance removal · Claim rằng SynthID có thể bị xoá ·
Full Chrome Extension implementation · Python media service.

> Python media worker **cũng out_of_scope cho Phase 0** (chỉ đạo owner 2026-09-15). Contract
> `WorkerJobEnvelope` / `WorkerResultEnvelope` là JSON thuần, có `envelopeVersion`, để một worker
> Python ở phase sau tiêu thụ được mà không đổi domain.

## 3. Giới hạn kỹ thuật đã chốt

| Giới hạn | Giá trị | Nguồn |
|---|---|---|
| Thời lượng video | **< 600 giây** (strict) | prompt Phase 0 |
| Dung lượng file | **< 209.715.200 bytes (200 MB)** (strict) | prompt Phase 0 |
| Định dạng ảnh | `image/jpeg`, `image/png`, `image/webp` | quyết định D-007 |
| Định dạng video | `video/mp4`, `video/quicktime`, `video/webm` | quyết định D-007 |
| Kích thước ảnh | 64 px ≤ cạnh ≤ 8000 px | quyết định D-007 |
| Kích thước video (pixel) | `unknown` — chưa có bằng chứng để chốt | OPEN_QUESTIONS Q-03 |

## 4. Thị trường

Việt Nam trước; tiếng Việt là locale mặc định. Kiến trúc i18n đã sẵn `en` với key parity được test
tự động, nhưng **chưa** có quyết định về thị trường quốc tế thứ hai (`unknown`).
