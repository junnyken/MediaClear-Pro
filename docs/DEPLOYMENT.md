# DEPLOYMENT — MediaClear Pro

- **Date**: 2026-09-16 · **MINI-SPEC**: `P2-MCP-26` · **Decision**: `D-040`

Tài liệu này ghi **cách triển khai thật đã chạy được**, không phải hướng dẫn lý thuyết.

## 1. Bản đang chạy

| Thành phần | URL | Vai |
|---|---|---|
| API | `https://mediaclear-api.cmc-1.vibenode.matbao.ai` | `MEDIACLEAR_ROLE=api` |
| Web | `https://mediaclear.cmc-1.vibenode.matbao.ai` | `MEDIACLEAR_ROLE=web` |

Nền tảng: **Vibe Host** (`vibehost.matbao.ai`), tài khoản `trieunt3@matbao.com`.
Cả hai dựng từ **cùng** repo `github.com/junnyken/MediaClear-Pro` nhánh `main`, **cùng một Dockerfile**.

## 2. Biến môi trường

### API

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `MEDIACLEAR_ROLE=api` | ✔ | Chọn vai trong ảnh |
| `MEDIACLEAR_UPLOAD_SECRET` | ✔ | Khoá ký vé upload/download. **Bí mật.** Thiếu thì hệ thống tự sinh mỗi lần khởi động ⇒ vé cũ hỏng |
| `MEDIACLEAR_PUBLIC_BASE_URL` | ✔ | **Địa chỉ công khai của API.** Thiếu thì `uploadUrl` trả về `http://localhost:<PORT>` — client bên ngoài không dùng được |
| `DATABASE_URL` | tự tiêm | Nền tảng tự tạo PostgreSQL và tiêm biến này. Hệ thống đọc `MEDIACLEAR_DATABASE_URL` trước, rồi đến `DATABASE_URL` |
| `MEDIACLEAR_S3_*` | không | Vibe Host **không có S3** ⇒ bỏ trống, chạy đĩa container |
| `MEDIACLEAR_DEV_AUTH` | không | Đã đặt `0` **trong ảnh**; đừng bật lại ở môi trường công khai |

### Web

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `MEDIACLEAR_ROLE=web` | ✔ | |
| `MEDIACLEAR_API_BASE_URL` | ✔ | Địa chỉ API. Đọc **lúc chạy**, không phải lúc build |

## 3. Ba cái bẫy đã vấp — đọc trước khi triển khai chỗ khác

**1. Health check gọi `/`, không gọi `/healthz`.** Bản triển khai đầu **bị huỷ** dù dịch vụ đã lên,
vì `/` trả `404`. Đã thêm route gốc (`P2-MCP-26`).

**2. Không đọc lại được giá trị biến bí mật.** Nền tảng tự tạo PostgreSQL và tiêm `DATABASE_URL`,
nhưng API quản trị **chỉ trả về tên biến**, không trả giá trị. Vì vậy không có cách nào copy sang biến
riêng — hệ thống phải **tự biết đọc `DATABASE_URL`**.

**3. `uploadUrl` trả `http://localhost:<PORT>`.** Mặc định của `MEDIACLEAR_PUBLIC_BASE_URL` là
`http://localhost:${PORT}`. Trong container `PORT=3000`, nên client nhận một địa chỉ **không dùng
được**. Đây là lỗi **chỉ lộ ra khi gọi thật từ ngoài Internet** — `/healthz` vẫn xanh.

**4. Đổi biến môi trường cần một lượt triển khai mới.** Đặt biến **sau khi** build đã bắt đầu thì
không có tác dụng. Nền tảng từ chối `redeploy` với `NO_CHANGE` nếu mã nguồn không đổi — nhưng **đổi
biến cũng tính là thay đổi**, nên sau khi `set_env` thì `redeploy` được.

## 4. Giới hạn của môi trường này

- **Tệp tải lên KHÔNG bền.** Object storage là đĩa container (`storage.production: false`) ⇒ **mất mỗi
  lần redeploy**. Dữ liệu trong PostgreSQL thì bền. Muốn tệp bền phải trỏ `MEDIACLEAR_S3_*` sang R2
  thật — **R2 chưa từng được kiểm** (xem `P2-MCP-24`).
- **URL công khai, không giới hạn IP.** Đăng ký mở. **Chưa có** giới hạn tần suất, chưa khoá sau N lần
  sai mật khẩu ⇒ chưa có gì chặn thử mật khẩu hàng loạt.
- Chưa có sao lưu, chưa theo dõi, chưa đo tải.
- **Chưa có xử lý AI** (`productionAiProcessingEnabled: false`); không job nào tới `completed`.
- Q-11 (BA/pháp lý duyệt câu chữ) vẫn chặn go-live thật.

## 5. Trạng thái tự khai của bản đang chạy

`GET /healthz`:

```
routes: 34
identity:    { id: 'password-phase2',      production: true  }
persistence: { id: 'postgres-phase2',      durability: 'durable' }
storage:     { id: 'local-fs-phase1',      production: false }
productionAiProcessingEnabled: false
```

Ba dòng đầu là thật và đã kiểm; dòng `storage` nói rõ đây **chưa** phải lưu trữ production.
