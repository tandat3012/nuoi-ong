# API và Database Module Kho

## 1. Tổng quan

Module Kho chạy tại `http://localhost:5050` và quản lý warehouse, nhập kho, xuất kho, tồn kho, LOT, ASSET, chuyển kho, kiểm kê và điều chỉnh tồn.

API nghiệp vụ yêu cầu:

```http
Authorization: Bearer <Clerk JWT>
Content-Type: application/json
```

`farmId` luôn được dùng để giới hạn dữ liệu theo farm. API đọc yêu cầu membership `ACTIVE`; API ghi yêu cầu role `ADMIN` hoặc `FARM_OWNER`.

| Mã | Ý nghĩa |
|---|---|
| `200/201` | Thành công |
| `400` | Dữ liệu request không hợp lệ |
| `401` | Thiếu, sai hoặc hết hạn JWT |
| `403` | Không có membership/quyền phù hợp |
| `404` | Không tìm thấy dữ liệu trong farm |
| `409` | Vi phạm trạng thái hoặc nghiệp vụ |

## 2. Warehouse API

```text
GET   /api/v1/warehouses?farmId=...
GET   /api/v1/warehouses/:id?farmId=...
POST  /api/v1/warehouses?farmId=...
PATCH /api/v1/warehouses/:id?farmId=...
```

Warehouse thuộc một farm, có `code`, `name` và `status`. Chỉ warehouse `ACTIVE` được dùng cho nhập, xuất, chuyển và kiểm kê. Mã warehouse phải duy nhất trong farm.

## 3. Stock Receipt API

```text
GET   /api/v1/stock-receipts?farmId=...
POST  /api/v1/stock-receipts?farmId=...
GET   /api/v1/stock-receipts/:id?farmId=...
PATCH /api/v1/stock-receipts/:id?farmId=...
POST  /api/v1/stock-receipts/:id/confirm?farmId=...
POST  /api/v1/stock-receipts/:id/cancel?farmId=...
```

Luồng:

```text
POST -> DRAFT -> PATCH -> CONFIRM -> tăng tồn kho
```

Khi tạo phiếu, hệ thống lưu chứng từ và dòng hàng nhưng chưa tăng tồn. Validation metadata LOT/ASSET được kiểm tra khi confirm.

- `QUANTITY`: chỉ cần `itemId` và `quantity`.
- `LOT`: cần `lotNumber`; confirm sẽ tạo `inventory_lots` nếu chưa có `lotId`.
- `ASSET`: cần `assetCode`, `quantity` phải bằng `1`; confirm sẽ tạo `assets` nếu chưa có `assetId`.
- Confirm thành công cập nhật `inventory_balances` và tạo transaction `RECEIPT`.
- Phiếu đã `CONFIRMED` không được cộng tồn lần hai.

## 4. Stock Issue API

```text
GET   /api/v1/stock-issues?farmId=...
POST  /api/v1/stock-issues?farmId=...
GET   /api/v1/stock-issues/:id?farmId=...
PATCH /api/v1/stock-issues/:id?farmId=...
POST  /api/v1/stock-issues/:id/confirm?farmId=...
POST  /api/v1/stock-issues/:id/cancel?farmId=...
```

Phiếu mới là `DRAFT`; chỉ confirm mới kiểm tra tồn và trừ balance. Không cho xuất vượt tồn hoặc làm tồn âm.

- Issue thường tạo `ISSUE`.
- Issue bảo trì phải có `issueType = MAINTENANCE` và `maintenanceRecordId`.
- Issue bảo trì tạo transaction `MAINTENANCE_ISSUE`.
- Constraint database bắt buộc `MAINTENANCE` phải có maintenance record và loại khác phải để field này `NULL`.

## 5. Inventory và Adjustment API

```text
GET  /api/v1/inventory?farmId=...&warehouseId=...&itemId=...&lotId=...
GET  /api/v1/inventory/transactions?farmId=...&warehouseId=...&itemId=...
POST /api/v1/inventory/adjustments?farmId=...
```

`inventory_balances` là số dư hiện tại; `inventory_transactions` là nhật ký bất biến của mọi biến động.

