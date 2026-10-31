# Commerce — backend

Module cửa hàng trong NestJS API, đọc catalog từ PostgreSQL qua Drizzle.

| Method | Endpoint                       | Kết quả                                                        |
| ------ | ------------------------------ | -------------------------------------------------------------- |
| GET    | `/api/v1/store/products`       | Danh sách sản phẩm có phân trang, lọc và sắp xếp               |
| GET    | `/api/v1/store/products/:slug` | Chi tiết trong `{ data }`; không tìm thấy hoặc bị ẩn trả `404` |
| GET    | `/api/v1/store/categories`     | Danh mục storefront có phân trang, kể cả danh mục trống        |

Các endpoint này dùng `@Public()`; API nội bộ vẫn giữ xác thực và phân quyền hiện có. Không nhận kho/trang trại từ customer.

## Dữ liệu công khai

- Kho bán lấy từ `store_settings.id = 1`. Thiếu cấu hình hoặc kho/trang trại không hoạt động trả `503`.
- Chỉ trả sản phẩm `PUBLISHED` có ít nhất một variant `active`, gắn item và đơn vị hoạt động; item phải cùng trang trại với kho bán.
- `price` là giá thấp nhất của các variant hợp lệ, kể cả variant hết hàng. Lọc và sort giá dùng cùng giá này. Đây là giá khởi điểm; variant còn hàng có thể có giá cao hơn.
- Giá được so sánh bằng numeric trong DB, chỉ chuyển thành `number` khi trả response. Giá hiển thị vượt số nguyên an toàn của JavaScript trả `500` thay vì làm tròn âm thầm.
- `inStock` đúng khi có variant hợp lệ đủ tồn cho ít nhất một `quantityStep` tại kho bán. Hết hàng vẫn được hiển thị.
- `QUANTITY` dùng balance không gắn lô. `LOT` chỉ cộng lô đúng item/trang trại và chưa hết hạn; ngày hết hạn bằng hôm nay vẫn hợp lệ, ngày tính theo UTC như module kho.
- `ASSET` cần balance đủ và cá thể `AVAILABLE` có vị trí thuộc kho bán. Dữ liệu thiếu vị trí được coi là chưa sẵn hàng. Cá thể đang bảo trì hoặc đã nằm trong phiếu xuất chưa duyệt (vd. đơn đã xác nhận) không được tính.
- Ảnh đại diện là ảnh có `position` nhỏ nhất, trả `image: { src, alt }`; thiếu ảnh thì bỏ trường `image`.
- Chỉ trả trường catalog công khai, không trả giá vốn, item nội bộ hoặc serial. ID là UUID từ DB.

Sản phẩm gồm `id`, `slug`, `name`, `description`, `category: { id, name, slug }`, `price`, `inStock` và `image` nếu có. Chi tiết dùng cùng quy tắc hiển thị với danh sách. Chi tiết trả thêm `images: { src, alt }[]` theo `position` (rỗng nếu chưa có ảnh).

## Quản trị cửa hàng

Module `store-admin` (`/api/v1/store-admin/...`) cho `ADMIN` / `FARM_OWNER` quản lý sản phẩm mọi trạng thái, biến thể, danh mục và ảnh. Mọi request cần `?farmId=` của trang trại sở hữu kho bán (`store_settings`); farm khác trả `403`, chưa cấu hình kho bán trả `503`.

- Sản phẩm tạo ở `DRAFT`; `PUBLISHED` cần ít nhất một biến thể active gắn item/đơn vị đang hoạt động cùng farm. Không xóa sản phẩm/biến thể: dùng `ARCHIVED` và `active=false`.
- Ảnh tải qua `POST products/:id/images` (multipart `file`, `alt`), JPEG/PNG/WebP ≤ 10MB, lưu lên Cloudinary thư mục `nuoi-ong/products` dưới dạng WebP, cạnh dài tối đa 2000px, `quality: auto:good` (ảnh cũ không được nén lại). Web hiển thị qua loader `web/shared/lib/cloudinary-image.ts` (`f_auto,q_auto,w_<width>`). DB giữ `url` (`secure_url`) và `public_id`; lưu DB lỗi thì xóa file vừa tải. Xóa ảnh xóa dòng DB trước rồi xóa trên Cloudinary (lỗi chỉ log). `PUT products/:id/images/order` nhận đủ danh sách ID theo thứ tự mới.
- Kiểm tra: `test/store-admin.e2e-spec.ts` (HTTP/multipart) và `test/store-admin.integration.e2e-spec.ts` (DB thật, Cloudinary mock).

