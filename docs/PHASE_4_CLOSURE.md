# PHASE 4 — Báo cáo đóng (MCP-40…44)

- **Quyết định**: `D-071` · **Ngày**: 2026-09-17

```
Technical gate: READY_FOR_PHASE_5_EXCEPT_PROVIDER_AND_ONLINE
Online verification: BLOCKED_BY_Q23
Go-live: NOT_READY_FOR_GO_LIVE
```

> **Cập nhật `D-072`**: UI và tích hợp **đã xong**, nên cổng chuyển từ `_EXCEPT_UI_AND_PROVIDER` sang
> `_EXCEPT_PROVIDER_AND_ONLINE`. Vẫn **không** phải `READY_FOR_PHASE_5` trần: provider tracking thật
> còn `blocked` (`Q-P4-01`) và xác minh online còn `BLOCKED_BY_Q23`. Giấu hai ngoại lệ đó sau một
> nhãn tròn trịa sẽ là nói dối về trạng thái thật.
>
> **Cập nhật `D-073` (bước xác nhận đóng)**: cổng **giữ nguyên**, nhưng lần bấm tay xác nhận đã tìm
> ra **hai lỗi** mà toàn bộ phép đo tự động bỏ sót — xem mục 8. Cả hai **đã sửa và đã có phép chặn**.
> Nếu không có bước bấm tay này, Phase 4 đã được đóng với `P4-MCP-44` chỉ là một cái nút bị làm mờ.

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
| `P4-MCP-42` Keyframe Correction | **completed** — logic + audit trail + **màn hình** (`D-072`) | bấm tay thật trên Chrome |
| `P4-MCP-43` Temporal Consistency | **completed** | ngưỡng theo frame rate thật |
| `P4-MCP-44` Quality Review Gate | **completed** — logic + **màn hình** (`D-072`) | nơi duy nhất được nói `completed`; nút tải về bị khoá khi cổng chưa qua |

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

## 6. Trạng thái sau completion patch (`D-072`)

**Đã xong:**

1. **Màn hình `P4-MCP-42` + `P4-MCP-44`** — `/jobs/[jobId]/frames`. Chọn khung hình, sửa vùng che,
   xem lý do cụ thể, nút tải về **bị khoá** khi cổng chưa qua. Đã bấm tay thật trên Chrome ở
   `1280×900` và `390×844`.
2. **Nối vào `run-video-job`** — thao tác `tracked_inpaint` chạy trọn `MCP-40 → 41 → 43 → audio → 44`
   trong worker thật, trên PostgreSQL thật.

**CHƯA xong, và không tự làm được:**

3. **Provider tracking thật** — `blocked` (`Q-P4-01`): chưa có benchmark. Cần owner duyệt trước.
4. **Xác minh online** — `BLOCKED_BY_Q23`.
5. **Ngưỡng `0.6`** vẫn là ước lượng (`Q-P4-02`), `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED = false`.

## 7. `D-073` — hai lỗi chỉ lộ ra khi có người thật bấm

Trạng thái trước mục này: `TSC/LINT/TEST/BUILD` xanh, 12/12 đối chứng âm đỏ đúng chỗ, mã sản phẩm
không đổi một byte so với `d439899`. Theo mọi phép đo tự động thì Phase 4 đã xong.

**Lỗi 1 — `P4-MCP-44` không phải cổng chặn, chỉ là quy ước của trình duyệt.** Màn hình khoá đúng nút
tải về khi cổng nói `failed`, nhưng gọi thẳng API thì:

```
GET /v1/jobs/<id>/output/download-url  →  200 + URL đã ký
GET <URL đã ký>                         →  200 + 16344 byte THẬT
```

Nguyên nhân: `run-tracked-video-job` ghi bản kết quả và đánh dấu `validated` **trước** khi hỏi cổng
chặn, nên job `review_required`/`failed` vẫn có sẵn bản kết quả đã kiểm byte — vượt qua phép kiểm
`validated` một cách hợp lệ. `validated` (bất biến `I-2`) và cổng chất lượng đo **hai điều khác
nhau**; trước `D-073` chỉ có phép kiểm thứ nhất.

Đã sửa: `createJobOutputDownloadUrl` từ chối khi `job.state !== 'completed'`, mã lỗi **mới**
`MCP_STATE_QUALITY_REVIEW_REQUIRED` (409). Đo lại trên máy chủ thật, đổi đúng một biến:

