# PHASE_0_DECISION_LOG — MediaClear Pro

Nhật ký quyết định theo trình tự thời gian của Phase 0 (2026-09-15). Chi tiết lý do của từng quyết
định nằm trong `DECISIONS.md`; file này ghi **ai quyết, lúc nào, dựa trên gì**.

| # | Thời điểm | Quyết định | Người quyết | Căn cứ | Trạng thái |
|---|---|---|---|---|---|
| 1 | Trước khi viết dòng code đầu tiên | Audit repository trước, không code feature | Agent | Playbook v2 §3, prompt §10 | thực hiện xong (MCP-00) |
| 2 | Sau audit | Ghi nhận repo **rỗng hoàn toàn**, mọi hạng mục `not found` | Agent | `ls -laR`, `find`, `git rev-parse` | verified |
| 3 | Sau audit | Playbook dùng là bản v2 owner gửi, **không** dùng bản khác tên trùng trong `projects/audit-ads/` | Agent | so sánh nội dung 2 file | verified |
| 4 | Trước khi chọn stack | Dừng lại hỏi owner vì "bám ngôn ngữ/framework hiện có" không có đáp án | Agent | prompt §10 (gặp ambiguity thì dừng ở boundary) | thực hiện |
| 5 | 2026-09-15 | **Monorepo TypeScript** (pnpm) cho contracts + web + API | **Owner** | trả lời câu hỏi scoping | `confirmed` (D-001) |
| 6 | 2026-09-15 | **Tài liệu tiếng Việt, vocabulary/API/enum tiếng Anh** | **Owner** | trả lời câu hỏi scoping | `confirmed` (D-003) |
| 7 | 2026-09-15 (giữa lượt) | **Không thêm Python service, không thêm Chrome Extension** trong Phase 0; chỉ chừa điểm nối | **Owner** | chỉ đạo bổ sung | `confirmed` (D-011) |
| 8 | Khi chốt vocabulary | Lấy nguyên bộ vocabulary của spec, không tự chế enum | Agent | guardrail 14 + audit không có enum cũ | `confirmed` (D-002) |
| 9 | Khi chốt vocabulary | Tách namespace cho `blocked` (JobState vs EvidenceStatus), cấm dùng chung cột DB | Agent | phát hiện bẫy khi đọc spec | `confirmed` (D-004) |
| 10 | Khi thiết kế state machine | `blocked` là **terminal**, gỡ block = job mới | Agent | ưu tiên giữ audit trail | `provisional` → Q-08 |
| 11 | Khi thiết kế policy | Attestation chỉ ở scope `asset`, hiệu lực 365 ngày | Agent | tránh biến gate thành hình thức | `provisional` → Q-09, Q-11 |
| 12 | Khi thiết kế validation | Allowlist định dạng ảnh/video + cạnh 64–8000 px; **không** đặt giới hạn pixel cho video | Agent | spec không nói; không bịa số cho video | `provisional` → Q-03 |
| 13 | Khi thiết kế usage | Preview miễn phí; `video_minute_unit = ceil(duration/60)` | Agent | UX bắt buộc preview; cần đơn vị đo được | `provisional` → Q-10 |
| 14 | Khi thiết kế usage | reserve ở `validating→queued`, commit ở `completed`, release ở các nhánh còn lại; một `commit` mỗi job | Agent | invariant I-6, I-7 | `confirmed` (D-010) |
| 15 | Khi thiết kế provider | Thêm `isProductionProvider` để mock không lọt vào runtime thật | Agent | guardrail 10 + kinh nghiệm "mock tạo kết quả giả" | `confirmed` (D-014) |
| 16 | Khi thiết kế API | API trả `messageKey`, không trả text đã dịch | Agent | i18n + dùng chung cho extension sau này | `confirmed` (D-012) |
| 17 | Khi chạy verification | Kiểm chứng lint **thật sự** quét `.ts`/`.tsx` bằng 2 vi phạm cố ý trước khi tin "lint xanh" | Agent | không tin kết quả xanh chưa được chứng minh | verified |
| 18 | Khi chạy verification | Bug B-01: sửa câu out-of-scope trong `FEATURES.md` đọc lẻ ra thành khẳng định năng lực | Agent | test `docs-consistency` báo đỏ | đã sửa |
| 19 | Kết thúc Phase 0 | Phase gate = **READY_WITH_BLOCKERS** | Agent | 7 blocker + 5 quyết định tạm chưa được duyệt | chờ owner |
| 20 | Kết thúc Phase 0 | **Không** tự động bắt đầu Phase 1 | Agent | prompt §10.9 | tuân thủ |

## Nguyên tắc đã áp dụng xuyên suốt

1. Thiếu bằng chứng → `unknown`/`unconfirmed`/`blocked`, không giả định pass (12 câu hỏi mở).
2. Không điền số giả: toàn bộ bảng benchmark là `unknown`, có test chặn số bịa lọt vào.
3. Không claim về SynthID / watermark vô hình, có test quét toàn bộ tài liệu.
4. Không tạo API key thật, không billing thật, không engine AI.
5. Mọi quyết định do agent tự chọn mà spec không nói rõ đều được đánh dấu `provisional` kèm câu hỏi
   cho owner — không im lặng cho qua.
