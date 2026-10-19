# Commerce — backend

Module bán hàng phục vụ customer trong NestJS API hiện tại, đã đăng ký trong `AppModule`.

## API base hiện tại

| Method | Endpoint                       | Kết quả                                                           |
| ------ | ------------------------------ | ----------------------------------------------------------------- |
| GET    | `/api/v1/store/products`       | Danh sách sản phẩm có phân trang                                  |
| GET    | `/api/v1/store/products/:slug` | Chi tiết sản phẩm, bọc trong `{ data }`; không tìm thấy trả `404` |
| GET    | `/api/v1/store/categories`     | Danh sách danh mục có phân trang                                  |

- Dùng **dữ liệu mẫu cố định** trong `commerce.fixtures.ts`: 4 sản phẩm và 4 danh mục. Giá (số nguyên VNĐ), ID và `inStock` đều là minh họa, không phản ánh dữ liệu thực tế.
- Không truy cập DB, không thay đổi schema/migration và không công khai hồ sơ vật tư/tài sản nội bộ.
- Mỗi endpoint được đánh dấu `@Public()` riêng; không yêu cầu Clerk token hay `farmId`. API Admin giữ nguyên cơ chế xác thực/phân quyền.
- Hai API danh sách dùng lại `parsePagination`: `page` mặc định `1`, `pageSize` mặc định `20`, tối đa `100` bản ghi/lần. Yêu cầu trên `100` được giới hạn xuống `100`.
- Giá trị rỗng dùng mặc định; số âm, `0`, số lẻ, giá trị không phải số hoặc trang vượt phạm vi số nguyên an toàn trả `400`.
- Trang vượt dữ liệu trả `data: []` cùng thông tin tổng; thứ tự hiện tại theo mảng fixture.
- Products hỗ trợ `category` là slug dài tối đa 100 ký tự, gồm chữ thường, số và dấu gạch nối giữa các nhóm. Lọc trước khi phân trang; tổng số là tổng trong danh mục. Slug đúng định dạng nhưng không tồn tại trả danh sách rỗng; sai định dạng hoặc truyền lặp trả `400`.
- Frontend đã nối trang chủ và danh sách `/products` có phân trang/lọc danh mục. Chưa triển khai tìm kiếm, API ghi, checkout, đơn hàng hoặc cache.

```text
api/
  src/modules/commerce/
    commerce.module.ts       # Đăng ký controller và service
    commerce.controller.ts   # GET /store/products, /store/products/:slug, /store/categories
    commerce.service.ts      # Đọc dữ liệu mẫu, phân trang, xử lý không tìm thấy
    commerce.fixtures.ts     # Dữ liệu mẫu, tách khỏi nghiệp vụ
    README.md
  test/commerce.e2e-spec.ts   # Test HTTP, dùng mock DB và Clerk
```

Ví dụ:

```text
GET /api/v1/store/products?page=1&pageSize=4
GET /api/v1/store/products?category=vat-tu&page=1&pageSize=20
GET /api/v1/store/categories?page=2&pageSize=2
GET /api/v1/store/products/mat-ong-hoa-ca-phe-nguyen-chat
```

Hợp đồng danh sách dùng quy ước `{ data, page }` hiện có:

```json
{
  "data": [],
  "page": {
    "number": 3,
    "size": 2,
    "totalItems": 4,
    "totalPages": 2
  }
}
```

Sản phẩm gồm `id`, `slug`, `name`, `description`, `category`, `price`, `inStock`. Danh mục gồm `id`, `name`, `slug`. ID hiện là chuỗi mẫu, chưa phải UUID từ DB.

Khi nối DB, phân trang tại truy vấn (`LIMIT`/`OFFSET` và thứ tự ổn định), không tải toàn bộ dữ liệu rồi cắt mảng. Giới hạn `100` kiểm soát kích thước phản hồi, không thay thế giới hạn tần suất request hay tối ưu truy vấn.

Chạy kiểm tra từ `api/`:

```bash
pnpm exec jest --config ./test/jest-e2e.json --runInBand commerce.e2e-spec.ts
pnpm build
```

## Định hướng giai đoạn sau (chưa triển khai)

Phạm vi V1: một thương hiệu, kho bán hàng được chỉ định; sản phẩm từ ong và vật tư/thiết bị; guest checkout, COD/chuyển khoản, giao hàng thủ công.

### File dự kiến khi mở rộng

Các file TypeScript dưới đây chưa được tạo:

```text
commerce/
  commerce.module.ts
  products/
    products.module.ts
    products.controller.ts        # API customer: danh sách và chi tiết đã xuất bản
    products.service.ts           # Đọc sản phẩm bán, SKU, giá, ảnh
    dto/
      list-products-query.dto.ts
  orders/
    orders.module.ts
    checkout.controller.ts        # API customer: báo giá checkout
    checkout.service.ts           # Kiểm tra đầu vào, tính giá và phí giao hàng
    orders.controller.ts          # API customer: tạo và tra cứu đơn
    orders.service.ts             # Tạo đơn, giữ hàng, bảo vệ truy cập đơn
    dto/
      quote-checkout.dto.ts
      create-order.dto.ts
      lookup-order.dto.ts
```

Test đặt cạnh service/controller theo quy ước hiện tại khi thêm logic. DTO validation dùng `class-validator`/`class-transformer` đã có.

### Ranh giới tích hợp

| Phần                                 | Trách nhiệm                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `products/`                          | Sản phẩm bán và SKU; không công khai trực tiếp hồ sơ vật tư/tài sản nội bộ             |
| `orders/`                            | Báo giá, đơn hàng, thông tin nhận hàng, phương thức/trạng thái thanh toán và giữ hàng  |
| `inventory/`, `warehouses/` hiện có  | Nguồn tồn kho; tích hợp giữ/xuất/giải phóng hàng khi triển khai đơn                    |
| `auth/` hiện có                      | Xác thực/phân quyền admin; endpoint guest phải được đánh dấu công khai có chủ đích     |
| `api/src/db/schema/`, `api/drizzle/` | Schema và migration theo cơ chế hiện tại; chưa tạo schema riêng trong thư mục customer |

API products/categories đã có trong bước base trên. API checkout/đơn hàng dự kiến dùng `/api/v1/store/checkout/quote`, `/api/v1/store/orders`, `/api/v1/store/orders/lookup`; các endpoint này chưa được triển khai hay chốt hợp đồng.

- Server xác định trang trại/kho bán hàng; không tin `farmId`, giá hoặc quyền do customer gửi lên.
- `orders.service.ts` dùng logic báo giá của `checkout.service.ts`; không viết hai bộ tính tiền khác nhau.
- Tạo đơn và giữ tồn phải cùng transaction, có cơ chế chống tạo đơn lặp.
- Tra cứu đơn cần mã truy cập đủ mạnh và giới hạn thử sai; không chỉ dựa vào mã đơn dễ đoán.
- Thông tin thanh toán COD/chuyển khoản thuộc nghiệp vụ đơn V1; chưa cần module cổng thanh toán hoặc vận chuyển riêng.
- Controller quản trị sản phẩm/đơn sẽ có namespace và guard riêng khi triển khai admin bán hàng; không dùng endpoint công khai để sửa dữ liệu.
- Không đổi quyền của các API nội bộ hiện có để phục vụ customer.

Xem [cấu trúc frontend](../../../../web/features/commerce/README.md).
