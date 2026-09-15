# POLICY — Rights Guard, Tenancy & Processing Policy

- **Date**: 2026-09-15 (cập nhật sau owner decisions Q-04, Q-08, Q-09)
- **MINI-SPEC**: MCP-02 (rights guard) + MCP-09 (tenancy)
- **Trạng thái**: contract `implemented`, thi hành runtime `planned`

## 1. Luồng policy bắt buộc

```
Asset upload
 → Kiểm tra tenancy + role          (MCP-09)
 → Rights attestation required      (MCP-02)
 → Validate media constraints       (MCP-03)
 → Allow processing OR block
 → Record audit event
```

Không có đường tắt. Mọi lần đánh giá đều trả về `auditEventType` (`policy.allowed` hoặc
`policy.blocked`) — kể cả khi cho qua. Authorization cũng sinh audit (`authz.allowed` /
`authz.denied`).

## 2. Tenancy và vai trò (owner decision Q-04)

Chuỗi sở hữu: **User → Workspace → Project → Asset**.

| Quyền | owner | admin | member | viewer |
|---|:--:|:--:|:--:|:--:|
| `workspace.manage` | ✅ | ❌ | ❌ | ❌ |
| `workspace.members.manage` | ✅ | ❌ | ❌ | ❌ |
| `billing.manage` | ✅ | ❌ | ❌ | ❌ |
| `project.manage` | ✅ | ✅ | ❌ | ❌ |
| `asset.upload` | ✅ | ✅ | ✅ | ❌ |
| `asset.read` | ✅ | ✅ | ✅ | ✅ |
| `rights.attest` | ✅ | ✅ | ✅ | ❌ |
| `job.create` | ✅ | ✅ | ✅ | **❌** |
| `job.read` | ✅ | ✅ | ✅ | ✅ |
| `audit.read` | ✅ | ✅ | ❌ | ❌ |

Quy tắc cứng:

1. **Không có quyền suy diễn.** Ma trận trên là liệt kê tường minh; quyền ghi asset không bao giờ
   kéo theo billing, quản trị workspace hay publish.
2. **Kiểm tra workspace trước role.** Tài nguyên thuộc workspace khác → từ chối bằng
   `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` (HTTP **404**), không xác nhận nó có tồn tại (invariant
   I-10). Thiếu quyền *bên trong* workspace mới trả `MCP_AUTHZ_INSUFFICIENT_ROLE` (403).
3. **Mọi quyết định đều được audit**, kèm `actorUserId`, `actorRole`, `permission`, `resourceType`.
   Khi từ chối cross-workspace, `resourceId` trong audit là `null`.

## 3. Khi nào cần xác nhận quyền (owner decision Q-09)

- **Mỗi asset** phải có `RightsAttestation` riêng trước khi bất kỳ `ProcessingJob` nào được chuyển
  sang `queued`. Scope duy nhất: `asset-level`.
- Attestation gắn với **cả `assetId` và `sourceFileId`**: source file mới trên cùng asset ⇒ phải
  xác nhận lại.
- Attestation của asset khác không bao giờ được dùng lại.
- Hiệu lực **365 ngày** (`RIGHTS_ATTESTATION_VALIDITY_DAYS`). Quá hạn ⇒
  `MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED`.
- Đổi `statementVersion` ⇒ attestation cũ thành `STALE`, phải xác nhận lại.
- Asset bị report ⇒ attestation chuyển `status: 'blocked'` ⇒
  `MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED`, không được submit job.
- Lưu tối thiểu: `attestedByUserId`, `workspaceId`, `assetId`, `sourceFileId`, `attestedAt`,
  `statementId` + `statementVersion` (policy version), `localeShown`, và một `AuditEvent` tương ứng.

## 4. Nội dung xác nhận

| Locale | Key | Nội dung |
|---|---|---|
| vi (mặc định) | `rights.attestation.v1.statement` | "Tôi xác nhận tôi sở hữu hoặc có quyền chỉnh sửa nội dung này, và tôi chịu trách nhiệm về việc sử dụng kết quả sau khi xử lý." |
| en | `rights.attestation.v1.statement` | "I confirm that I own this content or am authorised to edit it, and that I am responsible for how the result is used." |