Adjustment nhận:

```json
{
  "warehouseId": "UUID",
  "itemId": "UUID",
  "quantityChange": "5.000",
  "reason": "Lý do điều chỉnh"
}
```

- Số dương tạo `ADJUSTMENT_IN`.
- Số âm tạo `ADJUSTMENT_OUT`.
- Không chấp nhận `0` hoặc điều chỉnh làm tồn âm.
- `reason` được lưu trong transaction để truy vết.
- Balance và transaction được cập nhật trong cùng database transaction.

## 6. LOT API

```text
GET /api/v1/lots?farmId=...&itemId=...
GET /api/v1/lots/suggestions?farmId=...&itemId=...&warehouseId=...
```

LOT thuộc một farm và một item. Suggestions dùng để chọn LOT phù hợp khi xuất, chỉ trả dữ liệu đúng item/farm và có thể giới hạn theo warehouse.

## 7. Stock Transfer API

```text
GET   /api/v1/stock-transfers?farmId=...
POST  /api/v1/stock-transfers?farmId=...
GET   /api/v1/stock-transfers/:id?farmId=...
PATCH /api/v1/stock-transfers/:id?farmId=...
POST  /api/v1/stock-transfers/:id/confirm?farmId=...
POST  /api/v1/stock-transfers/:id/cancel?farmId=...
```

Luồng:

```text
POST DRAFT -> PATCH -> CONFIRM
-> trừ kho nguồn
-> cộng kho đích
-> TRANSFER_OUT + TRANSFER_IN
```

Kho nguồn và đích phải khác nhau, cùng farm, `ACTIVE` và phiếu phải có item. Nguồn phải đủ tồn. Hai transaction dùng cùng `sourceType = STOCK_TRANSFER` và `sourceId = transferId`. Confirm lại không được biến động lần hai.

## 8. Stock Count API

```text
GET   /api/v1/stock-counts?farmId=...
POST  /api/v1/stock-counts?farmId=...
GET   /api/v1/stock-counts/:id?farmId=...
PATCH /api/v1/stock-counts/:id?farmId=...
POST  /api/v1/stock-counts/:id/confirm?farmId=...
POST  /api/v1/stock-counts/:id/cancel?farmId=...
```

Trạng thái:

```text
DRAFT -> COUNTING -> CONFIRMED
DRAFT/COUNTING -> CANCELLED
```

`systemQuantity` là snapshot tồn khi lập phiếu; `actualQuantity` là số đếm thực tế. Khi confirm, nếu tồn hiện tại khác snapshot thì trả `409 STOCK_COUNT_STALE`. Chênh lệch dương tạo `ADJUSTMENT_IN`, chênh lệch âm tạo `ADJUSTMENT_OUT`; không chênh lệch thì không tạo transaction.

## 9. Asset Return API

```text
GET  /api/v1/assets?farmId=...
GET  /api/v1/assets/:id?farmId=...
GET  /api/v1/assets/by-code/:assetCode?farmId=...
GET  /api/v1/assets/by-qr/:qrToken?farmId=...
POST /api/v1/assets/:id/return?farmId=...
```

Asset chỉ được return khi đang `ASSIGNED` hoặc `IN_USE`. Warehouse nhận phải `ACTIVE`. Sau khi return, asset thành `AVAILABLE` và tạo transaction `RETURN_IN`. Asset đã `AVAILABLE` trả lại sẽ bị từ chối bằng `409`.

## 10. Maintenance Records liên quan kho

```text
GET   /api/v1/maintenance-records?farmId=...
POST  /api/v1/maintenance-records?farmId=...
GET   /api/v1/maintenance-records/:id?farmId=...
PATCH /api/v1/maintenance-records/:id?farmId=...
POST  /api/v1/maintenance-records/:id/start?farmId=...
POST  /api/v1/maintenance-records/:id/complete?farmId=...
POST  /api/v1/maintenance-records/:id/cancel?farmId=...
```

Trạng thái hợp lệ:

```text
SCHEDULED -> IN_PROGRESS -> COMPLETED
SCHEDULED/IN_PROGRESS -> CANCELLED
```

