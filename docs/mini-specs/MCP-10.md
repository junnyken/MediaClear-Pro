# MCP-10 — Object Storage Abstraction Contract

| | |
|---|---|
| **ID** | MCP-10 · **Parent phase** Phase 0 (gate closure) |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: owner decision Q-01, `ARCH.md` §4, `MCP-05` (bảo toàn source).
- Trạng thái trước khi làm: `ARCH.md` ghi object storage là `unknown`; không có adapter nào.
- Quyết định phải giữ: file gốc không bao giờ bị ghi đè (invariant I-1).

## Goal
Cho phép Phase 1 nối storage thật (R2/MinIO) mà domain không phải biết vendor nào, và không có
đường nào ghi đè lên file gốc.

## Constraints
1. Domain logic **không** phụ thuộc trực tiếp vào Cloudflare R2.
2. Mọi truy cập đi qua `ObjectStorageAdapter`.
3. Media binary **không bao giờ** nằm trong PostgreSQL.
4. Adapter dev/test phải tự khai `isProductionAdapter = false`.
5. Không tạo migration production không cần thiết; Phase 0 = 0 migration.
6. Không commit khoá/secret của vendor.

## Scope
- **A. Domain model**: `StorageClass`, `StorageObjectRef`, `SignedUrl`, `StorageObjectHead`,
  `STORAGE_TARGET`, `MEDIA_BINARY_IN_DATABASE`.
- **B. Services/engine**: `storageKeyFor()`, `storageClassOf()`, `assertWritableKey()`,
  `InMemoryStorageAdapter` (chỉ cho test).
- **C. API contract**: `POST /v1/uploads` trả signed upload URL (`planned`); mã lỗi
  `MCP_STORAGE_*`.
- **D. UI surfaces**: không đổi ở Phase 0.
- **E. Tests**: `storage.test.ts` (7) + phần storage trong `integration-pipeline.test.ts`.

## Audit Before Build
- Đã kiểm: `entities.ts` có `storageKey` dạng chuỗi tự do, không có quy ước; không có adapter,
  không có nơi nào chặn ghi đè ở tầng lưu trữ.
- Gap **data**: `storageKey` không có cấu trúc ⇒ không phân biệt được source/output/preview ⇒ không
  thi hành được tính bất biến của source.
- Gap **vocabulary**: chưa có `StorageClass`.
- Những phần **không** đổi vì đã đúng: `OutputAsset.sourceAssetId` bắt buộc và
  `assertOutputDoesNotOverwriteSource()` đã có từ Phase 0 — MCP-10 chỉ bổ sung tầng lưu trữ.

## Design Choice
Khoá có cấu trúc `<workspaceId>/<class>/<id><ext>` để class suy ra được từ chính khoá, nhờ đó
`assertWritableKey()` chặn ghi đè `source` mà không cần tra DB. `STORAGE_TARGET` ghi rõ R2 là mục
tiêu **ban đầu** và `deploymentReviewStatus: 'pending'` — tài liệu không được nói R2 đã chốt hạ tầng.

## Test Plan
- **Unit**: cấu trúc khoá, `storageClassOf`, `assertWritableKey` cho cả ba class.
- **Contract**: adapter in-memory chạy đủ 5 method; `head` trả `checksumSha256: null` khi chưa đo
  (không bịa giá trị).
- **Regression**: ghi đè source key bị từ chối (I-1); adapter test tự khai không phải production.
- **Integration**: trong pipeline, source giữ nguyên kích thước sau khi ghi output.
- **Live**: `planned` — chưa nối R2/MinIO thật.

## Success Criteria
1. Không có import SDK vendor nào trong `packages/contracts`.
2. Mọi lần ghi vào object class `source` đã tồn tại đều bị từ chối.
3. Đổi vendor chỉ cần thêm một adapter mới.

## Remaining Limits
- Chưa có adapter R2/MinIO thật, chưa có bucket, chưa có chính sách lifecycle/retention.
- Chưa có kiểm tra checksum thật (adapter in-memory trả `null` đúng như thiết kế).
- Chưa có quét virus/nội dung khi upload.
