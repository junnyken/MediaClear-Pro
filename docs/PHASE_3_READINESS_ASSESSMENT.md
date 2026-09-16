# PHASE_3_READINESS_ASSESSMENT — MediaClear Pro

- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Commit đánh giá**: `62e329a` · **Cổng vào**: `READY_FOR_PHASE_3` · **Go-live**: `NOT_READY_FOR_GO_LIVE`
- **Kết luận**: Phase 3 **bắt đầu được ở chế độ local/ephemeral**. Mọi phần cần xác minh online bị
  đánh dấu `blocked_by_Q23`.

> Tài liệu này ghi **những gì đo được trong repository**, trước khi sửa bất kỳ dòng mã nào.

## 1. Xác nhận trạng thái đầu vào

| Điều đề bài nêu | Đo được trong repo | Khớp? |
|---|---|---|
| Phase 2 đóng bằng `62e329a` | `git log` có `62e329a` là commit đóng Phase 2 | ✅ |
| `READY_FOR_PHASE_3`, chưa `GO_LIVE` | `PHASE_2_REPORT.md` §gate ghi đúng hai kết luận này | ✅ |
| 13 MINI-SPEC, 20 commit, 547 test | `MINI_SPEC_INDEX.md`: `P2-MCP-23`…`P2-MCP-35` = 13 · `git log` = 20 · suite = 547 | ✅ |
| Không còn route trả 501 | `/healthz` khai `plannedRoutes: 0` | ✅ |
| Production dùng `local-fs-phase1` | `/healthz` bản online khai đúng vậy | ✅ |

**Không có mâu thuẫn nào giữa đề bài và repository.**

## 2. Hai thứ chặn được phát hiện trước khi sửa mã

**1. `ffmpeg` KHÔNG có trong môi trường, và KHÔNG có trong ảnh Docker.**

Toàn bộ Phase 3 là xử lý video. Kho hiện chỉ có `sharp` (libvips) — **chỉ ảnh**. Provider tất định
`P2-MCP-27` tự khai không làm được video.

- Máy phát triển: đã cài `ffmpeg 6.1.1-3ubuntu5` (kèm `ffprobe`). **Lưu ý**: workspace này **mất gói
  hệ thống giữa các phiên** — đã xảy ra hai lần trong Phase 2 — nên bản cài này là **tạm**.
- Ảnh Docker (`node:22-bookworm-slim`) **chưa có** `ffmpeg`. Phải thêm vào `Dockerfile`, nếu không
  worker chạy trên Vibe Host sẽ hỏng mọi job video.

**2. Thiếu hai chuyển tiếp trạng thái mà đề bài yêu cầu.**

`ALLOWED_TRANSITIONS` hiện thiếu `queued -> failed` và `processing -> blocked`. Tám trạng thái canonical
thì **đã khớp sẵn** (repo có thêm `cancelled`, đề bài không cấm).

## 3. Những gì ĐÃ CÓ SẴN — Phase 3 không phải dựng lại

| Đề bài cần | Đã có từ phase trước |
|---|---|
| 8 trạng thái job canonical | `JOB_STATES` khớp đúng (+ `cancelled`) |
| `completed` chỉ sau output verification | `TransitionContext.outputValidated` đã chặn từ Phase 0 |
| Toạ độ vùng chuẩn hoá 0..1 | `NormalizedRegion` + đã dùng thật ở `P2-MCP-27/31` |
| Tệp gốc bất biến | I-1, có chốt ở **tầng lưu trữ** (`assertWritableKey`) |
| Đọc lại output trước khi báo xong | I-2, đã chạy thật ở `P2-MCP-27` |
| Biên nhận + provenance | `P2-MCP-30`, bảng `processing_receipts` |
| Xem trước trước khi render | `P2-MCP-31`, không tính mức dùng (I-12) |
| Dò audio trong video | `header-probe` đọc `hasAudioStream` cho MP4/MOV/WebM |
| Kho object có thể thay | `ObjectStorageAdapter`, đã kiểm trên MinIO |
| Worker chạy job | `P2-MCP-28` |
| Module dùng chung UI ↔ server | `@mediaclear/contracts`, **web đã import sẵn** |

## 4. D-047 — phương án chọn

Đề bài cho ba phương án. **Chọn phương án 3**, vì repository đã có sẵn cấu trúc cho nó: `apps/web`
**đã** phụ thuộc `@mediaclear/contracts` qua `workspace:*`. Không cần tách package mới.

Bổ sung **kiểm tra lúc chạy tại biên**: viết bộ kiểm tay trong `contracts`, **không thêm thư viện**.
Lý do giống D-039 (chọn `scrypt` thay `argon2`): thêm phụ thuộc là thêm thứ có thể hỏng khi dựng ảnh.

**Phạm vi**: đề bài nói rõ *"giải quyết **phần** lỗ hổng D-047 **trong phạm vi Phase 3**"*. Hiện có
**25 interface do giao diện tự khai**. Phase 3 đóng phần của các endpoint Phase 3; phần còn lại **vẫn
mở** và sẽ được ghi rõ trong `PHASE_3_CLOSURE.md`.

## 5. Q-23 và ranh giới online

`Q-23` **chưa được giải quyết** và tài liệu này **không đóng nó**. Hệ quả cho Phase 3:

- Chạy **local/ephemeral** được: API + worker cùng tiến trình hoặc cùng máy, chung một thư mục đĩa.
- **`blocked_by_Q23`**: mọi xác minh cần (a) tệp sống sót qua một lần deploy lại, hoặc (b) worker chạy
  **tiến trình/container riêng** đọc được tệp do API ghi.
- **Không** tự tạo bucket, **không** tự điền endpoint/khoá. Cần online thì **dừng tại cổng phụ thuộc**
  và xin chủ tài khoản cấu hình qua biến môi trường.

## 6. Quy ước ID cho Phase 3 — một điểm cần owner biết

Đề bài đặt tên `MCP-30` … `MCP-34`. Repository **đã có** `P2-MCP-30` … `P2-MCP-34` (Phase 2).

Theo luật canonical của chính repo (`D-029`, `MINI_SPEC_INDEX.md`): *"Canonical ID là **chuỗi đầy đủ**,
không phải con số cuối"*, và *"quy ước 'phase sau bắt đầu từ số kế tiếp' chỉ để người đọc lướt qua
không nhầm, **không phải ràng buộc kỹ thuật**"*.

⇒ Phase 3 dùng **`P3-MCP-30` … `P3-MCP-34`**. Đây **không** phải ID trùng: `P3-MCP-30` và `P2-MCP-30`
là hai chuỗi khác nhau, và **không ID lịch sử nào bị đổi**.

Đây là **cách hiểu của agent** khi áp hai ràng buộc cùng lúc (đề bài đặt tên MCP-30..34; repo cấm
trùng ID). Ghi lại như `Q-13`/`Q-15` đã làm, thay vì tự quyết trong im lặng. Xem `Q-P3-09`.

## 7. Kết luận

**Bắt đầu Phase 3 được**, với ba điều kiện ghi rõ từ đầu:

1. `ffmpeg` phải vào `Dockerfile` — nếu không, worker trên bản online hỏng mọi job video.
2. Mọi xác minh online mang nhãn **`blocked_by_Q23`**.
3. `NOT_READY_FOR_GO_LIVE` **giữ nguyên** suốt Phase 3.
