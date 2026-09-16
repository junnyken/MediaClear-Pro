# MINI_SPEC_INDEX — MediaClear Pro

- **Cập nhật**: 2026-09-15 (Phase 1.1 + Q-20 closure) · **Quyết định**: Q-16 / D-029

Đây là **nguồn tra cứu duy nhất** cho ID của MINI-SPEC.

Vì sao cần: Phase 0 và Phase 1 đều đã publish một tài liệu mang ID `MCP-10` với hai nội dung khác
nhau (Object Storage Abstraction và Authentication & Workspace Boundary), còn mã nguồn lại dùng quy
ước thứ ba (`MCP-10-P1`). Bảng dưới gỡ mơ hồ đó mà **không** sửa lịch sử.

## Quy tắc

1. **Canonical ID** có dạng `P<phase>-MCP-<nn>`, hoặc `P<phase>-Q<nn>-MCP-<nn>` cho MINI-SPEC sinh ra
   từ một câu hỏi đã chốt (vd `P1.1-Q20-MCP-20`). ID là **ổn định** — không đổi, không tái sử dụng.
2. **Historical ID** là ID từng được publish; giữ nguyên, không xoá khỏi bảng này.
3. Tên file lịch sử **không đổi** — đổi tên sẽ phá mọi đường dẫn đã trích dẫn trong báo cáo đã publish.
4. MINI-SPEC **mới bắt buộc** dùng canonical ID có tiền tố phase (Phase 2 dùng `P2-MCP-23…`; `P2-MCP-23` đã dùng).
5. Mã nguồn (`API_ROUTES.mcp`) chỉ dùng canonical ID.
6. Không có hai canonical ID trùng nhau — có test chặn.

## Bảng ánh xạ

| Canonical ID | Historical ID | Phase | Name | Path | Status |
|---|---|---|---|---|---|
| `P0-MCP-00` | `MCP-00` | Phase 0 | Repository & Capability Audit | `docs/mini-specs/MCP-00.md` | completed |
| `P0-MCP-01` | `MCP-01` | Phase 0 | Product Scope & Stable Vocabulary | `docs/mini-specs/MCP-01.md` | completed |
| `P0-MCP-02` | `MCP-02` | Phase 0 | Rights Guard & Processing Policy Gate | `docs/mini-specs/MCP-02.md` | completed |
| `P0-MCP-03` | `MCP-03` | Phase 0 | Media Limits & Validation Contract | `docs/mini-specs/MCP-03.md` | completed |
| `P0-MCP-04` | `MCP-04` | Phase 0 | Provider Adapter & Evidence Model | `docs/mini-specs/MCP-04.md` | completed |
| `P0-MCP-05` | `MCP-05` | Phase 0 | Metadata, Provenance & Processing Receipt Contract | `docs/mini-specs/MCP-05.md` | completed |
| `P0-MCP-06` | `MCP-06` | Phase 0 | UX Design Tokens & Navigation Foundation | `docs/mini-specs/MCP-06.md` | completed |
| `P0-MCP-07` | `MCP-07` | Phase 0 | Usage Ledger & Cost Measurement Contract | `docs/mini-specs/MCP-07.md` | completed |
| `P0-MCP-08` | `MCP-08` | Phase 0 | Phase 0 Verification Gate | `docs/mini-specs/MCP-08.md` | completed |
| `P0-MCP-09` | `MCP-09` | Phase 0 | Tenancy & Role Permission Contract | `docs/mini-specs/MCP-09.md` | completed |
| `P0-MCP-10` | `MCP-10` | Phase 0 | Object Storage Abstraction Contract | `docs/mini-specs/MCP-10.md` | completed |
| `P1-MCP-10` | `MCP-10` (Phase 1) | Phase 1 | Authentication & Workspace Boundary | `docs/mini-specs/phase-1/MCP-10.md` | completed |
| `P1-MCP-11` | `MCP-11` | Phase 1 | Project & Asset Library | `docs/mini-specs/phase-1/MCP-11.md` | completed |
| `P1-MCP-12` | `MCP-12` | Phase 1 | Media Intake Validation | `docs/mini-specs/phase-1/MCP-12.md` | completed |
| `P1-MCP-13` | `MCP-13` | Phase 1 | Asset Rights Attestation Gate | `docs/mini-specs/phase-1/MCP-13.md` | completed |
| `P1-MCP-14` | `MCP-14` | Phase 1 | Processing Job Creation Boundary | `docs/mini-specs/phase-1/MCP-14.md` | completed |
| `P1-MCP-15` | `MCP-15` | Phase 1 | Upload Storage Adapter | `docs/mini-specs/phase-1/MCP-15.md` | completed |
| `P1.1-MCP-16` | — | Phase 1.1 | MINI-SPEC Identity Index Hardening | `docs/mini-specs/phase-1.1/P1.1-MCP-16.md` | completed |
| `P1.1-MCP-17` | — | Phase 1.1 | Usage Reservation TTL & Expiry | `docs/mini-specs/phase-1.1/P1.1-MCP-17.md` | completed |
| `P1.1-MCP-18` | — | Phase 1.1 | Data Retention Contract & Dry Run | `docs/mini-specs/phase-1.1/P1.1-MCP-18.md` | completed |
| `P1.1-MCP-19` | — | Phase 1.1 | Vietnamese Policy & UX Wording | `docs/mini-specs/phase-1.1/P1.1-MCP-19.md` | completed |
| `P1.1-Q20-MCP-20` | — | Phase 1.1 (Q-20 closure) | Canonical Provenance and Rights Warning Wording | `docs/mini-specs/phase-1.1/P1.1-Q20-MCP-20.md` | completed |
| `P1.1-Q22-MCP-22` | — | Phase 1.1 (Q-22 closure) | Rights Attestation Checkbox Scope Clarification | `docs/mini-specs/phase-1.1/P1.1-Q22-MCP-22.md` | completed |
| `P1.1-Q21-MCP-21` | — | Phase 1.1 (Q-21 closure) | English Provenance Wording Unconfirmed State | `docs/mini-specs/phase-1.1/P1.1-Q21-MCP-21.md` | completed |
| `P2-MCP-23` | — | Phase 2 | PostgreSQL Persistence Adapter & Migration Runner | `docs/mini-specs/phase-2/P2-MCP-23.md` | completed |
| `P2-MCP-24` | — | Phase 2 | S3-Compatible Object Storage Adapter | `docs/mini-specs/phase-2/P2-MCP-24.md` | completed |
| `P2-MCP-25` | — | Phase 2 | Password Authentication & Durable Sessions | `docs/mini-specs/phase-2/P2-MCP-25.md` | completed |

