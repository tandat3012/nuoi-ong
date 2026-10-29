# Nuôi Ong Mobile

App Expo (Expo 57, React Native 0.86, expo-router, Clerk) cho nhân viên và quản lý trang trại: quét QR, tồn kho, phiếu nhập/xuất/kiểm/chuyển, bảo trì, thông báo đẩy.

Tài liệu này dành cho người đã làm app trên nhánh `feature/warehouse-module-mobile`. App đã được tích hợp vào `dev` ngày 2026-10-29. Ở đây ghi lại những gì đã đổi, quy tắc API đang chốt, và các bước cần làm để chạy lại.

## 1. Cách app được tích hợp

Nhánh `feature/warehouse-module-mobile` không được merge thẳng vào `dev`, vì nhánh đó chậm hơn `dev` 38 commit và xung đột khoảng 40 file. Thay vào đó, từng phần được chuyển dần sang `dev`, mỗi phần một PR (#74 → #91, rồi PR của thư mục `mobile/`):

| Bước | Nội dung |
|---|---|
| 1 | Schema và migration (bảng push token, outbox, yêu cầu bảo trì) |
| 2 | Backend thông báo và thiết bị nhận push |
| 3 | Clerk guard nhận token từ app native |
| 4 | Duyệt phiếu kho: gửi duyệt (submit) và từ chối (reject) |
| 5 | Nhật ký thay đổi (`audit-logs`) |
| 6 | Các API nhỏ: lô có sẵn khi nhập, QR, yêu cầu bảo trì, yêu cầu chuyển tài sản |
| 7 | Phần web tương ứng |
| 8 | Thư mục `mobile/` (tài liệu này) |

**Đừng tiếp tục làm trên nhánh cũ, và đừng merge nhánh cũ vào `dev`.** Hãy tạo nhánh mới từ `dev`.

## 2. Những gì đã sửa trong `mobile/`

App được chép nguyên từ commit `3f2a20a` của nhánh mobile. Chỉ những chỗ mà API trên `dev` từ chối mới bị sửa; giao diện và chữ hiển thị giữ nguyên.

### Cấu hình

| File | Thay đổi | Lý do |
|---|---|---|
| `pnpm-workspace.yaml` | Thêm `nodeLinker: hoisted` | Expo cần `node_modules` dạng phẳng. Nếu không có, jest báo không tìm thấy `@babel/runtime` |
| `.gitignore` | Thêm `google-services.json` | File cấu hình Firebase không đưa vào repo; mỗi máy tự đặt file này |
| `.env.example` | Để trống `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Giống `web/.env.example`; mỗi người tự điền khóa vào `.env` |
| Các file `.gitkeep` | Xóa | Thư mục rỗng, không dùng |

### Code

| Chỗ | Trước | Sau | Lý do |
|---|---|---|---|
| `AssetDetailScreen` | Tra tài sản bằng `GET /assets/by-qr/{token}` | `GET /assets/by-code/{assetCode}` | Tem QR in từ web chứa link `/scan/{assetCode}`, còn `by-qr` chỉ nhận UUID |
| `StockCountScreen` | Đưa cả mặt hàng loại ASSET vào phiếu kiểm | Lọc bỏ ASSET (cả trong danh sách tồn lẫn bộ chọn mặt hàng) | `dev` từ chối phiếu kiểm có dòng ASSET |
| `InventoryActionScreen` (phiếu chuyển) | Có lựa chọn "Tài sản", gửi `assetId` vào `/stock-transfers` | Bỏ lựa chọn "Tài sản" | `dev` cấm chuyển tài sản bằng phiếu chuyển kho |
| `AssetDetailScreen`, `InventoryDetailScreen`, `ItemQrResultScreen`, `InventoryQrResultScreen` | Có nút "Điều chuyển" cho tài sản | Ẩn nút này khi mặt hàng là ASSET | Cùng lý do như dòng trên |

**Còn thiếu:** app chưa có màn tạo yêu cầu chuyển tài sản (`asset-transfer-requests`). Hiện việc này làm trên web. Chỗ cần làm được đánh dấu `shortcut:` trong `AssetDetailScreen.tsx`.

**Không đổi:** chữ "qrToken" trên màn quét vẫn giữ nguyên. Khi nhập tay, người dùng gõ **mã tài sản** vào ô đó.

## 3. Quy tắc API đang chốt trên `dev`

Mọi route nằm dưới `/api/v1`. API theo trang trại nhận `farmId` qua query.

### Vai trò

| Vai trò | Được làm |
|---|---|
| `ADMIN`, `FARM_OWNER` | Người duyệt: tạo phiếu, xác nhận thẳng phiếu nháp (DRAFT), xác nhận hoặc từ chối phiếu đang chờ duyệt, duyệt các yêu cầu |
| `EMPLOYEE` | Tạo phiếu nháp, rồi sửa, hủy và gửi duyệt **chỉ phiếu của mình**; không tự xác nhận được |
| `GUEST` | Chỉ xem; không tạo phiếu |

### Phiếu kho (nhập, xuất, kiểm, chuyển)

```
DRAFT ──submit──▶ PENDING_APPROVAL ──confirm──▶ CONFIRMED
  │                    │
  │                    └──reject (có lý do)──▶ REJECTED (kết thúc, không mở lại)
  └──confirm (chỉ ADMIN/FARM_OWNER)──▶ CONFIRMED
```

- Endpoint: `POST /stock-{receipts|issues|counts|transfers}/:id/{submit|confirm|reject|cancel}`. `reject` cần `rejectionReason`.
- Người tạo **không rút lại được** phiếu đã gửi duyệt (`PENDING_APPROVAL`).
- Tồn kho chỉ thay đổi khi phiếu được xác nhận.
- **Phiếu kiểm:** không nhận mặt hàng ASSET. Dòng của mặt hàng LOT phải có `lotId` thuộc đúng mặt hàng đó.
- **Phiếu chuyển:** không nhận ASSET. Tài sản đi theo quy trình riêng của tài sản (mục bên dưới).
- **Phiếu xuất:**
  - Loại `SALE` chỉ được tạo qua đơn hàng của cửa hàng; tạo trực tiếp sẽ bị 400.
  - Tài sản không được xuất với loại `DAMAGE` hoặc `MAINTENANCE`.
  - Nếu không gửi `issueType`, API mặc định là `CONSUMPTION`.
- **Phiếu nhập:** dòng của mặt hàng LOT có thể chọn lô có sẵn bằng `lotId` (lấy danh sách qua `GET /lots`) thay vì tạo lô mới.

### Tài sản

- Tra theo mã: `GET /assets/by-code/:assetCode`. Endpoint `by-qr` vẫn còn nhưng không được dùng nữa.
- Vòng đời tài sản: `POST /assets/:id/{assign|start-use|return|transfer|incidents|recover|retire}`.
- **Yêu cầu chuyển tài sản** (`/asset-transfer-requests`):
  - `POST /asset-transfer-requests`: chỉ EMPLOYEE được gửi. Body gồm `assetId`, `warehouseId`, `locationId` và `note` (tùy chọn).
  - Tài sản phải đang `AVAILABLE`. Khi gửi, tài sản chuyển sang trạng thái **`TRANSFER_PENDING`** ("Chờ chuyển") và mọi thao tác khác trên tài sản bị khóa.
  - Mỗi tài sản chỉ có một yêu cầu chờ duyệt. Nhân viên chưa rút lại được yêu cầu.
  - `POST /asset-transfer-requests/:id/approve` thực hiện việc chuyển ngay trong cùng giao dịch; `POST .../reject` cần `rejectionReason`.
  - Nếu kho hoặc vị trí đích không còn hợp lệ, `approve` trả 409 và yêu cầu vẫn ở trạng thái chờ duyệt.

### Yêu cầu bảo trì

- `POST /maintenance-requests`: chỉ EMPLOYEE được tạo.
- Người duyệt thấy mọi yêu cầu; người khác chỉ thấy yêu cầu của mình.
- `POST /maintenance-requests/:id/approve` (gửi kèm `scheduledAt`) tạo lịch bảo trì trong cùng giao dịch. `reject` cần lý do.

### QR

Mọi mã QR chứa một **đường link web**, nên quét bằng camera thường cũng mở được trang web:

| Loại | Link | API lấy QR |
|---|---|---|
| Tài sản | `{WEB_APP_URL}/scan/{assetCode}` | `GET /assets/:id/label` |
| Mặt hàng | `{WEB_APP_URL}/scan/item/{itemId}` | `GET /items/:id/qr` |
| Tồn kho | `{WEB_APP_URL}/scan/inventory/{balanceId}` | `GET /inventory/:balanceId/qr` |

App đọc phần đường dẫn của link: màn quét đã xử lý được cả ba dạng. `WEB_APP_URL` được cấu hình ở phía API.

### Thông báo

- Danh sách và đánh dấu đã đọc:
  - `GET /notifications`
  - `PATCH /notifications/:id/read`
  - `PATCH /notifications/read-all`
- Thiết bị nhận push: `PUT/GET/DELETE /notifications/devices/:installationId`.
- Người nhận thông báo duyệt là `ADMIN` và `FARM_OWNER`.
- **Worker gửi push mặc định tắt.** Muốn thử push, đặt trong `api/.env`:
  - `PUSH_WORKER_ENABLED=true`
  - `EXPO_ACCESS_TOKEN` nếu có bật bảo mật push trên EAS
  - `PUSH_RECEIPT_DELAY_MS=60000` để kiểm receipt nhanh khi thử local

### Nhật ký thay đổi

- `GET /audit-logs` và `GET /audit-logs/:id`.
- Người duyệt thấy tất cả; EMPLOYEE chỉ thấy nhật ký phiếu của mình; GUEST bị 403.
- Trường `references` ánh xạ id sang mã hoặc tên, để hiển thị không phải in UUID.

### Đăng nhập (Clerk)

API nhận token Clerk của app native qua header `Authorization: Bearer`. Riêng token **không có `azp`** thì được bỏ qua bước kiểm `authorizedParties`; trên web vẫn kiểm như cũ.

**Việc cần xác nhận:** token Expo thật có đúng là không có `azp` không. Nếu bị 401 khi gọi API, hãy kiểm tra điểm này trước.

## 4. Những gì trên nhánh cũ đã không được chuyển sang

- **Chuyển tài sản bằng phiếu chuyển kho:** cách này bỏ qua bảng `inventory_balances`, nên được thay bằng yêu cầu chuyển tài sản.
- **Phần thân xác nhận phiếu (confirm) của nhánh mobile:** `dev` giữ bản của mình, vì bản đó có thêm các luật mới hơn. Chỉ phần submit, reject và các bước chặn theo trạng thái được chuyển sang.
- **Lớp bọc audit của nhánh mobile:** lớp này khóa phiếu xuất trước đơn hàng nên có nguy cơ deadlock. `dev` ghi nhật ký ngay trong từng service.
- **Để làm sau:** biểu đồ tồn kho trên dashboard, lọc vật tư theo danh mục hoặc theo kho, thời gian giữ và dọn bảng thông báo.

## 5. Chạy lại sau khi pull `dev`

### Cơ sở dữ liệu (đọc kỹ trước khi migrate)

Migration đã được **đánh số lại**:

| Nhánh mobile cũ | `dev` |
|---|---|
| `0012_notifications_table` | (bảng `notifications` đã có sẵn trên `dev`) |
| `0013_device_push_tokens_and_push_outbox` | `0020_device-push-tokens-and-push-outbox` |
| `0014_maintenance_requests_approval` | `0021_maintenance-requests-approval` |
| — | `0022_asset-transfer-requests` (mới) |

Nếu DB local của bạn đã chạy migration của nhánh cũ, `make db-migrate` nhiều khả năng sẽ lỗi vì bảng đã tồn tại. Cách gọn nhất là tạo lại DB:

```bash
# ở root repo; nếu cần giữ dữ liệu cũ, sao lưu trước (pg_dump)
make db-reset        # xóa và tạo lại DB nuoi_ong (gõ nuoi_ong để xác nhận)
make db-migrate
make db-seed
```

### API

```bash
cp api/.env.example api/.env   # nếu chưa có; điền khóa Clerk và DATABASE_URL
make db-up                     # PostgreSQL ở cổng 5435
make be                        # API ở http://localhost:5050/api/v1
```

### App

```bash
cd mobile
rm -rf node_modules            # bắt buộc: cách cài node_modules đã đổi sang hoisted
pnpm install
cp .env.example .env           # điền EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
# đặt google-services.json vào mobile/ (không có trong repo)
pnpm start
```

`EXPO_PUBLIC_API_BASE_URL` chỉ dùng khi chạy qua tunnel. Trong mạng LAN, app tự lấy địa chỉ máy từ Metro.

### Kiểm tra

```bash
cd mobile
pnpm typecheck
pnpm test
```

### Nên thử lại trên điện thoại

1. Đăng nhập, rồi gọi một API bất kỳ (xác nhận token không có `azp`).
2. Quét tem tài sản in từ web (nút "In nhãn QR"), tem mặt hàng và tem tồn kho.
3. Tạo phiếu kiểm ở kho có tài sản: phiếu không được có dòng tài sản.
4. Tài khoản EMPLOYEE: tạo phiếu, gửi duyệt, rồi kiểm tra ADMIN có nhận thông báo.
5. Tạo phiếu chuyển kho: không còn lựa chọn "Tài sản".
