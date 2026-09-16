# P2-MCP-30 — Provenance Measurement & Processing Receipt

- **Canonical ID**: `P2-MCP-30` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-045` (kèm `D-044` — sửa lỗi hợp đồng Phase 0 phát hiện khi làm mục này)

## Context

Đã đọc: `P0-MCP-05` (hợp đồng provenance) · `P2-MCP-27/28/29` · `docs/DECISIONS.md` (D-041…D-044) ·
`packages/contracts/src/provenance.ts`. Commit nền: `ae690cb`.

**Vấn đề.** `ProcessingReceipt` bắt buộc có `provenanceBeforeId` (**không nhận null**), nhưng trong
repo **không có bảng provenance nào** và **không chỗ nào ghi provenance**. Biên nhận là **bất khả thi
về mặt cấu trúc** — đúng dạng lỗi mà `output_assets` từng mắc trước `P2-MCP-27`.

**Và một lỗi nặng hơn tìm được khi chuẩn bị nối vào.** `evaluatePreservation()` gộp `'unknown'` chung
với `'absent'`, nên với bộ đo thật (không đọc được C2PA → luôn `'unknown'`) **mọi biên nhận** sẽ mang
lời khai *"đã kiểm chứng: giữ nguyên"*. Đã sửa ở `D-044` trước khi làm tiếp — chi tiết ở đó.

## Constraints (Guardrails)

- **Guardrail 4**: không phát hiện, không gỡ, không cam kết kiểm soát dấu ẩn vô hình (kể cả SynthID).
  Bộ đo cũng **không được giả vờ** làm được.
- **Guardrail 6**: bảo toàn metadata + dấu vết AI mặc định bật.
- **D-044**: `'unknown'` không bao giờ được thành `'verified'`.
- Biên nhận là **bằng chứng**, nên ghi xong **không sửa** — cổng chỉ có `create` và `find`.

## Design Choice

**1. `'unknown'` và `'absent'` là hai thứ khác hẳn nhau.**

| Giá trị | Nghĩa |
|---|---|
| `absent` | **đã tìm** và không thấy |
| `unknown` | **chưa từng tìm được** |

Bộ đo trả `originalMetadataPresence` thật (libvips đọc được EXIF/ICC/XMP/IPTC), nhưng
`aiProvenancePresence` **luôn** `'unknown'` vì hệ thống **không có bộ đọc C2PA** (Q-12 còn mở). Trả
`'absent'` ở đây sẽ là bịa ra một phép đo chưa từng chạy.

**2. Đo TRƯỚC khi động vào byte, và đo LẠI trên byte đã đọc về từ kho.**

Đo sau khi xử lý thì không còn gì để so sánh. Đo lần hai trên **byte đọc lại từ kho** chứ không trên
buffer trong bộ nhớ: biên nhận phải nói về **tệp người dùng sẽ nhận**, không phải tệp hệ thống định ghi.

**3. Tệp hỏng ⇒ `'unknown'`, không phải `'absent'`.** Một phép đo thất bại **không phải** bằng chứng
rằng metadata không tồn tại.

**4. Ràng buộc D-044 đặt luôn ở tầng cơ sở dữ liệu:**

```sql
CONSTRAINT provenance_unknown_never_verified CHECK (
  evidence_status <> 'verified'
  OR (original_metadata_presence <> 'unknown' AND ai_provenance_presence <> 'unknown')
)
```

Logic đã sửa ở tầng hợp đồng; ràng buộc này chặn thêm một lần ở chỗ không ai đi vòng được.

**5. Biên nhận trả về CẢ hai bản ghi đo, không chỉ id.** Một biên nhận trỏ tới hai id mà người đọc
không tra cứu được thì không phải bằng chứng, chỉ là một lời hứa.

## Phát hiện thật: công cụ TỰ THÊM metadata vào tệp người dùng

Đo được, không phải suy đoán:

```
NGUON  exif: 0   | icc: 0
KET QUA exif: 180 | icc: 480
```

`.withMetadata()` của libvips **thêm** một hồ sơ màu ICC (480 byte) và một khối EXIF (180 byte) vào
tệp kết quả **dù tệp gốc không có gì**. Nghĩa là với ảnh không metadata, biên nhận ghi
`trước = absent`, `sau = present` — **cả hai đều đúng** về sự thật của từng tệp, và chênh lệch giữa
chúng chính là thông tin người dùng cần biết: **công cụ đã thêm thứ vào tệp của họ**.

Quan trọng: `evidenceStatus` vẫn là `'unknown'`, **không** phải `'preserved'` — hệ thống không nhận vơ
rằng đã bảo toàn một thứ vốn không tồn tại. Có test ghim lại hành vi này để lần sau nó đổi thì test đỏ.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| ảnh có EXIF → `present`, ảnh không có → `absent` | bộ đo không đo gì cả |
| **không đọc được C2PA ⇒ luôn `unknown`, không bao giờ `absent`** | bịa ra phép đo chưa chạy |
| tệp hỏng ⇒ `unknown` | coi "đo hỏng" là "không có" |
| video ⇒ `unknown` | đoán thay vì nói chưa đo được |
| biên nhận kèm **cả hai** bản ghi đo, tra cứu được thật | biên nhận trỏ vào hư không |
| **biên nhận KHÔNG được khai "đã kiểm chứng"** khi chưa đọc được C2PA | đúng lỗi D-044 |
| **EXIF thật sống sót** qua đường xử lý, đo trên byte đã lưu | `withMetadata()` bị quên |
| công cụ tự thêm hồ sơ màu — ghim lại con số | hành vi đổi âm thầm |
| job chưa chạy ⇒ 404 | trả biên nhận rỗng |
| workspace khác ⇒ 404 | lộ dữ liệu |

**Fixture mới `sample-with-exif.png`**: fixture cũ **không có metadata nào**, nên mọi phép kiểm "có
bảo toàn không" trên nó đều vô nghĩa. Đo đối chứng âm: bỏ `.withMetadata()` thì EXIF **bị xoá sạch** —
phép thử có thể đỏ, nên nó có giá trị.

## Success Criteria

- Biên nhận đọc được qua API, kèm hai bản ghi đo tra cứu được.
- Biên nhận nói **thật** là chưa đo được dấu vết AI, thay vì đóng dấu "đã kiểm chứng".
- EXIF thật của người dùng sống sót qua đường xử lý — **đo trên byte đã lưu trong kho**.

## Remaining Limits / Follow-ups

- **Không đọc được C2PA / Content Credentials** (Q-12 còn mở). Đây là giới hạn lớn nhất: phần "dấu vết
  AI" của mọi biên nhận hiện là `unknown`.
- **Video chưa đo được metadata** — `header-probe` chỉ đọc kích thước và thời lượng.
- **Công cụ thêm hồ sơ màu ICC vào tệp kết quả.** Chưa có tuỳ chọn tắt, và chưa nói điều này với người
  dùng trên giao diện.
- `providerRunIds` luôn rỗng vì bản tất định chạy trong tiến trình, không gọi provider ngoài.
- **Chưa có giao diện xem biên nhận** — mới có route.
- Biên nhận chưa xuất ra được dạng tệp để lưu trữ ngoài hệ thống.