## Điểm mơ hồ duy nhất còn lại

`MCP-10` khi đứng một mình (không có tiền tố phase) là **mơ hồ**: có thể là `P0-MCP-10` (Object
Storage) hoặc `P1-MCP-10` (Auth & Workspace). Trong tài liệu đã publish trước 2026-09-15, hãy đọc
theo thư mục chứa nó. Từ Phase 1.1 trở đi, mọi tham chiếu mới phải dùng canonical ID.

## ID đã dùng — không được tái sử dụng

`MCP-00` … `MCP-15` (cả hai phase), `P0-MCP-00` … `P0-MCP-10`, `P1-MCP-10` … `P1-MCP-15`,
`P1.1-MCP-16` … `P1.1-MCP-19`, `P1.1-Q20-MCP-20`, `P1.1-Q22-MCP-22`, `P1.1-Q21-MCP-21`, `P2-MCP-23`, `P2-MCP-24`, `P2-MCP-25`.

> Lưu ý: số `20` đã dùng bởi `P1.1-Q20-MCP-20`, số `21` bởi `P1.1-Q21-MCP-21`, số `22` bởi
> `P1.1-Q22-MCP-22`. Để tránh mọi khả năng hiểu nhầm, **Phase 2 bắt đầu từ `P2-MCP-23`** (đã dùng; tiếp theo là `P2-MCP-26`).
>
> **Quy ước đánh số (D-036):** số cuối chạy theo **số hiệu câu hỏi**, không theo thứ tự hoàn thành —
> Q-21 → `...-MCP-21`, Q-22 → `...-MCP-22`. Vì vậy `P1.1-Q21-MCP-21` mang số nhỏ hơn dù hoàn thành
> **sau** `P1.1-Q22-MCP-22` một ngày.
>
> Bốn ID của Q-21/Q-22 **đã được đánh số lại một lần** theo chỉ đạo của owner (ngoại lệ có ghi chép
> đối với D-029, chỉ được phép vì repo chưa push). Bảng đối chiếu cũ ↔ mới ở
> `PHASE_1_1_Q21_Q22_CLOSURE.md` §2. Từ đây về sau **không đánh số lại** ID đã phát hành nữa.
>
> Canonical ID là **chuỗi đầy đủ**, không phải con số cuối: `P1.1-Q22-MCP-22` và `P2-MCP-21` là hai ID
> khác nhau và không bao giờ đụng nhau. Quy ước "Phase 2 bắt đầu từ số kế tiếp" chỉ để người đọc lướt
> qua không nhầm, chứ không phải ràng buộc kỹ thuật.
