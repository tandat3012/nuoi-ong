# Commerce — backend

Module cửa hàng trong NestJS API, đọc catalog từ PostgreSQL qua Drizzle.

| Method | Endpoint                       | Kết quả                                                        |
| ------ | ------------------------------ | -------------------------------------------------------------- |
| GET    | `/api/v1/store/products`       | Danh sách sản phẩm có phân trang, lọc và sắp xếp               |
| GET    | `/api/v1/store/products/:slug` | Chi tiết trong `{ data }`; không tìm thấy hoặc bị ẩn trả `404` |
| GET    | `/api/v1/store/categories`     | Danh mục storefront có phân trang, kể cả danh mục trống        |

Các endpoint này dùng `@Public()`; API nội bộ vẫn giữ xác thực và phân quyền hiện có. Không nhận kho/trang trại từ customer.

## Dữ liệu công khai

- Catalog dùng chung cho mọi trại. Một trại có nhiều kho; chủ trại chọn đúng **một** kho làm kho bán (`store_settings`, mỗi trại một dòng). Chỉ kho bán có miền giao (`regions`) và `sales_enabled`; các kho còn lại là kho làm việc. Chỉ tồn của **chính kho bán** được hứa cho khách và giữ khi xác nhận đơn (D03); kho khác không bao giờ được cộng, muốn bán thì chuyển hàng sang kho bán qua phiếu chuyển kho trước. Xác nhận đơn mà kho bán thiếu → `409 INSUFFICIENT_STOCK`, không giữ một phần, không tự tạo phiếu chuyển. Dữ liệu cũ: bảng `store_source_warehouses` vẫn còn nhưng không được đọc. Đơn `PREPARING` tạo trước T06 chạy nốt qua `store_order_replenishments` + `StockTransferHooks`: duyệt phiếu cuối thì đơn tự tạo phiếu xuất SALE và sang `CONFIRMED` (kho bán thiếu thì ở lại `PREPARING`, xác nhận lại sẽ 409); từ chối một phiếu thì huỷ phiếu còn chờ và đưa đơn về `PENDING`; staff huỷ đơn thì huỷ luôn phiếu chưa duyệt. Khách chỉ huỷ được đơn `PENDING`. **Tiền và hàng trả (T10, D10/D11):** chuyển khoản chỉ `PAID` qua webhook SePay hoặc đối soát tay (`mark-paid` với mã giao dịch ngân hàng, lưu thành `payment_transactions` provider `MANUAL`, mỗi mã một đơn, audit `PAYMENT_RECONCILE`); chưa `PAID` thì không nhận giao được. COD ghi đã thu khi giao xong; quản lý xác nhận nhận tiền một lần (`cod-remit`, lọc `codPending`). Huỷ đơn đã `PAID` bắt buộc ghi hoàn tiền thủ công (số tiền + chứng cứ). Không giao được: `return-delivery` chỉ đưa đơn về chờ giao (tồn không đổi); `return-to-warehouse` tạo phiếu nhập nháp ở kho bán với đúng hàng/lô đã xuất và đưa đơn sang `RETURNING`; kho sửa số lượng thực nhận (không vượt lượng đã xuất), xác nhận phiếu thì tồn tăng một lần và đơn sang `RETURNED` (`StockReceiptHooks`); từ chối/huỷ phiếu thì đơn về `SHIPPING`. Đơn `RETURNED` đã thanh toán ghi hoàn tiền qua `refund`. Chưa hỗ trợ trả hàng `ASSET`. Trại tắt bán, kho/trại không hoạt động thì không cung cấp hàng; không còn trả `503`.
- Chỉ trả sản phẩm `PUBLISHED` có ít nhất một variant `active` với đơn vị hoạt động và ít nhất một trại đang bán đã gắn item hoạt động vào variant đó (`store_variant_items`).
- `price` là giá thấp nhất của các variant hợp lệ, kể cả variant hết hàng. Lọc và sort giá dùng cùng giá này. Đây là giá khởi điểm; variant còn hàng có thể có giá cao hơn.
- Giá được so sánh bằng numeric trong DB, chỉ chuyển thành `number` khi trả response. Giá hiển thị vượt số nguyên an toàn của JavaScript trả `500` thay vì làm tròn âm thầm.
- `inStock` đúng khi **một** kho bán đủ tồn cho ít nhất một `quantityStep` của variant hợp lệ; tồn của nhiều kho không được cộng. Kho làm việc (mọi kho khác của trại) không tính. Hết hàng vẫn được hiển thị.
- Danh sách/chi tiết nhận `?region=NORTH|CENTRAL|SOUTH`; chi tiết nhận thêm `?quantity=` (số bước, mặc định 1). Sản phẩm và variant trả `availability`, không bao giờ trả số tồn:
  - không có miền: `REGION_REQUIRED` (còn ở đâu đó) hoặc `OUT_OF_STOCK`;
  - có miền: `AVAILABLE` (một kho bán của miền đủ `quantity`), `INSUFFICIENT_IN_REGION` (đủ 1 bước nhưng không đủ `quantity`), `REGION_NOT_SUPPORTED` (không kho bán nào của miền bán variant này), `OUT_IN_REGION` (miền khác còn), `OUT_OF_STOCK`.
  - Có miền thì `inStock` chỉ tính kho của miền đó.
