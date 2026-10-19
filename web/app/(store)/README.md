# Customer storefront — routes

Khung thư mục cho cửa hàng customer. Hiện chỉ có tài liệu và `.gitkeep`, chưa đăng ký route hay thay đổi hành vi ứng dụng.

Phạm vi V1: một thương hiệu, bán sản phẩm từ ong và vật tư/thiết bị; mua không cần tài khoản, COD/chuyển khoản, giao hàng thủ công.

## File dự kiến khi triển khai

Các file `.tsx` bên dưới chưa được tạo:

```text
(store)/
  layout.tsx                    # Layout cửa hàng: header, footer, giỏ hàng
  page.tsx                      # Trang chủ /
  products/
    page.tsx                    # Danh sách /products
    [slug]/page.tsx             # Chi tiết /products/:slug
  cart/page.tsx                 # Giỏ hàng /cart
  checkout/page.tsx             # Thông tin nhận hàng, báo giá, đặt đơn
  order-confirmation/page.tsx   # Kết quả đặt hàng
  track-order/page.tsx          # Tra cứu đơn bằng mã truy cập của đơn
```

## Ranh giới

- Route chỉ ghép các thành phần từ `web/features/commerce/`; không chứa nghiệp vụ tính giá hoặc tồn kho.
- `(store)` là route group, không xuất hiện trong URL và không phải cơ chế phân quyền.
- Layout customer không dùng `AuthContextProvider` yêu cầu thành viên/chọn trang trại của admin.
- UI cơ bản dùng lại `web/shared/components/ui/`; header/footer riêng thuộc `features/commerce/storefront/`.
- Giữ nguyên khu vực `(dashboard)` và `(auth)` hiện có trong bước chuẩn bị này.

## Khi bắt đầu thêm route thật

- Chuyển trách nhiệm trang chủ từ `web/app/page.tsx` sang `(store)/page.tsx`; không để hai file cùng đăng ký `/`.
- Rà soát metadata và Clerk provider trong `web/app/layout.tsx`, cùng phạm vi bảo vệ route trong `web/proxy.ts`.
- Bổ sung trạng thái tải, lỗi và không tìm thấy khi từng luồng được triển khai.
- Không lưu thông tin người nhận hoặc mã truy cập đơn vào URL công khai; chi tiết đơn chỉ được hiển thị sau khi kiểm tra quyền truy cập.

Xem [cấu trúc chức năng FE](../../features/commerce/README.md).
