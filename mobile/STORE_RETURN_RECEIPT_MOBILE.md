# Phiếu nhập hàng trả về: lưu ý cho Mobile (T10)

API bổ sung luồng trả hàng về kho khi không giao được đơn bán online (D11, AC20). Mobile **không cần màn hình mới**. Chỉ cần biết các điểm sau khi hiển thị và duyệt phiếu nhập.

## Điều gì thay đổi

- Khi người giao chọn "trả hàng về kho", server tạo **phiếu nhập nháp (DRAFT)** ở kho bán:
  - Không có nhà cung cấp.
  - `note` dạng `Hàng trả về đơn DH000123: <lý do>`.
  - Các dòng là đúng mặt hàng, lô (`lotId`) và số lượng mà đơn đã xuất.
- Người duyệt kho nhận thông báo `STOCK_RECEIPT` ("Phiếu nhập hàng trả về"). Thông báo mở phiếu như mọi phiếu nhập khác.
- Kho kiểm hàng thực nhận. Nếu hàng lỗi hoặc thiếu, kho **giảm số lượng** ở phiếu nháp rồi xác nhận như bình thường. Tồn chỉ tăng khi phiếu được xác nhận, và chỉ tăng một lần.

## Lỗi mới khi xác nhận phiếu (400)

| Thông báo API | Gợi ý hiển thị |
|---|---|
| `A return receipt cannot receive more than the order shipped, or other items or lots` | "Phiếu hàng trả về chỉ nhận tối đa đúng mặt hàng, lô và số lượng đơn đã xuất." |
| `A return receipt must go into the order's sales warehouse` | "Phiếu hàng trả về phải nhập vào kho bán của đơn." |

Lý do: nếu kho tăng số lượng, thêm dòng mới hoặc đổi sang lô mới, server sẽ từ chối.

## Từ chối hoặc hủy phiếu

Từ chối hoặc hủy phiếu thì đơn quay về trạng thái "đang giao": người giao vẫn đang giữ hàng. Mobile không phải xử lý gì thêm.

## Không thay đổi

Các luồng tạo, sửa, gửi duyệt, xác nhận phiếu nhập và các API khác Mobile đang dùng vẫn giữ nguyên.

T06 (chỉ bán từ kho bán) không ảnh hưởng Mobile.