- `POST cart/availability {region, items[{variantId, quantity}]}` trả `canOrder` (một kho của miền đủ cả giỏ), nhãn từng dòng và `groups` (mảng `variantId`) gợi ý tách đơn khi `canOrder=false`. Không trả id kho.
- Phí giao hàng: `GET store/shipping-fees` trả `{ NORTH, CENTRAL, SOUTH }` (chuỗi VNĐ, bảng `store_shipping_fees`, một dòng mỗi miền, dùng chung mọi trại). Tạo đơn chép phí của miền vào `shipping_fee`, `total = subtotal + shipping_fee`; COD và VietQR đều dùng `total` này. Gửi `expectedShippingFee` (phí khách đã thấy) thì phí đã đổi trả `409 SHIPPING_FEE_CHANGED`. Không còn sửa phí tay trên đơn.
- Tạo đơn: server duyệt kho bán theo mã trại, chọn kho đầu tiên đủ **toàn bộ** giỏ và ghi item của trại đó vào dòng đơn. Miền không có kho bán trả `409 REGION_NOT_SUPPORTED`. Không kho nào đủ một món trả `409 INSUFFICIENT_STOCK`; mỗi món có nơi đủ nhưng không chung một kho trả `409 CART_NOT_FULFILLABLE`.
- `QUANTITY` dùng balance không gắn lô. `LOT` chỉ cộng lô đúng item/trang trại và chưa hết hạn; ngày hết hạn bằng hôm nay vẫn hợp lệ, ngày tính theo UTC như module kho.
- `ASSET` cần balance đủ và cá thể `AVAILABLE` có vị trí thuộc kho bán. Dữ liệu thiếu vị trí được coi là chưa sẵn hàng. Cá thể đang bảo trì hoặc đã nằm trong phiếu xuất chưa duyệt (vd. đơn đã xác nhận) không được tính.
- Ảnh đại diện là ảnh có `position` nhỏ nhất, trả `image: { src, alt }`; thiếu ảnh thì bỏ trường `image`.
- Chỉ trả trường catalog công khai, không trả giá vốn, item nội bộ hoặc serial. ID là UUID từ DB.

Sản phẩm gồm `id`, `slug`, `name`, `description`, `category: { id, name, slug }`, `price`, `inStock`, `availability` và `image` nếu có. Chi tiết dùng cùng quy tắc hiển thị với danh sách. Chi tiết trả thêm `images: { src, alt }[]` theo `position` (rỗng nếu chưa có ảnh).

## Quản trị cửa hàng

Module `store-admin` (`/api/v1/store-admin/...`), mọi request cần `?farmId=`:

