# PHASE_3_CLOSURE — MediaClear Pro

- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Phạm vi**: `P3-MCP-30` … `P3-MCP-34` · **Quyết định**: `D-051` … `D-055`
- **Gate**: **`BLOCKED_ON_UI_AND_Q23`** (chi tiết §17)
- **Go-live**: **`NOT_READY_FOR_GO_LIVE`** — xem §18

## 1. Phạm vi thực tế đã triển khai

Pipeline video **không AI**: tải lên → proxy xem trước → chọn vùng chuẩn hoá → mask / crop / blur →
kiểm audio → đọc lại và đo lại output → biên nhận. Tất cả chạy trên `ffmpeg` thật, trên video thật.

## 2. Ánh xạ MCP-30..34

| Đề bài | Trong repo | Trạng thái |
|---|---|---|
| `MCP-30` Video Upload and Proxy Preview | `P3-MCP-30` | **hoàn thành (API)**, giao diện **chưa** |
| `MCP-31` Static Logo Mask | `P3-MCP-31` | **hoàn thành (API)**, giao diện **chưa** |
| `MCP-32` Crop and Blur Fallback | `P3-MCP-32` | **hoàn thành (API)**, giao diện **chưa** |
| `MCP-33` Audio Preservation | `P3-MCP-33` | **hoàn thành** |
| `MCP-34` Social Export Presets | `P3-MCP-34` | **hoàn thành (API)**, giao diện **chưa** |

Tên `P3-` thay vì `MCP-` trần: theo luật canonical `D-029`; `P3-MCP-30` ≠ `P2-MCP-30`. Không ID lịch
sử nào bị đổi. Ghi ở `Q-P3-09`.

## 3. Tệp/đường mã đã thay đổi

`packages/contracts/src/{schema,phase3,presets}.ts` · `job-state-machine.ts` · `entities.ts` ·
`api.ts` · `apps/api/src/media/ffmpeg.ts` · `providers/deterministic-video.ts` ·
`services/{run-video-job,video-proxy}.ts` · `run-job.ts` · `persistence/{port,in-memory,postgres,types}.ts` ·
`db/migrations/0008_*.sql` · `Dockerfile` · 5 tệp test mới + fixture video.

## 4. State machine và contract

8 trạng thái canonical **đã khớp sẵn** từ Phase 0. Thêm hai chuyển tiếp đề bài đòi: `queued → failed`
và `processing → blocked`. `completed` vẫn bị chặn bởi `TransitionContext.outputValidated` từ Phase 0.

**Contract**: một nguồn duy nhất (`JOB_STATE_SCHEMA` đọc thẳng từ `JOB_STATES`), kiểm lúc chạy tại
biên, kiểu **suy ra** từ chính lịch kiểm. **25 test**, gồm thiếu trường / sai enum / sai kiểu /
phản hồi không phải object.

## 5. Bằng chứng output verification

Byte trong kho **khớp checksum biên nhận khai**, và output **vẫn đọc được bằng `ffprobe`** sau khi
lưu. `outputVerified` chỉ `true` sau bước đọc lại (I-2).

## 6. Bằng chứng bảo toàn audio

`preserved` qua mask / blur / crop và qua **từng preset**. `absent_by_design` phân biệt rạch ròi với
`lost`. **Đối chứng âm**: ép render bỏ audio ⇒ job thành `failed` kèm `reason: audio_lost`.

## 7. Bằng chứng tệp gốc bất biến

Sau render và sau khi sinh proxy, tệp nguồn **khớp từng byte**. Bản kết quả ở lớp `output`, proxy ở
lớp `preview` — **không cái nào** chạm `source`. Tầng lưu trữ **từ chối** ghi đè `source`.

## 8. Xem trước trước khi render

Proxy sinh được, **giữ audio**, tải về được, và byte khớp kích thước đã khai.

## 9. Credit

Không có luồng credit. Mức dùng: job `completed` tính **đúng một lần**; job `blocked`/`failed`
**hoàn trả** khoản giữ — có test.

## 10. Kho lưu trữ và Q-23

**`Q-23` VẪN MỞ. Tài liệu này KHÔNG đóng nó.** Bản online vẫn `local-fs-phase1`.

