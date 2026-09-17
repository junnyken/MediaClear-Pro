# P5-MCP-52 — Processing Receipt

- **Phase**: 5 · **Trạng thái**: xem `PHASE_5_CLOSURE.md` · **Quyết định**: `D-075`
- **Quy ước ID**: `P5-` theo luật canonical `D-029` (ID là **chuỗi đầy đủ**). Owner **chưa xác nhận
  riêng** cho Phase 5 — xem `Q-P5-01`, cùng tình trạng `Q-P4-03`.

---

## Mục tiêu

Biên nhận có cấu trúc cho mỗi lượt xử lý, đủ để đối chiếu lại về sau.

## Mở rộng ở Phase 5

Biên nhận đã có từ `P2-MCP-30`. Phase 5 **mở rộng file canonical hiện có**, không tạo bản thứ hai.

Thêm: kết luận thông tin kèm theo (`metadataVerdict`, `metadataEvidence`, `metadataStrippedCategories`),
công bố AI (`disclosureState`, `disclosureLimitationKey`), bộ nhận diện đã áp dụng
(`brandKitId`, `brandKitVersion`), và `schemaVersion`.

## Quy tắc

- **APPEND-ONLY.** Không sửa biên nhận cũ để kết quả đẹp hơn.
- `null` ở mọi trường Phase 5 nghĩa là **không đo được / không áp dụng** — không phải một giá trị
  mặc định âm thầm. Dòng ghi trước Phase 5 giữ `null` và đó là sự thật về chúng.
- Không ghi `completed` khi kết quả chưa được đọc lại byte (`I-2`).
- Không ghi dịch vụ xử lý là đã xác minh khi trạng thái của nó là `unknown`.
- Phải phân biệt `absent_by_design` · `lost` · `unknown` cho âm thanh (đã có từ Phase 3).
- **Phải ghi cả phiên bản** bộ nhận diện: sửa bộ nhận diện không được làm đổi hồ sơ của một bản xuất
  đã phát hành.
