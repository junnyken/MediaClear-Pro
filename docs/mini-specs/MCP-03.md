# MCP-03 — Media Limits & Validation Contract

| | |
|---|---|
| **ID** | MCP-03 · **Parent phase** Phase 0 |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: `PRODUCT_SCOPE.md` §3, `DATA_MODEL.md` §4, `MCP-01`.
- Spec chốt: video **dưới 10 phút**, file **dưới 200 MB**. Không nói gì về định dạng và pixel.

## Goal
Chốt giới hạn ảnh/video, format, duration, size, validation error và state transition — để không
bao giờ có file "lọt" vào pipeline chỉ vì hệ thống chưa đo được thuộc tính của nó.

## Constraints
1. "Dưới" nghĩa là **strict less-than**: đúng 600 giây và đúng 209.715.200 bytes đều bị từ chối.
2. Không đo được (`duration`/`dimension` = `null`) → **không pass**, trả mã `*_UNKNOWN`.
3. Trả về **tất cả** lỗi, không dừng ở lỗi đầu tiên (người dùng sửa một lần).
4. Không đổi nghĩa state nào trong `JobState`.
5. Giới hạn chỉ định nghĩa một nơi (`MEDIA_LIMITS`), UI đọc lại từ đó chứ không hard-code.

## Scope
- **A. Domain model**: `MediaProbe`, `ValidationResult`, `MEDIA_LIMITS`.
- **B. Services/engine**: `validateMedia()`; `canTransition()`; `canSubmitProviderJob()`.
- **C. API contract**: `POST /v1/uploads`, `POST /v1/assets/:assetId/validate`,
  `GET /v1/jobs/:jobId` (đều `planned`).
- **D. UI surfaces**: màn "Kiểm tra tệp tải lên" nêu rõ lý do từ chối bằng ngôn ngữ thường.
- **E. Tests**: 7 test biên giới hạn + 7 test state machine.

## Audit Before Build
- Đã kiểm: không có giới hạn upload nào tồn tại (`MCP-00`), không có state machine nào.
- Gap **state machine**: cần chốt transition hợp lệ + guard cho `completed`.
- Gap **vocabulary**: cần mã lỗi riêng cho "không đo được" để phân biệt với "vượt giới hạn" — nếu
  dùng chung mã, sau này không phân biệt được lỗi người dùng với lỗi hệ thống đo.

## Design Choice
Hàm thuần `validateMedia(probe)` tách hẳn khỏi I/O: tầng trên chịu trách nhiệm probe file thật
(ffprobe/exif ở Phase 1), tầng này chỉ phán xét. Nhờ vậy test biên chạy được ngay hôm nay mà không
cần file thật. State machine đặt guard cứng tại `→ completed` (bắt buộc `outputAssetId` +
`outputValidated`), để invariant I-2 không phụ thuộc vào kỷ luật của người viết service.

## Test Plan
- **Unit**: 599.9 / 600 / 600.1 giây; 209.715.199 / 209.715.200 bytes; file rỗng; file hỏng;
  format ngoài allowlist (ảnh + video); ảnh quá lớn/quá nhỏ/không đo được; gộp nhiều lỗi.
- **Regression**: bảng transition phủ hết `JOB_STATES`; terminal không có lối ra;
  `uploaded → completed` bị chặn; `completed` không có output verified bị chặn.
- **Integration / Live**: `planned`.

## Success Criteria
1. Không tồn tại đường nào đưa job sang `completed` mà chưa có output verified.
2. File không đo được thuộc tính **không bao giờ** đi tiếp.
3. Đổi một con số giới hạn chỉ cần sửa `MEDIA_LIMITS`.

## Remaining Limits
- Chưa có giới hạn pixel cho video (`unknown`, Q-03).
- Chưa kiểm tra codec bên trong container (mp4 có thể chứa codec lạ) — `planned`.
- Chưa có probe thật; `MediaProbe` hiện do caller cung cấp.
