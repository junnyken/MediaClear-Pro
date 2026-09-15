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

---

# Phase 1 — policy đã chạy thật (2026-09-15)

## 11. Cổng đã có hiệu lực (không còn là contract trên giấy)

| Cổng | Nơi thi hành | Bằng chứng |
|---|---|---|
| Chưa đăng nhập | `resolveUser()` | HTTP 401 `MCP_AUTHZ_SESSION_REQUIRED` |
| Ngoài workspace | `authorize()` | HTTP 404, không lộ existence |
| Thiếu quyền theo role | `authorize()` | HTTP 403 `MCP_AUTHZ_INSUFFICIENT_ROLE` |
| Tệp chưa kiểm tra | `JobService` cổng 2 | job `blocked`, `validation_block` |
| Tệp không đạt | `validateMedia()` | job `blocked` kèm đúng mã lỗi validation |
| Chưa/hết hạn xác nhận quyền | `evaluateProcessingPolicy()` | job `blocked`, `policy_block` |
| Provider không làm được | `JobService` cổng 4 | job `blocked`, `provider_block` |

## 12. Xác nhận quyền trong Phase 1

- Lưu **append-only**: mỗi lần ký là một bản ghi mới, giữ nguyên ai ký, ký bản nào, lúc nào.
- Bản đang hiệu lực = bản mới nhất khớp `(assetId, sourceFileId)` và `status='active'`.
- Ký sai phiên bản câu chữ ⇒ `MCP_POLICY_RIGHTS_ATTESTATION_STALE`, phải ký lại bản hiện hành.
- Xác nhận của asset khác **không** dùng lại được (đã có test HTTP thật).
- Giao diện hiển thị đủ bốn điều: phạm vi sở hữu · đây là tuyên bố của người dùng · chỉ xử lý phần
  nhìn thấy được · giới hạn về các dấu ẩn không nhìn thấy được. Nút xác nhận **khoá** cho tới khi
  người dùng tick ô đồng ý.

> Ghi chú câu chữ: bản tiếng Việt tránh thuật ngữ kỹ thuật theo guardrail đã có từ Phase 0
> (có test chặn). Vì vậy câu "chỉ xử lý logo/watermark hiển thị" được diễn đạt thành "logo, nhãn
> hiệu và dấu hiệu nhận diện nhìn thấy được". Ý nghĩa giữ nguyên; **BA là người chốt câu chữ** —
> xem Q-11.

## 13. Job bị chặn

Job bị chặn **vẫn được ghi lại** (trạng thái `blocked`, có `reasonCode` + `blockReasonKind`) nhưng
**không** giữ mức dùng. Đây là trạng thái cuối: không route nào đưa nó về `processing`, kể cả huỷ
(trả `MCP_STATE_TERMINAL`). Khắc phục xong thì tạo **job mới**, job cũ giữ nguyên để tra cứu.

Ngoại lệ: khi **quyền** bị từ chối thì **không** ghi job nào — người không có quyền không được tạo
dấu vết trong workspace của người khác.

---

# Phase 1.1 — câu chữ và lưu giữ (2026-09-15)

## 14. Nội dung xác nhận quyền: phiên bản 2

Owner duyệt bản câu chữ mới. Vì hệ thống lưu `statementId + statementVersion + localeShown` trên từng
lời khai để về sau chứng minh người dùng đã đồng ý với **văn bản nào**, đổi chữ ⇒ **đổi phiên bản**
(D-032). Bản v1 được giữ nguyên trong file dịch làm dấu vết lịch sử, không xoá.

| Khoản | Bản đang hiệu lực (v2) |
|---|---|
| Phạm vi năng lực | "MediaClear Pro chỉ hỗ trợ xử lý logo, nhãn hiệu và dấu hiệu nhận diện nhìn thấy được" |
| Xác nhận quyền | "Tôi xác nhận rằng tôi sở hữu nội dung này hoặc có quyền chỉnh sửa nội dung này." |
| Giới hạn về dấu hiệu nhận diện vô hình | "MediaClear Pro không cam kết loại bỏ hoặc thay đổi các dấu hiệu nhận diện vô hình trong tệp." |
| CTA chính | "Làm sạch vùng nhận diện" · "Xử lý vùng logo và dấu hiệu nhận diện" |

**Hệ quả có chủ đích**: mọi lời khai ký theo v1 trở thành `stale`, người dùng phải xác nhận lại. Đây
là lần đầu cơ chế phiên bản của Phase 0 chạy thật — đã kiểm chứng trên server thật.

> Câu về giới hạn dấu hiệu nhận diện vô hình trong prompt **bị cắt giữa chừng**; hệ thống chỉ dùng
> phần đọc được và **không tự viết tiếp** (Q-20).

## 15. Lưu giữ dữ liệu (owner decision Q-18)

| Loại dữ liệu | Giữ trong bao lâu | Tính từ |
|---|---|---|
| Tệp gốc, tệp kết quả | 30 ngày | **lần truy cập cuối** |
| Tệp trung gian / thất bại | 7 ngày | lúc tạo |
| Bản xem thử | 24 giờ | lúc tạo |
| Nhật ký thao tác | 365 ngày | lúc xảy ra |
| Sổ mức dùng | 24 tháng | lúc ghi |
| Dấu vết của tệp đã xoá | 30 ngày | lúc xoá |
| Xác nhận quyền | theo tệp; hiệu lực 365 ngày | lúc ký |

