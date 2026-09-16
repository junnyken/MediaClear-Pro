# P3-MCP-31 — Static Logo Mask

- **Canonical ID**: `P3-MCP-31` · **Parent phase**: Phase 3 · **Decision**: `D-052`
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16

## Design Choice

**1. Không tạo từ vựng mới.** `static mask` = `brand_overlay` trên một vùng cố định — **đúng cách
`Q-15` đã chốt**. Thêm một enum nữa sẽ tạo ra hai tên cho một việc.

**2. Toạ độ chuẩn hoá 0..1**, nên vùng chọn trên bản proxy nhỏ áp dụng **đúng** lên bản gốc lớn.
Đây là lý do hệ thống chuẩn hoá toạ độ từ Phase 0 — giờ mới dùng tới.

**3. Vùng tràn ra ngoài bị TỪ CHỐI, không cắt âm thầm.** Cắt âm thầm nghĩa là người dùng tưởng đã
che một vùng mà thực tế che vùng khác.

**4. Không bám chuyển động.** Logo **di chuyển ra khỏi vùng** thì hệ thống **không được** tuyên bố
đã xử lý hoàn toàn. Đây là giới hạn có thật của một static mask, và `review_required` tồn tại cho
đúng loại tình huống đó.

## Tests

Vùng ở **bốn góc** · vùng **chạm biên** (`x + width = 1`) · vùng **tràn ra ngoài** bị từ chối ·
vùng rỗng bị từ chối · toạ độ ngoài `0..1` bị từ chối · mask chạy thật trên video, **audio nguyên**
· biên nhận ghi `operationMode: 'mask'` · tệp gốc bất biến · output verify trước `completed`.

## Remaining Limits

- **KHÔNG bám chuyển động.** Logo di chuyển ra ngoài vùng sẽ **không** được che ở các khung đó.
  Hệ thống không tự phát hiện được điều này — nó chỉ **không tuyên bố** đã xử lý hoàn toàn.
  Việc phát hiện thuộc Phase 4.
- Chưa có giao diện kéo-thả để chọn vùng; hiện nhận toạ độ qua API.
