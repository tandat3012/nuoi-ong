# Trả tài sản có kết quả kiểm nhận (P0-03) — ghi chú cho Mobile

Mobile hiện không gọi `POST /assets/:id/return`; chỉ cần cập nhật hiển thị.

- Trạng thái tài sản mới `DAMAGED` ("Hỏng, chờ xử lý", tông destructive): tài sản trả về bị hỏng, vẫn nằm ở vị trí trong kho và được tính tồn, nhưng **không** cấp phát, điều chuyển, xuất hay bán được. Chỉ được đưa đi bảo trì (PASSED thì về `AVAILABLE`) hoặc thanh lý.
- Màn danh sách/chi tiết tài sản và tra QR: thêm nhãn cho `DAMAGED`; trạng thái lạ hiện đang rơi vào nhánh mặc định, không crash.
- Nếu sau này Mobile cho trả tài sản: body bắt buộc `condition: "GOOD" | "DAMAGED"`; `DAMAGED` cần `note` (400 `A damaged return needs a note`). Thiếu `condition` ⇒ 400.