Một asset chỉ có một maintenance đang hoạt động. Trạng thái hoạt động là `SCHEDULED` và `IN_PROGRESS`; database bảo vệ bằng unique partial index `ux_one_active_maintenance_per_asset`. Đây là lý do tạo record mới cho asset đang bảo trì sẽ trả `409`.

## 11. Bảng và field database

### Phạm vi và quyền

| Bảng | Field chính | Vai trò |
|---|---|---|
| `farms` | `id`, `code`, `name` | Trại ong/tenant |
| `users` | `id`, `auth_provider_user_id`, `status` | User liên kết Clerk |
| `farm_members` | `id`, `farm_id`, `user_id`, `status` | Membership trong farm |
| `roles` | `id`, `code` | Quyền như `ADMIN`, `FARM_OWNER` |
| `farm_member_roles` | `farm_member_id`, `role_id` | Gán quyền |

### Danh mục và tồn

| Bảng | Field chính | Vai trò |
|---|---|---|
| `warehouses` | `id`, `farm_id`, `code`, `name`, `status` | Kho |
| `items` | `id`, `farm_id`, `code`, `name`, `tracking_mode` | Vật tư/thiết bị |
| `inventory_lots` | `id`, `farm_id`, `item_id`, `lot_number`, `manufactured_date`, `expiry_date`, `initial_quantity` | LOT |
| `assets` | `id`, `farm_id`, `item_id`, `asset_code`, `serial_number`, `status` | Tài sản riêng |
| `inventory_balances` | `id`, `farm_id`, `warehouse_id`, `item_id`, `lot_id`, `quantity_on_hand` | Số dư hiện tại |
| `inventory_transactions` | `id`, `warehouse_id`, `item_id`, `lot_id`, `asset_id`, `transaction_type`, `quantity_change`, `reason`, `source_type`, `source_id` | Nhật ký biến động |

### Chứng từ

| Bảng | Field chính | Vai trò |
|---|---|---|
| `stock_receipts` | `id`, `farm_id`, `warehouse_id`, `receipt_code`, `status` | Phiếu nhập |
| `stock_receipt_items` | `stock_receipt_id`, `item_id`, `quantity`, `lot_id`, `lot_number`, `asset_id`, `asset_code`, `serial_number` | Dòng nhập và metadata |
| `stock_issues` | `id`, `warehouse_id`, `issue_code`, `issue_type`, `status`, `maintenance_record_id`, `reason` | Phiếu xuất |
| `stock_issue_items` | `stock_issue_id`, `item_id`, `lot_id`, `asset_id`, `quantity` | Dòng xuất |
| `stock_transfers` | `id`, `from_warehouse_id`, `to_warehouse_id`, `transfer_code`, `status` | Phiếu chuyển |
| `stock_transfer_items` | `stock_transfer_id`, `item_id`, `lot_id`, `asset_id`, `quantity` | Dòng chuyển |
| `stock_counts` | `id`, `warehouse_id`, `count_code`, `status` | Phiếu kiểm kê |
| `stock_count_items` | `stock_count_id`, `item_id`, `system_quantity`, `actual_quantity`, `note` | Snapshot và số đếm |
| `maintenance_records` | `id`, `asset_id`, `maintenance_type`, `status`, `labor_cost`, `material_cost`, `other_cost` | Hồ sơ bảo trì |

## 12. Kiểm thử và migration

Đã kiểm thử các nhóm thành công, xác thực, validation, không tìm thấy, conflict trạng thái, thiếu tồn, cập nhật balance và tạo transaction. Sau mỗi flow cần đối chiếu chứng từ, `inventory_balances` và `inventory_transactions`.

Quy trình thay đổi schema Drizzle:

```text
sửa api/src/db/schema/schema.ts
-> pnpm db:generate
-> kiểm tra SQL trong api/drizzle
-> pnpm db:migrate
-> test API
```

File SQL database là tài liệu đối chiếu; `schema.ts` và migration Drizzle là nguồn thực thi. Không chạy lại toàn bộ SQL trên database đã quản lý bằng migration nếu có nguy cơ trùng bảng, enum, index hoặc constraint.
