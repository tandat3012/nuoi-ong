# Bàn giao mobile: bảo trì bên ngoài và nhập lại kho

## Phạm vi

API và web triển khai trên nhánh `feature/maintenance-return-workflow`. Không sửa mã trong `mobile/` theo yêu cầu. Nhà bảo trì bên ngoài chưa có tài khoản. Role mới `MAINTENANCE_STAFF` là nhân viên nội bộ, chủ trại/admin cấp role qua màn hình nhân sự.

## Quyền và trạng thái

- `MAINTENANCE_STAFF`, `WAREHOUSE_MANAGER` và các quyền quản trị hiện có: lập/sửa/hủy lịch khi còn `SCHEDULED`.
- Chỉ `MAINTENANCE_STAFF`: gửi ra ngoài, nhận lại thực tế, nghiệm thu, lập/gửi lại phiếu nhập.
- `WAREHOUSE_MANAGER` và quyền quản trị hiện có: duyệt/từ chối phiếu nhập lại. Nhân viên bảo trì không tự duyệt nếu không có thêm quyền quản lý kho.
- `SCHEDULED` → `IN_PROGRESS` (đã gửi ra ngoài) → `RECEIVED` (đã nhận, chờ nghiệm thu) → `COMPLETED` (đạt) hoặc `FAILED` (bảo trì không thành công).
- Chỉ hủy hồ sơ `SCHEDULED`. Không có thao tác hủy để đưa thiết bị đang ở bên ngoài trở lại sử dụng.
- Kết quả nghiệm thu và trạng thái phiếu nhập là hai thông tin riêng: `returnStatus`: null (chưa lập), `PENDING_APPROVAL`, `REJECTED`, `CONFIRMED`.
- Một hồ sơ có một phiếu nhập lại. Bị từ chối thì sửa kho/vị trí và gửi lại; lịch sử quyết định vẫn nằm trong audit.
- Thiết bị tiếp tục `MAINTENANCE` sau khi nhận và nghiệm thu. Chỉ sau duyệt nhập: đạt → `AVAILABLE`; không đạt → giữ `MAINTENANCE`, gắn nhãn “Bảo trì không thành công”, chặn sử dụng/cấp phát. Cả hai trường hợp đều tăng tồn vật lý đúng một lần.
- Sau khi nhập lại thiết bị không đạt, có thể lập lần bảo trì mới; không sửa đè kết quả lần cũ.

## API

Mọi request dưới đây dùng Clerk token, query `farmId=<uuid>`. Response thao tác `{ data: record }`; lỗi validation 400, không có quyền 403, không tìm thấy 404, sai trạng thái 409. Không dùng POST `/stock-receipts` để nhận lại thiết bị bảo trì vì API đó tạo tài sản mới.

| Method / path                                          | Body                                                                                                                              | Điều kiện                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| GET `/maintenance-records`                             | Query `assetId?`, `recordId?`, `status?`, `dateFrom?`, `dateTo?` (YYYY-MM-DD), `page`, `pageSize`                                 | Danh sách phân trang trong farm; lọc theo ngày lịch (giờ VN, gồm cả hai đầu)     |
| GET `/maintenance-records/:id`                         | —                                                                                                                                 | Chi tiết                                                                        |
| POST `/maintenance-records`                            | `{assetId, maintenanceType, scheduledAt, description?, supplierId?, expectedReturnAt?}`                                           | `maintenanceType`: PREVENTIVE/CORRECTIVE/INSPECTION                             |
| PATCH `/maintenance-records/:id`                       | Các trường lịch hiện có; thêm `supplierId`, `expectedReturnAt`                                                                    | Chỉ SCHEDULED                                                                   |
| POST `/maintenance-records/:id/start`                  | `{}`                                                                                                                              | Chọn supplierId và expectedReturnAt tương lai trước khi gửi                     |
| POST `/maintenance-records/:id/receive`                | `{receivedAt: "2026-11-10T03:00:00.000Z"}`                                                                                        | IN_PROGRESS; ngày thực tế không trước ngày gửi, không ở tương lai               |
| POST `/maintenance-records/:id/complete`               | `{outcome:"PASSED", resultNote:"Đã kiểm tra đạt", intervalMonths:3, laborCost?:"500000", materialCost?:"100000", otherCost?:"0"}` | RECEIVED; kết quả bắt buộc; intervalMonths nguyên 1–120 khi đạt                 |
| POST `/maintenance-records/:id/complete`               | `{outcome:"FAILED", resultNote:"Thiết bị vẫn không hoạt động"}`                                                                   | RECEIVED; lý do bắt buộc; không đặt lại kỳ tiếp theo                            |
| POST `/maintenance-records/:id/return-receipt`         | `{warehouseId, locationId}`                                                                                                       | Đã nghiệm thu; chưa lập hoặc REJECTED; vị trí ACTIVE thuộc đúng kho ACTIVE/farm |
| POST `/maintenance-records/:id/return-receipt/approve` | `{}`                                                                                                                              | PENDING_APPROVAL; duyệt lại trả 409, không cộng trùng tồn                       |
| POST `/maintenance-records/:id/return-receipt/reject`  | `{reason:"Sai vị trí nhập kho"}`                                                                                                  | PENDING_APPROVAL; lý do ít nhất 3 ký tự sau trim                                |
| POST `/maintenance-records/:id/cancel`                 | `{}`                                                                                                                              | Chỉ SCHEDULED                                                                   |

