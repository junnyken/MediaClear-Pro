# PHASE_3_CLOSURE — MediaClear Pro

- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Phạm vi**: `P3-MCP-30` … `P3-MCP-34` · **Quyết định**: `D-051` … `D-055`
- **Gate**: **`READY_FOR_PHASE_4_EXCEPT_ONLINE`** (chi tiết §17)
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

**Đã rà (`Q-P3-08` đóng, `D-059`).** Owner giao agent rà; agent đã rà **77 khoá** thêm từ `170b244`
bằng **5 phép kiểm chạy được** — xem `docs/WORDING_REVIEW_P3.md`. Tìm và sửa **1 lỗi thật** (lọt
thuật ngữ `C2PA` ra màn hình người dùng), mở rộng phép chắn thuật ngữ, có đối chứng âm.

**Vẫn còn nguyên**: câu chữ **xác nhận quyền** (`Q-11`) — có sức nặng pháp lý, cần người chịu trách
nhiệm đọc và duyệt; agent **không thay thế được**. `Rights Statement v1/v2` không bị đụng vào.

## 13. Lệnh kiểm và số test

| Lệnh | Mã thoát |
|---|---|
| `pnpm typecheck` | `0` |
| `pnpm lint` | `0` |
| `pnpm test` (có PostgreSQL + MinIO) | `0` — **59 tệp · 636 test đạt** |
| `pnpm build:web` | `0` |
| `git diff --check` | sạch |

Phase 3 thêm **85 test**. Chạy riêng từng lệnh.

## 14. Xác minh desktop/mobile — ĐÃ CHẠY THẬT

Bấm tay trên Chrome thật, tài khoản mới, video thật đi hết luồng:
trang tệp nhận đúng là video → **"Làm sạch video"** → tạo bản xem trước → **phát thử** →
chọn cách xử lý + vùng + khung hình → bắt đầu → worker chạy → job `completed` → tải kết quả.

| Khổ màn hình | Tràn ngang | Chữ bị cắt | Khoá dịch thô | Console |
|---|---|---|---|---|
| **1280×900** | `0` | `0` | không | **không lỗi/cảnh báo** |
| **390×844** | `0` | `0` | không | **không lỗi/cảnh báo** |

15 phần tử focus được bằng bàn phím; hai nhóm chọn có `role="radiogroup"` kèm nhãn nên trình đọc
màn hình đọc được *"Cách xử lý"* và *"Khung hình khi xuất"*; cảnh báo dùng `role="alert"`.

**Nút "Bắt đầu xử lý" bị KHOÁ khi chưa có bản xem trước** — đúng yêu cầu *"preview trước render"*.

### Ba lỗi chỉ bấm tay mới thấy

1. **Bản xem trước không phát được** — `<video src>` trỏ thẳng vào `/proxy/download-url`, mà route
   đó trả **JSON chứa URL**, không trả byte. Trình duyệt báo *"Unable to play media"*. Xem trước mà
   không phát được thì mất hẳn ý nghĩa. Sửa: lấy URL đã ký rồi mới gán vào `<video>`.
2. **Khoá dịch thô lọt ra màn hình**: `provenance.limitation.no_video_metadata_reader` do **máy chủ**
   sinh ra, không có chuỗi tĩnh nào trong `apps/web` nên test khoá dịch cũ **không chạm tới**. Đã
   thêm bản dịch **và** một phép chắn mới quét khoá do máy chủ sinh (có đối chứng âm).
3. **Ô nhập bị cắt chữ ở khổ 390**: `width: 100%` **cộng** padding 24px và viền 2px mà thiếu
   `box-sizing: border-box` ⇒ dôi đúng 26px (`scrollWidth 304 > clientWidth 278`). Lỗi nằm ở
   **component dùng chung** nên ảnh hưởng **mọi form** của ứng dụng, không riêng Phase 3.

## 15. Negative controls — đã chạy thật

| Đối chứng | Kết quả |
|---|---|
| Làm mất audio sau render | **đỏ** — `failed`, `reason: audio_lost` |
| Bỏ cổng audio | **đỏ** — bắt tại `audioVerdict` ('lost' ≠ 'preserved') |
| Preset khai `verified` | **đỏ** — 3 test |
| Enum giao diện lệch enum máy chủ | **đỏ** — bỏ `review_required` khỏi `JOB_STATES` |
| Ghi đè tệp gốc | **bị chặn** ở tầng lưu trữ |
| **Ép stereo → mono** (`-ac 1`) | **đỏ** — cổng số kênh bắt được (`D-057`) |

