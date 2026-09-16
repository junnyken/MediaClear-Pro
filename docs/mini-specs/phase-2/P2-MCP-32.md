# P2-MCP-32 — Audit Log Pagination

- **Canonical ID**: `P2-MCP-32` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-047`

## Context

Đã đọc: `P1-MCP-10` (audit) · `apps/api/src/persistence/{port,in-memory,postgres}.ts` ·
`P2-MCP-23` (bộ test hai-adapter). Commit nền: `4a8b443`.

**Vấn đề.** `audit.listByWorkspace(workspaceId, limit = 100)` trả về một **mảng**. Nhật ký dài hơn
`limit` thì **phần còn lại không có đường nào đọc tới**. Với một bản ghi tồn tại để đối chiếu về sau,
"không đọc tới được" nghĩa là **không dùng được** — và nó hỏng đúng lúc cần nhất: khi có nhiều hoạt
động để rà.

## Constraints (Guardrails)

- Nhật ký đọc **mới nhất trước**, ngược chiều với mọi danh sách khác trong hệ thống.
- Con trỏ phải **ổn định**: đọc lại cùng một con trỏ phải cho cùng kết quả.
- Hai adapter phải cho **cùng một thứ tự** — nếu không, hành vi đổi theo cấu hình triển khai.
- Ranh giới workspace không được rò qua bất kỳ trang nào.

## Design Choice

**1. Khoá phụ `id` là bắt buộc, không phải chi tiết làm đẹp.**

Sắp xếp theo `(occurredAt, id)` giảm dần. Hai sự kiện **cùng mốc thời gian** mà không có khoá phụ thì
thứ tự là **tuỳ ý**, và con trỏ sẽ **nhảy qua hoặc lặp lại** mục khi đọc trang sau. Nhật ký kiểm toán
là nơi các sự kiện cùng mốc xảy ra thường xuyên — một job hoàn tất ghi nhiều bút toán trong cùng một
mili-giây.

**Đây đúng là chỗ hai adapter đã lệch nhau:** bản PostgreSQL sắp xếp `ORDER BY occurred_at DESC, id
DESC` từ trước, còn bản in-memory chỉ `sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))` —
**không có** khoá phụ. Với sắp xếp ổn định của V8, hai mục cùng mốc giữ nguyên thứ tự chèn (id **tăng**
dần), trong khi PostgreSQL trả id **giảm** dần. Hai adapter cho hai thứ tự ngược nhau.

**2. Phân trang giảm dần tách riêng khỏi phân trang tăng dần.** `paginate` (tăng dần) dùng cho project
/ asset; nhật ký cần `paginateDesc`. Nhét cả hai vào một hàm bằng một cờ sẽ khiến mỗi lần đọc phải tự
hỏi "lần này chiều nào".

**3. Con trỏ hỏng ⇒ đọc từ đầu**, không ném lỗi và không trả rỗng. Trả rỗng sẽ bị hiểu là "không có
nhật ký nào" — sai nguy hiểm hơn nhiều so với đọc lại từ đầu.

## Phát hiện: đổi hình dạng response KHÔNG bị typecheck bắt

Route này đổi `data` từ **mảng** thành `{ items, nextCursor }`. Giao diện `activity/page.tsx` đang đọc
nó bằng `apiFetch<AuditRow[]>(...)`.

`apiFetch<T>` chỉ là một **khẳng định kiểu** trên JSON nhận về — không ai kiểm. Kiểu của máy chủ và
kiểu của giao diện là **hai khai báo rời nhau**, nên `tsc` ở cả hai bên đều **xanh** trong khi trang
Hoạt động sẽ hỏng **lúc chạy** (`resource.data.length` trên một object là `undefined`, danh sách hiện
rỗng và không báo lỗi gì).

Tôi bắt được nó vì đi tìm mọi nơi đọc route này, **không phải** vì công cụ báo. Đây là một lỗ hổng
thật của kiến trúc hiện tại, chưa đóng: chưa có gì buộc hai khai báo đó khớp nhau.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| **đi HẾT các trang ra đúng tập hợp**, không thiếu không lặp | con trỏ nhảy cóc |
| mới nhất trước | đọc ngược chiều |
| **cùng mốc thời gian vẫn có thứ tự ổn định** | đúng chỗ hai adapter từng lệch |
| đọc lại cùng con trỏ cho cùng kết quả | con trỏ phụ thuộc lần đọc |
| hết dữ liệu ⇒ `nextCursor` là `null` | chuỗi rỗng bị hiểu là còn trang |
| con trỏ hỏng ⇒ đọc từ đầu | trả rỗng, bị hiểu là không có nhật ký |
| workspace khác không lọt vào trang nào | rò dữ liệu |

Chạy trên **cả hai adapter** (14 phép thử). Chỉ kiểm "trang đầu có đủ 2 mục" thì một con trỏ nhảy cóc
vẫn xanh — nên phép thử chính là **đọc hết mọi trang rồi so tập hợp**.

**Đối chứng âm đã chạy:** tạm bỏ khoá phụ `id` ⇒ ca *"cùng mốc thời gian"* **đỏ** ngay. Phép thử có
thể đỏ, nên nó có giá trị.

## Success Criteria

- Đọc được **toàn bộ** nhật ký qua nhiều trang, không thiếu không lặp.
- Hai adapter cho **cùng một thứ tự**, kể cả khi các mục trùng mốc thời gian.

## Remaining Limits / Follow-ups

- **Chưa có lọc** theo loại sự kiện, theo người thực hiện, hay theo khoảng thời gian. Với nhật ký dài,
  phân trang không thay thế được việc lọc.
- **Chưa có giao diện xem nhật ký** — mới có route.
- Chưa có xuất nhật ký ra tệp để lưu trữ ngoài hệ thống.
- **Không có gì buộc kiểu của giao diện khớp kiểu của máy chủ** (xem mục phát hiện ở trên). Cần một
  bộ kiểu dùng chung hoặc phép kiểm lúc chạy — chưa làm.
- Con trỏ mã hoá `base64url` của `occurredAt|id`, **không ký**: nó lộ mốc thời gian và id, và người
  dùng sửa tay được. Không rò dữ liệu của workspace khác (truy vấn vẫn lọc theo workspace), nhưng nếu
  sau này cần con trỏ không đọc được thì phải đổi.
