# P2-MCP-25 — Password Authentication & Durable Sessions

- **Canonical ID**: `P2-MCP-25` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-039` · **Đóng**: Q-14

## Context

Đã đọc: `docs/mini-specs/phase-2/P2-MCP-23.md` · `P2-MCP-24.md` · `docs/OPEN_QUESTIONS.md` ·
`docs/DECISIONS.md` · `docs/API.md` · `docs/DATA_MODEL.md` · `apps/api/src/auth/identity.ts` ·
`apps/api/src/persistence/port.ts` · `apps/api/src/config/env.ts`.

Commit nền: `9469ef0` (P2-MCP-24).

**Hai vấn đề gộp làm một.**

1. **Q-14 chưa chốt** nên hệ thống chỉ có `DevIdentityProvider`: gõ **bất kỳ email nào** là vào được,
   không mật khẩu. Nó tự khai `isProductionProvider: false`, nhưng đó là tất cả những gì nó làm được.
2. Ở `P2-MCP-23` tôi phát hiện: dữ liệu đã bền vững nhưng **phiên đăng nhập vẫn mất mỗi lần khởi động
   lại**, vì phiên nằm trong một mảng bộ nhớ (`identity.ts:44`) và lược đồ **không có bảng `sessions`**.

Owner chốt Q-14 (2026-09-16): **tự làm, phiên lưu DB**.

Điều này còn là **cửa chặn để đưa lên mạng**: ở `NODE_ENV=production`, `devAuthEnabled` tự tắt ⇒
không ai đăng nhập được; còn nếu bật ⇒ trên một URL công khai, bất kỳ ai gõ bất kỳ email nào cũng vào
được. Không có đường thứ ba.

## Constraints (Guardrails)

- **Không** đổi hành vi của `DevIdentityProvider` — nó ở lại cho dev/test.
- **Không** để chuỗi băm mật khẩu lọt vào kiểu `User` (kiểu này đi thẳng ra API response).
- **Không** lưu token phiên ở dạng rõ trong database.
- **Không** tạo kênh dò email: sai mật khẩu / email không tồn tại / đăng ký trùng phải **cùng một** mã lỗi.
- **Không** thêm native module — phải build được trên nền tảng không có toolchain C.
- Giữ 12 invariant Phase 0 và toàn bộ hồi quy Phase 1 / 1.1 / P2-MCP-23 / P2-MCP-24.

## Scope

**Trong phạm vi**: băm mật khẩu · bảng `sessions` · `PasswordIdentityProvider` · hai route
`register` / `sign-in` · mở rộng `PersistencePort` · tài liệu.

**Ngoài phạm vi**: đặt lại mật khẩu qua email · xác minh email · đăng nhập hai lớp · OAuth ·
khoá tài khoản sau N lần sai · giới hạn tần suất.

## Design Choice

**1. `scrypt` có sẵn trong Node, không dùng argon2.**

argon2 mạnh hơn về lý thuyết, nhưng mọi bản hiện thực cho Node đều là **native module** — phải biên
dịch lúc cài, và sẽ làm hỏng build Docker trên nền tảng không có toolchain C. Một hàm băm tốt mà
**chạy được ở mọi nơi** an toàn hơn một hàm băm tốt hơn mà build hỏng, vì khi build hỏng người ta sẽ
đi tìm đường tắt.

Tham số: `N=32768, r=8, p=1`, muối 16 byte, khoá 32 byte. Định dạng lưu tự mô tả
(`scrypt$N$r$p$salt$hash`) nên đổi tham số sau vẫn đọc được bản cũ.

**2. Chuỗi băm mật khẩu nằm NGOÀI kiểu `User`.**

`User` đi thẳng ra API response. Nếu chuỗi băm là một trường của `User` thì chỉ cần một lần quên
loại bỏ là nó ra ngoài. Vì vậy cổng có `users.findPasswordHash(userId)` riêng — muốn đọc phải gọi
đích danh.

**3. Một mã lỗi duy nhất cho mọi thất bại đăng nhập.**

`MCP_AUTH_INVALID_CREDENTIALS` dùng cho: sai mật khẩu · email không tồn tại · đăng ký trùng email.
Tách ra là tạo một kênh **dò email**. Người thật sự sở hữu email vẫn đăng nhập được nên họ không mất
gì. Đường đăng nhập còn **luôn chạy hàm kiểm** kể cả khi email không tồn tại, để thời gian trả lời
không tố ra email có tồn tại hay không.

**4. Provider xác thực KHÔNG phụ thuộc cấu hình database.**

Bản đầu tôi bật `PasswordIdentityProvider` chỉ khi có `MEDIACLEAR_DATABASE_URL`, nghĩ rằng "xác thực
thật mà phiên bay mỗi lần restart là lừa người dùng". **Test bắt được là sai**: route khai
`implemented` lại trả `501` khi chạy không DB — tức là nói dối về chính nó.

Cách đúng: độ bền của phiên là việc của **tầng lưu trữ**, đã tự khai ở `/healthz` qua
`persistence.durability`. Cổng xác thực chỉ lo **chứng minh danh tính**. Nên provider luôn bật;
chạy in-memory thì phiên bay theo restart **đúng như mọi dữ liệu khác**, không có gì bất ngờ.

**5. Thu hồi phiên là GHI MỐC, không xoá dòng.**

`revoked_at` giữ dấu vết để audit. Nhất quán với nguyên tắc append-only của lời khai quyền.

## Test Plan

| Test | Chặn điều gì |
|---|---|
| mật khẩu đúng qua, sai không qua | hỏng đường kiểm |
| chuỗi băm **không chứa** mật khẩu thường | lưu mật khẩu thô |
| hai lần băm cùng mật khẩu ra **hai chuỗi khác nhau** | quên muối |
| tài khoản chưa đặt mật khẩu ⇒ không đăng nhập bằng mật khẩu được | tài khoản thời dev thành cửa sau |
| **mọi dạng chuỗi băm hỏng trả `false`, không ném lỗi** | chuỗi hỏng thành đường vào |
| email không tồn tại và mật khẩu sai trả **cùng** mã lỗi | kênh dò email |
| đăng ký trùng email cũng trả mã đó | kênh dò email |
| **phiên sống sót qua "khởi động lại"** (thể hiện provider mới đọc phiên của thể hiện cũ) | đúng lỗ hổng tìm ra ở P2-MCP-23 |
| thu hồi rồi thì token hết tác dụng | thu hồi không thật |
| phiên hết hạn không dùng được | phiên sống mãi |
| token bịa không vào được | bỏ kiểm |
| database **chỉ lưu hash**, không lưu token rõ | dump DB lộ token dùng được |

Chạy trên **cả hai** adapter lưu trữ.

## Success Criteria

- Toàn bộ test trên xanh ở cả hai adapter.
- Phiên sống sót khởi động lại khi chạy PostgreSQL — kiểm bằng tay.
- Không native module mới.
- Bốn lệnh kiểm chạy **riêng**, đều thoát 0.

## Remaining Limits / Follow-ups

- **Chưa có**: đặt lại mật khẩu, xác minh email, khoá sau N lần sai, giới hạn tần suất. Ba thứ cuối
  nên có **trước khi mở cho người ngoài** — hiện chưa có gì chặn thử mật khẩu hàng loạt.
- Tài khoản tạo ở thời dev không có mật khẩu nên **không đăng nhập bằng mật khẩu được**; không đặt
  mật khẩu mặc định cho họ vì một mật khẩu ai cũng đoán được còn tệ hơn không có.
- Q-11 (BA/pháp lý duyệt câu chữ) vẫn chặn go-live, không chặn mục này.
