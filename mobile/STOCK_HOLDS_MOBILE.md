# Giữ hàng và xác nhận xuất đơn chuyển khoản: lưu ý cho Mobile

Không có route hay trường nào Mobile đang gọi bị đổi. Chỉ có thêm lý do từ chối (HTTP 409) khi kho xác nhận phiếu xuất/chuyển, cấp phát tài sản hoặc gửi tài sản đi bảo trì. Mobile hiện chỉ cần hiện đúng thông báo lỗi `message` của API.

| Tình huống | Phản hồi 409 | Gợi ý nhãn |
|---|---|---|
| Hàng đã được giữ cho đơn khách, phần còn lại không đủ | `Insufficient available inventory: the stock is held for customer orders` | "Hàng đang được giữ cho đơn của khách" |
| Tài sản cụ thể đã nằm trong phiếu xuất của đơn khách | `ASSET is held for a customer order` | "Tài sản đã được giữ cho đơn khách" |
| Phiếu xuất của đơn chuyển khoản chưa thanh toán | `code: PAYMENT_NOT_VERIFIED` | "Đơn chuyển khoản chưa được xác nhận đã thanh toán" |
| Phiếu xuất đổi bảo hành bị sửa lệch yêu cầu | `Exchange issue must match the item, quantity and warehouse of the warranty request` | "Phiếu đổi bảo hành phải đúng mặt hàng và số lượng đã duyệt" |

Phiếu xuất của đơn khách và phiếu đổi bảo hành vẫn không sửa được kho/loại phiếu như trước.
