# Commerce — backend

Module bán hàng phục vụ customer trong NestJS API hiện tại, đã đăng ký trong `AppModule`.

## API base hiện tại

| Method | Endpoint                       | Kết quả                                                           |
| ------ | ------------------------------ | ----------------------------------------------------------------- |
| GET    | `/api/v1/store/products`       | Danh sách sản phẩm có phân trang                                  |
| GET    | `/api/v1/store/products/:slug` | Chi tiết sản phẩm, bọc trong `{ data }`; không tìm thấy trả `404` |
| GET    | `/api/v1/store/categories`     | Danh sách danh mục có phân trang                                  |

- Dùng **dữ liệu mẫu cố định** trong `commerce.fixtures.ts`: 4 sản phẩm và 4 danh mục. Giá (số nguyên VNĐ), ID và `inStock` đều là minh họa, không phản ánh dữ liệu thực tế.
- API hiện chưa truy cập DB và không công khai hồ sơ vật tư/tài sản nội bộ. Schema storefront đã được chuẩn bị bằng migration `0014`–`0015`, chưa nối vào các endpoint này.
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

## Schema storefront

Định nghĩa Drizzle nằm tại `api/src/db/schema/storefront.ts`, được export qua `schema/index.ts`.

| Bảng                     | Trách nhiệm                                                                     |
| ------------------------ | ------------------------------------------------------------------------------- |
| `store_settings`         | Tối đa một bản ghi (`id = 1`), chọn kho bán hàng qua `warehouse_id`             |
| `store_categories`       | Tên, slug duy nhất của danh mục bán hàng                                        |
| `store_products`         | Nội dung, danh mục và trạng thái `DRAFT` / `PUBLISHED` / `ARCHIVED`             |
| `store_product_images`   | Gallery dùng chung cho các biến thể, ảnh có `position` nhỏ nhất là ảnh đại diện |
| `store_product_variants` | Mỗi lựa chọn mua gắn một `item`, giá VNĐ, bước số lượng và cờ `active`          |

- Sản phẩm mặc định `DRAFT`. Một sản phẩm đơn vẫn cần một biến thể; khi triển khai API xuất bản phải kiểm tra có biến thể hợp lệ. Chuyển về nháp sẽ ẩn sản phẩm, không giữ thêm phiên bản công khai song song.
- Mỗi `item_id` chỉ xuất hiện ở một biến thể. Giá bán thuộc biến thể, đơn vị lấy từ `items.unit_id`; chưa có combo/quy đổi đơn vị.
- `price` là `numeric(18,0)`, không âm; `quantity_step` là `numeric(18,3)`, dương, mặc định `1`. Cả hai cấm `NaN`. Drizzle/pg trả numeric dưới dạng chuỗi để giữ độ chính xác; API nối DB sau này cần quyết định serialize giá tương thích frontend, không ép mọi giá sang `Number` thiếu kiểm tra.
- PostgreSQL làm tròn numeric theo scale khi ghi. API ghi sau này phải từ chối giá lẻ đồng và bước có quá 3 chữ số thập phân trước khi gửi DB. Số lượng đặt phải là bội số dương của bước; tối thiểu bằng một bước. Quy tắc tính/làm tròn tiền thuộc bước triển khai đơn hàng.
- Migration `0015` dùng trigger buộc bước của item `ASSET` bằng `1`, kiểm tra cả thay đổi biến thể và đổi `items.tracking_mode`. Trigger khóa chia sẻ item khi kiểm tra để tránh tranh chấp với đổi cách quản lý.
- Ảnh có thứ tự không âm, duy nhất trong từng sản phẩm. Khi đổi chỗ hai ảnh, API cần dùng vị trí tạm còn trống trong transaction để tránh vi phạm unique.
- Các khóa ngoại dùng `RESTRICT` khi xóa; không xóa dây chuyền item, kho hoặc nội dung có dữ liệu phụ thuộc. `updated_at` được cập nhật bởi service khi ghi, theo convention hiện tại.
- Không lưu tồn kho, serial, hoặc `in_stock` lặp lại trong storefront. `inventory_balances`, `inventory_lots`, `assets` là nguồn dữ liệu cho bước tích hợp sau.

