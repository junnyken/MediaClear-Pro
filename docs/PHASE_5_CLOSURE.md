# PHASE 5 — Báo cáo đóng (MCP-50…54)

- **Quyết định**: `D-075` · **Ngày**: 2026-09-18

```
Phase 5 technical gate: READY_FOR_PHASE_6_EXCEPT_PROVIDER_AND_ONLINE
Provider:               BLOCKED_BY_Q-P4-01
Online verification:    BLOCKED_BY_Q23
Go-live:                NOT_READY_FOR_GO_LIVE
```

> Không phải `READY_FOR_PHASE_6` trần: dịch vụ xử lý thật còn `blocked` và xác minh online còn
> `BLOCKED_BY_Q23`. Giấu hai ngoại lệ đó sau một nhãn tròn trịa sẽ là nói dối về trạng thái thật.

---

## 1. Trạng thái từng MCP

| MCP | Trạng thái | Bằng chứng |
|---|---|---|
| `P5-MCP-50` Provenance Inspector | **`verified`** | 7 mục truy ngược trên job thật, 0 mục mồ côi, bấm tay ở `1280×900` + `390×844` |
| `P5-MCP-51` Preserve Metadata | **`verified`** | 15 trường/ảnh chụp trên tệp thật; `jpeg→png`, `channels 3→4` đo được |
| `P5-MCP-52` Processing Receipt | **`verified`** | `schemaVersion: 2`, 8 trường mới đi tròn qua PostgreSQL thật |
| `P5-MCP-53` Brand Kit | **`partially_verified`** | CRUD + phiên bản + cô lập workspace đã đo; **tải logo chưa làm** — xem `Q-P5-03` |
| `P5-MCP-54` AI Disclosure | **`partially_verified`** | luật công bố đã đo đủ; **lớp phủ chưa vẽ vào bản xuất** — xem `Q-P5-03` |

## 2. Quyết định nền: không có nguồn sự thật thứ hai

`MCP-50` **không** tạo bảng `provenance_events`. Dòng thời gian dựng từ các nguồn đã có (tệp gốc,
bản xem trước, job, biên nhận, lịch sử sửa khung hình, ảnh chụp thông tin kèm theo). Một bảng thứ
hai sẽ lập tức thành nguồn sự thật thứ hai, và hai nguồn sẽ lệch nhau (`D-047`).

Đổi lại: quan hệ cha–con phải **tự dựng**, và mục mồ côi **lộ ra** ở `orphanIds` — đi qua được biên
giới API có chủ đích, không bị lọc ở máy chủ.

## 3. Ba lỗi chỉ bấm tay mới thấy

| # | Lỗi | Vì sao phép đo tự động bỏ sót |
|---|---|---|
| 1 | Khoá thô `disclosure.limitation.provider_blocked` hiện ra cho người dùng đọc | phép chắn i18n chỉ quét `translate('chuỗi tĩnh')`; nhãn **động** nằm ngoài tầm |
| 2 | Ô nhập màu là **một dòng** nhưng hướng dẫn bảo "mỗi màu một dòng" ⇒ hai mã dính lại, nút lưu khoá vĩnh viễn | không test nào gõ vào ô đó |
| 3 | Mã kiểm tra 64 ký tự **đẩy tràn** màn hình ở khổ 390px | ở 1280px mọi thứ trông bình thường |

## 4. Một lỗi máy chủ mà 806 phép kiểm không bắt được

Một **dấu phẩy đôi** trong mảng tham số SQL (`reviewReason,,`) tạo một **lỗ thưa**: mảng dài thêm
một phần tử `undefined` và **mọi tham số phía sau bị đẩy lệch một ô**.

`typecheck` xanh · `lint` xanh · **806 phép kiểm xanh**. Vì mọi test chạm tới biên nhận đều chạy
trên bản trong bộ nhớ. Chỉ một lượt chạy **thật** trên PostgreSQL mới lộ ra.

**Hai phép chắn mới**, cả hai đã thử đối chứng âm:
- `no-sparse-arrays` trong ESLint ⇒ lint đỏ.
- Phép kiểm biên nhận **đi tròn từng trường** trong bộ đối chiếu hai bản lưu trữ ⇒ test đỏ.

Đây là lần thứ hai bộ đối chiếu hai bản lưu trữ phải mở rộng vì cùng một lý do (`D-066`).

## 5. Xung đột chính sách — KHÔNG tự quyết

`preserveOriginalMetadata` là `true` **cố định** theo **guardrail 6/7**. Đo thật: `exif.Make` đi
nguyên vẹn vào bản xuất. Chính sách gỡ vị trí/thiết bị mâu thuẫn với cam kết đó.

Mã được sửa để **không khai một chính sách nó không thi hành**:
`METADATA_CATEGORIES_STRIPPED_BY_DEFAULT = []`. Mọi trường biến mất đều được gọi đúng tên là
`removed`. Khả năng phân loại vẫn còn — khi owner quyết, đổi đúng một hằng số. Xem `Q-P5-02`.

## 6. Không đụng tới

Provider thật vẫn **`blocked`** (`Q-P4-01`) · `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED` vẫn `false` ·
`CORRECTION_NEIGHBOUR_RADIUS_IS_MEASURED` vẫn `false` · `MEDIACLEAR_CLEANUP_ENABLED` vẫn **tắt** ·
`Q-23` vẫn **blocked** · go-live vẫn **`NOT_READY_FOR_GO_LIVE`** · Rights Statement v1/v2 **không đổi
một ký tự**, **không có v3** · không route DELETE · không đánh số lại ID lịch sử · **chưa mở Phase 6,
không billing, không tiện ích trình duyệt**.
