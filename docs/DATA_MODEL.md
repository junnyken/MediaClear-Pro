# DATA_MODEL — MediaClear Pro

- **Date**: 2026-09-15 · **MINI-SPEC**: MCP-01 / MCP-05 · **Trạng thái**: contract `implemented`, schema DB `planned`

> Phase 0 **không** tạo migration nào (owner decision Q-01). Đây là contract TypeScript tại
> `packages/contracts/src/entities.ts`; DB schema sẽ sinh ở Phase 1.

## 1. Entity

| Entity | Vai trò | Ghi chú bắt buộc |
|---|---|---|
| `User` | tài khoản | `defaultLocale` mặc định `vi` |
| `Workspace` | ranh giới đa tenant | mọi truy vấn phải filter theo `workspaceId` |
| `WorkspaceMembership` | user ↔ workspace + role | **mới 2026-09-15**; nguồn duy nhất của role, không suy diễn |
| `Project` | nhóm công việc | |
| `Asset` | đơn vị nội dung logic | trỏ tới đúng một `SourceFile` |
| `SourceFile` | binary gốc | **immutable**, có cờ `readonly immutable: true` |
| `ProcessingJob` | một lần xử lý | `state`, `idempotencyKey`, `attemptCount`, `blockReasonKind` |
| `OutputAsset` | kết quả | `sourceAssetId` **bắt buộc**, `validated: boolean` |
| `BrandKit` | logo/nhãn của khách | dùng ở phase sau |
| `RightsAttestation` | lời khai quyền | `attestationType: 'user_self_declared'`; gắn **cả** `assetId` và `sourceFileId`; `status: 'active' \| 'blocked'` |
| `ProvenanceRecord` | thông tin gốc trước/sau | ba giá trị `present/absent/unknown` |
| `ProcessingReceipt` | biên bản xử lý | nối job ↔ source ↔ output ↔ provider run |
| `AuditEvent` | vết kiểm toán | `detail` chỉ metadata phi nhạy cảm |
| `ProviderRun` | một lần gọi provider | cost/latency/evidence |
| `UsageLedgerEntry` | sổ mức dùng | `reserve` / `commit` / `release` |

## 2. Quy ước `null` quan trọng

`durationSeconds`, `widthPx`, `heightPx`, `estimatedCostUsd`, `actualCostUsd`, `latencyMs` dùng
`null` khi **chưa đo được**. Cấm điền `0` thay cho `null` — `0` là một số liệu, `null` là "chưa
biết". UI hiển thị `null` bằng "Chưa xác định", không hiển thị `0`.

## 3. Enum (vocabulary chốt)

- `MediaType`: `image` · `video`
- `CleanupOperation`: `visible_logo_cleanup` · `visible_text_cleanup` · `object_cleanup` · `crop` ·
  `blur` · `inpaint` · `tracked_inpaint` · `brand_overlay`
- `JobState`: `uploaded` · `validating` · `queued` · `processing` · `review_required` ·
  `completed` · `failed` · `blocked` · `cancelled`
- `EvidenceStatus`: `verified` · `partially_verified` · `unknown` · `unconfirmed` · `blocked`
- `WorkspaceRole`: `owner` · `admin` · `member` · `viewer` (owner decision Q-04)
- `BlockReasonKind`: `policy_block` · `validation_block` · `provider_block` (owner decision Q-08)
- `StorageClass`: `source` · `output` · `preview`

> **Bẫy đã ghi nhận (D-004)**: `blocked` xuất hiện ở cả `JobState` và `EvidenceStatus` với hai nghĩa
> khác nhau. `JobState.blocked` = policy từ chối; `EvidenceStatus.blocked` = không thu thập được
> bằng chứng. **Không bao giờ dùng chung một cột DB cho hai enum này.** Có test khẳng định hai enum
> không phải tập con của nhau.

## 4. State machine (`ProcessingJob`)

```
uploaded ──► validating ──► queued ──► processing ──► review_required
   │             │            │            │                │
   │             ├─► blocked  ├─► blocked  ├─► completed*    ├─► completed*
   │             ├─► failed   │            ├─► failed        ├─► processing
   └─► cancelled └─► cancelled└─► cancelled└─► cancelled     ├─► failed
                                                             └─► cancelled

* completed CHỈ hợp lệ khi outputAssetId != null VÀ outputValidated === true.
Terminal: completed · failed · blocked · cancelled (không có transition ra).
Owner decision Q-08: gỡ block KHÔNG phải transition — phải tạo `ProcessingJob` mới với
`job_id` mới; job cũ giữ nguyên `blocked` và toàn bộ audit history.
```

