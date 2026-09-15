# DATA_MODEL — MediaClear Pro

- **Date**: 2026-09-15 · **MINI-SPEC**: MCP-01 / MCP-05 · **Trạng thái**: contract `implemented`, schema DB `planned`

> Phase 0 **không** tạo migration. Đây là contract TypeScript tại
> `packages/contracts/src/entities.ts`; DB schema sẽ sinh ở Phase 1.

## 1. Entity

| Entity | Vai trò | Ghi chú bắt buộc |
|---|---|---|
| `User` | tài khoản | `defaultLocale` mặc định `vi` |
| `Workspace` | ranh giới đa tenant | mọi truy vấn phải filter theo `workspaceId` |
| `Project` | nhóm công việc | |
| `Asset` | đơn vị nội dung logic | trỏ tới đúng một `SourceFile` |
| `SourceFile` | binary gốc | **immutable**, có cờ `readonly immutable: true` |
| `ProcessingJob` | một lần xử lý | `state`, `idempotencyKey`, `attemptCount` |
| `OutputAsset` | kết quả | `sourceAssetId` **bắt buộc**, `validated: boolean` |
| `BrandKit` | logo/nhãn của khách | dùng ở phase sau |
| `RightsAttestation` | lời khai quyền | `attestationType: 'user_self_declared'` |
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
```

## 5. Quan hệ source ↔ output

`OutputAsset.sourceAssetId` bắt buộc và `OutputAsset.storageKey` phải khác
`SourceFile.storageKey`. Hàm `assertOutputDoesNotOverwriteSource()` thi hành điều này và có
regression test (invariant I-1).

## 6. Usage ledger

`UsageLedgerEntry(jobId, entryType, unitType, quantity, idempotencyKey, reasonCode)`.
Ràng buộc dự kiến ở DB (Phase 1): unique `(jobId, entryType='commit')`.
