# P2-MCP-34 — OpenAPI Document Generated From the Route Table

- **Canonical ID**: `P2-MCP-34` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-049`

## Context

Đã đọc: `packages/contracts/src/api.ts` · `docs/API.md` · `P2-MCP-32` (bài học về kiểu rời nhau).
Commit nền: `d3d5118`.

Không có tài liệu API nào máy đọc được. `docs/API.md` là bảng cho người đọc, đã có test đối chiếu với
`API_ROUTES`, nhưng client bên ngoài không dùng được nó.

## Design Choice

**1. SINH từ bảng route, không viết tay.**

Một tài liệu viết tay sẽ **trôi khỏi mã nguồn**, và tài liệu mô tả một API **khác** với API thật thì
**tệ hơn không có tài liệu** — người đọc tin nó. `API_ROUTES` đã là nguồn sự thật duy nhất cho danh
sách đường dẫn (có test đối chiếu với server thật), nên sinh từ đó là cách duy nhất bảo đảm không lệch.

**2. CỐ Ý không mô tả schema riêng cho từng route.**

Hiện **không có gì kiểm chứng được** những schema đó — viết ra là khai một thứ không ai đo. Đây đúng
là lỗi `P2-MCP-32` vừa vấp: kiểu của giao diện và kiểu của máy chủ là hai khai báo rời nhau nên cả hai
đều "xanh" trong khi thực tế lệch.

Tài liệu khai thứ **kiểm chứng được**: đường dẫn, phương thức, trạng thái hiện thực, yêu cầu xác thực,
hình dạng **vỏ bọc** chung của mọi phản hồi, và **toàn bộ danh mục mã lỗi**. Phần giới hạn này được
nói thẳng trong `info.description` của chính tài liệu.

**3. Route `planned` vẫn xuất hiện, kèm câu nói rõ nó trả 501.** Giấu đi sẽ khiến người đọc tưởng
đường đó không tồn tại, trong khi nó có thật.

**4. Trả tài liệu ở mức gốc, không bọc trong `{ok, data}`.** Công cụ đọc OpenAPI mong đợi tài liệu ở
gốc phản hồi. Đây là ngoại lệ **có chủ đích** với quy ước vỏ bọc, giống `/healthz`.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| mọi route trong bảng đều có trong tài liệu, đúng phương thức | tài liệu bỏ sót |
| **CHIỀU NGƯỢC LẠI: không đường nào trong tài liệu mà server không có** | tài liệu mô tả đường ma |
| mỗi route tự mô tả trạng thái thật, mang MINI-SPEC của nó | giấu route chưa hiện thực |
| route cần đăng nhập khai `bearerAuth`; `/healthz` thì không | khai sai yêu cầu xác thực |
| khai đủ **toàn bộ** danh mục mã lỗi | client không biết trước mã có thể gặp |
| server trả JSON hợp lệ ở mức gốc | công cụ đọc không parse được |

Phép thử quan trọng nhất là **chiều ngược lại** — nó hỏi `app.hasRoute()` trên Fastify **thật**.

**Đối chứng âm đã chạy:** thêm tạm `/v1/duong-khong-ton-tai` vào bảng ⇒ ca "CHIỀU NGƯỢC LẠI" **đỏ**
ngay. Phép thử có thể đỏ, nên nó có giá trị.

## Success Criteria

- `GET /openapi.json` trả tài liệu OpenAPI 3.1 hợp lệ, đọc được khi **chưa đăng nhập**.
- Tài liệu và server **khớp nhau theo cả hai chiều**.

## Remaining Limits / Follow-ups

- **Không có schema cho thân request/response của từng route.** Đây là giới hạn **cố ý** (xem trên),
  nhưng nó vẫn là giới hạn: client phải đọc `docs/API.md` hoặc mã nguồn để biết hình dạng dữ liệu.
  Đóng được nó cần một bộ kiểu dùng chung giữa máy chủ và client — chính là lỗ hổng `D-047` đã ghi.
- Chưa có trang đọc tài liệu (Swagger UI / Redoc).
- Chưa mô tả tham số truy vấn (`cursor`, `limit`) của các route phân trang.
- Chưa mô tả header `x-workspace-id` mà hầu hết route cần.
- Tài liệu **không** được kiểm bằng bộ xác thực OpenAPI chuẩn — mới chỉ kiểm hình dạng và tính khớp
  với server.
