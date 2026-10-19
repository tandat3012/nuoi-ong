# Báo cáo W2 - Warehouse UI

## 1. Mục tiêu

Xây dựng giao diện quản lý kho cho farm hiện tại, cho phép người dùng xem danh sách, tìm kiếm, lọc, phân trang, xem chi tiết và thực hiện các thao tác quản lý kho theo quyền của membership.

Phạm vi này gồm hai nhóm task:

- Xây dựng danh sách và chi tiết kho.
- Tạo, cập nhật và vô hiệu hóa kho.

## 2. Phạm vi đã thực hiện

### 2.1. Route và navigation

- Tạo route danh sách kho: `/warehouses`.
- Tạo route chi tiết kho: `/warehouses/:id`.
- Thêm mục `Kho` vào navigation của ứng dụng.
- Màn hình chi tiết có nút quay lại danh sách kho.

### 2.2. Danh sách kho

Màn hình danh sách kho được triển khai tại:

```text
web/features/warehouses/components/warehouses-screen.tsx
```

Chức năng:

- Gọi API danh sách kho.
- Tìm kiếm theo mã kho hoặc tên kho.
- Lọc theo trạng thái `ACTIVE` và `INACTIVE`.
- Phân trang.
- Hiển thị mã, tên, địa chỉ và trạng thái kho.
- Click vào tên kho để mở chi tiết.
- Hiển thị trạng thái loading, empty và error.
- Không tự động chọn hoặc hard-code kho từ seed.

Request sử dụng:

```http
GET /api/v1/warehouses
```

Query gửi lên backend:

```text
farmId
page
pageSize
search
status
```

### 2.3. Chi tiết kho

Màn hình được triển khai tại:

```text
web/features/warehouses/components/warehouse-detail-screen.tsx
```

Hiển thị:

- Mã kho.
- Tên kho.
- Trạng thái.
- Địa chỉ.
- Mô tả.
- Danh sách tồn kho trong kho.
- Mã và tên item.
- LOT tương ứng nếu có.
- Số lượng tồn hiện tại.

API sử dụng:

```http
GET /api/v1/warehouses/:id?farmId={{currentFarmId}}
GET /api/v1/inventory?farmId={{currentFarmId}}&warehouseId={{warehouseId}}
```

### 2.4. Tạo kho

Form tạo kho gồm:

- `code` - mã kho, bắt buộc, tối đa 50 ký tự.
- `name` - tên kho, bắt buộc, tối đa 255 ký tự.
- `address` - địa chỉ.
- `description` - mô tả.

API sử dụng:

```http
POST /api/v1/warehouses?farmId={{currentFarmId}}
```

Kho mới được tạo với trạng thái `ACTIVE` ở backend.

Sau khi tạo thành công:

- Form được đóng.
- Kho mới được cập nhật vào danh sách.
- Chi tiết kho được cập nhật.

### 2.5. Cập nhật kho

Form cập nhật được mở từ màn hình chi tiết kho.

API sử dụng:

```http
PATCH /api/v1/warehouses/:id?farmId={{currentFarmId}}
```

Các trường có thể cập nhật:

- `code`.
- `name`.
- `address`.
- `description`.

Chỉ kho thuộc farm hiện tại mới được cập nhật.

### 2.6. Vô hiệu hóa kho

Thao tác được thực hiện từ danh sách kho bằng nút `Vô hiệu hóa`.

API sử dụng:

```http
DELETE /api/v1/warehouses/:id?farmId={{currentFarmId}}
```

Backend xử lý theo hướng soft delete bằng cách chuyển trạng thái kho sang `INACTIVE`, không xóa vật lý bản ghi.

Không được vô hiệu hóa kho nếu:

- Kho còn số lượng tồn lớn hơn 0.
- Kho còn đang giữ tài sản.

Trong các trường hợp trên backend trả lỗi:

```text
409 WAREHOUSE_NOT_EMPTY
```

FE hiển thị thông báo:

```text
Không thể vô hiệu hóa kho vì kho còn tồn kho hoặc tài sản.
```

## 3. Farm context và phân quyền

### 3.1. Farm hiện tại

FE sử dụng `selectedFarmId` từ `useAuthContext()`:

```ts
const { data: auth, selectedFarmId } = useAuthContext();
```

Không sử dụng UUID farm seed trực tiếp trong component.

Khi người dùng đổi farm:

- Dữ liệu kho cũ được xóa khỏi state.
- Trang được reset về trang đầu tiên.
- Request mới sử dụng farm đang chọn.
- Response trễ của farm cũ bị bỏ qua.

### 3.2. Quyền đọc và ghi

Quyền ghi được xác định từ membership của farm hiện tại:

```text
ADMIN       -> được đọc và ghi
FARM_OWNER  -> được đọc và ghi
EMPLOYEE    -> chỉ đọc
GUEST       -> chỉ đọc
```

FE dùng quyền này để ẩn các action:

- Tạo kho.
- Cập nhật kho.
- Vô hiệu hóa kho.

Backend vẫn kiểm tra quyền trên từng request bằng `assertFarmAccess`, vì vậy việc ẩn button trên FE không thay thế kiểm tra bảo mật ở backend.

## 4. Xử lý lỗi

### `400 Bad Request`

Dữ liệu form không hợp lệ hoặc thiếu trường bắt buộc.

### `403 Forbidden`

Người dùng không có membership hợp lệ trong farm hoặc không có role ghi dữ liệu.

FE hiển thị:

```text
Bạn không có quyền thực hiện thao tác này.
```