**`blocked_by_Q23`**: (a) proxy/output sống sót qua một lần deploy lại; (b) worker chạy **tiến
trình/container riêng** đọc được tệp do API ghi. Không tự tạo bucket, không tự điền khoá.

## 11. Trạng thái provider

`deterministic-video`: **`partially_verified`** — xử lý byte thật, có test, nhưng `getResult` trả
`outputUrl: null` vì chạy trong tiến trình. **Không provider AI nào được gọi.**
`productionAiProcessingEnabled` vẫn **`false`**.

## 12. Câu chữ

**`unknown` (Q-P3-08).** Phase 3 thêm 5 khoá nhãn preset (`preset.*`), **chưa khoá nào được owner
duyệt** — cộng với ~30 khoá chưa duyệt của Phase 2 (Q-11).

## 13. Lệnh kiểm và số test

| Lệnh | Mã thoát |
|---|---|
| `pnpm typecheck` | `0` |
| `pnpm lint` | `0` |
| `pnpm test` (có PostgreSQL + MinIO) | `0` — **58 tệp · 624 test đạt** |
| `pnpm build:web` | `0` |
| `git diff --check` | sạch |

Phase 3 thêm **77 test**. Chạy riêng từng lệnh.

## 14. Xác minh desktop/mobile

**CHƯA CHẠY.** Chưa có giao diện Phase 3 nên không có gì để bấm. **Không báo pass.**

## 15. Negative controls — đã chạy thật

| Đối chứng | Kết quả |
|---|---|
| Làm mất audio sau render | **đỏ** — `failed`, `reason: audio_lost` |
| Bỏ cổng audio | **đỏ** — bắt tại `audioVerdict` ('lost' ≠ 'preserved') |
| Preset khai `verified` | **đỏ** — 3 test |
| Enum giao diện lệch enum máy chủ | **đỏ** — bỏ `review_required` khỏi `JOB_STATES` |
| Ghi đè tệp gốc | **bị chặn** ở tầng lưu trữ |

Sau mỗi lần, implementation **đã được khôi phục** và toàn bộ suite chạy lại **xanh**.

## 16. Giới hạn đã biết

- **Chưa có giao diện Phase 3** — mục lớn nhất còn thiếu.
- Proxy có thể **lớn hơn** bản gốc với video rất nhỏ (đo được: 12261 > 9658 byte).
- **Không bám chuyển động**: logo ra khỏi vùng mask sẽ không được che, hệ thống **không tự phát hiện**.
- **Chưa so nội dung tiếng** — chỉ so hiện diện + thời lượng + codec.
- Dung sai audio `0,25s` **chưa được owner duyệt**.
- Preset **không có bằng chứng tuân thủ nền tảng**.
- **25 interface giao diện tự khai** ở màn hình cũ vẫn ngoài phạm vi D-051.
- Chưa dọn proxy/phiên quá hạn; chưa retry có backoff.
- `blocked_by_Q23`: mọi xác minh online.

## 17. Gate

**`BLOCKED_ON_UI_AND_Q23`** — không phải `READY_FOR_PHASE_4`.

Đề bài nói rõ: *"Chỉ nếu toàn bộ acceptance criteria đạt mới đề xuất `READY_FOR_PHASE_4`"*. Hai tiêu
chí **chưa đạt**:

1. *"Người dùng chọn được vùng xử lý"*, *"Preview hoạt động trước render"*, *"Có reset về file gốc"*
   — đều là tiêu chí **giao diện**, và **chưa có giao diện Phase 3**. Tầng API đã sẵn sàng.
2. *"Live verification chỉ được báo pass khi thực sự chạy được"* — xác minh online **`blocked_by_Q23`**.

Khai `READY_FOR_PHASE_4` lúc này là tuyên bố một thứ chưa đo được.

## 18. Gate này KHÔNG phải GO_LIVE

**Khẳng định riêng**: `NOT_READY_FOR_GO_LIVE` **giữ nguyên**. Bốn blocker go-live **đều còn**:
kho object dùng chung (Q-23) · ~35 khoá câu chữ chưa duyệt · dấu vết AI vẫn `unknown` · chưa có việc
dọn dữ liệu nào chạy thật.
