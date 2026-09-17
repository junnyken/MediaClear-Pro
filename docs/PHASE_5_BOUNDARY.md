# PHASE 5 — Ranh giới phạm vi

- **Ngày**: 2026-09-17, cập nhật 2026-09-18 · **Quyết định**: `D-073`, `D-075`
- **Trạng thái**: `STARTED` (2026-09-18, `D-075`) — xem `PHASE_5_CLOSURE.md`

```
Phase 5 code written:   YES   (D-075)
Phase 5 migrations:     0012_phase5_provenance_brand
Phase 5 routes:         7  (/v1/assets/:assetId/provenance, /v1/jobs/:jobId/metadata, /v1/brand-kits*)
Phase 5 ID:             P5-MCP-50 … P5-MCP-54  (Q-P5-01: owner chua xac nhan quy uoc)
```

> Tài liệu này **giữ nguyên** làm ranh giới gốc. Phần dưới là những gì đã vạch ra **trước khi** viết
> dòng mã đầu tiên — đọc nó cạnh `PHASE_5_CLOSURE.md` để thấy cái gì đã làm đúng như dự kiến và cái
> gì không.

> Tài liệu này tồn tại để trả lời **"cái gì KHÔNG thuộc Phase 4"**, chứ không phải để bắt đầu Phase 5.
> Đọc nó như một danh sách việc **chưa làm**, không phải một kế hoạch đã duyệt.

---

## 1. Năm mục dự kiến

Đánh số theo luật canonical `D-029` (ID là **chuỗi đầy đủ**, nên `P5-MCP-50` không đụng ID nào cũ).
**Chưa mục nào được owner duyệt.**

| ID dự kiến | Tên | Một câu mô tả | Phụ thuộc cứng |
|---|---|---|---|
| `P5-MCP-50` | Provenance Inspector | Cho người dùng **xem** những gì `Q-12` đã đọc được trên tệp của họ | `detectC2pa` đã có (`D-069`) |
| `P5-MCP-51` | Preserve Metadata Pipeline | **Giữ lại** metadata gốc qua quá trình xử lý thay vì để ffmpeg vứt đi | cần đo trước: hiện đang mất những gì |
| `P5-MCP-52` | Processing Receipt | Biên nhận đọc được cho **một chuỗi nhiều lượt xử lý**, không chỉ một lượt | biên nhận một lượt đã có (`P2-MCP-30`) |
| `P5-MCP-53` | Brand Kit | Bộ vùng che dùng lại được giữa các lượt xử lý | không |
| `P5-MCP-54` | AI Disclosure Overlay | Nhãn hiển thị *"tệp này đã qua xử lý"* theo yêu cầu công bố | **`Q-11` — chưa có luật sư duyệt** |

## 2. Phải chốt TRƯỚC khi viết dòng mã Phase 5 đầu tiên

Bốn mục dưới đây không phải thủ tục — mỗi mục đều có thể làm hỏng thiết kế nếu bỏ qua:

1. **`Q-23` vẫn `blocked`.** Chưa có kho object dùng chung ⇒ chưa xác minh online được **bất cứ thứ
   gì**, kể cả Phase 4. Xây thêm tầng lên trên một nền chưa đo được là nhân đôi phần chưa đo.
2. **Provider tracking thật vẫn `blocked`** (`Q-P4-01`). `P5-MCP-51` (giữ metadata) chạm đúng đường
   render mà provider thật sẽ thay thế.
3. **`Q-11` chưa có luật sư duyệt.** `P5-MCP-54` là **câu chữ pháp lý hiển thị cho người dùng cuối**
   — làm trước khi có người duyệt là tạo ra rủi ro pháp lý dưới dạng mã.
4. **`P5-MCP-50` phải nói đúng phạm vi của `Q-12`.** Bộ đọc hiện tại chỉ trả lời *"có dấu hiệu
   manifest hay không"* — **không** kiểm chữ ký, **không** xác thực chuỗi tin cậy. Một màn hình
   khiến người dùng hiểu thành *"đã xác thực"* sẽ tệ hơn là không có màn hình nào.

## 3. Ranh giới cứng — mang từ Phase 4 sang, không nới

- Guardrail 4 **không đổi**: không phát hiện/gỡ dấu ẩn (SynthID…). `P5-MCP-50` chỉ **đọc** manifest
  công khai trong container.
- Không route DELETE mới, không đường xoá dữ liệu destructive nào ngoài `D-070` đã có.
- `MEDIACLEAR_CLEANUP_ENABLED` vẫn **tắt** cho tới khi owner bật.
- Rights Statement v1/v2 **không sửa**; muốn đổi thì tạo version mới và phải có người duyệt.
- Không đánh số lại ID lịch sử.

## 4. Hai bài học Phase 4 phải mang sang

Từ `D-073`, vì cả hai đều tốn một lượt closure mới lộ ra:

1. **Mỗi cổng chặn phải có phép chặn hỏi "nếu bỏ qua giao diện thì sao".** `P4-MCP-44` từng chỉ là
   một cái nút bị làm mờ trong khi API vẫn giao tệp.
2. **Mỗi màn hình mới phải có phép chặn hỏi "người dùng đi tới đây bằng cách nào".** Màn hình kiểm
   khung hình từng chạy hoàn hảo mà không liên kết nào trỏ tới.
