# MCP-05 — Metadata, Provenance & Processing Receipt Contract

| | |
|---|---|
| **ID** | MCP-05 · **Parent phase** Phase 0 |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: prompt mục E, guardrails 3/4/6/7/8/9.
- Trạng thái: chưa có cơ chế đọc metadata nào trong repo.

## Goal
Bảo toàn quan hệ source ↔ output và ý định giữ metadata/provenance trong mọi workflow tương lai,
đồng thời nói thật về những gì hệ thống **không** kiểm soát được.

## Constraints
1. `preserveOriginalMetadata` và `preserveAiProvenance` mặc định **ON**, MVP không tắt được (kiểu
   TypeScript là literal `true`, không phải `boolean`).
2. Không có tuỳ chọn remove provenance; xin xoá → policy block.
3. Không tuyên bố xoá/vô hiệu hoá/kiểm soát được SynthID hay watermark vô hình.
4. File gốc không bao giờ bị ghi đè; output là bản mới có link tới asset gốc.
5. Chưa đo được → `unknown`, tuyệt đối không mặc định `preserved`.
6. Không báo `completed` nếu output chưa qua validation hoặc audio/metadata mất ngoài ý muốn.

## Scope
- **A. Domain model**: `ProvenanceRecord`, `ProcessingReceipt`, `OutputAsset.sourceAssetId`,
  `SourceFile.immutable`.
- **B. Services/engine**: `evaluatePreservation()`; `assertOutputDoesNotOverwriteSource()`.
- **C. API contract**: `GET /v1/jobs/:jobId/receipt` (`planned`).
- **D. UI surfaces**: màn "Thông tin gốc của tệp" + disclaimer bắt buộc
  `provenance.invisible_watermark_disclaimer` (vi/en).
- **E. Tests**: 8 test provenance + regression I-1, I-5, I-8.

## Audit Before Build
- Đã kiểm: không có entity metadata/provenance nào, không có thư viện đọc EXIF/C2PA nào.
- Gap **vocabulary**: cần ba trạng thái `present/absent/unknown` thay vì boolean — boolean sẽ ép hệ
  thống nói dối khi chưa đo được.
- Gap **observability**: cần `ProcessingReceipt` nối job ↔ source ↔ output ↔ provider run, nếu
  không thì sau này không trả lời được câu "bản này ra đời như thế nào".

## Design Choice
Tách hai việc: *đo* (probe, chưa có) và *kết luận* (`evaluatePreservation`, đã có). Hàm kết luận
luôn hạ cấp trung thực: chưa thử → `unconfirmed`; không đo được sau xử lý → `unknown`; mất metadata
→ `lost`; mất provenance nhưng còn metadata → `partial`. Chỉ khi giữ được cả hai mới `preserved` +
`verified`. Disclaimer watermark vô hình là **i18n key bắt buộc** trong receipt, không phải câu chữ
tuỳ hứng của UI.

## Test Plan
- **Unit**: 6 nhánh của `evaluatePreservation`.
- **Regression**: I-1 (output không ghi đè source, bắt buộc có link), I-5 (preview không đụng
  source), I-8 (default ON + không có cờ remove).
- **Docs consistency**: không tài liệu nào chứa câu khẳng định về watermark vô hình mà thiếu phủ định.
- **Live**: `planned` — cần file thật (Q-12).

## Success Criteria
1. Không có đường nào tạo output trùng `storageKey` với source.
2. Không có nhánh nào trả `preserved` khi chưa đo.
3. Mọi receipt đều mang disclaimer.

## Remaining Limits
- Chưa chọn thư viện đọc metadata/C2PA (Q-12) → `ProvenanceRecord` hiện chưa có nguồn dữ liệu thật.
- Chưa có kiểm tra audio stream sau xử lý (mới chỉ có chỗ để worker báo cáo lại).
