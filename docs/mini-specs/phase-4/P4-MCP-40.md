# P4-MCP-40 — Frame Timeline

- **Phase**: 4 · **Trạng thái**: xem cuối tài liệu · **Quyết định**: `D-071`
- **Quy ước ID**: `P4-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**), nhưng owner **chưa xác nhận riêng** cho Phase 4 — xem `Q-P4-03`.

---

## Mục tiêu

Dựng timeline đại diện **chính xác** cho toàn bộ frame của video, làm nền cho `P4-MCP-41…44`.

## Điều quan trọng nhất

**Tổng số frame phải được ĐẾM, không được suy ra từ `duration × fps`.**

Với video frame rate biến đổi (VFR), `duration × fps` sai — và sai theo hướng nguy hiểm nhất: nó cho
ra một con số **trông như đúng**. Đo thật trên `video-vfr.mp4`: `r_frame_rate = 10`, thời lượng ~2s
⇒ suy ra ~20 frame, trong khi số thật là **26**. Nếu lấy con số suy ra làm "số frame kỳ vọng" thì
bất biến *"không frame nào bị bỏ sót"* **mất hết ý nghĩa** — hệ thống sẽ so kết quả tracking với một
ước lượng, không phải với sự thật.

## Cách làm

`ffprobe -count_frames` — giải mã thật và đếm. Chậm hơn, và đó là cái giá phải trả để con số có nghĩa.

## Frame hỏng decode

Container **khai** `nb_frames`, ffprobe **giải mã được** `nb_read_frames`. Chênh lệch chính là frame
hỏng. Đo thật: `video-corrupt-frame.mp4` khai 10, giải mã được 9 ⇒ 1 frame hỏng.

`expectedFrameCount` lấy số **khai**, không lấy số giải mã được. Lấy số giải mã thì frame hỏng tự
động "không tồn tại" và yêu cầu *"frame lỗi decode phải được ghi nhận, không bị bỏ qua khỏi tổng số"*
thất bại trong im lặng.

## Trạng thái

`completed`. 7 test, có **đối chiếu độc lập** bằng `ffprobe` gọi thẳng trong test — test chỉ hỏi
chính module rồi so với chính nó thì chỉ chứng minh module nhất quán với bản thân, không chứng minh
nó đúng.
