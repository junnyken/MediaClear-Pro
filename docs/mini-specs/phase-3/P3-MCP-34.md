# P3-MCP-34 — Social Export Presets

- **Canonical ID**: `P3-MCP-34` · **Parent phase**: Phase 3 · **Decision**: `D-055`
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16

## Sự thật phải nói rõ

`status` của mỗi preset nói về điều **hệ thống này tự đo được** — tỉ lệ khung hình, codec và
container mà pipeline **thật sự** sinh ra. Nó **KHÔNG** nói về việc nền tảng có chấp nhận tệp hay
không. Không có bằng chứng nào về điều đó trong repo (`Q-P3-04`).

⇒ **Không preset nào mang `verified`.** Tất cả là `partially_verified`, và
`maxDurationSeconds` / `maxFileSizeBytes` đều **`null`** — giới hạn của nền tảng là thứ **không đo
được** từ repo này. Điền một con số lấy từ tài liệu quảng cáo chính là thứ đề bài cấm.

Tên "TikTok/Reels/Shorts" là **nhãn gợi ý** về tỉ lệ phổ biến, **không phải** lời cam kết tương thích.

## Preset

| id | tỉ lệ | video | audio | container | status |
|---|---|---|---|---|---|
| `tiktok_vertical` | 9:16 | h264 | aac | mp4 | `partially_verified` |
| `reels_vertical` | 9:16 | h264 | aac | mp4 | `partially_verified` |
| `shorts_vertical` | 9:16 | h264 | aac | mp4 | `partially_verified` |
| `square` | 1:1 | h264 | aac | mp4 | `partially_verified` |
| `landscape` | 16:9 | h264 | aac | mp4 | `partially_verified` |

`evidence` của mọi preset trỏ tới `apps/api/tests/p3-presets.test.ts` — **chính bộ test chứng minh
pipeline sinh đúng những giá trị khai ở đây**.

## Tests (13)

Không preset nào khai `verified` · không preset nào khai nhiều hơn bằng chứng · giới hạn nền tảng
đều `null` · mỗi preset trỏ tới bản ghi bằng chứng có thật · đủ ba preset đề bài đòi · nhãn là
**khoá i18n** chứ không phải câu chữ viết thẳng · **pipeline sinh đúng tỉ lệ 9:16 / 16:9 / 1:1** ·
codec và container đúng như khai · **audio nguyên qua từng preset** · route đọc được khi chưa đăng
nhập · **không preset nào trong phản hồi hiện là `verified`**.

**Đối chứng âm đã chạy**: đổi một preset thành `verified` ⇒ **3 test đỏ**.

## Remaining Limits

- **Không có bằng chứng tuân thủ nền tảng** (Q-P3-04). Đây là giới hạn lớn nhất của mục này.
- `targetResolution` là `null`: chưa đo độ phân giải đích cho từng preset.
- Chưa có bước xuất riêng — preset áp trong chính lượt render, chưa có đường "xuất lại theo preset
  khác" mà không chạy lại từ đầu.
- **Chưa có giao diện chọn preset.**
