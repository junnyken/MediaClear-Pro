# P3-MCP-32 — Crop and Blur Fallback

- **Canonical ID**: `P3-MCP-32` · **Parent phase**: Phase 3 · **Decision**: `D-053`
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16

## Design Choice

**1. Ba chế độ đều là phép TẤT ĐỊNH, không cái nào là "AI cleanup".** Có test khẳng định tên của
chúng (`mask`/`crop`/`blur`) và khẳng định không chuỗi nào chứa "ai".

**2. `crop` lấy GIỮA khung hình theo tỉ lệ của preset.** Kích thước làm tròn về **số chẵn** vì
`yuv420p` đòi vậy.

**3. `blur` làm mờ ĐÚNG vùng**, không mờ toàn khung: cắt vùng ra → làm mờ → dán lại đúng chỗ.

**4. Audio `-c:a copy` ở mọi đường ghi.** Không mã hoá lại thì không thể mất tiếng vì encode hỏng.

## Hai lỗi thật chỉ lộ ra khi RENDER

**1. Bán kính làm mờ cố định làm ffmpeg từ chối trên vùng nhỏ.**

```
Invalid chroma_param radius value 12, must be >= 0 and <= 7
```

`boxblur` giới hạn bán kính theo mặt phẳng **chroma** (chỉ bằng nửa luma với `yuv420p`). Bán kính
phải **co theo kích thước vùng**. Không thể bắt bằng đọc mã.

**2. Một vùng thì chạy, HAI vùng thì hỏng.**

Nhãn đầu ra của bộ lọc (`[step0]`) chỉ được **tiêu thụ một lần**, khác nhãn luồng (`[0:v]`) mà
ffmpeg tự nhân bản. Phải chèn `split`. Cả hai đã có test hồi quy.

## Tests

Crop **9:16** · crop **16:9** · crop **1:1** · blur một vùng · blur **nhiều vùng** · blur trên
**vùng rất nhỏ** · vùng không hợp lệ bị từ chối · **audio nguyên sau crop và sau blur** · job hỏng
**không** được tính như completed · tệp gốc bất biến.

## Remaining Limits

- **Chưa có nút reset về bản gốc trên giao diện.** Ở tầng dữ liệu thì bản gốc luôn còn (I-1) và
  chạy lại = job **mới** (D-005), nhưng đường bấm thì chưa có.
- `crop` luôn lấy **giữa** khung; chưa cho chọn vùng cắt.
- Chưa đo chất lượng cạnh vùng mờ.
