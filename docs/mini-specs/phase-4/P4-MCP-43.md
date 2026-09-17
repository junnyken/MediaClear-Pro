# P4-MCP-43 — Temporal Consistency Check

- **Phase**: 4 · **Trạng thái**: xem cuối tài liệu · **Quyết định**: `D-071`
- **Quy ước ID**: `P4-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**), nhưng owner **chưa xác nhận riêng** cho Phase 4 — xem `Q-P4-03`.

---

## Mục tiêu

Phát hiện flicker / mask nhảy bất thường giữa các frame liên tiếp.

## Ngưỡng tính theo FRAME RATE THẬT

`maxMaskDeltaPerFrame(fps) = MAX_MASK_SPEED_PER_SECOND / fps`.

Không hardcode theo giả định 30fps: video 60fps có gấp đôi số frame cho cùng một chuyển động, nên
mỗi frame chỉ được phép nhảy một nửa. Có test chứng minh: cùng một cú nhảy 0.04 bị bắt ở 60fps
(giới hạn 0.025) nhưng không bị bắt ở 24fps (giới hạn 0.0625).

`MAX_MASK_SPEED_PER_SECOND = 1.5` cũng là **ước lượng**, cùng lý do với ngưỡng confidence.

## KHÔNG tự làm mượt

Phát hiện và đánh dấu để người xem. Làm mượt âm thầm sẽ sửa một **triệu chứng** và giấu mất nguyên
nhân, đồng thời làm kết quả không còn là kết quả tracking nữa.

## Không biết frame rate thì không kết tội

`fps` không đọc được ⇒ giới hạn là vô cực ⇒ không báo flicker. Không đo được thì không kết luận —
cùng tinh thần `D-044`.

## Trạng thái

`completed`. 4 test.

---

## Cập nhật `D-074`

Cổng chặn chất lượng và phép kiểm tính liên tục nay **chạy lại sau mỗi lần sửa keyframe**, và kết quả
ở **cả hai vế** (ngay trước · ngay sau) được ghi vào hồ sơ lần sửa (`flicker_before/after`,
`gate_verdict_before/after`).

Một vế "sau" đứng một mình không trả lời được câu hỏi thật sự của người dùng: *lần sửa vừa rồi làm
tình hình tốt lên hay xấu đi*. Đo được trên hệ thống chạy thật: một lần sửa tạo cú nhảy ghi
`0 trước · 6 sau`, cổng rời khỏi `completed`, và nút tải về vẫn khoá.

Xem `D-074` và `Q-P4-05`.
