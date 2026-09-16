# PHASE_2_READINESS_ASSESSMENT — MediaClear Pro

- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Commit đánh giá**: `0bd8420` · **Gate hiện tại**: `READY_FOR_PHASE_2`
- **Kết luận**: **Chất lượng đủ. Đầu vào chưa đủ.** Phase 2 chưa thể bắt đầu — thiếu đề bài của
  owner và bốn quyết định chỉ owner mới trả lời được.

> Tài liệu này **không** mở Phase 2 và **không** tự đặt phạm vi cho Phase 2. Nó trả lời đúng một câu
> hỏi: *dựa trên dữ liệu thật trong repo, đứng ở đây thì đi tiếp được tới đâu?*

## 1. Cổng hiện tại có thật không

Có. Kiểm lại bằng số, không bằng trí nhớ:

| Kiểm | Số thật |
|---|---|
| Bốn lệnh kiểm chạy riêng | typecheck `0` · lint `0` · test `0` · build `0` |
| Test | **348/348 đạt**, 38 tệp |
| `git diff --check` | sạch |
| Route | `31` — 25 chạy thật · 3 trả 501 · 2 nội bộ tắt mặc định |
| Route `DELETE` | không có |
| Migration | `0001`, `0002` — không thêm bản nào |
| Khoá dịch thô | `0` · parity vi/en `252/252` |
| Kiểm live | ký thành công 1280×900 và 390×844, console sạch, không tràn ngang |

Cổng `READY_FOR_PHASE_2` là **thật**, có bằng chứng, không phải lời tự nhận.

## 2. Nhưng "sẵn sàng cho Phase 2" không có nghĩa là "Phase 2 đã có đề bài"

Trong repo **không tồn tại**: tài liệu `PHASE_2_*` nào · thư mục `docs/mini-specs/phase-2/` nào ·
MINI-SPEC nào có tiền tố `P2-`. Số hiệu `P2-MCP-23` mới chỉ là **chỗ trống đã đặt sẵn**, chưa có nội dung.

Toàn bộ năm lượt trước đều kết thúc bằng đúng một câu của owner: *"Không bắt đầu Phase 2."* Chưa lượt
nào owner gửi đề bài Phase 2.

Tự viết đề bài Phase 2 lúc này sẽ lặp lại đúng lỗi mà quy trình này đã chặn ba lần: **bịa nội dung
khi đầu vào bị thiếu**.

## 3. Bốn thứ chặn, chỉ owner trả lời được

Đây không phải việc kỹ thuật có thể tự xoay xở. Mỗi mục dưới đây quyết định **kiến trúc**, nên chọn
sai là phải làm lại.

| # | Câu hỏi | Chặn cái gì | Vì sao không tự quyết được |
|---|---|---|---|
| 1 | **Q-02** — queue/worker runtime nào cho video? | Toàn bộ pipeline xử lý thật. Hiện **không có worker nào tồn tại** | Quyết định hạ tầng chạy (và tiền hạ tầng). Chọn sai thì viết lại tầng job |
| 2 | **Q-06 + Q-07** — provider AI nào, và ai chuẩn bị bộ media mẫu để benchmark? | Việc chọn provider. Hiện `productionProviders: 0`, `productionAiProcessingEnabled: false` | Cổng chọn provider **được mã chặn**: `readyToSelectProvider` chỉ thành `true` khi **không còn ô `unknown` nào**. Cả 10×10 ô hiện đều `unknown` vì chưa chạy benchmark lần nào — mà muốn chạy thì phải có media mẫu (Q-07) |
| 3 | **Q-14** — auth provider / IdP production nào? | Thay `DevIdentityProvider` (tự khai `production: false`) | Quyết định vendor + mô hình phiên, ảnh hưởng tenancy và API |
| 4 | **Q-12** — thư viện nào đọc được dữ liệu nguồn gốc / C2PA thật? | `ProvenanceRecord` có số liệu thật thay vì `unknown` | Phụ thuộc hệ sinh thái bên ngoài, cần owner chốt mới cam kết được với người dùng |

Ngoài ra **Q-11** (BA/pháp lý duyệt câu chữ vi + en) chặn **go-live**, không chặn Phase 2.
**Q-21** không chặn — nay đã có chốt hai chiều canh giữ.

## 4. Repo tự nói Phase 2 gồm gì (không phải tôi đề xuất)

