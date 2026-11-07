# Trả tài sản có kết quả kiểm nhận (P0-03) — ghi chú cho Mobile

Mobile hiện không gọi `POST /assets/:id/return`; chỉ cần cập nhật hiển thị.

- Trạng thái tài sản mới `DAMAGED` ("Hỏng, chờ xử lý", tông destructive): tài sản trả về bị hỏng, vẫn nằm ở vị trí trong kho và được tính tồn, nhưng **không** cấp phát, điều chuyển, xuất hay bán được. Chỉ được đưa đi bảo trì (PASSED thì về `AVAILABLE`) hoặc thanh lý.
- Màn danh sách/chi tiết tài sản và tra QR: thêm nhãn cho `DAMAGED`; trạng thái lạ hiện đang rơi vào nhánh mặc định, không crash.
- Nếu sau này Mobile cho trả tài sản: body bắt buộc `condition: "GOOD" | "DAMAGED"`; `DAMAGED` cần `note` (400 `A damaged return needs a note`). Thiếu `condition` ⇒ 400.

## Phiếu nhập hàng trả về từ đơn giao thất bại (P1-08)

- Phiếu nhập do `return-to-warehouse` tạo có thể chứa dòng tài sản với `assetId` (tài sản đã bán). Dòng có thêm `assetCondition` (`GOOD` | `DAMAGED` | null). Chi tiết phiếu trả thêm `orderReturn: true`.
- Nếu Mobile sửa phiếu loại này: gửi `lineId` của dòng cũ để giữ tài sản, kèm `assetCondition` và `locationId`; không đổi mã/serial. Phiếu `orderReturn` được lưu và xác nhận với 0 dòng (không món nào dùng được).
- Lỗi mới: `A returned asset needs its inspected condition`, `Only an asset that left the farm can be received back`, `assetCondition is only for assets returned by an order`.