- Xem catalog: `ADMIN`, `FARM_OWNER`, `STORE_MANAGER`. Sửa catalog chung (sản phẩm, danh mục, biến thể, giá, ảnh): chỉ `ADMIN`.
- `GET/PUT settings`, `PUT/DELETE products/:id/variants/:variantId/item`: `ADMIN`/`FARM_OWNER` chọn kho bán, miền phục vụ và vật tư của trại cho từng variant. Vật tư phải cùng đơn vị với variant. Không đổi kho bán khi kho cũ còn đơn `PENDING`/`CONFIRMED`/`SHIPPING` (`409`).
- Tạo variant gắn luôn vật tư của trại đang chọn; vật tư đó quyết định `unit_id` của variant.
- Giao hàng (`STORE_DELIVERY_ROLES` = quản lý cửa hàng + `EMPLOYEE` + `DELIVERY_STAFF`): `GET store-orders/deliveries?scope=available|mine` liệt kê đơn `CONFIRMED` có phiếu xuất đã duyệt (chờ giao) hoặc đơn `SHIPPING` mình đang giao, kèm người nhận, SĐT, địa chỉ, dòng hàng và tổng. `POST :id/ship` (Nhận giao) chuyển sang `SHIPPING` và ghi `shipper_member_id` là người bấm. `POST :id/complete` (Đã giao xong) chuyển `COMPLETED`; COD ghi người giao là người thu tiền, chuyển khoản phải `PAID` trước. `POST :id/return-delivery {reason}` trả đơn về `CONFIRMED` và xoá người giao. Complete/return chỉ người đang giao hoặc quản lý cửa hàng. Mỗi bước ghi `audit_logs` (`STORE_ORDER`, `DELIVERY_CLAIM`/`DELIVERY_RETURN`/`DELIVERY_COMPLETE`); chi tiết đơn của staff trả `shipper` và `deliveryLog`. Ba thao tác trả chi tiết đơn đầy đủ cho quản lý cửa hàng, còn `EMPLOYEE`/`DELIVERY_STAFF` chỉ nhận dạng xem giao hàng (như `deliveries`, không có email khách, thanh toán hay kho). Web: `/deliveries`.
- Trả hàng về kho khi giao thất bại (`POST :id/return-to-warehouse`): tạo phiếu nhập nháp gồm đúng các dòng đã xuất; dòng tài sản giữ `assetId` của chính tài sản đã bán (sửa nháp giữ theo `lineId`, đổi mã không tạo tài sản mới). Kho chọn vị trí và `assetCondition` (`GOOD`/`DAMAGED`) cho từng tài sản; xác nhận đưa tài sản `RETIRED` về `AVAILABLE` hoặc `DAMAGED` tại vị trí đó, +1 tồn một lần. Tài sản/lô/mặt hàng khác đơn bị từ chối. Không món nào dùng được: xoá hết dòng rồi xác nhận phiếu rỗng, đơn sang `RETURNED`, không cộng tồn.
- `PUT shipping-fees` (chỉ `ADMIN`, theo D09): nhận đủ `{ NORTH, CENTRAL, SOUTH }`, áp dụng cho đơn đặt sau đó; đơn đã đặt giữ phí cũ. Mỗi lần lưu ghi audit `SHIPPING_FEES_UPDATED` (phí cũ/mới, người sửa) vào trại đang thao tác. Web sửa ở thẻ "Phí giao hàng theo miền" trên `/store-products`.
- `GET sales-stock` (`ADMIN`, `FARM_OWNER`, `STORE_MANAGER`): mỗi variant trại đã gắn, tồn vật lý tại kho bán, `held` (phiếu xuất `DRAFT`/`PENDING_APPROVAL`), `available = max(onHand - held, 0)` và `saleable`. Chỉ nhân viên thấy số; khách chỉ thấy nhãn.

- Sản phẩm tạo ở `DRAFT`; `PUBLISHED` cần ít nhất một biến thể active gắn item/đơn vị đang hoạt động cùng farm. Không xóa sản phẩm/biến thể: dùng `ARCHIVED` và `active=false`.
- Ảnh tải qua `POST products/:id/images` (multipart `file`, `alt`), JPEG/PNG/WebP ≤ 10MB, lưu lên Cloudinary thư mục `nuoi-ong/products` dưới dạng WebP, cạnh dài tối đa 2000px, `quality: auto:good` (ảnh cũ không được nén lại). Web hiển thị qua loader `web/shared/lib/cloudinary-image.ts` (`f_auto,q_auto,w_<width>`). DB giữ `url` (`secure_url`) và `public_id`; lưu DB lỗi thì xóa file vừa tải. Xóa ảnh xóa dòng DB trước rồi xóa trên Cloudinary (lỗi chỉ log). `PUT products/:id/images/order` nhận đủ danh sách ID theo thứ tự mới.
- Kiểm tra: `test/store-admin.e2e-spec.ts` (HTTP/multipart) và `test/store-admin.integration.e2e-spec.ts` (DB thật, Cloudinary mock).

## Bảo hành sau bán (NV06, T09)

`/api/v1/store-warranties?farmId=` (`STORE_MANAGE_ROLES`), service `StoreWarrantiesService`, bảng `store_warranty_requests`, lịch sử ở `audit_logs` (`entityType = STORE_WARRANTY`, action `WARRANTY_*`).

