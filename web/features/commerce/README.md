# Commerce — frontend

Chức năng bán hàng phục vụ customer. Đã có trang chủ, danh sách `/products`, chi tiết `/products/[slug]`, giỏ hàng `/cart` và cart drawer. Sản phẩm/danh mục đọc từ API công khai; giỏ hàng lưu trên trình duyệt. Checkout và đơn hàng vẫn là khung dự kiến.

## Luồng đọc hiện tại

- Trang chủ lấy 4 sản phẩm theo thứ tự mặc định của API và danh mục từ DB qua Server Components dùng native `fetch`; không dùng fixture khi API lỗi.
- Danh mục trang chủ và bộ lọc `/products` dùng `getAllCategoriesStore()`, đọc đủ các trang, mỗi trang tối đa 100 danh mục. Tên/slug lấy từ API; icon và mô tả phụ lấy từ cấu hình theo slug, danh mục mới dùng icon mặc định.
- `/products` lấy 20 sản phẩm/trang; URL lưu phân trang, danh mục, từ khóa, khoảng giá và sắp xếp.
- Backend lọc danh mục trước khi phân trang. Khi chuyển trang, liên kết giữ nguyên danh mục; bỏ lọc sẽ về trang đầu.
- Query sai định dạng trả trang 404. Trang vượt dữ liệu chuyển về trang cuối còn tồn tại (hoặc trang 1 nếu rỗng).
- Danh mục và sản phẩm trang chủ có Suspense riêng, trạng thái lỗi/rỗng riêng. Lỗi danh mục không chặn danh sách sản phẩm. Có liên kết tải lại trang khi lỗi.
- Carousel lọc trong 4 sản phẩm đã tải, các tab danh mục lấy từ chính các sản phẩm đó. Chưa có quy tắc xếp hạng sản phẩm nổi bật/bán chạy.
- Thẻ sản phẩm hiển thị còn/hết hàng theo `inStock` và liên kết tới trang chi tiết. Thêm vào giỏ cần xác minh quy cách, giá và tình trạng còn hàng từ chi tiết sản phẩm.
- Request dùng `API_INTERNAL_URL` nếu có, rồi `NEXT_PUBLIC_API_URL` hoặc `http://localhost:5050`; `cache: 'no-store'`, timeout 10 giây mỗi request. Khi gọi từ trình duyệt, dùng cấu hình API công khai.
- Backend đọc catalog và tồn kho từ DB; local có thể dùng dữ liệu seed minh họa.

## Chi tiết sản phẩm và giỏ hàng hiện tại

- `products/api/product.api.ts` có `getProductStore(slug)`, gọi `GET /api/v1/store/products/:slug` bằng native `fetch` với cấu hình server như API danh sách.
- Trả `{ data: StorefrontProductDetail }`; kiểu chi tiết kế thừa `StorefrontProduct`, có mô tả và các trường mở rộng cho gallery, quy cách, thông tin bổ sung. API hiện trả danh sách `variants` cùng giá/tồn của từng quy cách.
- Slug gồm chữ thường, số và dấu gạch nối giữa các nhóm. Slug sai định dạng hoặc API trả `404` thì hàm trả `null`; không gọi API nếu slug sai định dạng.
- Các HTTP lỗi khác, lỗi mạng, timeout hoặc JSON lỗi được ném ra, không coi là sản phẩm không tồn tại.
- Sản phẩm hết hàng vẫn trả chi tiết với `inStock: false`.
- `/products/[slug]` đọc chi tiết ở server, dựng metadata, gallery, thông tin mua, mô tả và sản phẩm liên quan. Slug sai hoặc sản phẩm không tồn tại trả 404; lỗi kết nối có giao diện thử lại riêng.
- `ProductDetailSummary` xử lý chọn quy cách và thêm vào giỏ; `cart/components/cart.logic.ts` quản lý dữ liệu giỏ, số lượng, tổng tiền và đối chiếu lại catalog.
- `CartProvider` nằm trong store layout, khôi phục/lưu giỏ qua `localStorage`. `CartDrawer` và `CartPageContent` dùng chung context; đối chiếu catalog khi khôi phục giỏ hoặc yêu cầu làm mới.
- Giỏ chưa giữ tồn, chưa tạo đơn và chưa có thanh toán. Giá/tồn hiển thị phải được backend kiểm tra lại khi triển khai checkout.

Ví dụ đọc chi tiết:

```ts
const result = await getProductStore('mat-ong-hoa-ca-phe-nguyen-chat');
// result === null: không tìm thấy; result.data: chi tiết sản phẩm.
```

## Phân chia trách nhiệm và file

| Thư mục hiện có | Trách nhiệm                                       | File chính / trạng thái                                                                                                              |
| --------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `storefront/`   | Các khối trang chủ, header/footer, điều hướng    | `components/store-header.tsx`, `components/store-footer.tsx`, `components/home-featured-products.tsx`, `config/storefront-config.ts`; layout tại `app/(store)/layout.tsx` |
| `products/`     | Danh sách, tìm/lọc, chi tiết, chọn quy cách      | `api/product.api.ts`, `components/products-page.tsx`, `components/product-detail-summary.tsx`, `components/product-gallery.tsx`, `components/product-card.tsx`, `types/product.ts` |
| `categories/`   | Đọc danh mục cửa hàng                             | `api/category.api.ts`, `types/category.ts` (đã có)                                                                                       |
| `cart/`         | Giỏ hàng trên trình duyệt, thêm/xóa/đổi số lượng  | `context/cart-context.tsx`, `components/cart.logic.ts`, `components/cart-page-content.tsx`, `components/cart-drawer.tsx`, `hooks/use-cart.ts`, `types/cart.ts` |
| `checkout/`     | Dự kiến: người nhận, báo giá, gửi yêu cầu đặt đơn | Chỉ có `.gitkeep`, chưa có API/component/schema |
| `orders/`       | Dự kiến: xác nhận đặt hàng, tra cứu tiến độ      | Chỉ có `.gitkeep`, chưa có API/component/type |

Chỉ tạo các thư mục con và file code khi triển khai chức năng tương ứng, theo [quy ước features](../README.md).

## Quy ước tích hợp

- `web/app/(store)/` sở hữu route/layout, metadata và tải dữ liệu ở server; component và logic dùng chung thuộc các feature trên.
- UI cơ bản, cấu hình và API transport tiếp tục dùng `web/shared/`; rà soát transport khi cần gọi API từ Server Components.
- API customer dùng namespace `/api/v1/store`; không gọi API kho/danh mục nội bộ bằng cách bỏ xác thực.
- Customer không phụ thuộc context trang trại của admin và không cần Clerk để duyệt hàng hoặc đặt đơn V1.
- Danh sách/chi tiết sản phẩm ưu tiên render phía server; giỏ hàng và form checkout xử lý tương tác phía client.
- Giỏ hàng lưu SKU và số lượng trên trình duyệt. BE kiểm tra lại giá, phí giao hàng và tồn trước khi tạo đơn.
- `checkout` phụ trách báo giá; yêu cầu tạo/tra cứu đơn nằm trong `orders/api/orders.api.ts` để tránh định nghĩa trùng API.
- Kiểu dữ liệu API thuộc chức năng sở hữu; chỉ bổ sung barrel export khi có nơi sử dụng.
- Khi bổ sung màn admin bán hàng, dùng API/component quản trị riêng; không ghép quyền admin vào component customer.

Xem [routes customer](<../../app/(store)/README.md>) và [ranh giới backend](../../../api/src/modules/commerce/README.md).
