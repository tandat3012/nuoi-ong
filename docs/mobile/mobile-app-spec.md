# Đặc Tả Chức Năng Mobile App - Nuôi Ong

## 1. Mục đích

Tài liệu này mô tả phạm vi và luồng chức năng của Mobile App cho hệ thống quản lý thiết bị, dụng cụ và vật tư nuôi ong mật.

Mobile App phục vụ chủ yếu cho nhân viên làm việc tại kho, trại ong hoặc hiện trường. Ứng dụng dùng chung RESTful API và dữ liệu với Website.

Tài liệu này chỉ là đặc tả để triển khai giao diện Mobile. Không tự ý thay đổi database schema hoặc API contract nếu chưa được thống nhất.

## 2. Căn cứ nghiệp vụ

Theo đề cương đề tài, Mobile App phải hỗ trợ:

- Quét QR để tra cứu thiết bị.
- Nhập và xuất vật tư tại hiện trường.
- Kiểm kê kho tại hiện trường.
- Đồng bộ dữ liệu với Website thông qua RESTful API.

Các chức năng liên quan có thể sử dụng thêm:

- Xem tồn kho.
- Xem thông tin tài sản.
- Theo dõi bảo trì.
- Xuất vật tư phục vụ bảo trì.
- Trả tài sản về kho.

## 3. Đối tượng sử dụng

### ADMIN

- Xem dữ liệu trong farm.
- Thực hiện các thao tác ghi theo quyền hệ thống.
- Duyệt hoặc xác nhận các chứng từ nếu nghiệp vụ yêu cầu.

### FARM_OWNER

- Quản lý dữ liệu farm.
- Xem, tạo và xác nhận nghiệp vụ kho.
- Quản lý tài sản và bảo trì.

### EMPLOYEE

- Xem dữ liệu farm được cấp quyền.
- Quét QR tra cứu tài sản.
- Nhập dữ liệu thực tế tại hiện trường.
- Lập phiếu nhập, phiếu xuất hoặc phiếu kiểm kê theo quyền được cấp.

### GUEST

- Không được truy cập chức năng QR.
- Không được thực hiện thao tác ghi.
- Khi cố truy cập QR, giao diện hiển thị: `Yêu cầu không hợp lệ`.

## 4. Xác thực và farm hiện tại

Mobile phải sử dụng Clerk JWT cho mọi API được bảo vệ.

Luồng khởi tạo:

```text
Mở ứng dụng
→ kiểm tra trạng thái đăng nhập
→ chưa đăng nhập: chuyển đến màn hình đăng nhập
→ đã đăng nhập: gọi /api/v1/auth/me
→ tải memberships và roles
→ nếu chỉ có một farm: tự chọn farm đó
→ nếu có nhiều farm: hiển thị Farm Selector
→ lưu currentFarmId
```

Ràng buộc:

- Không hard-code `farmId` trong giao diện.
- Không gọi API nghiệp vụ nếu chưa có `currentFarmId`.
- Khi đổi farm phải xóa dữ liệu tạm của farm cũ.
- Khi đổi farm phải tải lại dữ liệu theo farm mới.
- Nếu farm lưu trong local storage không còn thuộc membership, phải xóa lựa chọn cũ.
- Backend vẫn kiểm tra lại membership và role ở từng request.

## 5. Luồng quét QR

### 5.1. Quy tắc QR

- Mỗi asset có một `qrToken` UUID duy nhất.
- `qrToken` không thay đổi trong vòng đời asset.
- Không dùng `assetCode` làm token chính.
- Không đưa thông tin nhạy cảm vào QR.
- Không tái sử dụng token sau khi asset bị xóa.
- QR chỉ chứa URL:

```text
{WEB_APP_URL}/scan/{qrToken}
```

Ví dụ:

```text
http://localhost:3000/scan/a0056068-82c4-4157-a2bb-351107e194de
```

### 5.2. Luồng đầy đủ

```text
Người dùng mở chức năng Quét QR
→ kiểm tra đăng nhập
→ mở camera hoặc nhập qrToken thủ công
→ đọc qrToken từ ảnh QR
→ kiểm tra currentFarmId
→ chưa có currentFarmId: hiển thị yêu cầu chọn farm
→ user chọn farm
→ tự động tiếp tục bằng qrToken đã quét
→ gọi API tra cứu asset
→ hiển thị kết quả
```