Trường mới cần đọc: `expectedReturnAt`, `receivedAt`, `receivedByMemberId`, `inspectedByMemberId`, `intervalMonths`, `nextDueDate`, `returnStatus`, `returnWarehouseId`, `returnLocationId`, `returnWarehouseName`, `returnLocationName`, `returnCreatedByMemberId`, `returnReviewedByMemberId`, `returnReviewedAt`, `returnRejectionReason`, `returnCode`, `alert`. Các ID người thực hiện do server xác định từ phiên đăng nhập, client không gửi chúng.

`returnCode` là mã phiếu `BT-<record UUID>`; phiếu nhập bảo trì nằm trong hồ sơ bảo trì, không nằm ở danh sách phiếu mua/nhập mới thông thường.

## Tồn kho theo một tài sản

GET `/inventory?farmId=…&assetId=<uuid>` trả các dòng tồn của đúng mặt hàng và kho đang chứa tài sản đó, `quantityOnHand` luôn là `"1.000"` (không phải tổng tồn của mặt hàng), kèm `selectedAsset: {id, assetCode, serialNumber, status, locationName}`. Tài sản không thuộc farm trả 404; `assetId` sai định dạng trả 400. Tài sản `MAINTENANCE` chỉ hiện khi đã nhập lại sau lần bảo trì không đạt (FAILED + CONFIRMED). Mobile có thể dùng cho nút “Xem tồn kho” ở chi tiết tài sản.

## Ngày kỳ tiếp theo

Chỉ khi nghiệm thu PASSED, API ghi `assets.lastMaintenanceDate` bằng ngày nhận thực tế tại Asia/Ho_Chi_Minh và `assets.nextMaintenanceDate`/record.nextDueDate bằng ngày đó cộng intervalMonths. Tháng thiếu ngày cuối thì chặn về ngày cuối tháng (31/01 + 1 tháng → 28/02 hoặc 29/02). Ngày nghiệm thu/duyệt phiếu không thay đổi mốc nhận lại. UI không tự ghi đè ngày này.

## Thông báo

API kiểm tra mỗi 5 phút và khi khởi động, dùng giờ Việt Nam. Mỗi mốc lịch gửi một lần cho từng người có quyền đang hoạt động: MAINTENANCE_STAFF, WAREHOUSE_MANAGER, FARM_OWNER, ADMIN. Nhắc trước trong cửa sổ 7 ngày, đúng ngày, lần đầu quá hạn; trễ hẹn trả khi chưa nhận lại. Sau khi gửi, không tiếp tục nhắc chưa đưa đi. Sau khi nhận, không tiếp tục nhắc trễ trả. Lịch thay đổi có mốc nhắc mới. Không có lịch chủ động thì API theo dõi assets.nextMaintenanceDate để không bỏ quên kỳ tiếp theo.

Entity/type cần bổ sung vào thông báo và bộ kiểm tra payload push:

- `MAINTENANCE_RECORD`: `_UPCOMING`, `_DUE`, `_OVERDUE`, `_RETURN_OVERDUE`; entityId là maintenance record ID.
- `MAINTENANCE_ASSET`: `_UPCOMING`, `_DUE`, `_OVERDUE`; entityId là asset ID (kỳ tiếp theo chưa lập hồ sơ).
- `MAINTENANCE_RETURN`: `_PENDING_APPROVAL`, `_CONFIRMED`, `_REJECTED`; entityId là maintenance record ID.

