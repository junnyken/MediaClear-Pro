# P2-MCP-27 — Deterministic Image Processing

- **Canonical ID**: `P2-MCP-27` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-041` · **Đóng một phần**: Q-06

## Context

Đã đọc: `P2-MCP-23/24/25/26` · `docs/PROVIDER_BENCHMARK.md` · `docs/DECISIONS.md` (D-020, D-005) ·
`packages/contracts/src/provider.ts` · `apps/api/src/services/jobs.ts` ·
`packages/contracts/src/vocabulary.ts`. Commit nền: `de0e6dd`.

**Vấn đề.** Từ Phase 1 tới giờ, **không job nào tới `completed`**. Ba thứ cùng thiếu:

1. Không provider production nào được đăng ký.
2. **Không có bảng lưu kết quả** — `processing_jobs` có ràng buộc
   `CHECK (state <> 'completed' OR output_asset_id IS NOT NULL)`, nên `completed` là bất khả thi.
3. Không có hàm nào đưa job từ `queued` đi tiếp.

Owner chốt Q-06 (2026-09-16): **làm thao tác tất định trước**, chưa chọn provider AI.

## Constraints (Guardrails)

- **Bất biến I-1**: tệp gốc không bao giờ bị ghi đè; kết quả luôn là bản **mới**.
- **Bất biến I-2**: không bao giờ nói "đã xong" về thứ chưa đo lại.
- `preserveOriginalMetadata` / `preserveAiProvenance` cố định `true` — **sharp mặc định XOÁ metadata**.
- **Không double-charge**: mức dùng chỉ tính một lần, sau khi xong.
- `blocked` là terminal (D-005).
- **Không** khai bừa năng lực: thao tác cần AI phải tự khai không làm được.

## Design Choice

**1. Tách "provider production" khỏi "provider dùng AI".**

Trước đây hai khái niệm này trùng nhau nên `/healthz` suy ra "đã bật xử lý AI" từ việc có provider
production. Nay chúng **không còn trùng**: provider tất định phục vụ traffic thật mà **không dùng AI
nào**. Thêm `usesAiModel` vào hợp đồng; `/healthz` suy ra
`productionAiProcessingEnabled` từ `listProductionAi()` thay vì hằng số cứng.

Nếu gộp chung, hệ thống sẽ **báo đã bật AI trong khi không hề có AI** — đúng loại nói dối mà mọi
guardrail của dự án này nhắm vào.

**2. Lưu vùng người dùng chọn.**

`regions` vốn được **kiểm rồi vứt đi**: `ProcessingJobRequest` không có chỗ lưu. Nghĩa là lựa chọn của
người dùng biến mất trong im lặng và worker không biết che ở đâu. Thêm cột `regions jsonb`.

**3. `runJob` là hàm riêng, không nằm trong route.**

Worker của `P2-MCP-28` sẽ gọi **đúng hàm này**. Viết thẳng trong route thì worker phải chép lại logic,
rồi hai bản trôi khác nhau. Trigger ở lượt này là route **nội bộ** (tắt mặc định).

**4. Thứ tự bắt buộc, không được đổi:**

```
queued → processing → xử lý → lưu kết quả → ĐỌC LẠI và đo lại → completed → tính mức dùng
```

Đọc lại trước khi báo xong là **bất biến I-2**. Nếu tầng lưu trữ hỏng nửa chừng, đây là chỗ **duy
nhất** phát hiện ra — trước khi nói với người dùng rằng đã xong.

**5. Hệ quả hành vi: job xin thao tác cần AI nay bị CHẶN ngay.**

Trước đây "không có provider nào" ⇒ nhận job, để nằm `queued` vĩnh viễn. Nay đã có provider production
nhưng nó không làm được thao tác AI ⇒ chặn với lý do rõ. **Đây là cải thiện**: nói ngay "chưa làm được"
tốt hơn nhận một việc không bao giờ chạy và giữ mức dùng của người ta.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| `crop` cắt đúng kích thước theo toạ độ chuẩn hoá | sai quy đổi toạ độ |
| `blur` **xoá được chi tiết** (độ lệch chuẩn giảm quá 3 lần) | blur không có tác dụng |
| vùng **không** được chọn giữ **nguyên từng byte** | đụng vào phần không được phép |
| `brand_overlay` phủ kín đúng vùng | che hụt |
| **không bao giờ sửa ảnh đầu vào** | vỡ bất biến I-1 |
| cùng đầu vào ⇒ cùng checksum | không tất định |
| **metadata gốc còn nguyên** | sharp xoá mất, vi phạm guardrail 6 |
| checksum khớp byte thật trả ra | báo số không đúng |
| tự khai **không** làm được `inpaint`/`visible_logo_cleanup`/video | khai bừa năng lực |

**Bẫy đã vấp khi viết test** (ghi lại vì cả hai đều làm test xanh/đỏ sai):
- `sharp(...).extract(box).stats()` trả thống kê của ảnh **đầu vào**, bỏ qua `extract()`. Phải ghi ô
  ra buffer **trước** rồi mới đo, nếu không mọi phép đo đều là đo cả ảnh.
- Làm mờ một vùng **màu đồng nhất** cho ra đúng màu đó. Ảnh mẫu phải **có chi tiết** thì phép kiểm
  "blur có tác dụng không" mới có nghĩa.

## Success Criteria

- Job đi tới **`completed`** với `outputAssetId` thật — lần đầu tiên trong dự án.
- Kết quả đọc lại được và checksum khớp.
- Tệp gốc còn nguyên.
- `/healthz` vẫn khai `productionAiProcessingEnabled: false` (đúng: không có AI).
- Mức dùng tính **đúng một lần**.

## Remaining Limits / Follow-ups

- **Chỉ ảnh.** Video chưa làm được gì — cần pipeline khung hình.
- **Chỉ `crop` / `blur` / `brand_overlay`.** Thao tác cần AI vẫn chưa làm được (Q-06 còn mở phần AI,
  Q-07 media mẫu benchmark chưa có).
- `brand_overlay` hiện phủ **mảng màu đặc**, chưa nhận logo thay thế.
- Chưa có worker tự chạy — hiện phải gọi route nội bộ (`P2-MCP-28`).
- Chưa đo hiệu năng trên ảnh lớn, chưa giới hạn kích thước đầu vào cho xử lý.