- Chỉ dòng **thiết bị/dụng cụ** của đơn `COMPLETED` cùng farm (AC22); vật tư → 400 `WARRANTY_NOT_APPLICABLE`. Tổng số lượng các yêu cầu đang mở trên một dòng không vượt số đã mua.
- Hạn: `items.warranty_months` (form "Thiết bị/dụng cụ") được chụp vào `store_order_items.warranty_months` khi đặt hàng (0 = không bảo hành, null = vật tư hoặc đơn trước T09 — nhân viên quyết định). Hạn = `completed_at` + số tháng; hết hạn chỉ tạo được `PAID_REPAIR`.
- Bảo hành hàng theo dõi tài sản: `POST store-warranties` bắt buộc `assetId` là một cá thể đơn đã giao (phiếu xuất bán hoặc phiếu đổi bảo hành đã xác nhận của chính đơn, cùng mặt hàng với dòng) và `quantity = 1`; mỗi tài sản chỉ một yêu cầu chưa đóng (unique index một phần, 409 `WARRANTY_ASSET_OPEN`). Chi tiết đơn của staff trả `deliveredAssets` để chọn. Hàng số lượng/lô không gửi `assetId`.
- Luồng `POST :id/actions { action }`: `send` (đối tác) → `quote` (báo giá, chuyển thành sửa có phí) → `decide` (khách đồng ý/từ chối) → `start-repair` → `back` (kết quả, chi phí) → `return` (đóng) hoặc `exchange`. Sửa có phí chưa có khách đồng ý thì `start-repair` 409 `CUSTOMER_CONSENT_REQUIRED`, CHECK trong DB cũng chặn (AC23).
- `exchange` tạo phiếu xuất nháp `OTHER` ở kho bán của đơn (chọn lô FEFO, trừ lượng đang giữ); kho xác nhận phiếu mới giảm tồn, một lần. `close` chỉ khi phiếu đã `CONFIRMED`; phiếu bị từ chối/hủy thì `exchange` lại được. Hàng lỗi khách trả không nhập kho (AC24).
- Khách xem trạng thái (chỉ đọc) trong `GET /store/orders/:id` → `warranties`, không có người xử lý hay phiếu kho. Chưa có: serial, trang khách tự gửi yêu cầu, thông báo.

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
| `store_settings`         | Một dòng mỗi trại: `sales_warehouse_id` (kho của chính trại, duy nhất), `regions`, `sales_enabled` |
| `store_variant_items`    | Vật tư của từng trại cung cấp một variant; mỗi item một variant, mỗi trại một item/variant |
| `store_categories`       | Tên, slug duy nhất của danh mục bán hàng                                        |
| `store_products`         | Nội dung, danh mục và trạng thái `DRAFT` / `PUBLISHED` / `ARCHIVED`             |
| `store_product_images`   | Gallery dùng chung cho các biến thể, ảnh có `position` nhỏ nhất là ảnh đại diện |
| `store_product_variants` | Lựa chọn mua: đơn vị, giá VNĐ, bước số lượng và cờ `active`                     |

- Sản phẩm mặc định `DRAFT`. Một sản phẩm đơn vẫn cần một biến thể; khi triển khai API xuất bản phải kiểm tra có biến thể hợp lệ. Chuyển về nháp sẽ ẩn sản phẩm, không giữ thêm phiên bản công khai song song.
- Mỗi `item_id` chỉ gắn với một biến thể (qua `store_variant_items`). Giá bán thuộc biến thể và tính theo `unit_id` của biến thể; mọi item gắn vào phải cùng đơn vị. Chưa có combo/quy đổi đơn vị.
- `price` là `numeric(18,0)`, không âm; `quantity_step` là `numeric(18,3)`, dương, mặc định `1`. Cả hai cấm `NaN`. Drizzle/pg trả numeric dưới dạng chuỗi để giữ độ chính xác; API chỉ chuyển giá sang `number` sau khi kiểm tra phạm vi số nguyên an toàn.
- PostgreSQL làm tròn numeric theo scale khi ghi. API ghi sau này phải từ chối giá lẻ đồng và bước có quá 3 chữ số thập phân trước khi gửi DB. Số lượng đặt phải là bội số dương của bước; tối thiểu bằng một bước. Quy tắc tính/làm tròn tiền thuộc bước triển khai đơn hàng.
- Trigger (từ `0028`) buộc bước bằng `1` khi variant gắn item `ASSET`, kiểm tra khi đổi bước, khi gắn/đổi item trong `store_variant_items` và khi đổi `items.tracking_mode`. Trigger khóa chia sẻ item khi kiểm tra để tránh tranh chấp với đổi cách quản lý.
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
- Upsert theo slug danh mục/sản phẩm, item của biến thể (qua `store_variant_items`), cặp `(product_id, position)` của ảnh và `farm_id` của cấu hình (FARM-DEMO, bật bán cho cả 3 miền nếu chưa chọn miền). Chạy lại giữ ID, cập nhật nội dung/giá/trạng thái mẫu; không xóa các bản ghi thêm ngoài seed. Nếu item đã gắn với sản phẩm khác, báo lỗi và rollback thay vì chuyển sản phẩm của item.
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
