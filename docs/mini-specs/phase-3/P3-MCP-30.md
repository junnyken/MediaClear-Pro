# P3-MCP-30 — Video Upload and Proxy Preview

- **Canonical ID**: `P3-MCP-30` · **Parent phase**: Phase 3 · **Decision**: `D-051`
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16

> **ID**: đề bài đặt tên `MCP-30`. Repo đã có `P2-MCP-30`, nên theo luật canonical `D-029`
> (*"ID là chuỗi đầy đủ, không phải con số cuối"*) mục này là **`P3-MCP-30`**. Không ID nào
> trùng, không ID lịch sử nào bị đổi. Xem `Q-P3-09`.

## Context

Tải lên video đã chạy từ Phase 1 (`P1-MCP-15`, giới hạn `MCP-03`). Thứ **chưa có** là một cách để
người dùng **nhìn thấy** video trước khi chọn vùng và trước khi render.

## Design Choice

**1. Proxy là object RIÊNG ở lớp `preview`, không bao giờ chạm `source`.** Tệp gốc vẫn bất biến
(I-1), và `assertWritableKey` vẫn là chốt ở tầng lưu trữ.

**2. `upsert` chứ không `create`.** Sinh lại proxy (lần trước thất bại, hoặc muốn bản mới) là
chuyện bình thường và **không được sinh bản thứ hai** cho cùng một asset.

**3. `hasAudio` đo trên byte của CHÍNH bản proxy**, không sao chép lời khai từ tệp gốc. Proxy mất
tiếng mà vẫn khai "có tiếng" sẽ khiến người dùng tưởng đã nghe kiểm rồi.

**4. Proxy giữ audio.** Xem trước mà không nghe được thì không kiểm được tiếng còn nguyên hay không.

**5. Thiếu `ffmpeg` ⇒ nói rõ `ffmpeg_missing`**, không báo lỗi chung chung.

## Tests (10, đều chạy trên video thật)

| Test | Chặn điều gì |
|---|---|
| sinh được proxy, ghi đúng quan hệ tới asset gốc | proxy mồ côi |
| **tệp gốc còn nguyên TỪNG BYTE sau khi sinh proxy** | vỡ I-1 |
| proxy nằm ở lớp `preview`, **không** phải `source` | rò vào vùng bất biến |
| proxy **giữ audio**, đo trên byte thật của proxy | khai theo tệp gốc |
| video không audio ⇒ proxy không audio, **không báo lỗi giả** | nhầm "vốn không có" với "bị mất" |
| sinh lại proxy an toàn, không sinh bản thứ hai | rác trong kho |
| chưa sinh thì đọc trả 404, không trả bản rỗng | bản rỗng bị hiểu là đã có |
| tải được proxy về, byte khớp kích thước đã khai | khai sai số |
| asset **ảnh** không sinh proxy video | chạy rồi hỏng |
| workspace khác không sinh/đọc được | rò dữ liệu |

## Remaining Limits

- **Proxy có thể LỚN HƠN bản gốc với video đã rất nhỏ** (đo được: 12261 > 9658 byte). Fixture nén ở
  `crf 40`, proxy mã hoá lại ở `crf 32`. Với video thật vài MB thì proxy nhỏ hơn hẳn — nhưng hệ
  thống hiện **không kiểm** điều này và có thể lưu một bản tốn chỗ hơn bản gốc.
- **Chưa hiển thị tiến trình tải lên** theo thời gian thực.
- **`blocked_by_Q23`**: chưa xác minh được proxy sống sót qua một lần deploy lại, vì bản online vẫn
  là `local-fs-phase1`.
- Chưa dọn proxy cũ khi asset bị xoá (chưa có đường xoá nào — đúng chính sách hiện tại).
