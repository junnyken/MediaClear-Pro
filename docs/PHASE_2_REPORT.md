# PHASE_2_REPORT — MediaClear Pro

- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Commit chốt**: `98697ff` · **Phạm vi**: `P2-MCP-23` … `P2-MCP-35` (13 MINI-SPEC, 20 commit)
- **Quyết định**: `D-037` … `D-050`
- **Gate**: **`READY_FOR_PHASE_3`** về kỹ thuật · **`NOT_READY_FOR_GO_LIVE`**

> Hai kết luận này **khác nhau và đều đúng**. Tách chúng ra là nội dung chính của báo cáo này: đi
> tiếp được không, và mở cho người dùng thật được chưa, là hai câu hỏi riêng.

## 1. Phase 2 đã làm gì

Phase 1 để lại một hệ thống **không lưu được gì qua lần khởi động lại** và **không job nào chạy**.
Phase 2 đóng cả hai.

| Mục | Kết quả |
|---|---|
| `P2-MCP-23` | Adapter PostgreSQL + trình chạy migration có tổng kiểm |
| `P2-MCP-24` | Object storage S3-compatible (kiểm trên MinIO thật) |
| `P2-MCP-25` | Mật khẩu `scrypt` + phiên lưu database (sống sót khởi động lại) |
| `P2-MCP-26` | Một ảnh Docker **ba vai** `api` / `web` / `worker` |
| `P2-MCP-27` | **Xử lý ảnh tất định** bằng libvips — job lần đầu tới `completed` |
| `P2-MCP-28` | **Worker tự chạy job** (`FOR UPDATE SKIP LOCKED` trên PostgreSQL) |
| `P2-MCP-29` | **Tải bản kết quả về** |
| `P2-MCP-30` | Đo dấu vết nguồn gốc trên byte thật + **biên nhận xử lý** |
| `P2-MCP-31` | Ước tính mức dùng + xem trước — **hết route 501** |
| `P2-MCP-32` | Phân trang nhật ký kiểm toán |
| `P2-MCP-33` | Giao diện cho xem trước · biên nhận · hạn lưu giữ |
| `P2-MCP-34` | Tài liệu OpenAPI sinh từ bảng route |
| `P2-MCP-35` | **Tải lên nối lại được** sau khi mất kết nối |

**Số đo tại thời điểm chốt:** 53 tệp test · **547 test đạt** (có PostgreSQL + MinIO thật) ·
typecheck `0` · lint `0` · build `0` · 18 bảng · `/healthz`: `routes=42 implemented=38 **planned=0**`.

## 2. Bốn phát hiện quan trọng hơn cả tính năng

**1. `evidenceStatus` khai `verified` cho phép đo chưa từng chạy (`D-044`).**
`evaluatePreservation()` của Phase 0 gộp `'unknown'` với `'absent'`. Đo thật cho ra: `ai trước=unknown,
sau=absent` ⇒ `preserved / verified` — tức là bộ đo **đã thấy dấu vết AI biến mất** mà hệ thống vẫn
đóng dấu "đã kiểm chứng: giữ nguyên". Vì không đọc được C2PA nên bộ đo thật **luôn** trả `unknown`,
nghĩa là **mọi biên nhận** sẽ mang lời khai không có cơ sở. 8 test cũ không ca nào chạm tới `'unknown'`.

**2. Tệp đã xử lý xong nhưng không đường nào lấy được (`D-043`).**
Sau `P2-MCP-27/28`, job tới `completed` và tệp nằm trong kho — nhưng bảng route **không có** đường nào
tới nó, và đường tải duy nhất luôn trả tệp **nguồn**. Sản phẩm coi như không dùng được. Danh sách
"việc còn lại" do chính agent lập **đã thiếu mục này**.

**3. Bốn lỗi giao diện mà 528 test + `tsc` + `eslint` đều không bắt (`D-048`).**
Chỉ mở Chrome thật và bấm mới thấy: tệp 5,4 KB hiện **"0 MB"**; câu cho người dùng là **chuỗi tiếng
Việt không dấu** lấy thẳng từ mã nguồn; nút "Tải tệp kết quả" **mở ảnh trong tab** thay vì tải; mốc
thời gian dạng ISO thô.

**4. Kiểu của giao diện và kiểu của máy chủ là hai khai báo rời nhau (`D-047`).**
`apiFetch<T>` chỉ là **khẳng định kiểu**. Đổi hình dạng response của một route khiến trang Hoạt động
hỏng **lúc chạy** và hiện rỗng **không báo lỗi gì**, trong khi `tsc` hai bên đều xanh. **Lỗ hổng này
còn nguyên** — chưa có gì buộc hai khai báo khớp nhau.

