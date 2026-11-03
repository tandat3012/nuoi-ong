# Bàn giao mobile: phí giao hàng theo miền và giao hàng cho nhân viên

## Phạm vi

Hai phần API + web, **chưa sửa mã trong `mobile/`**:

| Phần | Nhánh | Trạng thái | Migration |
| --- | --- | --- | --- |
| Phí giao hàng theo miền | `feature/region-shipping-fees` | Commit `f755286` | `0034_store-shipping-fees` |
| Giao hàng cho nhân viên, chủ trại sửa phí | `feature/order-delivery` (nối tiếp nhánh trên) | Chưa commit | `0035_order-delivery` |

Mobile hiện là app kho/tài sản, không có storefront và không có màn đơn hàng. Vì vậy chỉ mục **"Cần sửa"** ảnh hưởng tới app đang chạy; các mục khác là hợp đồng API để mobile tự quyết định có làm hay không.

## Cần sửa (ảnh hưởng app hiện tại)

1. **Vai trò mới `DELIVERY_STAFF` ("Nhân viên giao hàng").** `/auth/me` có thể trả mã này trong `memberships[].roles`.
   - `mobile/src/features/auth/types.ts`: `FarmRoleCode` chưa có `DELIVERY_STAFF`, cũng chưa có `MAINTENANCE_STAFF` từ đợt bảo trì trước.
   - `mobile/src/features/account/presentation/AccountLayout.tsx` (`roleLabels`): thiếu nhãn, nên tên vai trò bị trống ở màn tài khoản/hồ sơ.
   - `mobile/src/features/home/presentation/DashboardScreen.tsx` (`roleLabel`): đang hiện mã thô `DELIVERY_STAFF`.
   - Nhãn web đang dùng: `DELIVERY_STAFF: 'Nhân viên giao hàng'`, `MAINTENANCE_STAFF: 'Nhân viên bảo trì'`.
2. **Quyền vào mobile.** `canUseMobileOperations` (`mobile/src/features/auth/mobile-access.ts`) chỉ cho `EMPLOYEE`. Tài khoản chỉ có `DELIVERY_STAFF` sẽ bị đưa về màn "dùng web". Đây là đúng nếu mobile chưa làm màn giao hàng; nếu làm thì cần mở quyền riêng cho màn đó, **không** mở các màn kho/tài sản.
3. **Lịch sử hoạt động (`/audit-logs`).** Có thêm `entityType: 'STORE_ORDER'` với các `action` sau. Hiện `mobile/src/features/activity/model.ts` sẽ hiện mã thô và không có đường dẫn liên quan (`relatedRecordRoute` trả `null`, không lỗi).

   | action | Nhãn web |
   | --- | --- |
   | `DELIVERY_CLAIM` | Nhận giao đơn |
   | `DELIVERY_RETURN` | Trả đơn giao (`newData.reason` là lý do) |
   | `DELIVERY_COMPLETE` | Giao xong đơn (`newData.collectedCod` = đã thu COD) |

   Mọi log có `newData.code` là mã đơn (`DH000123`). `EMPLOYEE` giao hàng sẽ thấy các dòng này trong lịch sử của chính mình.

## Nghiệp vụ giao hàng (web đã có ở `/deliveries`)

Luồng: `CONFIRMED` (phiếu xuất đã duyệt) → **Nhận giao** → `SHIPPING` (ghi người giao) → **Đã giao xong** → `COMPLETED`. Đang giao mà không giao được: **Trả đơn** kèm lý do → về `CONFIRMED` để người khác nhận.

- Ai giao được: `DELIVERY_STAFF`, `EMPLOYEE`, `STORE_MANAGER`, `FARM_OWNER`, `ADMIN` (`STORE_DELIVERY_ROLES`).
- Giao xong và trả đơn: chỉ người đang giao đơn đó, hoặc quản lý cửa hàng (`ADMIN`, `FARM_OWNER`, `STORE_MANAGER`).
- COD: giao xong nghĩa là người giao đã thu tiền. Đơn được đánh dấu `PAID`, và `paidByMemberId` là người giao.
- Chuyển khoản chưa `PAID`: không cho báo giao xong (nút khoá).
- Shipper không xác nhận, không huỷ đơn, không xem danh sách đơn quản lý.
- Chỉ trại đã cấu hình bán online mới dùng được; trại khác trả `403 Farm does not sell online`.

Màn giao hàng rất hợp với điện thoại (shipper cầm máy ngoài đường). Nếu mobile làm, gợi ý: 2 tab "Chờ giao"/"Tôi đang giao", thẻ đơn có nút gọi `tel:`, mở bản đồ từ địa chỉ, dòng "Thu tiền mặt: …" nổi bật, xác nhận trước khi bấm giao xong.

### API (mọi request cần Clerk token và `?farmId=`)

