# Bàn giao mobile: checkout tự kiểm tra giá/tồn kho và ô tìm kiếm trang sản phẩm

## Phạm vi

Chỉ thay đổi web storefront trên nhánh `feature/checkout-auto-verify`. **Không đổi API, không migration, không đổi quyền.** Mobile hiện là app kho/tài sản, không có storefront; tài liệu này để đồng bộ hành vi nếu sau này mobile có luồng mua hàng.

## Thay đổi hành vi

- Trang đặt hàng bỏ nút "Xác minh giá và tồn kho". Giá và tình trạng hàng được kiểm tra tự động khi mở trang và mỗi khi nội dung giỏ thay đổi (mỗi trạng thái giỏ một lần). Trong lúc kiểm tra, nút "Đặt hàng" hiện "Đang cập nhật giá…"; xong là bấm được.
- Form thông tin nhận hàng không còn bị khóa trong lúc kiểm tra.
- Kiểm tra lỗi (mạng/API) chỉ hiện thông báo và liên kết "Thử cập nhật lại", không tự gọi lặp.
- Giữ nguyên: khi giá đổi, người mua phải tích ô đồng ý giá mới; server vẫn kiểm tra lại giá (`PRICE_CHANGED`) và tồn kho khi tạo đơn.
- Trang `/products` có ô "Tìm kiếm sản phẩm" dùng lại `StoreSearchBar` có sẵn.

## Nếu mobile làm luồng mua hàng

Dùng các API storefront hiện có (`GET /store/products/:slug`, `POST /store/cart/availability`, `POST /store/orders` với `expectedUnitPrice` và `idempotencyKey`). Kiểm tra giá/tồn tự động trước khi bật nút đặt hàng, không bắt người mua bấm xác minh riêng; vẫn hiển thị và yêu cầu đồng ý khi giá thay đổi.