### `404 Not Found`

Kho không tồn tại trong farm hiện tại.

### `409 Conflict` do trùng mã kho

Backend trả lỗi khi mã kho đã tồn tại trong cùng farm.

FE hiển thị:

```text
Mã kho đã tồn tại trong farm này.
```

### `409 WAREHOUSE_NOT_EMPTY`

Không cho vô hiệu hóa kho còn tồn kho hoặc còn tài sản.

FE hiển thị rõ nguyên nhân thay vì chỉ hiển thị thông báo lỗi chung.

### Loading, empty và network error

Các màn hình có trạng thái:

- Đang tải dữ liệu.
- Không có dữ liệu phù hợp.
- Lỗi API.
- Không có farm đang chọn.

## 5. Backend Warehouse API liên quan

Các endpoint được FE sử dụng:

```http
GET    /api/v1/warehouses
POST   /api/v1/warehouses
GET    /api/v1/warehouses/:id
PATCH  /api/v1/warehouses/:id
DELETE /api/v1/warehouses/:id
GET    /api/v1/inventory
GET    /api/v1/items
```

Endpoint item dùng cho các form kho được bổ sung tại:

```text
api/src/modules/inventory/inventory.controller.ts
api/src/modules/inventory/inventory.service.ts
```

Endpoint này trả item thuộc farm hiện tại, gồm cả:

- `MATERIAL`.
- `EQUIPMENT`.
- `TOOL`.

Mục đích là phục vụ lựa chọn item trong các form nhập, xuất, điều chuyển và kiểm kê.

## 6. Database và nghiệp vụ vô hiệu hóa kho

Service backend nằm tại:

```text
api/src/modules/warehouses/warehouses.service.ts
```

Khi vô hiệu hóa kho, backend:

1. Kiểm tra user có membership active trong farm.
2. Kiểm tra user có role `ADMIN` hoặc `FARM_OWNER`.
3. Tìm kho theo cả `warehouseId` và `farmId`.
4. Tính tổng `quantityOnHand` trong `inventory_balances`.
5. Kiểm tra tài sản đang có vị trí thuộc kho.
6. Nếu kho rỗng thì cập nhật `status = INACTIVE`.
7. Nếu kho không rỗng thì trả `WAREHOUSE_NOT_EMPTY`.

Không thay đổi database schema cho hai task W2.

## 7. Đối chiếu tiêu chí hoàn thành

| Tiêu chí | Kết quả |
|---|---|
| Hiển thị dữ liệu kho từ seed local | Đạt |
| Search gửi đúng query | Đạt |
| Filter trạng thái gửi đúng query | Đạt |
| Pagination gửi đúng query | Đạt |
| Xem chi tiết một kho | Đạt |
| Hiển thị tồn kho theo kho | Đạt |
| Không hard-code farm hoặc seed ID | Đạt |
| Không truy cập chéo dữ liệu giữa farm | Đạt ở FE và backend |
| Tạo kho theo quyền | Đạt |
| Cập nhật kho theo quyền | Đạt |
| Vô hiệu hóa kho hợp lệ | Đạt |
| Chặn kho còn tồn hoặc tài sản | Đạt |
| Hiển thị lỗi mã kho trùng | Đạt |
| Hiển thị lỗi `WAREHOUSE_NOT_EMPTY` | Đạt |
| Role chỉ đọc không ghi được | Đạt ở FE và backend |
| Loading, empty, error, forbidden | Đạt |

## 8. Kiểm tra kỹ thuật

Đã kiểm tra TypeScript cho backend:

```powershell
cd api
.\node_modules\.bin\tsc.CMD --noEmit
```

Đã kiểm tra TypeScript cho frontend:

```powershell
cd web
.\node_modules\.bin\tsc.CMD --noEmit
```

Kết quả:

```text
Backend TypeScript: PASS
Frontend TypeScript: PASS
```

Đã kiểm tra ESLint cho các màn hình warehouse và các component liên quan:

```text
ESLint: PASS
```

## 9. Checklist kiểm thử thủ công

1. Đăng nhập bằng user có role `ADMIN` hoặc `FARM_OWNER`.
2. Mở `/warehouses` và kiểm tra danh sách từ seed local.
3. Tìm kiếm theo mã kho và tên kho.
4. Lọc `ACTIVE` và `INACTIVE`.
5. Chuyển trang.
6. Click tên kho để mở chi tiết.
7. Kiểm tra tồn kho hiển thị đúng theo `warehouseId`.
8. Tạo kho mới.
9. Tạo kho với mã đã tồn tại.
10. Cập nhật thông tin kho.
11. Vô hiệu hóa kho rỗng.
12. Thử vô hiệu hóa kho còn tồn kho.
13. Thử vô hiệu hóa kho còn tài sản.
14. Đổi sang farm khác và kiểm tra dữ liệu được tải lại.
15. Đăng nhập bằng role chỉ đọc và kiểm tra không có action ghi.
16. Gọi API bằng `farmId` của farm khác và xác nhận không truy cập chéo.

## 10. Phạm vi chưa thuộc W2

Các chức năng sau thuộc phạm vi mở rộng của Module Kho, không phải tiêu chí bắt buộc của hai task W2:

- Stock Transfer nâng cao.
- Stock Count nâng cao.
- Inventory Adjustment.
- Maintenance Record.
- Maintenance Material Issue.
- Asset Return.
- Lịch sử inventory transaction.
- Quản lý LOT chi tiết.
- Chi tiết và chỉnh sửa nhiều dòng của phiếu nhập/xuất.