## Query và phân trang

| Query                   | Hợp đồng                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `page`                  | Mặc định `1`, số nguyên dương                                                                                                  |
| `pageSize`              | Mặc định `20`, tối đa `100`                                                                                                    |
| `category`              | Slug danh mục, tối đa 100 ký tự; slug hợp lệ không tồn tại trả danh sách rỗng                                                  |
| `q`                     | Trim, tối đa 100 ký tự; tìm substring trong tên, không phân biệt hoa/thường, có phân biệt dấu; `%`, `_` và `\` là ký tự thường |
| `minPrice` / `maxPrice` | Cận giá bao gồm, chỉ chữ số, từ `0` đến `9007199254740991`; hai cận bằng nhau hợp lệ                                           |
| `sort`                  | `price_asc` hoặc `price_desc`; giá bằng nhau theo ID tăng dần                                                                  |

Không truyền sort thì theo tên, ID tăng dần. Query sai định dạng, lặp không hợp lệ, cận giá đảo hoặc phân trang vượt phạm vi an toàn trả `400`. Bộ lọc kết hợp theo AND.

Danh sách dùng envelope `{ data, page: { number, size, totalItems, totalPages } }`. Trang vượt dữ liệu trả `data: []` và giữ tổng đã lọc; không có kết quả thì tổng và số trang bằng `0`.

Query catalog chỉ tổng hợp giá và dữ liệu sản phẩm. Lọc/sort/`LIMIT`/`OFFSET` chạy trong DB; count dùng cùng tập lọc. Sau đó lấy ảnh và tính tồn bằng hai query theo ID trên trang; trang rỗng bỏ qua hai query này. List và count không dùng cùng snapshot nên có thể lệch tạm thời khi catalog được sửa đồng thời.

## Kiểm tra

Từ `api/`:

```bash
pnpm exec jest --config ./test/jest-e2e.json --runInBand commerce.e2e-spec.ts
pnpm exec jest --config ./test/jest-db.json --runInBand commerce.integration.e2e-spec.ts
pnpm build
```

- `commerce.e2e-spec.ts` kiểm tra HTTP, validation, async response và guard bằng service/Clerk mock.
- `commerce.integration.e2e-spec.ts` kiểm tra service thật trên DB đã migrate: publication, giá variants, lọc/sort/phân trang, ảnh và ba kiểu tồn kho. Mỗi test tạo fixture trong transaction rồi rollback; cấu hình kho cũng được phục hồi.
- `commerce.fixtures.ts` không còn được service dùng.

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
- `price` là `numeric(18,0)`, không âm; `quantity_step` là `numeric(18,3)`, dương, mặc định `1`. Cả hai cấm `NaN`. Drizzle/pg trả numeric dưới dạng chuỗi để giữ độ chính xác; API chỉ chuyển giá sang `number` sau khi kiểm tra phạm vi số nguyên an toàn.
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

### Ràng buộc khi tích hợp quản trị và đơn hàng

- Thiết lập kho trước khi bán. Kho phải hoạt động; item phải cùng trang trại với kho được chọn. Khóa ngoại hiện chỉ kiểm tra sự tồn tại, chưa kiểm tra cùng trang trại hoặc trạng thái hoạt động. API đọc đã kiểm tra các điều kiện này và giới hạn tồn theo kho/trang trại; API quản trị sau này phải kiểm tra cả khi đổi kho/item.
- `QUANTITY` lấy tồn kho bán; `LOT` xét lô và hạn dùng theo nghiệp vụ. Với `ASSET`, phải bảo đảm vị trí cá thể thuộc kho bán và trạng thái đủ điều kiện xuất. Luồng nhập cho phép thiếu vị trí và luồng trả thiết bị hiện chưa cập nhật vị trí, nên cần xử lý trước khi dùng làm tồn khả dụng.
- Không tự công khai toàn bộ items hoặc danh mục nội bộ. Catalog được chọn và biên tập riêng trong các bảng storefront.

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
