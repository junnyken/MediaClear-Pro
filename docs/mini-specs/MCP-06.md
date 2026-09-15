# MCP-06 — UX Design Tokens & Navigation Foundation

| | |
|---|---|
| **ID** | MCP-06 · **Parent phase** Phase 0 |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: `UX_FOUNDATION.md`, prompt mục H/I.
- Trạng thái: không có design system, component hay i18n nào trong repo (`MCP-00`).
- Quyết định giữ: một sản phẩm duy nhất; tiếng Việt mặc định; nói trạng thái thật.

## Goal
Chốt UX/UI foundation thân thiện, tiếng Việt mặc định, responsive và sẵn sàng mở rộng quốc tế —
trước khi ai kịp hard-code chuỗi hay màu vào component.

## Constraints
1. Mọi chuỗi hiển thị đi qua translation key; không hard-code text trong component.
2. Tiếng Việt là locale mặc định; `en` phải luôn đủ key.
3. Không dùng màu success cho trạng thái chưa xác định.
4. Không phơi bày 5 module nội bộ như 5 sản phẩm trong điều hướng.
5. Không dùng từ chuyên môn (`inpainting`, `mask`, `provenance`, `metadata`, `watermark`) trong
   chuỗi tiếng Việt cho người dùng cuối.
6. Accessibility: focus thấy được, contrast, nhãn, error text, tôn trọng reduced motion.

## Scope
- **A. Domain model**: không đổi.
- **B. Services/engine**: `t()`, `formatDuration/Bytes/DateTime/Usage` locale-aware.
- **C. API contract**: không đổi (API trả `messageKey`, D-012).
- **D. UI surfaces**: `Shell` (điều hướng theo workflow) + 10 màn foundation + `ScreenPlaceholder`
  tự khai "đây mới là khung thiết kế".
- **E. Tests**: 8 test i18n (parity, rỗng, mã lỗi, nhãn state, chặn từ chuyên môn, `null` hiển thị
  "Chưa xác định").

## Audit Before Build
- Đã kiểm: `not found` cho toàn bộ layout/token/component/i18n.
- Gap **UX wording**: nếu không dựng i18n ngay, Phase 1 chắc chắn sinh chuỗi hard-code — sau này BA
  không sửa được câu chữ nếu không đụng code.
- Gap **vocabulary**: cần nhãn hiển thị cho **từng** `JobState`/`EvidenceStatus`, nếu không UI sẽ tự
  chế chữ và nói sai trạng thái.

## Design Choice
Token tồn tại ở hai dạng luôn khớp nhau: `tokens.css` (biến CSS cho runtime) và `index.ts` (kiểu
TypeScript cho logic). Trạng thái được gán màu **trong token**, không để component tự chọn — đó là
cách chặn "success sớm" ở tầng thiết kế chứ không phải tầng kỷ luật. Mỗi màn foundation render
chính "hợp đồng thiết kế" của nó (3 dòng từ i18n) để Phase 1 biết màn đó phải làm được gì.

## Test Plan
- **Unit**: parity key vi/en; không giá trị rỗng; mọi mã lỗi có bản dịch; mọi state có nhãn;
  `formatDuration(null)` = "Chưa xác định"; thiếu key thì lộ key.
- **Regression**: quét toàn bộ chuỗi tiếng Việt, chặn 7 từ chuyên môn.
- **Build**: `next build` phải xanh.
- **Live**: đã chạy `next start` và gọi thật 10 route — xem `TEST_LOG.md` §3.

## Success Criteria
1. Không có chuỗi hiển thị nào nằm trong component.
2. Thêm một mã lỗi mà quên bản dịch → test đỏ.
3. Mọi màn foundation mở được và nói rõ nó chưa xử lý tệp thật.

## Remaining Limits
- Chưa có component library (button/modal/toast/empty state) — `planned`.
- Responsive mới ở mức flex-wrap; chưa test trên breakpoint thật.
- Chưa có kiểm tra contrast tự động; chưa click-through bằng trình duyệt thật.
