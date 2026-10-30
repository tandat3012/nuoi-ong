# Customer storefront — routes

Khu vực cửa hàng Mộc Ong đã có trang chủ, danh sách/chi tiết sản phẩm và giỏ hàng. Dữ liệu catalog đọc từ API công khai; checkout và đơn hàng chưa triển khai.

## Cấu trúc hiện tại

```text
(store)/
  layout.tsx                    # Header/footer, CartProvider, CartDrawer
  page.tsx                      # Trang chủ /
  products/
    page.tsx                    # Danh sách /products
    [slug]/page.tsx             # Chi tiết /products/:slug và metadata
  cart/page.tsx                 # Giỏ hàng /cart
  checkout/.gitkeep             # Chưa có route
  order-confirmation/.gitkeep   # Chưa có route
  track-order/.gitkeep          # Chưa có route
```

`(store)` là route group, không xuất hiện trong URL. Không có `web/app/page.tsx` đăng ký trùng trang chủ.

## Luồng dữ liệu và trách nhiệm

- Trang chủ và danh sách gọi các hàm trong `features/commerce/products/api/` và `categories/api/`. Các khối trang chủ và thành phần điều hướng nằm trong `features/commerce/storefront/`.
- Chi tiết sản phẩm gọi `getProductStore(slug)` ở server, dựng metadata và ghép gallery, thông tin mua, mô tả, sản phẩm liên quan từ `features/commerce/products/components/`. Slug sai/sản phẩm không có trả 404; lỗi API hiển thị trạng thái thử lại.
- Layout bọc `CartProvider`, dựng header/footer và cart drawer. `/cart` ghép `CartPageContent`; giỏ dùng `localStorage` và đối chiếu lại catalog, chưa giữ tồn hoặc tạo đơn.
- Store layout không dùng `AuthContextProvider` chọn trang trại của khu vực quản trị. `web/proxy.ts` bảo vệ các route quản trị; duyệt cửa hàng không yêu cầu đăng nhập.
- UI cơ bản dùng `web/shared/components/ui/`; logic sản phẩm, giỏ hàng và kiểu dữ liệu thuộc `web/features/commerce/`.

## Phần chưa triển khai

`checkout/`, `order-confirmation/` và `track-order/` mới có `.gitkeep`; chưa có `page.tsx` hoặc API đơn hàng tương ứng. Định hướng V1 là guest checkout, COD/chuyển khoản và giao hàng thủ công. Backend phải kiểm tra lại giá/tồn, giữ hàng và bảo vệ truy cập đơn khi triển khai các luồng này.

Xem [cấu trúc commerce](../../features/commerce/README.md), [web routes](../../README.md), và [API storefront](../../../api/src/modules/commerce/README.md).
