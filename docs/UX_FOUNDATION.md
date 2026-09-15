# UX_FOUNDATION — MediaClear Pro

- **Date**: 2026-09-15 · **MINI-SPEC**: MCP-06 · **Trạng thái**: token + skeleton `implemented`, màn nghiệp vụ `planned`

## 1. Design tokens

Nguồn: `packages/design-tokens/src/index.ts` (TypeScript) và `tokens.css` (CSS custom properties).
Hai file phải luôn khớp nhau.

| Token | Giá trị |
|---|---|
| Background | `#0B1020` |
| Surface | `#121A2E` |
| Primary | `#5B8CFF` |
| Success | `#35D0A1` |
| Warning | `#F6B84B` |
| Danger | `#F26B6B` |
| Text primary | `#F5F7FB` |
| Text secondary | `#9CA8BF` |

Spacing: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px. Radius: 6 / 10 / 16 / pill.
Font size: 12 / 14 / 16 / 20 / 28 / 36 px. Breakpoint: 480 / 768 / 1024 / 1280 px.

### Token ngữ nghĩa cho trạng thái

`JOB_STATE_COLORS` và `EVIDENCE_STATUS_COLORS` gán màu theo trạng thái, **không** để UI tự chọn:
`completed` → success; `review_required` → warning; `failed`/`blocked` → danger;
`unknown`/`unconfirmed` → text secondary (**không bao giờ** dùng màu success cho trạng thái chưa
xác định).

## 2. Nguyên tắc UX

1. Tiếng Việt mặc định; `en` đã sẵn key, bật được mà không sửa component.
2. **Một sản phẩm** — điều hướng theo workflow (Tổng quan / Tạo yêu cầu / Mức dùng / Nhật ký),
   không phơi bày 5 module nội bộ như 5 sản phẩm.
3. Không bắt người dùng hiểu từ chuyên môn. Có test tự động chặn các từ `inpaint`, `mask`,
   `provenance`, `metadata`, `watermark`, `endpoint`, `payload` xuất hiện trong chuỗi tiếng Việt.
4. Hiển thị trạng thái thật, không "success" sớm: màn hình Phase 0 luôn kèm nhãn
   `screen.placeholder_notice` nói rõ đây mới là khung thiết kế.
5. Preview trước render/export.
6. Tệp gốc luôn được bảo toàn — thông điệp `common.original_file_safe`.
7. Progressive disclosure cho tuỳ chọn nâng cao.
8. Hiện ước tính chi phí/mức dùng trước khi chạy **nếu có bằng chứng**; thiếu thì hiện "Chưa có
   ước tính", không hiện `0`.
9. Accessibility: focus ring 2px (`*:focus-visible`), tap target ≥ 44px, contrast tối thiểu 4.5,
   nhãn cho vùng điều hướng, `@media (prefers-reduced-motion: reduce)` tắt animation.

## 3. Màn hình foundation

| # | Màn hình | Route thật trong `apps/web` | Trạng thái |
|---|---|---|---|
| 1 | Dashboard | `/` | skeleton |
| 2 | New Cleanup | `/new-cleanup` | skeleton |
| 3 | Upload validation | `/upload-validation` | skeleton |
| 4 | Project detail | `/projects/[projectId]` | skeleton |
| 5 | Image workspace | `/workspace/image` | skeleton |
| 6 | Video workspace | `/workspace/video` | skeleton |
| 7 | Rights confirmation | `/rights` | skeleton |
| 8 | Provenance review | `/provenance` | skeleton |
| 9 | Usage / Credits | `/usage` | skeleton |
| 10 | Activity log | `/activity` | skeleton |

Mỗi màn hiện danh sách "hợp đồng thiết kế" của chính nó (3 dòng, lấy từ i18n key
`screen.<id>.contract.*`), để Phase 1 biết màn đó phải làm được gì.

## 4. i18n

- Locale mặc định: `vi`. Locale sẵn sàng: `en`. 107 key, **parity được test tự động**.
- Không hard-code chuỗi hiển thị trong component — mọi text đi qua `t(locale, key)`.
- Định dạng locale-aware: `formatDuration`, `formatBytes`, `formatDateTime`, `formatUsage`.
- Giá trị `null` hiển thị "Chưa xác định" / "Unknown", không phải `0`.

## 5. Giới hạn còn lại

- Chưa có responsive thật ở mức component (mới có flex-wrap cơ bản trong `Shell`) — `planned`.
- Chưa có component library (button, modal, toast, empty state) — `planned`.
- Chưa có kiểm tra contrast tự động — `planned`, xem TEST_STRATEGY §5.