Nếu user đã có `currentFarmId`, không yêu cầu quét lại hoặc chọn farm lần nữa.

### 5.3. API tra cứu QR

```http
GET /api/v1/assets/by-qr/{qrToken}?farmId={currentFarmId}
Authorization: Bearer {CLERK_JWT}
```

Response thành công:

```json
{
  "data": {
    "asset": {
      "id": "UUID",
      "assetCode": "AST-SMOKER-002",
      "qrToken": "UUID",
      "status": "AVAILABLE"
    },
    "itemCode": "TOOL-SMOKER-01",
    "itemName": "Bình tạo khói inox",
    "locationCode": "WH-MAIN",
    "locationName": "Kho trung tâm"
  }
}
```

### 5.4. Trạng thái giao diện QR

Giao diện phải có các trạng thái:

- Chưa cấp quyền camera.
- Đang khởi động camera.
- Đang quét.
- Nhập `qrToken` thủ công.
- Đang tải dữ liệu asset.
- Tra cứu thành công.
- QR không hợp lệ.
- Chưa chọn farm.
- Không có quyền.
- Asset không tồn tại.
- Lỗi mạng và nút thử lại.

Thông báo chuẩn:

| Tình huống | Thông báo Mobile |
|---|---|
| Chưa chọn farm | `Vui lòng chọn trang trại trước khi quét QR` |
| GUEST hoặc không đủ quyền | `Yêu cầu không hợp lệ` |
| Asset không tồn tại hoặc RETIRED | `Asset không còn tồn tại` |
| Lỗi mạng | `Không thể kết nối máy chủ. Vui lòng thử lại.` |

### 5.5. API sinh ảnh QR

Nếu Mobile hoặc Website cần hiển thị QR của asset:

```http
GET /api/v1/assets/{assetId}/qr?farmId={currentFarmId}
Authorization: Bearer {CLERK_JWT}
```

Ảnh QR được sinh động từ `qrToken`, không lưu file ảnh trong database.

## 6. Màn hình Mobile cần có

### 6.1. Home

Hiển thị:

- Tên farm hiện tại.
- Farm Selector.
- Người dùng và role.
- Nút `Quét QR`.
- Nút `Tồn kho`.
- Nút `Kiểm kê`.
- Nút `Phiếu nhập`.
- Nút `Phiếu xuất`.
- Nút `Bảo trì` nếu role được phép.

### 6.2. Farm Selector

Hiển thị khi user có nhiều farm:

- Tên farm.
- Mã farm.
- Farm đang chọn.
- Trạng thái loading khi đổi farm.
- Sau khi đổi farm, tải lại dữ liệu màn hình hiện tại.

### 6.3. Asset Detail

Sau khi quét thành công, hiển thị:

- Mã asset.
- Loại item.
- Tên item.
- Trạng thái asset.
- Kho/vị trí hiện tại.
- Serial number nếu có.
- Thông tin bảo trì gần nhất nếu có.
- Lịch sử sử dụng nếu API hỗ trợ.

Các action ghi phải kiểm tra role trước khi hiển thị.

### 6.4. Inventory

Cho phép:

- Chọn warehouse.
- Tìm item.
- Lọc theo tracking mode `QUANTITY`, `LOT`, `ASSET`.
- Xem số lượng tồn.
- Xem LOT và hạn sử dụng.
- Xem trạng thái loading, empty, error.

API:

```http
GET /api/v1/inventory?farmId={farmId}&warehouseId={warehouseId}
GET /api/v1/lots?farmId={farmId}&itemId={itemId}
```

### 6.5. Phiếu nhập kho

Luồng:

```text
Chọn kho
→ chọn item
→ nhập số lượng
→ nhập metadata LOT/ASSET nếu cần
→ tạo phiếu DRAFT
→ chờ người có quyền xác nhận
→ CONFIRMED
→ tồn kho tăng
```

API:

```http
POST /api/v1/stock-receipts?farmId={farmId}
POST /api/v1/stock-receipts/{id}/confirm?farmId={farmId}
```

Quy tắc:

- Tạo DRAFT chưa làm tăng tồn kho.
- Chỉ khi CONFIRMED mới tạo transaction và cập nhật balance.
- Item LOT phải có metadata LOT hợp lệ.
- Item ASSET phải có `assetCode` và quantity bằng `1`.

### 6.6. Phiếu xuất kho

Luồng:

