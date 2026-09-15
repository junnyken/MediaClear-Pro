# TEST_STRATEGY — MediaClear Pro

- **Date**: 2026-09-15 (cập nhật sau owner decisions) · **MINI-SPEC**: MCP-08

## 1. Hạ tầng test hiện có

| Loại | Công cụ | Trạng thái |
|---|---|---|
| Unit / contract | vitest 2.1 | `implemented` |
| Integration (ghép contract + HTTP thật qua Fastify inject) | vitest | `implemented` |
| Typecheck | `tsc -b` | `implemented` |
| Lint | eslint 9 flat config + typescript-eslint | `implemented` (đã kiểm chứng quét `.ts`/`.tsx`) |
| Build FE | `next build` | `implemented` |
| Integration với DB thật | — | `not found` — chưa có DB (Q-01 đã chốt PostgreSQL nhưng Phase 0 không tạo schema) |
| E2E browser | — | `not found` |
| Migration test | — | `not found` — Phase 0 không có migration nào |

> Test **luôn chạy trên source**: `vitest.config.ts` alias `@mediaclear/*` về `src/`, để không bao
> giờ xanh giả vì `dist/` cũ.

## 2. Invariant phải luôn xanh (12 mục)

| ID | Nội dung | Test |
|---|---|---|
| I-1 | Original source asset không bị overwrite; output luôn liên kết tới source | `invariants`, `storage`, `integration-pipeline` |
| I-2 | `completed` chỉ khi output tồn tại **và** đã verified | `invariants`, `job-state-machine` |
| I-3 | `blocked` không submit provider job | `invariants`, `job-state-machine` |
| I-4 | `blocked` không chuyển lại thành `processing` | `invariants`, `job-state-machine`, `integration-pipeline` |
| I-5 | Rights attestation không bị suy diễn từ workspace membership | `invariants`, `policy` |
| I-6 | Viewer không tạo processing job | `invariants`, `tenancy`, `policy` |
| I-7 | Provider error không biến thành success | `invariants`, `usage`, `integration-pipeline` |
| I-8 | Retry không double-charge | `invariants`, `usage`, `integration-pipeline` |
| I-9 | Preserve metadata/provenance mặc định ON | `invariants`, `provenance` |
| I-10 | Job/asset ngoài workspace không lộ existence | `invariants`, `tenancy`, `error-catalogue` |
| I-11 | `JobState.blocked` và `EvidenceStatus.blocked` không bị dùng lẫn nghĩa | `invariants`, `vocabulary` |
| I-12 | Preview không bị tính vào video-minute usage | `invariants`, `preview`, `usage` |

Danh sách sinh từ `INVARIANTS` trong `packages/contracts/src/invariants.ts`; có test khẳng định
registry đủ 12 mục và mỗi mục đều có mô tả.

## 3. Test theo MINI-SPEC

| MINI-SPEC | File test |
|---|---|
| MCP-01 vocabulary | `vocabulary.test.ts` |
| MCP-02 rights guard & policy | `policy.test.ts` |
| MCP-03 media limits | `media-limits.test.ts` |
| MCP-03 state machine | `job-state-machine.test.ts` |
| MCP-04 provider | `provider.test.ts` |
| MCP-04 benchmark harness | `benchmark.test.ts` |
| MCP-05 provenance | `provenance.test.ts` |
| MCP-06 i18n | `i18n.test.ts` |
| MCP-07 usage | `usage.test.ts` |
| MCP-07 preview | `preview.test.ts` |
| MCP-08 invariants + docs | `invariants.test.ts`, `docs-consistency.test.ts` |
| MCP-09 tenancy | `tenancy.test.ts` |
| MCP-10 storage | `storage.test.ts` |
| Error catalogue | `error-catalogue.test.ts` |
| Integration | `integration-pipeline.test.ts`, `apps/api/tests/api-contract.test.ts` |

## 4. Nguyên tắc test

1. **Không mock chính thứ đang kiểm tra.** Policy/validate/state/usage đều pure nên test gọi thẳng.
   API test chạy Fastify thật qua `inject`, không mock route.
2. **Test biên, không test giữa.** 199 MB: dưới / đúng / trên. Thời lượng: 599 / 600. Video:
   3840 / 3841 cho cả width và height. Attestation: 365 ngày / 366 ngày.
3. **Thiếu bằng chứng phải đỏ.** Duration `null`, dimension `null`, cost `null`, capability chưa
   benchmark — đều có test khẳng định hệ thống **không** cho qua và **không** tự điền số.
4. **Mock phải tự khai.** `NoopContractProvider.isProductionProvider === false` và
   `InMemoryStorageAdapter.isProductionAdapter === false`, kèm test khẳng định chúng bị loại khỏi
   đường production.
5. **Docs phải khớp code.** `docs-consistency.test.ts` đối chiếu route, invariant, job state, các
   con số giới hạn; đồng thời chặn mọi câu tự nhận năng lực mà guardrail 4 không cho phép, và chặn
   số liệu benchmark bịa.

## 5. Còn thiếu (kèm lý do)

| Hạng mục | Lý do chưa chạy |
|---|---|
| Integration với PostgreSQL thật | Phase 0 không tạo schema/migration (quyết định của owner ở Q-01) |
| Migration trên DB sạch | không có migration nào để chạy |
| Live verification với media thật | chưa có provider thật và chưa có bộ media mẫu (Q-06, Q-07) |
| Storage adapter thật (R2/MinIO) | chưa deploy; hiện chỉ có adapter in-memory cho contract test |
| E2E click-through 10 màn bằng trình duyệt | Phase 0 chỉ có skeleton; mới kiểm ở mức HTTP + nội dung HTML |
| Kiểm tra contrast/a11y tự động | chưa có component library |


---

## 6. Hồi quy Phase 1 (R-1 … R-12)

Ngoài 12 invariant của Phase 0, Phase 1 bổ sung 12 chốt hồi quy, mỗi chốt một test gọi đúng tên
trong `apps/api/tests/phase1-regression.test.ts`:

| ID | Nội dung |
|---|---|
| R-1 | Người ngoài workspace không đọc được project |
| R-2 | Người ngoài workspace không đọc được asset |
| R-3 | Viewer không tạo được job |
| R-4 | Member không quản lý billing hay quyền sở hữu workspace |
| R-5 | Asset không hợp lệ không tạo được job |
| R-6 | Xác nhận quyền không hợp lệ không tạo được job |
| R-7 | Job bị chặn không quay lại `processing` bằng bất kỳ route nào |
| R-8 | Provider no-op không sinh output "đã kiểm chứng" giả |
| R-9 | Byte của file gốc không bao giờ bị ghi đè |
| R-10 | Gửi lại upload/job không tạo reservation trùng |
| R-11 | Preview chưa hiện thực nên không thể tính tiền |
| R-12 | Phản hồi lỗi không lộ secret, đường dẫn hệ thống, hay lỗi nội bộ của framework |

## 7. Chốt chặn cho giao diện

`apps/web/tests/ui-structure.test.ts` chặn hai lớp lỗi tìm được khi bấm tay: lồng `<Button>` trong
`<Link>`, và gõ thẳng chuỗi tiếng Việt vào JSX thay vì đi qua translation key. Cả hai chốt đã được
**kiểm đối chứng âm** (dựng lại lỗi thì test đỏ).