Sau mỗi lần, implementation **đã được khôi phục** và toàn bộ suite chạy lại **xanh**.

## 16. Giới hạn đã biết

- Proxy có thể **lớn hơn** bản gốc với video rất nhỏ (đo được: 12261 > 9658 byte).
- **Không bám chuyển động**: logo ra khỏi vùng mask sẽ không được che, hệ thống **không tự phát hiện**.
- **Chưa so nội dung tiếng** — chỉ so hiện diện, thời lượng, và **số kênh** (`D-057`). Một bản giữ đúng độ dài và đúng số kênh nhưng **tiếng bị méo** vẫn lọt qua.
- Dung sai audio `0,25s` **nay có cơ sở đo được** (≈11× biên độ lớn nhất, xem `D-056`) nhưng vẫn là giá trị agent chọn — owner đổi được bằng một hằng số.
- Preset **không có bằng chứng tuân thủ nền tảng**.
- ~~25 interface giao diện tự khai ngoài phạm vi D-051~~ — **đã đóng hoàn toàn** (`D-058`): 0 lời gọi chưa kiểm trên toàn giao diện, kèm chốt chặn tái phát + đối chứng âm.
- Chưa dọn proxy/phiên quá hạn; chưa retry có backoff.
- `blocked_by_Q23`: mọi xác minh online.

## 17. Gate

**`READY_FOR_PHASE_4_EXCEPT_ONLINE`.**

Toàn bộ tiêu chí **Definition of Done** của đề bài **đã đạt**, trừ đúng một mục **không phụ thuộc
vào Phase 3**:

| Tiêu chí | Kết quả |
|---|---|
| Người dùng chọn được vùng xử lý | ✅ |
| Preview hoạt động trước render/export | ✅ (nút bắt đầu bị khoá tới khi có preview) |
| Mask / crop / blur đúng phạm vi | ✅ |
| Audio giữ được, hoặc cảnh báo rõ | ✅ |
| Tệp gốc không bị ghi đè · có reset về tệp gốc | ✅ |
| Output chưa verify không hiện completed | ✅ |
| Failed job không tính như completed | ✅ |
| UI/server dùng chung contract + kiểm lúc chạy | ✅ |
| Không còn raw translation key trong UI Phase 3 | ✅ (sau khi sửa 1 lỗi) |
| Regression Phase 1.1 vẫn pass | ✅ |
| Typecheck · lint · test · build · diff | ✅ |
| **Live verification online** | ❌ **`blocked_by_Q23`** |

Vì vậy **không** khai `READY_FOR_PHASE_4` trần: mục cuối chưa đo được và **chỉ mở được khi owner
cấp kho object dùng chung**. Đây là chặn **bên ngoài Phase 3**, không phải thiếu sót của Phase 3.

## 17b. Câu hỏi mở — đã đo, không đoán (`D-056`)

**Năm câu đã trả lời bằng đo**: `Q-P3-01` (giới hạn video) · `Q-P3-02` (codec/container thật:
họ MP4 · `h264` · `aac`) · `Q-P3-03` (dung sai audio có cơ sở) · `Q-P3-06` (**chưa** dọn dữ liệu lần
nào, và **không có** lệnh xoá nào trong mã) · `Q-P3-07` (**0** provider dùng AI).

**`Q-P3-08` và `Q-P3-09` nay đã chốt** (`D-059`): owner giao agent rà câu chữ và xác nhận quy ước ID.

**Hai câu còn mở, mỗi câu có lý do cụ thể**: `Q-P3-04` cần dữ liệu **từ chính nền tảng** ·
`Q-P3-05` cần **kho object của owner**. Không câu nào mở vì chưa ai đi tìm.

## 18. Gate này KHÔNG phải GO_LIVE

**Khẳng định riêng**: `NOT_READY_FOR_GO_LIVE` **giữ nguyên**. Bốn blocker go-live **đều còn**:
kho object dùng chung (Q-23) · ~35 khoá câu chữ chưa duyệt · dấu vết AI vẫn `unknown` · chưa có việc
dọn dữ liệu nào chạy thật.
