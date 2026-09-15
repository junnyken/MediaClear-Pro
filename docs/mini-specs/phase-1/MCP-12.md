# MCP-12 — Media Intake Validation (Phase 1)

- **ID**: `MCP-12` · **Parent phase**: Phase 1 — SaaS Shell & Media Intake Foundation
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-15

## Context

Đọc: như `MCP-10` (Phase 1) + `docs/mini-specs/MCP-03.md` (Phase 0) + `config.ts` + `media-limits.ts`.
Trạng thái: `validateMedia(probe)` **đã có và đã đúng** (10 test biên). Thứ đang thiếu là **probe thật**:
Phase 0 chưa bao giờ đọc một file thật nào — `MediaProbe` luôn do test dựng tay.
Quyết định phải giữ: giới hạn đọc từ `config.ts`; biên **inclusive**; thiếu số đo → `*_UNKNOWN`,
tuyệt đối không đoán; `null` không được coi là hợp lệ.

## Goal

Biến `validateMedia` từ hàm ăn số liệu do người khác đưa thành cổng chặn **đọc số đo từ chính byte của
file người dùng tải lên**, để media không hợp lệ bị chặn trước khi chạm bất kỳ ranh giới xử lý nào.

## Constraints (Guardrails)

1. Không hard-code lại bất kỳ giới hạn nào — chỉ đọc `config.ts`.
2. Không tin `mimeType` do client khai: phải đối chiếu magic bytes → lệch thì `MCP_VAL_MIME_MISMATCH`.
3. Đọc không được số đo → `MCP_VAL_DURATION_UNKNOWN` / `MCP_VAL_DIMENSION_UNKNOWN`, **không** mặc định pass.
4. Không phụ thuộc binary ngoài (ffprobe/ImageMagick) ở runtime — parser thuần TypeScript.
5. Validation phải chạy **trước** mọi đường tạo job (không có đường vòng).
6. File hỏng/đọc dở → `MCP_VAL_CORRUPT_MEDIA`, không nuốt lỗi.
7. Không đọc toàn bộ file vào RAM khi chỉ cần header.

## Scope

**A. Domain model** — tái dùng `MediaProbe`, `ValidationResult`. Thêm `ValidationRecord` ở tầng app
(kết quả lần validate gần nhất của một asset: trạng thái + danh sách mã lỗi + thời điểm).

**B. Services/engine** — `MediaProbeAdapter` port; `HeaderMediaProbe`: PNG (IHDR), JPEG (SOFn),
WebP (RIFF/VP8|VP8L|VP8X), MP4/MOV (ISO-BMFF `moov` → `mvhd` timescale/duration, `tkhd` width/height),
WebM (EBML → `Info.Duration`×`TimecodeScale`, `Video.PixelWidth/PixelHeight`).

**C. API contract** — `POST /v1/assets/:assetId/validate` (đã có trong bảng Phase 0, nay `implemented`).

**D. UI surfaces** — Upload validation result: hiện rõ ĐẠT/KHÔNG ĐẠT, lý do theo từng mục
(format / dung lượng / thời lượng / chiều rộng / chiều cao) và hành động tiếp theo; hiển thị
giới hạn **đọc từ config**, không gõ tay.

**E. Tests** — unit trên **file thật** (sinh bằng ffmpeg/PIL, commit làm fixture nhỏ): PNG/JPEG/WebP,
MP4/MOV/WebM, file rỗng, file hỏng, mime lệch; biên 199 MB / 599 s / 3840 px.

## Audit Before Build

| Đã kiểm | Kết luận |
|---|---|
| `validateMedia()` | Đúng, phân biệt đủ 5 nhóm lỗi. **Không sửa logic.** |
| `MEDIA_LIMITS` | Chỉ là view của config. Dùng cho UI. |
| Mã lỗi | 12 mã validation đã có, đủ dùng, không thêm mã mới. |
| Fixture | Repo **chưa có file media nào** → phải sinh fixture thật. |

**Gap** (observability/metrics): chưa lưu kết quả validate → UI không biết asset đã qua cổng chưa.
**Gap** (state machine): chưa nối "validate fail" vào lý do chặn job.

## Design Choice

Parser thuần TS đọc **header** (đọc từng khối, không nạp cả file). Lý do: không ràng buộc hạ tầng vào
ffmpeg, chạy được trong test/CI, và kiểm chứng được bằng file thật do ffmpeg sinh ra. Bỏ hướng gọi
`ffprobe` vì tạo phụ thuộc nhị phân bên ngoài cho một bước nằm trên đường chặn bảo mật.
Biên 199 MB được kiểm bằng **số byte thật của file trên đĩa**, không dựng `byteSize` giả.

## Test Plan

- Unit: mỗi định dạng ra đúng width/height/duration so với `ffprobe` (đối chứng ngoài, chỉ trong test).
- Boundary: < 199 MB · = 199 MB · > 199 MB; 599 s nhận · 600 s từ chối; 3840 nhận · >3840 từ chối.
- Integration: upload file thật → validate → asset chuyển trạng thái đúng.
- Regression: R-5 (asset invalid không tạo được job); không đường nào còn dùng 200 MB / 10 phút.
- Live: upload một ảnh và một video thật qua HTTP rồi đọc kết quả.

## Success Criteria

- Mọi giới hạn lấy từ config tập trung.
- Validation chạy trước ranh giới tạo job, không bypass được.
- Mã lỗi có i18n vi/en.
- Số đo sai/không đọc được không bao giờ biến thành "hợp lệ".

## Remaining Limits / Follow-ups

- Chưa đọc EXIF/C2PA (Q-12 còn mở) — provenance vẫn `unknown`.
- Codec bên trong container không được kiểm (mp4 chứa codec lạ vẫn qua nếu header hợp lệ).
- Video có nhiều track: lấy track video đầu tiên; đa track là giới hạn đã biết.
