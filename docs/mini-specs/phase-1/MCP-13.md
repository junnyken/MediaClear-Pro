# MCP-13 — Asset Rights Attestation Gate (Phase 1)

- **ID**: `MCP-13` · **Parent phase**: Phase 1 — SaaS Shell & Media Intake Foundation
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-15

## Context

Đọc: như `MCP-10` (Phase 1) + `docs/POLICY.md` §3 + `docs/mini-specs/MCP-02.md` (Phase 0).
Trạng thái: `policy.ts` **đã có** `RIGHTS_STATEMENT` (id/version/i18nKey/validityDays đọc từ config),
`attestationErrors()` phân biệt missing / stale / expired / blocked, và `evaluateProcessingPolicy()`
kiểm tenancy trước. `entities.ts` đã có `RightsAttestation` (scope `'asset'`, có `sourceFileId`,
`attestationType: 'user_self_declared'`). Chưa có nơi tạo/đọc attestation.

Quyết định phải giữ: attestation là **lời khai của người dùng**, không phải bằng chứng sở hữu (I-5);
365 ngày (D-022); source file mới ⇒ phải xác nhận lại; không suy diễn từ membership/role.

## Goal

Cho người dùng ký xác nhận quyền ở cấp asset và biến xác nhận đó thành điều kiện cứng của mọi lần tạo
job, sao cho không có asset nào đi tiếp khi xác nhận thiếu, hết hạn, sai bản, hoặc đang bị chặn.

## Constraints (Guardrails)

1. Không đặt tên field kiểu `ownershipVerified` — đây là lời khai, không phải xác minh.
2. Không cho attestation cấp workspace/project ("tích một lần cho tất cả").
3. Attestation của asset A hoặc của source file khác **không** dùng lại được cho asset B.
4. Hiệu lực đọc từ `RIGHTS_ATTESTATION_VALIDITY_DAYS`, không hard-code 365.
5. Câu xác nhận hiển thị phải qua i18n key, lưu lại `statementId` + `statementVersion` + `localeShown`.
6. UI phải nói rõ hệ thống **không** cam kết về watermark vô hình (guardrail 4 của Phase 0).
7. Mọi lần tạo attestation sinh audit event; không ghi nội dung nhạy cảm.

## Scope

**A. Domain model** — tái dùng `RightsAttestation` nguyên vẹn. Không thêm field.

**B. Services/engine** — `AttestationService.create/getActive`; policy gate gọi qua
`evaluateProcessingPolicy()` (không tự viết luật thứ hai).

**C. API contract** — `POST /v1/assets/:assetId/rights-attestation`,
`GET /v1/assets/:assetId/rights-attestation`.

**D. UI surfaces** — Rights Attestation dialog: checkbox xác nhận, hiển thị `policy version`,
4 thông điệp bắt buộc (sở hữu/quyền chỉnh sửa · đây là tuyên bố của bạn · chỉ xử lý phần hiển thị
trong phạm vi được phép · không cam kết về watermark vô hình).

**E. Tests** — unit (biên 365/366 ngày, stale version, blocked), integration (không attestation ⇒ không
tạo được job; attestation asset A không cứu asset B), regression (I-5).

## Audit Before Build

| Đã kiểm | Kết luận |
|---|---|
| `attestationErrors()` | Đủ 4 nhánh + biên ngày. **Không sửa.** |
| `RIGHTS_STATEMENT` | version = 1, i18n key đã có bản vi + en. Dùng lại. |
| i18n `rights.attestation.v1.*` | Đã có title/statement/checkbox/decline_note. Thiếu key cho dialog Phase 1 → bổ sung. |
| `AuditEvent.subjectType` | Đã có `'attestation'`. Dùng lại. |

**Gap** (data): không có store attestation. **Gap** (UX wording): chưa có màn ký thật.

## Design Choice

Attestation lưu **append-only**: mỗi lần ký tạo bản ghi mới; bản "đang hiệu lực" là bản mới nhất khớp
`(assetId, sourceFileId)` và `status='active'`. Lý do: giữ được dấu vết ai ký, ký bản nào, lúc nào —
nếu cập nhật tại chỗ thì mất lịch sử, mà audit là bắt buộc. Bỏ hướng "một hàng, update status" vì lý do đó.

## Test Plan

- Unit: 365 ngày còn hiệu lực, 366 ngày hết hạn; `statementVersion` thấp hơn ⇒ stale; `status='blocked'` ⇒ chặn.
- Integration: ký → tạo job được; chưa ký → `MCP_POLICY_RIGHTS_ATTESTATION_MISSING` + job không sinh.
- Regression: I-5 — thành viên/role cao không tự sinh attestation.
- Live: ký thật qua HTTP rồi đọc lại bằng `GET`.

## Success Criteria

- Asset không có attestation ⇒ không tạo được processing job.
- Attestation hết hạn bị chặn; attestation của asset khác không áp dụng.
- UI hiển thị rõ đây là tuyên bố của người dùng, có policy version.
- Policy gate test xanh.

## Remaining Limits / Follow-ups

- Quy trình report/abuse đầy đủ vẫn `unknown` (Q-05); Phase 1 chỉ có trạng thái `blocked` để policy đọc.
- Câu chữ pháp lý chưa được luật sư/BA duyệt (Q-11).