## 5. Quan hệ source ↔ output

`OutputAsset.sourceAssetId` bắt buộc và `OutputAsset.storageKey` phải khác
`SourceFile.storageKey`. Hàm `assertOutputDoesNotOverwriteSource()` thi hành điều này và có
regression test (invariant I-1).

## 6. Usage ledger

`UsageLedgerEntry(jobId, entryType, unitType, quantity, idempotencyKey, reasonCode)`.

Vòng đời (owner decision Q-10): `accepted job submission → reserve → provider processing →
verified output → commit`; provider failure hoặc validation failure do người dùng → `release` theo
`releasesUsageReservation` của mã lỗi.

Ràng buộc dự kiến ở DB (Phase 1): unique `(jobId, entryType='reserve')` và unique
`(jobId, entryType='commit')`. Ở tầng contract, `canReserveUsage()` và `canCommitUsage()` đã thi
hành cả hai.

## 7. Storage và migrations

Khoá lưu trữ: `<workspaceId>/<source|output|preview>/<id><ext>`. Object class `source` là bất biến —
`assertWritableKey()` chặn mọi lần ghi đè (invariant I-1). Media binary **không bao giờ** nằm trong
PostgreSQL.

| | |
|---|---|
| Migration thuộc Phase 0 | **Không có** (contract-only, theo yêu cầu owner ở Q-01) |
| Migration để Phase 1 | Toàn bộ 15 entity + ràng buộc unique của usage ledger + index theo `workspaceId` |

---

# Phase 1 — schema thật (2026-09-15)

## 8. Migration

`db/migrations/0001_phase1_init.sql` — **đã chạy thật trên một PostgreSQL 16 sạch** (container
`postgres:16-alpine`), tạo 12 bảng. Migration chỉ TẠO mới, không sửa/xoá gì (không destructive).

| Bảng | Vai trò |
|---|---|
| `users`, `workspaces`, `workspace_members` | danh tính và tenancy |
| `projects`, `assets`, `source_files` | thư viện nội dung |
| `validation_results` | kết quả kiểm tra media của từng asset |
| `rights_attestations` | lời khai quyền, append-only |
| `processing_jobs` | vòng đời job |
| `usage_ledger_entries` | reserve / commit / release |
| `audit_events` | dấu vết thao tác |
| `schema_migrations` | phiên bản đã áp dụng |

## 9. Ràng buộc bảo vệ invariant ở tầng dữ liệu

Không chỉ dựa vào code ứng dụng — các ràng buộc sau **đã được kiểm chứng là chặn thật** trên DB sạch:

| Ràng buộc | Chặn điều gì |
|---|---|
| `FOREIGN KEY (project_id, workspace_id)` (và tương tự cho asset/job) | asset/job trỏ sang tài nguyên của workspace khác |
| `processing_jobs_completed_requires_output` | `completed` khi chưa có output (I-2) |
| `processing_jobs_blocked_requires_reason` | `blocked` mà không có lý do |
| `UNIQUE (job_id, entry_type)` + `UNIQUE (idempotency_key)` | double-charge / reserve trùng (I-8) |
| `source_files_stored_has_measurements` | đánh dấu đã lưu trong khi chưa có số đo thật |
| `CHECK (preserve_original_metadata)` | tắt bảo toàn metadata (I-9) |

## 10. Chỉ mục và lưu giữ

Chỉ mục theo `workspace_id` + thời gian cho project/asset/job/usage/audit (mọi truy vấn đều lọc theo
tenant trước). **Chưa có**: soft-delete, retention policy, xoá theo yêu cầu người dùng — `planned`,
cần owner quyết thời hạn lưu.

## 11. Chênh lệch có chủ đích giữa runtime và schema

Runtime Phase 1 dùng `InMemoryPersistence` (`ephemeral`), **không** phải PostgreSQL. Schema được
thiết kế và chạy thử để không nợ thiết kế, nhưng adapter PostgreSQL là việc của phase sau
(`planned`). `/healthz` khai đúng điều này, không giả vờ đã có DB.
