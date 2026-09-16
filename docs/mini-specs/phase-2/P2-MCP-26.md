# P2-MCP-26 — Deployable Container & Runtime Configuration

- **Canonical ID**: `P2-MCP-26` · **Parent phase**: Phase 2
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-16
- **Decision**: `D-040`

## Context

Đã đọc: `docs/mini-specs/phase-2/P2-MCP-23.md` · `P2-MCP-24.md` · `P2-MCP-25.md` ·
`docs/PHASE_2_READINESS_ASSESSMENT.md` · `apps/web/app/_lib/api.ts` · `apps/web/app/layout.tsx` ·
`package.json` · `pnpm-workspace.yaml`. Commit nền: `6922f3a`.

Owner muốn đưa hệ thống lên **Vibe Host** (`vibehost.matbao.ai`, tài khoản `trieunt3@matbao.com`) để
kiểm thử dễ hơn. Audit nền tảng cho thấy ba việc phải làm trước.

| Phát hiện | Vì sao là vấn đề |
|---|---|
| Repo **chưa có Dockerfile**, và là monorepo pnpm | `apps/api` phụ thuộc `@mediaclear/contracts` qua `workspace:*`. Deploy với `subdir: apps/api` thì ngữ cảnh build **không có** gói ở gốc ⇒ hỏng |
| `NEXT_PUBLIC_API_BASE_URL` bị **nhúng lúc build** | Đổi địa chỉ API là phải **build lại toàn bộ web**. Không dùng được khi nền tảng cấp tên miền **sau khi** build |
| Vibe Host **không có S3** | Object storage rơi về đĩa container ⇒ mất mỗi lần redeploy |

## Constraints (Guardrails)

- **Không** đổi hành vi mặc định khi chạy ở máy dev.
- **Không** commit khoá truy cập hay chuỗi kết nối.
- **Không** chạy container bằng `root`.
- **Không** để cửa dev (`/v1/auth/dev-session`) mở ở production.

## Design Choice

**1. Một Dockerfile, hai vai.**

| Phương án | Kết quả |
|---|---|
| Hai Dockerfile, mỗi app một cái, dùng `subdir` | **Loại.** `subdir` đổi **ngữ cảnh build**, nên gói workspace ở gốc biến mất ⇒ build hỏng |
| **Một ảnh build cả workspace, chọn vai lúc chạy bằng `MEDIACLEAR_ROLE`** | **Chọn.** Hai website trên Vibe Host dùng **chung** repo và chung ảnh, chỉ khác biến môi trường |

Build theo đúng thứ tự `build:packages` → api → web. Bỏ bước đầu từng làm giao diện hiện **khoá dịch
thô** (bài học Phase 1) vì Next đóng gói bản `dist` cũ của gói workspace.

**2. Địa chỉ API đọc LÚC CHẠY, không phải lúc build.**

`NEXT_PUBLIC_*` bị Next nhúng thẳng vào bundle. Thay bằng: layout (server component) đọc
`MEDIACLEAR_API_BASE_URL` và tiêm vào `window.__MCP_API_BASE__`; `apiBaseUrl()` đọc biến lúc chạy
trước, rồi mới đến biến lúc build, rồi mới đến mặc định dev.

**Bẫy đã vấp và đã sửa:** chỉ tiêm thôi **chưa đủ**. Next **prerender tĩnh** các trang lúc build, nên
HTML tĩnh mang sẵn `__MCP_API_BASE__=""` — tức là vừa đổi từ bẫy build-time này sang bẫy build-time
khác. Phải thêm `export const dynamic = 'force-dynamic'` ở layout gốc để render theo từng request.
Sau khi sửa, bảng route đổi từ `○ (Static)` sang `ƒ (Dynamic)` — đó là dấu hiệu quan sát được.

Đánh đổi: mất tối ưu tĩnh. Chấp nhận, vì một trang tĩnh **không gọi được API nào** thì nhanh cũng vô
nghĩa.

**3. Cửa dev đóng cứng trong ảnh.**

`ENV MEDIACLEAR_DEV_AUTH=0` nằm ngay trong Dockerfile, không phụ thuộc người vận hành nhớ đặt. Nếu
quên, `/v1/auth/dev-session` sẽ cho **bất kỳ ai gõ bất kỳ email nào** đăng nhập trên một URL công khai.

**4. Không chạy bằng root.** Tạo user `mediaclear` (uid 10001).

## Test Plan

Kiểm bằng **chạy thật ảnh Docker**, không phải đọc Dockerfile:

| Kiểm | Cách |
|---|---|
| Ảnh build được | `docker build` thoát 0 |
| Vai `api` chạy | container lên, chạy migration, `/healthz` trả đúng |
| Vai `web` chạy | container lên, `/sign-in` trả 200 |
| Vai sai bị từ chối | `MEDIACLEAR_ROLE` lạ ⇒ thoát mã 2, in rõ lý do |
| **Địa chỉ API đổi được mà không build lại** | chạy **cùng một bản build** với hai giá trị biến khác nhau ⇒ hai giá trị tiêm khác nhau |

## Live Verification

Đã kiểm trên máy:

- `docker build` → **0**.
- Vai `api`: `migration: ap dung 0, bo qua 4` · `luu tru postgres-phase2 (durable)` ·
  `identity: password-phase2 (production)`.
- Vai `web`: Next 15.1.6 lên, `/sign-in` → **200**.
- Cùng một bản build, đổi `MEDIACLEAR_API_BASE_URL` → giá trị tiêm đổi theo, **không build lại**.

## Remaining Limits / Follow-ups

- **Vibe Host không có S3** ⇒ chạy ở đó thì object storage là đĩa container, **mất khi redeploy**.
  Muốn bền phải trỏ `MEDIACLEAR_S3_*` sang R2 thật — và R2 **chưa từng được kiểm** (xem `P2-MCP-24`).
- Chưa có health check trong Dockerfile, chưa có giới hạn tài nguyên trong ảnh.
- Chưa đo thời gian khởi động lạnh và kích thước ảnh.
- Mất tối ưu tĩnh của Next do `force-dynamic` — đổi lại được nếu sau này địa chỉ API cố định.
