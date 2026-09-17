# PHASE 4 — Báo cáo đóng (MCP-40…44)

- **Quyết định**: `D-071` · **Ngày**: 2026-09-17

```
Technical gate: READY_FOR_PHASE_5_EXCEPT_UI_AND_PROVIDER
Online verification: BLOCKED_BY_Q23
Go-live: NOT_READY_FOR_GO_LIVE
```

> Cổng kỹ thuật **không** phải `READY_FOR_PHASE_5` trần: hai mục còn nợ được nêu ở §6, và giấu chúng
> sau một nhãn tròn trịa sẽ là nói dối về trạng thái thật.

---

## 1. Ba bất biến cốt lõi — mỗi cái có test TRỰC TIẾP

| Bất biến (nguyên văn đề bài) | Thi hành ở đâu | Test trực tiếp |
|---|---|---|
| Không có frame nào bị bỏ sót mà UI lại báo tracking hoàn tất | `summariseTimeline` so `states.size` với `expectedFrameCount` | `BAT BIEN 1 — mot frame bien mat khoi ket qua` |
| Frame confidence thấp phải được đánh dấu review | `frameStateFor` → `frame_low_confidence` | `BAT BIEN 2 — chi MOT frame confidence thap` |
| Video không được xuất nếu audio bị mất ngoài ý muốn | `audioAllowsCompletion` (dùng lại `P3-MCP-33`) | `BAT BIEN 3 — audio bi mat` |

**Không có "completed theo phần trăm".** Có test riêng: 49/50 frame tốt vẫn `review_required`.

## 2. Vì sao số frame phải ĐẾM, không được SUY

| Tệp | `r_frame_rate` | `duration × fps` suy ra | Số frame THẬT |
|---|---|---|---|
| `video-vfr.mp4` | 10 | ~20 | **26** |

Nếu lấy con số suy ra làm "số frame kỳ vọng", bất biến 1 mất hết ý nghĩa — hệ thống sẽ so kết quả
tracking với một **ước lượng**, không phải với sự thật.

Và vì sao lấy số container **khai** chứ không lấy số **giải mã được**:

| Tệp | container khai | giải mã được | chênh |
|---|---|---|---|
| `video-corrupt-frame.mp4` | 10 | 9 | **1 frame hỏng** |

Lấy số giải mã làm tổng thì frame hỏng tự động "không tồn tại".

## 3. Trạng thái MCP-40…44

| MCP | Trạng thái | Ghi chú |
|---|---|---|
| `P4-MCP-40` Frame Timeline | **completed** | đối chiếu độc lập bằng `ffprobe` gọi thẳng trong test |
| `P4-MCP-41` Motion Tracking | **completed** với provider giả; **provider thật `blocked`** | `Q-P4-01` |
| `P4-MCP-42` Keyframe Correction | **completed** (logic + audit trail) | màn hình còn nợ — §6 |
| `P4-MCP-43` Temporal Consistency | **completed** | ngưỡng theo frame rate thật |
| `P4-MCP-44` Quality Review Gate | **completed** | nơi duy nhất được nói `completed` |

## 4. Chín đối chứng âm — chạy hết, 9/9 đỏ đúng chỗ

| # | Đột biến | Kết quả |
|---|---|---|
| 1 | Frame bị bỏ sót nhưng job báo `completed` | **1 đỏ** |
| 2 | Frame confidence thấp không chuyển review | **2 đỏ** |
| 3 | Audio mất nhưng job vẫn `completed` | **1 đỏ** |
| 4 | Provider quá hạn bị nuốt lỗi | **1 đỏ** |
| 5 | Correction ghi đè, không giữ audit trail | **1 đỏ** |
| 6 | Temporal check bị tắt | **2 đỏ** |
| 7 | UI/server lệch enum, không kiểm lúc chạy | **1 đỏ** |
| 8 | Gate bỏ qua audio verification | **1 đỏ** |
| 9 | Gate bỏ qua frame confidence tổng hợp | **3 đỏ** |

Đột biến #9 làm đỏ **ba** test ở ba tầng khác nhau — dấu hiệu bất biến đó được canh ở nhiều lớp.

## 5. Ba số ƯỚC LƯỢNG, không phải số đo

`FRAME_CONFIDENCE_THRESHOLD = 0.6` · `MAX_MASK_SPEED_PER_SECOND = 1.5`.

Cả hai nằm tường minh một chỗ, và mã tự khai qua `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED = false`.
Phase 3 làm ngược lại và đúng: dung sai audio `0.25s` được **đo** bằng 12 lượt render rồi mới ghim.
`Q-P4-02` để đo lại khi có provider thật.

## 6. CHƯA làm — nói thẳng, không giấu sau nhãn "completed"

1. **Màn hình cho `P4-MCP-42`/`44`.** Hợp đồng dùng chung và kiểm lúc chạy **đã có** (`D-047` áp
   dụng lại, có test sai enum + thiếu trường). Nhưng **chưa dựng màn hình** để người dùng sửa
   keyframe và xem lý do review. Đây là phần còn nợ.
2. **Chưa nối vào đường job thật.** Logic hoàn chỉnh và có test, nhưng chưa thay đường
   `run-video-job` của Phase 3.
3. **Provider tracking thật** — `blocked` (`Q-P4-01`).

## 7. Không đụng tới

`MEDIACLEAR_CLEANUP_ENABLED` vẫn **tắt** · `Q-23` vẫn **blocked** · go-live vẫn
**`NOT_READY_FOR_GO_LIVE`** · Rights Statement v1/v2 **không đổi một ký tự** · không ID lịch sử nào
bị đánh số lại · không ghi đè asset gốc (có test riêng ở `P4-MCP-40`).