Dùng route nội bộ cố định từ entityType/entityId, không dùng URL tùy ý trong payload. Khi chạm push phải kiểm tra tài khoản nhận, farm còn quyền và tải lại trạng thái hiện tại. Thông báo trong app có cùng entity/type. Push dùng outbox/worker Expo hiện có, cần bật cấu hình push của môi trường và thiết bị đăng ký token; chưa nghiệm thu gửi push trên thiết bị thật.

Các file mobile cần người phụ trách cập nhật: `src/features/inventory/presentation/InventoryActionScreen.tsx` (quyền lập lịch và trường supplier/ngày trả), `src/features/assets/presentation/MaintenanceHistoryScreen.tsx` (trạng thái, hành động nhận/nghiệm thu/nhập lại và đếm ngược), màn hình chi tiết tài sản (nhãn không thành công), `src/features/notifications/api.ts` và `push-response.ts` (entity/type và route).

## Breaking changes và dữ liệu cũ

POST complete không còn chấp nhận hoàn tất trực tiếp từ IN_PROGRESS: phải receive trước; outcome/resultNote bắt buộc, intervalMonths bắt buộc khi đạt. PATCH chỉ sửa khi SCHEDULED. Cancel sau khi gửi bị chặn. Không giữ nút “hoàn tất” hoặc “dừng bảo trì” theo luồng cũ.

Hồ sơ COMPLETED cũ không có receivedAt vẫn là lịch sử cũ, không tự phát sinh phiếu nhập. Tài sản cũ IN_USE dùng luồng trả kho hiện có khi nhận về thực tế; không tự backfill ngày nhận hoặc tăng tồn. Với IN_PROGRESS cũ, nhân viên bảo trì có thể nhận và nghiệm thu theo luồng mới.

## Kiểm thử nghiệm thu mobile

1. Nhân viên bảo trì và quản lý kho lập được lịch; nhân viên thường/store-only không thực hiện được nghiệp vụ mới.
2. Quản lý kho không gửi/nhận/nghiệm thu khi không có MAINTENANCE_STAFF; nhân viên bảo trì không tự duyệt nhập.
3. Đạt: nhận → nghiệm thu → gửi phiếu → quản lý duyệt, mã tài sản giữ nguyên, tồn tăng một lần.
4. Không đạt: bắt buộc lý do, không đổi kỳ cũ, nhập lại vẫn không cấp phát được; có thể tạo lần sửa mới sau nhập.
5. Từ chối → sửa kho/vị trí → gửi lại → duyệt; không tăng tồn trước duyệt hoặc khi bị từ chối.
6. Kiểm tra đổi farm, hết phiên, thao tác trùng, reload sau 409; không giữ form cũ để thao tác trên farm khác.
7. Thông báo đến đúng farm/người nhận, mở đúng hồ sơ; không hiển thị hành động dựa riêng vào payload cũ.

## Triển khai API/web

Chạy migration 0032 và 0033 bằng quy trình hiện có trước khi khởi động API mới; role mới không tự gán cho ai. Chỉ migrate DB ứng dụng khi người triển khai chủ động thực hiện. Nhánh phát triển này chỉ xác minh migration trên DB test riêng. Tài liệu này là hợp đồng bàn giao, không đánh dấu mobile đã hoàn thành.

Kiểm thử tích hợp có thể chạy lại: đặt `DATABASE_URL` trỏ tới PostgreSQL local đã migrate, tên DB kết thúc `_test`, rồi chạy `cd api` và `pnpm test:maintenance`. Bộ test tạo fixture riêng và dọn dữ liệu fixture sau khi chạy. Không trỏ vào DB ứng dụng.

## Nhập chi phí theo báo giá khi nhận lại

Form lập lịch chỉ nhập loại, lịch dự kiến và mô tả; không hỏi chi phí. Khi nhận lại thiết bị và nghiệm thu, nhân viên bảo trì tự nhập tiền công sửa chữa, tiền linh kiện/vật tư và chi phí khác theo báo giá/chứng từ nhà bảo trì gửi về. Áp dụng cả nghiệm thu đạt và không đạt. Hệ thống chỉ cộng các khoản đã nhập thành tổng, không ước tính giá, không lấy giá tự động từ nhà cung cấp và không tự xuất vật tư khỏi kho. API complete đã hỗ trợ ba khoản này; mobile cần đặt các trường ở bước nghiệm thu.