## 3. Vì sao `READY_FOR_PHASE_3` về kỹ thuật

- Mọi bất biến cốt lõi **được kiểm bằng phép đo, không bằng lời**: I-1 (tệp gốc nguyên vẹn từng byte),
  I-2 (đọc lại trước khi báo xong), I-12 (xem trước không tính tiền), không double-charge (3 worker
  song song trên PostgreSQL thật, đúng một bút toán).
- **Không route nào còn trả 501.** Không còn tính năng nào "có contract mà chưa có runtime" trong
  phạm vi Phase 2.
- Bộ test **hai adapter** đã bắt được lệch thật giữa in-memory và PostgreSQL (thứ tự nhật ký).
- Mỗi mục đều có **đối chứng âm** đã chạy, chứng minh phép thử có thể đỏ.
- Nền tảng cho Phase 3 đã có: hàng đợi, worker, biên nhận, provenance, OpenAPI.

## 4. Vì sao `NOT_READY_FOR_GO_LIVE`

Bốn thứ chặn, xếp theo mức nghiêm trọng:

**1. Bản online KHÔNG có kho object dùng chung (Q-23).**
`/healthz` của bản đang chạy khai `storage: local-fs-phase1`. Hệ quả **đã đo, không phải suy đoán**:
tệp người dùng tải lên **mất mỗi lần deploy lại**, và **không deploy được worker** — worker ở container
khác sẽ có đĩa rỗng, nhận job rồi hỏng ngay. Đây là mục chặn nặng nhất.

**2. Câu chữ chưa được duyệt (Q-11).**
Phase 2 thêm **~30 khoá i18n do agent viết** và **chưa khoá nào được owner/BA duyệt**. Thêm ~20 nhãn
loại sự kiện chưa ai viết (Q-24).

**3. Không đọc được dấu vết AI (Q-12).**
Phần "dấu vết AI" của **mọi** biên nhận là `unknown`. Với một sản phẩm bán lời hứa về nguồn gốc, đây
là giới hạn phải nói rõ với người dùng trước khi mở.

**4. Chưa có việc dọn dữ liệu nào chạy thật.**
Luật lưu giữ **chưa từng xoá tệp nào** (chỉ có bản thử đếm). Khoản giữ mức dùng quá hạn chưa có worker
tự chạy. Phiên tải lên quá hạn để lại mảnh thừa không ai dọn.

## 5. Nợ kỹ thuật đã ghi, không mục nào bỏ lửng

| Nợ | Ở đâu |
|---|---|
| Worker chưa retry có backoff, chưa cứu job kẹt ở `processing` | `P2-MCP-28` |
| Bản kết quả không có `lastAccessedAt` ⇒ luật lưu giữ lớp `output_asset` chưa tính được | `P2-MCP-29` |
| Video chưa đo được metadata | `P2-MCP-30` |
| Xem trước chưa có giới hạn tần suất (vẫn tốn CPU thật) | `P2-MCP-31` |
| Nhật ký chưa có lọc theo loại/người/thời gian | `P2-MCP-32` |
| Chưa kiểm bằng trình đọc màn hình, chưa kiểm màn hình nhỏ | `P2-MCP-33` |
| OpenAPI không có schema thân request/response (cố ý) | `P2-MCP-34` |
| Ghép tệp trong bộ nhớ, chưa checksum từng mảnh, giao diện chưa dùng đường tải nối lại | `P2-MCP-35` |
| **Kiểu giao diện ↔ kiểu máy chủ không có gì buộc khớp** | `D-047` |

## 6. Điều kiện để mở cổng go-live

1. Owner cấp thông tin kho object S3-compatible (Q-23) ⇒ gắn cho API + worker, deploy worker, và
   **kiểm lại toàn bộ luồng trên bản online** — không phải chỉ local.
2. Owner/BA duyệt ~30 khoá câu chữ mới + viết ~20 nhãn loại sự kiện (Q-11, Q-24).
3. Chốt Q-12 (bộ đọc C2PA) **hoặc** owner chấp nhận rằng biên nhận sẽ nói "chưa đo được dấu vết AI".
4. Có ít nhất một worker dọn dữ liệu **chạy thật một lần** và được ghi vào `TEST_LOG.md`.

## 7. Tài liệu này KHÔNG làm gì

Nó **không** mở Phase 3 và **không** tự đặt phạm vi cho Phase 3. Nó chốt Phase 2 và nói rõ đứng ở đây
thì đi tiếp được tới đâu. Phạm vi Phase 3 là đề bài của owner.
