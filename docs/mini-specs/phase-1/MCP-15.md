# MCP-15 — Upload Storage Adapter (Phase 1)

- **ID**: `MCP-15` · **Parent phase**: Phase 1 — SaaS Shell & Media Intake Foundation
- **Author**: Nguyễn Thiên Triều (trieunt@matbao.com) · **Date**: 2026-09-15

> Liên quan trực tiếp tới `docs/mini-specs/MCP-10.md` của **Phase 0** (Object Storage Abstraction).
> MINI-SPEC này **mở rộng**, không thay thế.

## Context

Đọc: như `MCP-10` (Phase 1) + `docs/mini-specs/MCP-10.md` (Phase 0) + `docs/ARCH.md` §4.
Trạng thái: `storage.ts` đã có `ObjectStorageAdapter` (createUploadUrl / createDownloadUrl / head /
putObject / deleteObject), `storageKeyFor()`, `storageClassOf()`, `assertWritableKey()` (chặn ghi đè
object class `source`), `MEDIA_BINARY_IN_DATABASE = false`, và `InMemoryStorageAdapter` (test-only).

Quyết định phải giữ: domain **không** phụ thuộc R2; media binary **không** vào PostgreSQL; source là
bất biến (I-1).

## Goal

Đưa byte thật của người dùng xuống một adapter lưu trữ thay thế được, với khoá object không sinh từ tên
file người dùng, và không tồn tại thao tác nào ghi đè được file gốc.

## Constraints (Guardrails)

1. Không dùng nguyên văn tên file người dùng làm path; tên gốc chỉ lưu làm `originalFilename`.
2. Không path traversal: khoá phải khớp allowlist ký tự; mọi `..` bị từ chối trước khi chạm đĩa.
3. Không ghi đè object class `source` — dùng `assertWritableKey()` đã có.
4. Cross-workspace object phải bị chặn ở tầng ứng dụng (không dựa vào "đoán không ra khoá").
5. Upload URL có hạn dùng và gắn với đúng một object + đúng một content type + trần dung lượng.
6. Media binary không bao giờ vào DB.
7. Adapter local tự khai `isProductionAdapter = false`.

## Scope

**A. Domain model** — tái dùng `StorageObjectRef`, `StorageClass`, `SignedUrl`, `StorageObjectHead`.
Thêm ở tầng app: `UploadTicket` (token có chữ ký + hạn + ref + contentType + maxByteSize).

**B. Services/engine** — `LocalFsStorageAdapter` (ghi xuống thư mục dữ liệu, tính SHA-256 thật);
`objectKeyForSource()` theo dạng lồng `workspaces/{ws}/projects/{p}/assets/{a}/source/{fileId}{ext}`;
`storageClassOf()` được **mở rộng** để nhận cả dạng khoá Phase 0 lẫn dạng lồng Phase 1.

**C. API contract** — `POST /v1/projects/:projectId/assets/upload-intent` (trả upload URL),
`PUT /v1/storage/upload/:token` (nhận byte thật), download URL có hạn cho asset detail.

**D. UI surfaces** — Asset upload: chọn file → tiến trình → kết quả validate (dùng lại `MCP-12`).

**E. Tests** — unit (sinh khoá, chặn traversal, chặn ghi đè source), integration (upload byte thật →
head → checksum khớp), regression (I-1, R-9, R-10), migration chạy trên database sạch.

## Audit Before Build

| Đã kiểm | Kết luận |
|---|---|
| `assertWritableKey()` | Đúng, nhưng phụ thuộc `storageClassOf()`. |
| `storageClassOf()` | Đọc `key.split('/')[1]` ⇒ **với khoá lồng của Phase 1 sẽ trả `null`**, làm mất lớp bảo vệ I-1 ở tầng lưu trữ. Đây là bẫy thật, phải sửa có kiểm soát. |
| `InMemoryStorageAdapter` | Test-only, không ghi đĩa ⇒ không đủ cho Phase 1. |
| `SourceFile.checksumSha256` | Đã có field, Phase 0 chưa bao giờ tính thật. |

**Gap** (vocabulary/state): khoá lồng vs khoá phẳng; **gap** (data): chưa có schema DB nào.

## Design Choice

Giữ nguyên `ObjectStorageAdapter` và **mở rộng** `storageClassOf()` để đọc segment đứng ngay trước tên
file, đồng thời vẫn nhận dạng khoá phẳng của Phase 0 (tương thích ngược, có test cho cả hai). Lý do:
khoá lồng theo khuyến nghị của prompt cho phép chặn cross-workspace ngay từ tiền tố, nhưng nếu không sửa
`storageClassOf()` thì `assertWritableKey()` im lặng mất tác dụng — đúng kiểu lỗi mà tầng test không
bao giờ la lên. Bỏ hướng "đổi hẳn sang khoá lồng và xoá dạng cũ" vì sẽ phá test/contract Phase 0.

Upload đi qua **ticket có chữ ký HMAC** trỏ về chính API (`PUT /v1/storage/upload/:token`): đó là cách
một adapter local mô phỏng presigned URL của S3 mà không giả vờ đã có S3. Khi đổi sang R2/MinIO, chỉ
thay implementation của cùng port.

**Schema**: Phase 1 thiết kế `db/migrations/0001_phase1_init.sql` cho 10 entity bắt buộc và **chạy thật
trên một PostgreSQL sạch** để chứng minh migration dựng được; runtime Phase 1 vẫn dùng
`InMemoryPersistence` (tự khai `ephemeral`) vì adapter PostgreSQL chưa nằm trong scope đã kiểm chứng.

## Test Plan

- Unit: khoá không chứa tên file người dùng; `..`/ký tự lạ bị từ chối; `storageClassOf` đúng cho cả hai dạng khoá.
- Integration: PUT byte thật → `head()` trả đúng size + checksum SHA-256 khớp file trên đĩa;
  PUT lần hai vào cùng khoá source ⇒ `MCP_STORAGE_WRITE_DENIED`.
- Regression: I-1; R-9 (source binary không bị ghi đè); R-10 (upload lại không sinh reservation trùng).
- Migration: `docker run postgres:16-alpine` sạch → `psql -f 0001_phase1_init.sql` → kiểm bảng/ràng buộc.
- Live: upload ảnh thật + video thật qua HTTP.

## Success Criteria

- Media binary không nằm trong PostgreSQL.
- Adapter local chạy được và thay thế được (cùng port với R2/MinIO).
- Cross-workspace object bị chặn ở ranh giới ứng dụng.
- Không có path traversal; không ghi đè được source.

## Remaining Limits / Follow-ups

- Chưa có adapter R2/MinIO thật (Q-01 đã chốt hướng, triển khai thuộc phase sau) — `planned`.
- Chưa có lifecycle/retention, chưa có quét virus, chưa có resumable upload.
- Adapter PostgreSQL cho domain state: `planned` (schema đã có và đã chạy thử).
