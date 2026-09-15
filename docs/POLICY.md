# POLICY — Rights Guard & Processing Policy

- **Date**: 2026-09-15 · **MINI-SPEC**: MCP-02 · **Trạng thái**: contract `implemented`, thi hành runtime `planned`

## 1. Luồng policy bắt buộc

```
Asset upload
 → Rights attestation required
 → Validate media constraints
 → Allow processing OR block
 → Record audit event
```

Không có đường tắt. Mọi lần đánh giá đều trả về `auditEventType` (`policy.allowed` hoặc
`policy.blocked`) — kể cả khi cho qua.

## 2. Khi nào cần xác nhận quyền

- **Mỗi asset** phải có `RightsAttestation` riêng trước khi bất kỳ `ProcessingJob` nào được
  chuyển sang `queued`.
- Không chấp nhận xác nhận cấp workspace/project kiểu "tích một lần cho tất cả" (D-006) — điều đó
  biến gate thành hình thức.
- Attestation hết hiệu lực sau **365 ngày** hoặc khi nội dung xác nhận đổi phiên bản
  (`statementVersion` tăng) → phải xác nhận lại.

## 3. Nội dung xác nhận

| Locale | Key | Nội dung |
|---|---|---|
| vi (mặc định) | `rights.attestation.v1.statement` | "Tôi xác nhận tôi sở hữu hoặc có quyền chỉnh sửa nội dung này, và tôi chịu trách nhiệm về việc sử dụng kết quả sau khi xử lý." |
| en | `rights.attestation.v1.statement` | "I confirm that I own this content or am authorised to edit it, and that I am responsible for how the result is used." |

**Đây là lời khai của người dùng (`attestationType: 'user_self_declared'`), KHÔNG phải bằng chứng
sở hữu** (invariant I-4). Không có field nào tên kiểu `ownershipVerified` trong toàn bộ contract.

## 4. Khi người dùng không xác nhận

Job chuyển sang `blocked` với `MCP_POLICY_RIGHTS_ATTESTATION_MISSING`. `blocked` là **terminal**
(D-005): sau khi người dùng xác nhận, hệ thống tạo **job mới**, không "rửa" job cũ — để audit trail
luôn thể hiện đúng chuyện đã xảy ra.

Job `blocked` **không bao giờ** được submit provider job (invariant I-3).

## 5. Các trường hợp luôn bị block

| Trường hợp | Mã |
|---|---|
| Chưa xác nhận quyền / xác nhận của asset khác | `MCP_POLICY_RIGHTS_ATTESTATION_MISSING` |
| Xác nhận quá hạn hoặc theo bản statement cũ | `MCP_POLICY_RIGHTS_ATTESTATION_STALE` |
| Yêu cầu xoá provenance | `MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED` |
| Asset thuộc workspace khác (cross-tenant) | `MCP_POLICY_WORKSPACE_MISMATCH` |
| Media không hợp lệ hoặc danh sách thao tác rỗng | `MCP_POLICY_OPERATION_NOT_PERMITTED` |

## 6. Audit fields tối thiểu

`AuditEvent`: `id`, `workspaceId`, `actorUserId`, `eventType`, `subjectType`, `subjectId`,
`detail`, `occurredAt`.

`detail` **chỉ** chứa metadata phi nhạy cảm (assetId, workspaceId, số thao tác, có/không
attestation, danh sách mã lý do). Cấm log: media bytes, API key, PII, nội dung file (guardrail 15).
Có test khẳng định `auditDetail` không chứa chuỗi kiểu `data:`/`base64`/`api_key`.

## 7. Report / abuse

`planned` — chưa thiết kế trong Phase 0. Câu hỏi mở tại OPEN_QUESTIONS Q-05.

## 8. Điều không được phép

Không thiết kế thông điệp hay flow khuyến khích xoá logo bản quyền của bên thứ ba. Không dùng sản
phẩm để làm giả nguồn gốc / chứng nhận / quyền sở hữu / lịch sử nội dung. UI chỉ được mô tả năng
lực là xử lý **visible** watermark / logo / object.