| `job.state` | HTTP | Kết quả |
|---|---|---|
| `completed` | 200 | có URL ký · tải về 16344 byte |
| `review_required` | 409 | `MCP_STATE_QUALITY_REVIEW_REQUIRED` · không URL |

**Lỗi 2 — màn hình `P4-MCP-42`/`P4-MCP-44` không có đường đi tới.** Thẻ *"Kết quả cần bạn xem lại"*
bảo người dùng xem lại, nhưng **không liên kết nào trong toàn ứng dụng** trỏ tới `/jobs/:id/frames`.
Cách duy nhất vào được là gõ tay URL — đúng thứ tôi đã làm suốt quá trình kiểm, nên tôi không nhận
ra. Đã thêm `LinkButton` ở đúng nhánh `review_required`; đã bấm thật để xác nhận đường đi thông.

**Phép chặn đi kèm, cả hai đã thử đối chứng âm:**

| Phép chặn | Gỡ lớp chặn ra ⇒ |
|---|---|
| `p2-output-download.test.ts` · 3 phép kiểm `D-073` | **3 đỏ**, 10 xanh (gồm đối chứng dương) |
| `p4-ui-contract.test.ts` · liên kết tới `/frames` | **1 đỏ**, 7 xanh |

Điểm khác biệt so với `D-070`/`D-071`/`D-072`: ba lần trước là *test thiếu*. Lần này **bộ test đã đầy
đủ và vẫn xanh hết** — vì mọi test đều đi qua cùng một cửa mà giao diện đi. Hai câu không ai hỏi:
*"nếu bỏ qua giao diện thì sao"* và *"làm sao tới được màn hình này"*.

## 8. `D-074` — hội tụ hai đường sửa keyframe (đóng `Q-P4-05`)

`Q-P4-05` ghi một điểm lệch: hàm thuần `applyCorrection` tính lại frame lân cận, đường API
`correctJobFrame` thì ghi `reinterpolated: []` và không tính gì. Yêu cầu là hội tụ.

**Đo hàm đích trước khi hội tụ** — và phép đo lộ ra hàm được chọn làm chuẩn cũng sai: timeline 7
frame với frame 2 và 4 ở `frame_low_confidence`, sửa **frame 3** một lần thì `lowConfidence: 2 → 0`
và `canComplete: false → true`. Một thao tác trên frame 3 xoá cờ review của hai frame người dùng
chưa hề nhìn. Hội tụ vào đó sẽ nhân rộng lỗi thay vì sửa.

Luật canonical mới nằm ở `planFrameCorrection` (hàm thuần, trong contract). Hai điểm **sửa hành vi**:
confidence của frame nội suy về `null` (số cũ mô tả một hộp đã đổi), và lân cận **đang bị gắn cờ**
giữ nguyên trạng thái — nội suy làm hộp mượt hơn, nó không trả lời được câu hỏi đã gắn cờ frame đó.

Ghi là **một giao dịch** (`applyCorrectionAtomically`), có phép chắn trên **cả hai** bản lưu trữ.
Migration `0011` thêm `neighbours` / `flicker_*` / `gate_verdict_*` — chỉ thêm cột, bảng vẫn
APPEND-ONLY.

**Đo lại trên hệ thống chạy thật**: sửa frame 4 → lân cận `3 · 2 · 5 · 6` được tính lại, frame 2 và
6 **giữ** cờ `frame_low_confidence`, màn hình hiện `Độ tin cậy thấp: 3 → 2` chứ không phải `0`. Sửa
tạo cú nhảy → cổng chạy lại, báo *"Vùng che nhảy bất thường — 6"*, hồ sơ ghi `0 trước · 6 sau`.

Chi tiết và 12 đối chứng âm: `D-074` và `TEST_LOG.md`.

## 9. Không đụng tới

`MEDIACLEAR_CLEANUP_ENABLED` vẫn **tắt** · `Q-23` vẫn **blocked** · go-live vẫn
**`NOT_READY_FOR_GO_LIVE`** · Rights Statement v1/v2 **không đổi một ký tự** · không ID lịch sử nào
bị đánh số lại · không ghi đè asset gốc (có test riêng ở `P4-MCP-40`).
