# Commerce — frontend

Chức năng bán hàng phục vụ customer. Đã nối API cho sản phẩm/danh mục trang chủ và danh sách `/products`; các phần giỏ hàng, checkout, đơn hàng và chi tiết sản phẩm vẫn là khung dự kiến.

## Luồng đọc hiện tại

- Trang chủ lấy 4 sản phẩm và 4 danh mục qua Server Components dùng native `fetch`.
- `/products` lấy 20 sản phẩm/trang; URL lưu `page` và `category`, ví dụ `/products?category=vat-tu&page=2`.
- Backend lọc danh mục trước khi phân trang. Khi chuyển trang, liên kết giữ nguyên danh mục; bỏ lọc sẽ về trang đầu.
- Query sai định dạng trả trang 404. Trang vượt dữ liệu chuyển về trang cuối còn tồn tại (hoặc trang 1 nếu rỗng).
- Có trạng thái tải, lỗi và danh sách rỗng. Chưa bật chi tiết sản phẩm hoặc thêm vào giỏ.
- Request server dùng `API_INTERNAL_URL`, nếu thiếu thì dùng `NEXT_PUBLIC_API_URL` hoặc `http://localhost:5050`; `cache: 'no-store'`, timeout 10 giây.
- Backend hiện trả dữ liệu mẫu cố định, không truy cập DB.

## API chi tiết sản phẩm (chưa có UI)

- `products/api/product.api.ts` có `getProductStore(slug)`, gọi `GET /api/v1/store/products/:slug` bằng native `fetch` với cấu hình server như API danh sách.
- Trả `{ data: StorefrontProductDetail }`; kiểu chi tiết kế thừa `StorefrontProduct` và thêm `description: string`.
- Slug gồm chữ thường, số và dấu gạch nối giữa các nhóm. Slug sai định dạng hoặc API trả `404` thì hàm trả `null`; không gọi API nếu slug sai định dạng.
- Các HTTP lỗi khác, lỗi mạng, timeout hoặc JSON lỗi được ném ra, không coi là sản phẩm không tồn tại.
- Sản phẩm hết hàng vẫn trả chi tiết với `inStock: false`.
- Chưa tạo trang `/products/[slug]` hoặc bật liên kết chi tiết trên `ProductCard`.

Ví dụ gọi từ server khi triển khai UI:

```ts
const result = await getProductStore('mat-ong-hoa-ca-phe-nguyen-chat');
// result === null: không tìm thấy; result.data: chi tiết sản phẩm.
```

## Phân chia trách nhiệm và file

| Thư mục hiện có | Trách nhiệm | File chính (gồm cả dự kiến) |
| --- | --- | --- |
| `storefront/` | Trang chủ, bố cục cửa hàng, điều hướng | `components/store-layout.tsx`, `components/store-header.tsx`, `components/store-footer.tsx`, `components/home-page.tsx` |
| `products/` | Danh sách, tìm/lọc, chi tiết, chọn SKU | `api/product.api.ts`, `components/products-page.tsx`, `components/product-detail.tsx`, `components/product-card.tsx`, `types/product.ts` |
| `categories/` | Đọc danh mục cửa hàng | `api/category.api.ts`, `types/category.ts` (đã có) |
| `cart/` | Giỏ hàng trên trình duyệt, thêm/xóa/đổi số lượng | `context/cart-context.tsx`, `components/cart-page.tsx`, `hooks/use-cart.ts`, `types/cart.ts` |
| `checkout/` | Nhập người nhận, lấy báo giá, gửi yêu cầu đặt đơn | `api/checkout.api.ts`, `components/checkout-page.tsx`, `components/checkout-form.tsx`, `schemas/checkout.ts`, `types/checkout.ts` |
| `orders/` | Xác nhận đặt hàng, tra cứu và hiển thị tiến độ | `api/orders.api.ts`, `components/order-confirmation.tsx`, `components/order-tracking.tsx`, `types/order.ts` |

Chỉ tạo các thư mục con và file code khi triển khai chức năng tương ứng, theo [quy ước features](../README.md).

## Quy ước tích hợp

- `web/app/(store)/` chỉ ghép component của các chức năng trên.
- UI cơ bản, cấu hình và API transport tiếp tục dùng `web/shared/`; rà soát transport khi cần gọi API từ Server Components.
- API customer dùng namespace `/api/v1/store`; không gọi API kho/danh mục nội bộ bằng cách bỏ xác thực.
- Customer không phụ thuộc context trang trại của admin và không cần Clerk để duyệt hàng hoặc đặt đơn V1.
- Danh sách/chi tiết sản phẩm ưu tiên render phía server; giỏ hàng và form checkout xử lý tương tác phía client.
- Giỏ hàng lưu SKU và số lượng trên trình duyệt. BE kiểm tra lại giá, phí giao hàng và tồn trước khi tạo đơn.
- `checkout` phụ trách báo giá; yêu cầu tạo/tra cứu đơn nằm trong `orders/api/orders.api.ts` để tránh định nghĩa trùng API.
- Kiểu dữ liệu API thuộc chức năng sở hữu; chỉ bổ sung barrel export khi có nơi sử dụng.
- Khi bổ sung màn admin bán hàng, dùng API/component quản trị riêng; không ghép quyền admin vào component customer.

Xem [routes customer](../../app/(store)/README.md) và [ranh giới backend](../../../api/src/modules/commerce/README.md).