```text
Chọn kho
→ chọn item/LOT/ASSET
→ nhập số lượng
→ tạo phiếu DRAFT
→ kiểm tra tồn kho
→ người có quyền xác nhận
→ CONFIRMED
→ tồn kho giảm
```

API:

```http
POST /api/v1/stock-issues?farmId={farmId}
POST /api/v1/stock-issues/{id}/confirm?farmId={farmId}
```

Quy tắc:

- Không được xuất vượt tồn.
- Không được làm tồn kho âm.
- Phiếu bảo trì phải có `maintenanceRecordId`.
- DRAFT chưa làm giảm tồn.
- Chỉ CONFIRMED mới tạo transaction ISSUE hoặc MAINTENANCE_ISSUE.

### 6.7. Kiểm kê kho

Luồng:

```text
Chọn kho
→ tải tồn hệ thống
→ nhân viên nhập số thực tế
→ tính chênh lệch
→ lưu/cập nhật phiếu kiểm kê
→ quản lý hoặc người có quyền xác nhận
→ điều chỉnh tồn
```

API:

```http
POST /api/v1/stock-counts?farmId={farmId}
PATCH /api/v1/stock-counts/{id}?farmId={farmId}
POST /api/v1/stock-counts/{id}/confirm?farmId={farmId}
```

Quy tắc:

- `actualQuantity` phải đúng định dạng và không âm.
- Không sửa phiếu đã `CONFIRMED` hoặc `CANCELLED`.
- Nếu tồn hệ thống thay đổi sau snapshot, xác nhận phải báo conflict `409`.
- Xác nhận lại phiếu đã xác nhận không được tạo transaction trùng.

## 7. Đồng bộ Website và Mobile

Mobile và Website dùng chung backend:

```text
Mobile tạo hoặc cập nhật dữ liệu
→ API lưu database
→ Website tải lại và thấy dữ liệu mới
```

```text
Website xác nhận phiếu
→ backend cập nhật balance/transaction
→ Mobile tải lại và thấy trạng thái mới
```

Không lưu dữ liệu nghiệp vụ độc lập chỉ trên Mobile.

Sau mỗi thao tác ghi cần tải lại:

- Trạng thái phiếu.
- Số lượng tồn.
- Transaction liên quan.
- Thông báo thành công hoặc lỗi.

## 8. Quy tắc lỗi chung

| HTTP | Ý nghĩa | Cách xử lý Mobile |
|---:|---|---|
| 400 | Dữ liệu đầu vào sai | Hiển thị lỗi tại field hoặc form |
| 401 | Chưa đăng nhập/JWT lỗi | Chuyển đến đăng nhập |
| 403 | Không có quyền hoặc sai farm | Hiển thị không có quyền |
| 404 | Không tìm thấy asset/kho/phiếu | Hiển thị dữ liệu không tồn tại |
| 409 | Vi phạm nghiệp vụ hoặc trạng thái | Hiển thị nguyên nhân và giữ dữ liệu nhập |
| 500 | Lỗi máy chủ | Hiển thị thử lại, không mất form nếu có thể |

## 9. Tiêu chí hoàn thành giao diện Mobile

- Có route hoặc app entry có thể render ở viewport mobile.
- Đăng nhập và farm context được mô phỏng đúng theo contract hiện tại.
- Không hard-code UUID farm hoặc asset trong flow chính.
- Có Farm Selector khi nhiều farm.
- Có flow quét QR và nhập token thủ công để test.
- Có màn hình asset detail sau khi tra cứu.
- Có màn hình tồn kho.
- Có form phiếu nhập, phiếu xuất và kiểm kê.
- Có đầy đủ loading, empty, error, forbidden và success state.
- Phân biệt rõ quyền đọc và quyền ghi.
- Dữ liệu form gửi đúng `farmId` hiện tại.
- Đổi farm không hiển thị dữ liệu của farm cũ.
- Không thay đổi database schema nếu không có yêu cầu riêng.
- Có thể kiểm thử trên trình duyệt ở kích thước màn hình mobile.

## 10. Phạm vi chưa bắt buộc trong prototype đầu tiên

- Chưa cần thiết kế UI hoàn chỉnh cho production.
- Chưa cần lưu ảnh QR lên Cloudinary.
- Chưa cần offline sync phức tạp.
- Chưa cần RFID thật.
- Chưa cần push notification.
- Chưa cần dashboard báo cáo đầy đủ.
- Chưa cần thay đổi REST API hiện có.
