# PHASE 5 — Báo cáo đóng (MCP-50…54)

- **Quyết định**: `D-075` · **Ngày**: 2026-09-18

```
Phase 5 technical implementation: COMPLETE (anh) / OPEN (lop phu video)
MCP-50: VERIFIED
MCP-51: VERIFIED_WITH_FIELD_LIMITATIONS   (Q-P5-04: 5 the EXIF, nay duoc KE TEN)
MCP-52: VERIFIED
MCP-53: VERIFIED cho ANH · lop phu VIDEO chua lam (Q-P5-03)
MCP-54: VERIFIED cho ANH · lop phu VIDEO chua lam (Q-P5-03)
Provider:               BLOCKED_BY_Q-P4-01
Online verification:    BLOCKED_BY_Q23
Gate:                   READY_FOR_PHASE_6_EXCEPT_PROVIDER_AND_ONLINE
Go-live:                NOT_READY_FOR_GO_LIVE
Phase 6:                NOT_STARTED
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

## 6. Completion patch `D-076` + `D-077` (2026-09-18)

### `Q-P5-02` — chốt: GIỮ NGUYÊN (`D-076`)

Chính sách mặc định là **giữ nguyên** thông tin gốc, đúng guardrail 6/7. Không tự động gỡ vị trí /
thiết bị / GPS. `METADATA_POLICIES` cố tình **không có** giá trị `redact`.

Ba luật đi kèm, mỗi luật chặn một cách nói dối cụ thể:

| Luật | Chặn điều gì |
|---|---|
| Trường **chưa đo** là `unknown`, liệt kê tường minh (`unmeasuredKeys`) | báo cáo đúng về 5 thẻ đã đo rồi **im lặng** về phần còn lại |
| Tách **kết luận** (`verdict`) khỏi **độ phủ** (`unmeasuredCount` → `partially_verified`) | gọi một báo cáo phủ 5/15 trường là `verified` |
| Trường đổi phải mang **lý do** (`changeReason`) | một cảnh báo trống mà người dùng không làm gì được |

Lần cài đặt đầu kéo `unknown` vào verdict — và **mọi** phép đối chiếu lập tức thành `unknown`. Một
kết luận luôn giống nhau thì không còn là kết luận.

### `Q-P5-03` — lớp phủ cho ẢNH đã xong (`D-077`)

`branding` là một trường **riêng**, không phải một `operation`: thao tác `brand_overlay` sẵn có là
**mặt nạ xám đặc** (`Q-15`) — nó **xoá** thông tin, còn `D-077` **thêm** thông tin. Ngược nhau.

Đo thật: không chọn ⇒ byte **y hệt** bản render · chọn ⇒ byte đổi, `I-2` vẫn đúng, tệp gốc nguyên
vẹn · bộ của workspace khác ⇒ **không dán gì** · phiên bản không tồn tại ⇒ **không dán gì**.

### Lỗi đo được: dải công bố TRỐNG RUỘT

Sau một lần khởi động lại, workspace mất **sạch font** (`fc-list` = 0). Thư viện vẽ SVG vẫn trả về
ảnh **hợp lệ** — chỉ là không có chữ. Bản xuất sẽ mang một dải tối màu trống ruột, và biên nhận
khai **đã công bố**. Một công bố trống còn tệ hơn không công bố.

`renderDisclosureBand` nay tự chạy một **đối chứng âm lúc chạy** (vẽ có chữ ↔ vẽ chuỗi rỗng, so
byte). Giống nhau ⇒ không dán gì, `disclosureApplied: false`.

### Trạng thái MCP sau patch

| MCP | Trước | Sau |
|---|---|---|
| `P5-MCP-51` | `verified` | **`verified`** + luật chưa-đo-là-unknown |
| `P5-MCP-53` | `partially_verified` | **`verified` cho ảnh** — tải logo + dán + biên nhận |
| `P5-MCP-54` | `partially_verified` | **`verified` cho ảnh** — dán dải công bố, có phép chắn dải trống |

**Video vẫn chưa có lớp phủ** (`Q-P5-03` còn mở). Không giả lập.

## 7. Không đụng tới

Provider thật vẫn **`blocked`** (`Q-P4-01`) · `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED` vẫn `false` ·
`CORRECTION_NEIGHBOUR_RADIUS_IS_MEASURED` vẫn `false` · `MEDIACLEAR_CLEANUP_ENABLED` vẫn **tắt** ·
`Q-23` vẫn **blocked** · go-live vẫn **`NOT_READY_FOR_GO_LIVE`** · Rights Statement v1/v2 **không đổi
một ký tự**, **không có v3** · không route DELETE · không đánh số lại ID lịch sử · **chưa mở Phase 6,
không billing, không tiện ích trình duyệt**.