| Method | Endpoint | Body | Kết quả |
| --- | --- | --- | --- |
| GET | `/store-orders/deliveries?scope=available` | | Đơn chờ giao, cũ nhất trước, tối đa 100 |
| GET | `/store-orders/deliveries?scope=mine` | | Đơn mình đang giao |
| POST | `/store-orders/:id/ship` | | Nhận giao |
| POST | `/store-orders/:id/complete` | | Đã giao xong |
| POST | `/store-orders/:id/return-delivery` | `{ "reason": "1–1000 ký tự" }` | Trả đơn |

`GET deliveries` trả `{ data: DeliveryOrder[] }`:

```ts
type DeliveryOrder = {
  id: string;
  code: string;            // DH000123
  status: 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | ...;
  recipientName: string;
  phone: string;
  address: string;
  region: 'NORTH' | 'CENTRAL' | 'SOUTH' | null;
  note: string | null;
  paymentMethod: 'COD' | 'BANK_TRANSFER';
  paymentStatus: 'UNPAID' | 'PAID';
  total: string;           // VNĐ, đã gồm phí giao hàng
  confirmedAt: string | null;
  shippedAt: string | null;
  items: { productName: string; variantName: string; quantity: number }[];
};
```

Ba POST trả `{ data }`:
- `DELIVERY_STAFF`/`EMPLOYEE`: `data` là **một `DeliveryOrder`** (không có email khách, thanh toán, kho).
- Quản lý cửa hàng: `data` là chi tiết đơn của staff (`order`, `items`, `customer`, `payments`, `replenishments`, `shipper`, `deliveryLog`).

Mobile nên coi kết quả chỉ là tín hiệu thành công rồi tải lại danh sách, không phụ thuộc hình dạng `data`.

### Lỗi cần xử lý

| HTTP | `message` | Gợi ý hiển thị |
| --- | --- | --- |
| 403 | `Delivery permission is required` | Bạn không có quyền giao hàng trong trại này |
| 403 | `Only the shipper of this order or a store manager can do this` | Chỉ người đang giao đơn hoặc quản lý được thao tác |
| 403 | `Farm does not sell online` | Trại chưa bán online |
| 409 | `Only CONFIRMED orders can be shipped` | Đơn đã có người nhận; tải lại danh sách |
| 409 | `The stock issue must be approved before shipping` | Phiếu xuất chưa duyệt |
| 409 | `Only SHIPPING orders can be completed` / `...returned` | Đơn không còn đang giao; tải lại |
| 409 | `Record the bank transfer before completing the order` | Chuyển khoản chưa ghi nhận |
| 400 | lỗi validation `reason` | Lý do 1–1000 ký tự |

Hai shipper cùng bấm "Nhận giao" một đơn: người sau nhận `409 Only CONFIRMED orders can be shipped`.

## Phí giao hàng theo miền

- Bảng `store_shipping_fees`, mỗi miền một dòng, dùng chung mọi trại. Migration tạo sẵn: Bắc 40.000, Trung 20.000, Nam 30.000.
- `GET /store/shipping-fees` (public) trả `{ data: { NORTH: "40000", CENTRAL: "20000", SOUTH: "30000" } }`.
- Tạo đơn (`POST /store/orders`): server tự cộng phí của `region`, `total = subtotal + shippingFee`. COD và VietQR đều dùng `total` này.
- `expectedShippingFee` (tuỳ chọn, chuỗi VNĐ): phí khách đã thấy. Phí đã đổi trả `409 { code: 'SHIPPING_FEE_CHANGED', shippingFee }`. Nó được tính vào fingerprint chống trùng đơn, nên gửi lại cùng `idempotencyKey` thì phải gửi đúng giá trị cũ.
- **Đã xoá** `PATCH /store-orders/:id/shipping-fee` (nhân viên sửa phí tay). Mobile không dùng endpoint này.
- Sửa phí: `PUT /store-admin/shipping-fees` `{ NORTH, CENTRAL, SOUTH }`, chỉ `ADMIN` hoặc `FARM_OWNER`. Chỉ làm trên web (`/store-products`).
- Nếu sau này mobile có luồng mua hàng: hiện phí theo miền và tổng đã gồm phí trước khi đặt, gửi `expectedShippingFee`, khi gặp `SHIPPING_FEE_CHANGED` thì tải lại phí rồi cho khách xác nhận lại.

## Dữ liệu và triển khai

- `store_orders.shipper_member_id` (mới): bắt buộc khi `SHIPPING`, giữ lại khi `COMPLETED`, xoá khi trả đơn. Chỉ có trong response của staff; khách không thấy.
- Đơn `SHIPPING` có trước migration được gán người giao = `handled_by_member_id`.
- Đơn `PENDING` đặt trước khi có phí giữ `shippingFee = "0"`.
- Migration `0034` và `0035` cần chạy trước khi deploy API mới.

## Kiểm tra trên mobile

Dùng tài khoản Clerk thật của: `DELIVERY_STAFF` thuần, `EMPLOYEE`, `EMPLOYEE` + `DELIVERY_STAFF`, `STORE_MANAGER`. Kiểm tra nhãn vai trò ở màn tài khoản/dashboard, màn được vào/bị chặn, và lịch sử hoạt động sau khi giao một đơn trên web.
