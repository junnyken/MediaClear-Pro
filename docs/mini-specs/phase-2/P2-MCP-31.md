# P2-MCP-31 — Cost Estimate & Preview

- **Canonical ID**: `P2-MCP-31` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-046`

## Context

Đã đọc: `P0-MCP-07` (usage & cost) · `packages/contracts/src/preview.ts` · `P2-MCP-27…30` ·
`docs/DECISIONS.md` (D-041…D-045). Commit nền: `fd84e20`.

Đây là **hai route 501 cuối cùng**. Sau mục này, **không route nào trong bảng còn trả 501**.

## Constraints (Guardrails)

- **I-12**: preview **không bao giờ** bị tính vào mức dùng.
- **I-5 / I-1**: preview là bản render phái sinh, **không bao giờ** động vào `SourceFile`.
- **Q-03**: preview luôn chạy trên bản **proxy** (≤ 720 px chiều cao), không trên ảnh gốc.
- **Guardrail 17**: hệ thống không thu tiền thật; đây là hợp đồng **đo lường**.
- Không bịa số: chưa có bảng giá thì không được đưa ra con số nào.

## Design Choice

**1. `estimatedCostUsd` luôn là `null`, không phải `0`.**

Hệ thống **chưa có bảng giá nào**: chưa chọn provider AI (Q-06 còn mở phần AI), chưa có bộ media mẫu
để đo giá thực tế (Q-07). Trả `0` sẽ bị hiểu là **miễn phí** — nói dối theo hướng nguy hiểm nhất.
`null` + `costEvidence` nói rõ lý do là câu trả lời đúng, và **hình dạng này đã có sẵn trong hợp đồng
Phase 0** — chỉ chưa ai nối vào.

Cái **đo được** và có ích thật sự là **số đơn vị** sẽ bị trừ: 1 ảnh, hay N phút video. Số này tính từ
số đo **thật trên byte** (`measured`), không phải từ lời khai của client.

**2. Ước tính dùng CHÍNH hàm mà `createJob` dùng.** Nếu ước tính và số thực trừ đi tính bằng hai
đường khác nhau, sớm muộn chúng sẽ lệch — và người dùng bị trừ khác với số đã được báo trước. Có test
đối chiếu hai con số.

**3. Preview KHÔNG lưu vào kho.**

Một object trong kho mà không có luật lưu giữ nào áp lên nó thì sẽ nằm đó **mãi mãi**. Preview là thứ
dùng một lần — trả thẳng byte về cho người gọi (data URI) là cách duy nhất không để lại rác. Bản proxy
bị chặn ở 720 px nên kích thước có trần.

**4. Thu nhỏ TRƯỚC khi xử lý, không phải sau.**

Xử lý ảnh gốc rồi mới thu nhỏ sẽ tốn đúng bằng công suất của một lượt thật — tức là preview "miễn
phí" vẫn đòi CPU y hệt, đúng thứ Q-03 muốn tránh.

**5. `regions` chuẩn hoá 0..1 nên áp thẳng lên bản proxy.** Đây chính là lý do hệ thống chuẩn hoá toạ
độ ngay từ Phase 0 — giờ mới dùng tới.

**6. `billable` và `providerJobBudget` nằm trong response.** Chúng là lời **tự khai** của hệ thống về
việc lượt này có bị tính tiền không, **kiểm tra được từ bên ngoài** thay vì phải tin.

## Test Plan

Hai phép thử quan trọng nhất đều là phép thử **KHÔNG xảy ra điều gì** — loại dễ viết sai thành luôn
xanh, nên mỗi ca đều đo **trước và sau** chứ không kiểm một lần.

| Test | Chặn điều gì |
|---|---|
| ước tính trả `null`, **không phải `0`** | người dùng hiểu nhầm là miễn phí |
| số đơn vị đo được thật (ảnh = 1 `image_unit`) | không đưa ra thông tin gì có ích |
| **số ước tính khớp số thực bị giữ** | báo một đằng trừ một nẻo |
| preview trả ảnh **giải mã được**, đúng thao tác | base64 hỏng vẫn "trông đúng" |
| **gọi preview 3 lần, số bút toán mức dùng không đổi** | vỡ I-12 |
| preview **không đổi trạng thái job** | preview thành một lượt chạy thật |
| preview **không tạo bản kết quả nào** | như trên |
| **checksum tệp nguồn nguyên vẹn** sau preview | vỡ I-5/I-1 |
| ảnh cao 1440 px bị thu nhỏ xuống ≤ 720 px | preview chạy trên độ phân giải gốc |
| thao tác cần AI bị chặn ngay | trả ảnh không phản ánh đúng việc đã xin |

**Một guardrail bắt được tôi khi viết test**: ca "ảnh cao hơn trần" lần đầu tôi viết bằng cách **ghi
đè** object `source`, và tầng lưu trữ từ chối — `MCP_STORAGE_WRITE_DENIED`, đúng bất biến I-1. Chặn
đúng, test sai. Đã đổi sang dùng fixture cao thật (`sample-tall.png`, 400×1440).

## Success Criteria

- **Không route nào trong bảng còn trả 501.**
- Preview chạy thật mà **không** sinh bút toán mức dùng nào.
- Tệp nguồn nguyên vẹn từng byte sau khi xem trước.
- Ước tính và số thực bị giữ là **cùng một con số**.

## Remaining Limits / Follow-ups

- **Không có giá.** `estimatedCostUsd` sẽ còn là `null` cho tới khi Q-06 (provider) và Q-07 (media
  mẫu để đo giá) được chốt. Đây là giới hạn lớn nhất của mục này.
- **Preview chỉ làm được thao tác tất định trên ảnh** — giống `P2-MCP-27`. Video chưa có gì.
- **Chưa có giao diện xem trước** — mới có route.
- Preview **không có giới hạn tần suất**: mỗi lượt vẫn tốn CPU thật dù không tính tiền. Cần chặn khi
  mở ra ngoài.
- Ước tính đặt ở `/v1/jobs/:jobId/estimate` nên **chỉ dùng được sau khi job đã tạo** — tức là sau khi
  mức dùng đã được giữ. Ước tính **trước** khi tạo job (lúc còn quyết định được) chưa có đường nào.
