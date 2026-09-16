# P3-MCP-33 — Audio Preservation

- **Canonical ID**: `P3-MCP-33` · **Parent phase**: Phase 3 · **Decision**: `D-054`
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16

## Đây là mục quan trọng nhất của Phase 3

Đề bài nói: *"Không xuất video nếu audio bị mất ngoài ý muốn."* Nên audio **không phải một trường
ghi cho vui — nó là một CỔNG**.

| Kết luận | Nghĩa | Job đi đâu |
|---|---|---|
| `preserved` | có tiếng trước, có tiếng sau, thời lượng khớp | `completed` |
| `absent_by_design` | **vốn không có tiếng** | `completed` |
| `lost` | có tiếng trước, **không có sau** | **`failed`** |
| `duration_drift` | lệch quá dung sai | `review_required` |
| `unknown` | **không đo được** | `review_required` |
| `channel_changed` | **số kênh đổi** (vd stereo → mono) | `review_required` |
| `changed_by_preset` | preset đổi tiếng **có chủ đích** | `review_required` |

**Phân biệt `absent_by_design` với `lost` là điều quan trọng nhất ở đây.** Gộp hai cái sẽ biến một
lỗi thật thành chuyện bình thường — cùng họ với lỗi `D-044` (`unknown` bị khai thành `verified`).

## Design Choice

**1. Đo trên BYTE ĐÃ ĐỌC LẠI TỪ KHO**, không trên buffer trong bộ nhớ. Cái người dùng nhận được là
tệp trong kho, nên phép đo phải chạy trên đúng tệp đó.

**2. Dung sai thời lượng `0,25` giây** (Q-P3-03). Đủ rộng để không báo động giả vì cách ffmpeg làm
tròn khung hình cuối, đủ hẹp để bắt được audio bị cắt thật. **Đây là mặc định của agent, chưa được
owner duyệt** — đổi một hằng số là xong.

**3. `null` ≠ `0`.** Codec/thời lượng/số kênh là `null` khi không đọc được, không điền `0`.

## Tests

Video có audio AAC · video **không** có audio · audio bị mất ⇒ `lost` ⇒ **không completed** · lệch
thời lượng ⇒ `duration_drift` · lệch **trong** dung sai ⇒ `preserved` · preset đổi audio có chủ
đích ⇒ ghi riêng · **không đo được ⇒ `unknown`, không suy ra là `preserved`** · audio nguyên qua
từng preset.

**Đối chứng âm đã chạy**: ép render bỏ audio (`-an`) ⇒ job thành `failed` kèm `reason: audio_lost`,
test đỏ đúng chỗ.

## Remaining Limits

- **Dung sai chưa được owner duyệt** (Q-P3-03).
- **Chưa so nội dung tiếng**, chỉ so sự hiện diện + thời lượng + codec. Một bản render giữ đúng độ
  dài nhưng **tiếng bị méo** sẽ lọt qua.
- ~~Chưa đo số kênh sau render~~ — **đã đóng**: `compareAudio` nay so `channelCount` và trả
  `channel_changed` khi số kênh đổi, và kết luận đó **không cho phép `completed`**. Có fixture
  stereo thật + đối chứng âm (ép `-ac 1` ⇒ test đỏ).