Migration chỉ thêm cấu trúc và ràng buộc; không tự chọn kho, không seed sản phẩm và không sửa dữ liệu kho. Sau khi kiểm tra `DATABASE_URL` trỏ đúng môi trường, chạy từ `api/`:

```bash
pnpm db:migrate
pnpm test:db --runInBand
pnpm build
```

Test storefront dùng transaction rollback và được đưa vào `test:db`; chạy trên DB test đã migrate. Có thể chạy riêng bằng `pnpm exec jest --config ./test/jest-db.json --runInBand storefront-schema.integration.e2e-spec.ts`.

### Seed storefront local

Script `api/scripts/seed-storefront.ts` chỉ ghi vào năm bảng storefront. Sau khi migrate, chạy từ `api/` với `DATABASE_URL` của DB local:

```bash
pnpm db:seed:storefront
```

- Cần sáu mặt hàng mẫu của `pnpm db:seed` tồn tại, hoạt động và có đúng đơn vị. Script không tự chạy seed gốc hoặc tạo/sửa hàng, tài sản, lô hay tồn kho.
- Dùng kho đã cấu hình trong `store_settings`; nếu chưa có, dùng `WH-MAIN` của `FARM-DEMO`. Kho và trang trại phải hoạt động, các item được tìm trong đúng trang trại của kho.
- Upsert theo slug danh mục/sản phẩm, `item_id` của biến thể, cặp `(product_id, position)` của ảnh và `id = 1` của cấu hình. Chạy lại giữ ID, cập nhật nội dung/giá/trạng thái mẫu; không xóa các bản ghi thêm ngoài seed. Nếu item đã gắn với sản phẩm khác, báo lỗi và rollback thay vì chuyển sản phẩm của item.
- Có 4 danh mục, 6 sản phẩm/biến thể, 7 ảnh minh họa và một cấu hình kho; gồm bản nháp, đã xuất bản, ngừng bán và bước số lượng lẻ. Giá là minh họa; ảnh dùng chung `/assets/bee-farm-hero.jpg` sẵn có trên web, cần thay bằng ảnh sản phẩm thật.
- Cả lần seed dùng một transaction, khóa advisory tránh hai lần seed chạy đồng thời. Thiếu điều kiện hoặc lỗi SQL sẽ rollback. CLI từ chối môi trường production và host ngoài local.
- Test seed dùng DB test riêng, storefront trống và chưa có `FARM-DEMO`; không chạy bộ test này trên DB chứa dữ liệu phát triển cần giữ.

### Điều kiện cần xử lý khi nối API

- Thiết lập kho trước khi bán. Kho phải hoạt động; item phải cùng trang trại với kho được chọn. Khóa ngoại hiện chỉ kiểm tra sự tồn tại, chưa kiểm tra cùng trang trại hoặc trạng thái hoạt động. API quản trị phải kiểm tra cả khi đổi kho/item và luôn giới hạn truy vấn tồn theo đúng kho/trang trại.
- `QUANTITY` lấy tồn kho bán; `LOT` xét lô và hạn dùng theo nghiệp vụ. Với `ASSET`, phải bảo đảm vị trí cá thể thuộc kho bán và trạng thái đủ điều kiện xuất. Luồng nhập cho phép thiếu vị trí và luồng trả thiết bị hiện chưa cập nhật vị trí, nên cần xử lý trước khi dùng làm tồn khả dụng.
- Không tự công khai toàn bộ items hoặc danh mục nội bộ. Catalog được chọn và biên tập riêng; sửa bảng storefront chưa làm thay đổi API mock hiện tại.

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
