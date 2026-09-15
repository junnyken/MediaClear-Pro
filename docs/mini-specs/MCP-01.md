# MCP-01 — Product Scope & Stable Vocabulary

| | |
|---|---|
| **ID** | MCP-01 |
| **Parent phase** | Phase 0 |
| **Author** | Nguyễn Thiên Triều · **Date** 2026-09-15 |

## Context
- Đọc trước: `MCP-00` (repo rỗng → không có vocabulary cũ), prompt Phase 0 mục 5B/5C.
- Quyết định phải giữ: một sản phẩm duy nhất, 5 module là tổ chức nội bộ chứ không phải 5 sản phẩm.

## Goal
Chốt phạm vi MVP, capability planned, out-of-scope và một bộ vocabulary không mơ hồ để mọi tầng
(DB, API, UI, worker) dùng chung một cách gọi.

## Constraints
1. Không tạo enum trùng nghĩa với vocabulary đã có — audit MCP-00 xác nhận **không có** cái nào.
2. Không thêm/bớt giá trị so với spec; muốn đổi phải ghi trong `DECISIONS.md`.
3. Tên domain/API/enum/state dùng English ổn định; UI tiếng Việt qua i18n key.
4. Không mô tả 5 module như 5 sản phẩm độc lập trong bất kỳ tài liệu hay UX nào.
5. Thiếu bằng chứng về capability → `unknown`, không ghi `implemented`.

## Scope
- **A. Domain model**: 14 entity + 4 enum tại `packages/contracts/src/{vocabulary,entities}.ts`.
- **B. Services/engine**: không có service nào ở MINI-SPEC này.
- **C. API contract**: không đổi.
- **D. UI surfaces**: nhãn hiển thị cho từng `JobState`/`EvidenceStatus` trong i18n.
- **E. Tests**: so khớp từng danh sách enum với spec; chặn trùng lặp; chặn nhầm namespace.

## Audit Before Build
- Đã kiểm: toàn bộ project (rỗng) → không có enum/tên trường nào để map.
- Gap **vocabulary**: chưa tồn tại.
- Bẫy phát hiện: `blocked` nằm ở hai enum khác nghĩa → nếu lưu chung một cột DB sẽ sinh trạng thái
  vô nghĩa kiểu "job có bằng chứng bị chặn".

## Design Choice
Lấy nguyên bộ vocabulary trong spec (D-002), thêm hai enum phụ trợ **không** trùng nghĩa với bất kỳ
enum nào trong spec: `CapabilityStatus` (implemented/planned/unknown/out_of_scope — dùng cho tài
liệu) và `Presence` (present/absent/unknown — dùng cho metadata). Tách namespace `blocked` bằng
tài liệu + test thay vì đổi tên, để không lệch spec.

## Test Plan
- **Unit**: so khớp 4 danh sách enum với spec; không trùng lặp; terminal states đúng.
- **Regression**: `EvidenceStatus` không phải tập con của `JobState`.
- **Docs consistency**: mọi `JobState` đều xuất hiện trong `DATA_MODEL.md`.

## Live Verification
Không áp dụng (không có runtime nghiệp vụ trong Phase 0).

## Success Criteria
1. Một nơi duy nhất định nghĩa vocabulary; không có bản sao nào trong `apps/`.
2. Thêm/sửa một giá trị enum làm test đỏ ngay.
3. Không tài liệu nào gọi 5 module là 5 sản phẩm.

## Remaining Limits
- Chưa có preset TikTok/Reels/Shorts cụ thể (tỷ lệ, độ dài) — `planned`.

---

## Amendment 2026-09-15 — Owner decisions (Q-04, Q-08)

**Thay đổi vocabulary** (không xoá giá trị cũ, chỉ bổ sung):
- `WorkspaceRole`: `owner` · `admin` · `member` · `viewer` — xem MCP-09.
- `BlockReasonKind`: `policy_block` · `validation_block` · `provider_block`.
- `StorageClass`: `source` · `output` · `preview` — xem MCP-10.
- Entity thứ 15: `WorkspaceMembership`.

**Không tạo enum trùng nghĩa**: "static mask" được map vào `blur`/`brand_overlay` trên một
`NormalizedRegion` cố định thay vì thêm giá trị mới (D-020, Q-15).

**Vocabulary bị thay**: `MCP_POLICY_WORKSPACE_MISMATCH` → `MCP_AUTHZ_WORKSPACE_ACCESS_DENIED`
(D-021) — mã cũ mô tả tình trạng dữ liệu, mã mới mô tả quyết định truy cập; giữ cả hai sẽ là hai mã
trùng nghĩa.

**Test bổ sung**: `tenancy.test.ts` khẳng định đúng 4 role; `invariants.test.ts` I-11 khẳng định
`JobState.blocked` và `EvidenceStatus.blocked` không phải tập con của nhau theo cả hai chiều.