Bốn trạng thái lưu giữ: `active` · `scheduled_for_deletion` · `deleted` · `legal_hold`.

Quy tắc không được vi phạm:

1. Tệp **đang giữ theo yêu cầu pháp lý** không bao giờ nằm trong danh sách dọn.
2. Nhật ký thao tác **không** bị dọn theo tệp — có luật riêng.
3. Sổ mức dùng giữ 24 tháng cho đối soát.
4. Tệp gốc không bị dọn chỉ vì "đã tạo lâu" — phải là **không ai dùng** đủ 30 ngày.
5. Phase 1.1 **không có đường xoá nào**: chỉ có bản thử chỉ đếm, không có cờ ép xoá, không có
   route `DELETE`. Có test khẳng định điều này.

---

# Đóng Q-20 — câu chữ canonical và quy tắc phiên bản (2026-09-15)

## 16. Cái gì là bằng chứng, cái gì là ngữ cảnh

Đây là phân biệt quan trọng nhất của mục này:

| Thành phần | Vai trò | Có version không |
|---|---|---|
| `rights.attestation.v2.statement` | **Văn bản được ký** — cùng với `statementVersion` tạo thành bằng chứng người dùng đã đồng ý điều gì | **Có**. Đổi chữ ⇒ phải lên phiên bản mới |
| Câu phạm vi hỗ trợ, câu về dữ liệu còn sót, câu giới hạn dấu hiệu nhận diện vô hình | **Ngữ cảnh hiển thị kèm** để người dùng hiểu hệ thống làm được gì | Không |
| Tiêu đề mục, nhãn phiên bản, nhãn nút | Nhãn giao diện | Không |

Vì vậy bản vá Q-20 sửa được câu chữ ngữ cảnh mà **không** cần tạo phiên bản tuyên bố mới, và **không
một chữ nào** của văn bản đã phát hành (v1, v2) bị đụng tới. Có test đóng băng hai văn bản này.

> Điểm còn chờ owner: ô tick ghi "xác nhận **nội dung trên**" trong khi chỉ một câu được version hoá.
> Xem Q-22.

## 17. Bộ câu chữ canonical đang hiệu lực

| Vai trò | Câu tiếng Việt |
|---|---|
| Phạm vi hỗ trợ | "MediaClear Pro chỉ hỗ trợ xử lý logo, nhãn hiệu và dấu hiệu nhận diện nhìn thấy được" |
| Dữ liệu còn sót trong tệp | "Dữ liệu nguồn gốc và dấu hiệu nhận diện vô hình có thể vẫn được giữ trong tệp." |
| Giới hạn | "MediaClear Pro không cam kết loại bỏ hoặc thay đổi các dấu hiệu nhận diện vô hình trong tệp." |
| Xác nhận quyền (**văn bản được ký**, v2) | "Tôi xác nhận rằng tôi sở hữu nội dung này hoặc có quyền chỉnh sửa nội dung này." |
| CTA | "Làm sạch vùng nhận diện" · "Xử lý vùng logo và dấu hiệu nhận diện" |

Ba điều hệ thống **không bao giờ** nói: không nói xoá/vô hiệu hoá/kiểm soát được dấu hiệu nhận diện
vô hình · không nói dữ liệu nguồn gốc luôn còn sau mọi lần xuất tệp · không dùng cách nói bị cấm làm
CTA chính. Có test chặn cả ba ở **cả hai** ngôn ngữ.

## 18. Ánh xạ khoá dịch

Prompt gợi ý năm khoá theo ngữ nghĩa; repo đã có sẵn ba khoá tương đương nên **dùng lại**, không tạo
khoá trùng nghĩa:

| Ngữ nghĩa prompt gợi ý | Khoá thật trong repo | Ghi chú |
|---|---|---|
| `rights.attestation.visible_scope_note` | `policy.visible_identity_scope` | dùng lại |
| `rights.attestation.rights_confirmation` | `rights.attestation.v2.statement` | dùng lại — **văn bản được ký** |
| `rights.attestation.provenance_warning` | `provenance.invisible_identity_disclaimer` | dùng lại |
| `rights.attestation.statement_version` | `rights.attestation.statement_version_label` | **mới**, không gắn version |
| `cleanup.visible_identity.cta` | `screen.asset_detail.create_job_cta` | dùng lại |
| — | `rights.attestation.scope_heading` | **mới**, tiêu đề mục |
| — | `provenance.retained_data_note` | **mới**, câu về dữ liệu còn sót |

Khoá lịch sử (`rights.attestation.v1.*`, `provenance.invisible_watermark_disclaimer`) **giữ nguyên
trong file dịch** để hồ sơ cũ vẫn tra cứu được; giao diện không còn gọi chúng.

## 19. Cấu trúc hộp thoại xác nhận quyền

```
Xác nhận quyền sử dụng
├─ Phạm vi hỗ trợ
│    câu phạm vi · câu dữ liệu còn sót · câu giới hạn
├─ Xác nhận quyền sử dụng
│    lưu ý sở hữu · lưu ý đây là tuyên bố của bạn · VĂN BẢN ĐƯỢC KÝ · ô tick
└─ Phiên bản tuyên bố: vN · hiệu lực 365 ngày
```

Nút xác nhận **khoá** cho tới khi người dùng tick. Hai mục có tiêu đề gắn nhãn cho trình đọc màn hình.