**Đây là lời khai của người dùng (`attestationType: 'user_self_declared'`), KHÔNG phải bằng chứng
sở hữu và không phải legal proof tuyệt đối.** Không có field nào tên kiểu `ownershipVerified` trong
toàn bộ contract, và **không** role nào được miễn bước xác nhận (invariant I-5).

## 5. Khi người dùng không xác nhận

Job chuyển sang `blocked` với `MCP_POLICY_RIGHTS_ATTESTATION_MISSING`. `blocked` là **terminal**
(owner decision Q-08): sau khi người dùng xác nhận, hệ thống tạo **`ProcessingJob` mới với
`job_id` mới**; job cũ giữ nguyên trạng thái và toàn bộ audit history. Không có transition nào từ
`blocked` quay lại `processing` (invariant I-4).

Job `blocked` **không bao giờ** được submit provider job — `assertCanSubmitProviderJob('blocked')`
trả `MCP_STATE_JOB_BLOCKED` (invariant I-3).

## 6. Phân loại lý do bị chặn (owner decision Q-08)

| Kind | Nguồn | Ví dụ mã |
|---|---|---|
| `policy_block` | rights guard, tenancy, provenance | `MCP_POLICY_RIGHTS_ATTESTATION_MISSING`, `MCP_AUTHZ_INSUFFICIENT_ROLE` |
| `validation_block` | media validation | `MCP_VAL_FILE_TOO_LARGE`, `MCP_VAL_VIDEO_WIDTH_EXCEEDED` |
| `provider_block` | dịch vụ xử lý | `MCP_PROVIDER_TIMEOUT`, `MCP_PROVIDER_UNAVAILABLE` |

`blockReasonKindFor(code)` suy ra kind từ category trong error catalogue — không phân loại thủ công.

## 7. Các trường hợp luôn bị block

| Trường hợp | Mã |
|---|---|
| Chưa xác nhận quyền / xác nhận của asset hoặc source file khác | `MCP_POLICY_RIGHTS_ATTESTATION_MISSING` |
| Xác nhận quá hạn 365 ngày | `MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED` |
| Xác nhận theo bản statement cũ | `MCP_POLICY_RIGHTS_ATTESTATION_STALE` |
| Asset đang bị report / chờ review | `MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED` |
| Yêu cầu xoá provenance | `MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED` |
| Tài nguyên thuộc workspace khác | `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED` (404) |
| Role không đủ quyền (vd viewer tạo job) | `MCP_AUTHZ_INSUFFICIENT_ROLE` |
| Media không hợp lệ hoặc danh sách thao tác rỗng | `MCP_POLICY_OPERATION_NOT_PERMITTED` |

## 8. Audit fields tối thiểu

`AuditEvent`: `id`, `workspaceId`, `actorUserId`, `eventType`, `subjectType`, `subjectId`,
`detail`, `occurredAt`.

`detail` **chỉ** chứa metadata phi nhạy cảm (assetId, workspaceId, role, số thao tác, có/không
attestation, danh sách mã lý do). Cấm log: media bytes, API key, PII, nội dung file (guardrail 15).
Có test khẳng định `auditDetail` không chứa chuỗi kiểu `data:`/`base64`/`api_key`, và không chứa
`assetId` khi từ chối cross-workspace.

## 9. Report / abuse

Phase 0 chốt được **một nửa**: asset bị report ⇒ attestation `blocked` ⇒ không xử lý được. Quy
trình đầy đủ (ai review, thời hạn, khiếu nại) vẫn `unknown` — Q-05.

## 10. Điều không được phép

Không thiết kế thông điệp hay flow khuyến khích xoá logo bản quyền của bên thứ ba. Không dùng sản
phẩm để làm giả nguồn gốc / chứng nhận / quyền sở hữu / lịch sử nội dung. UI chỉ được mô tả năng
lực là xử lý phần **nhìn thấy được**.
