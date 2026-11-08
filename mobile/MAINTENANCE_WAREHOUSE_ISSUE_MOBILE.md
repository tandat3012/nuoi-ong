# Bàn giao mobile: kho xác nhận xuất thiết bị đi sửa (T05)

Ngày 06/11/2026. Căn cứ: `docs/CHOT_NGHIEP_VU.md` (baseline v1.1), NV04 §5.2 bước 2, `AC10`, `AC11`; ticket T05. Đã sửa API, DB và web trên nhánh `feature/t05-warehouse-confirms-repair-issue`. **Chưa sửa mã trong `mobile/`.** Khi tài liệu này khác với API thì làm theo API.

## Thay đổi phía API

- `POST /maintenance-records/:id/start` trước đây do nhân viên điều phối (`MAINTENANCE_STAFF`) gọi; giờ là **kho xác nhận xuất thiết bị đi sửa**:
  - Chỉ `ADMIN`, `FARM_OWNER`, `WAREHOUSE_MANAGER` thuộc kho của tài sản được gọi. Điều phối không kiêm vai trò kho nhận `403`.
  - Phải chọn đơn vị sửa (`supplierId`) và ngày hẹn trả (`expectedReturnAt`) trước, qua `PATCH /maintenance-records/:id`. Điều phối vẫn làm được bước này.
  - Mỗi hồ sơ chỉ xác nhận được một lần. Gọi lại nhận `409`.
- Mỗi hồ sơ bảo trì (`GET /maintenance-records` và `GET /maintenance-records/:id`) có thêm 2 trường:
  - `issuedByMemberId: string | null`: thành viên kho đã xác nhận xuất. Trường này `null` với hồ sơ chưa gửi và với hồ sơ gửi trước T05 (lúc đó điều phối tự bấm).
  - `issuedByName: string | null`: họ tên, hoặc email nếu chưa có họ tên.
- `startedAt` giữ nguyên tên trường. Từ T05, giá trị này là **thời điểm kho xác nhận xuất**.
- Luồng nhận lại không đổi: kho duyệt phiếu nhập lại thì tồn mới tăng, và vẫn là tài sản cũ (`AC11`).

## Mobile cần sửa

Mobile hiện chỉ **đọc** hồ sơ bảo trì, không gọi `/start`, nên không có chức năng nào bị hỏng. Chỉ cần sửa phần hiển thị để khớp nghiệp vụ mới:

1. **Kiểu dữ liệu:** thêm `issuedByMemberId: string | null` và `issuedByName: string | null` vào type `MaintenanceRecord` trong `src/features/assets/presentation/MaintenanceHistoryScreen.tsx:10`.
2. **Nhãn ngày:** ô `DateCell label="Bắt đầu"` (`MaintenanceHistoryScreen.tsx:110`) hiển thị như sau:
   - Hồ sơ có `issuedByMemberId`: hiện **"Kho xác nhận xuất"**, kèm `issuedByName`, ví dụ `06/11/2026 · Nguyễn Văn A`.
   - Hồ sơ có `startedAt` nhưng `issuedByMemberId = null` (hồ sơ cũ): hiện **"Gửi sửa"**. Không ghi "kho xác nhận" cho hồ sơ cũ.
3. **Gợi ý bước tiếp theo (nếu mobile có):** khi hồ sơ `SCHEDULED`, ghi "Chờ quản lý kho xác nhận xuất thiết bị đi sửa", không ghi "Chờ nhân viên bảo trì gửi thiết bị".
4. **Test:** nếu màn hình có test, bổ sung 3 trường hợp: hồ sơ có `issuedByName` hiện tên người xác nhận; hồ sơ cũ hiện "Gửi sửa"; hồ sơ chưa gửi không hiện ô này.

Không cần thêm nút xác nhận trên mobile. Nếu sau này muốn thêm, gọi `POST /maintenance-records/:id/start?farmId=…` với body rỗng, chỉ hiện nút cho vai trò kho, và chỉ khi hồ sơ `SCHEDULED` đã có `supplierId` và `expectedReturnAt`. Xử lý `403` (không phải kho phụ trách) và `409` (đã xác nhận rồi).

## Tiêu chí nghiệm thu phía mobile

- Hồ sơ do kho xác nhận trên web: mobile hiện "Kho xác nhận xuất", đúng ngày và đúng tên người xác nhận.
- Hồ sơ gửi trước T05: mobile hiện "Gửi sửa", không hiện tên.
- Các màn hình bảo trì khác giữ nguyên hành vi.

## Ticket không cần mobile sửa

- **T08** (mẫu thiết bị/dụng cụ): `GET /items` trả dữ liệu như cũ. Lọc một `itemType` vẫn chạy. Mobile không tạo mặt hàng.
- **T11** (ngừng sử dụng tài sản sửa hỏng): mobile không có thao tác ngừng sử dụng. Trạng thái `RETIRED` đã có sẵn và mobile đã xử lý.
- **T07** (giữ hàng khi xác nhận đơn): chỉ thêm test, API không đổi.