`docs/FEATURES.md` §2 đã liệt kê sẵn phần "đã có contract/schema, chưa nối vào runtime". Đây là dữ
liệu có sẵn trong repo, không phải phạm vi tôi tự đặt:

- Adapter **PostgreSQL** thật (schema đã chạy thử trên PG 16 sạch)
- Adapter **R2/MinIO** thật (port đã có)
- **Auth provider production** (Q-14)
- **Queue/worker** (Q-02)
- Ba route còn trả 501: `POST /v1/jobs/:jobId/estimate` · `POST /v1/jobs/:jobId/preview` ·
  `GET /v1/jobs/:jobId/receipt`
- **Worker tự hoàn trả khoản giữ quá hạn** và **worker dọn dữ liệu theo luật lưu giữ**
- Giao diện hiển thị hạn lưu giữ · phân trang audit · resumable upload · OpenAPI

`docs/PHASE_1_REPORT.md` §11 còn nói thẳng: *"Adapter PostgreSQL … là việc đầu tiên của phase sau"*,
kèm một cảnh báo cụ thể — **chưa có trình chạy migration**, nên chạy migration lần hai trên DB đã có
dữ liệu sẽ lỗi.

## 5. Rủi ro lớn nhất nếu cứ thế đi tiếp

**Dữ liệu vẫn nằm trong bộ nhớ.** `/healthz` tự khai `persistence: { id: 'in-memory-phase1',
durability: 'ephemeral' }`. Khởi động lại API là **mất sạch** workspace, project, asset, lời khai
quyền. Trong chính lượt kiểm hôm nay, việc này đã xảy ra **ba lần** và mỗi lần phải dựng lại dữ liệu
từ đầu.

Hệ quả cần nói thẳng: **lời khai quyền sử dụng — thứ cả Q-19, Q-20, Q-22 dựng lên để làm bằng
chứng — hiện không sống sót qua một lần khởi động lại.** Chừng nào chưa có adapter PostgreSQL, mọi
công sức về bằng chứng vẫn chỉ đúng trong một phiên chạy.

Vì vậy nếu owner muốn xếp thứ tự theo rủi ro, **adapter PostgreSQL + trình chạy migration** là việc
đáng làm trước, và nó **không phụ thuộc** bất kỳ câu hỏi nào trong §3.

## 6. Việc không bị chặn, có thể làm ngay khi owner cho phép

Hai việc dưới đây không cần trả lời Q-02/Q-06/Q-07/Q-12/Q-14. Chúng vẫn thuộc Phase 2 nên **vẫn cần
owner bật đèn xanh**, nhưng chúng không phải chờ ai:

| Việc | Vì sao không bị chặn | Rủi ro nếu hoãn |
|---|---|---|
| Adapter **PostgreSQL** + trình chạy migration | Schema đã có và đã chạy thật trên PG 16 sạch; port `PersistencePort` đã định nghĩa | Bằng chứng lời khai quyền vẫn bay theo mỗi lần khởi động lại |
| Adapter **object storage** thật (R2/MinIO) | Port `ObjectStorageAdapter` đã có, bản local đang chạy | Tệp gốc vẫn nằm trên đĩa của một máy |

Mọi việc còn lại của Phase 2 đều móc vào ít nhất một câu hỏi ở §3.

## 7. Khuyến nghị

1. **Owner gửi đề bài Phase 2** theo đúng khuôn các lượt trước (mục tiêu, phạm vi, điều cấm, định
   dạng báo cáo). Không có đề bài thì không mở Phase 2.
2. **Owner chốt Q-02 và Q-14** — hai quyết định kiến trúc, chọn sai phải làm lại.
3. **Owner chỉ định người chuẩn bị bộ media mẫu (Q-07)**, vì không có nó thì không benchmark được,
   không benchmark được thì **mã không cho phép chọn provider**.
4. Nếu muốn có tiến độ ngay trong lúc chờ ba mục trên: cho phép làm **adapter PostgreSQL + trình chạy
   migration** như MINI-SPEC `P2-MCP-23` đầu tiên.

## 8. Cho tới khi có đề bài

Gate giữ **`READY_FOR_PHASE_2`**. Không viết mã Phase 2, không tự sinh MINI-SPEC `P2-*`, không chọn
provider, không bật xử lý AI, không đụng văn bản đã ký, không tạo statement v3.
