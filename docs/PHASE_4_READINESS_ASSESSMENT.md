# PHASE 4 — Đánh giá sẵn sàng (Bước 0)

- **Ngày**: 2026-09-17 · **Cổng vào**: `READY_FOR_PHASE_4_EXCEPT_ONLINE` · **Quyết định**: `D-071`
- **Go-live**: `NOT_READY_FOR_GO_LIVE` — blocker duy nhất là `Q-23`, **không bị đụng tới trong Phase 4**

---

## 1. Bốn câu Bước 0, trả lời bằng kiểm tra thật

### 1.1 Provider AI tracking nào khả dụng?

**Không có.** Đo được:

- `apps/api/src/providers/` chỉ có `deterministic-image.ts`, `deterministic-video.ts`
- `app-context.ts` đăng ký đúng ba: `NoopContractProvider`, `DeterministicImageProvider`,
  `DeterministicVideoProvider`
- Không biến môi trường nào liên quan tracking (`env.ts` và environment thật đều trống)

### 1.2 Đã benchmark theo bộ chuẩn Phase 3 chưa?

**Chưa.** `PROVIDER_BENCHMARK.md` ghi nguyên văn *"CHƯA CHẠY BENCHMARK NÀO"*, mọi ô là `unknown`, và
`evaluateReadiness()` chỉ trả `readyToSelectProvider: true` khi **không còn ô `unknown`**.

⇒ Provider thật là **`blocked`**, tuyệt đối không phải `verified`.

### 1.3 Rủi ro native binding

Bộ tracking thật sẽ cần **OpenCV binding** hoặc **ONNX runtime** — cả hai đều native, đúng dạng rủi
ro đã làm hỏng build Docker ở `D-039` (argon2 → phải đổi sang `scrypt` có sẵn trong Node).

`DeterministicTrackingProvider` **không có phụ thuộc native nào**, nên Phase 4 chạy trọn vẹn trong
ảnh Docker hiện tại. Khi chọn provider thật, rủi ro build phải được đánh giá **trước**.

### 1.4 Ngưỡng frame confidence

`FRAME_CONFIDENCE_THRESHOLD = 0.6`. **Đây là ước lượng, không phải số đo** — và mã nói đúng điều đó
qua `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED = false`.

Đối chiếu với tiền lệ Phase 3: dung sai audio `0.25s` (`Q-P3-03`) được **đo** bằng 12 lượt render
rồi mới ghim. Ở đây chưa có provider thật ⇒ chưa có phân bố confidence thật ⇒ chưa đo được.
`Q-P4-02` để đo lại.

## 2. Kết luận

Bước 0 **không chặn** Phase 4. Đường đi: dựng cổng `MotionTrackingProvider`, chạy pipeline bằng bản
giả tất định, ghi provider thật là `blocked` với lý do cụ thể.

## 3. Điều kiện đầu vào được tôn trọng

| Ràng buộc | Trạng thái |
|---|---|
| Không bật `MEDIACLEAR_CLEANUP_ENABLED` | ✔ không đụng tới |
| Không đóng `Q-23` | ✔ giữ nguyên `blocked` |
| Không nới go-live | ✔ `NOT_READY_FOR_GO_LIVE` |
| Không sửa Rights Statement v1/v2 | ✔ không đụng |
| Không đánh số lại ID lịch sử | ✔ dùng `D-071`, ID kế tiếp sau `D-070` |
