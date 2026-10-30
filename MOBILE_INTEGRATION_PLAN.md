# Kế hoạch tích hợp nhánh mobile vào `dev`

Cập nhật: 29/10/2026. `dev` hiện ở `3960bd2` (#91).

Chưa thử tay 7e: quét bằng camera trong web, mở URL nhãn từ camera điện thoại khi chưa đăng nhập, xem trước khi in.

Nhánh gốc: `feature/warehouse-module-mobile`, gồm một commit squash `3f2a20a`. Nhánh này tạo từ `84c10b5`, nay đã chậm hơn `dev` 38 commit và xung đột khoảng 40 file. Vì vậy nhánh **không được gộp thẳng**. Từng phần được viết lại trên `dev`, mỗi bước một PR, bước trước gộp xong mới làm bước sau.

## Quy tắc làm việc

- Mỗi phần được thảo luận và thống nhất trước khi làm. Làm xong thì gộp hẳn ("chốt"), rồi mới sang phần tiếp theo.
- Tạo nhánh `feature/*` từ `dev`, mở PR vào `dev` và gộp bằng merge commit. Gộp xong thì xóa nhánh. Không dùng tiền tố `fix/*`, vì trên remote đang có một nhánh tên `fix` làm push bị lỗi.
- Hỏi trước khi push hoặc tạo PR.
- Không commit tài liệu cá nhân và file test local: các file `.md`, `data_KhaoSat.xlsx`, `nuoi-ong-catalog-*`, `supabase-enable-app-rls.sql`, các file `*.test.mjs` hoặc `*.spec.ts` chưa được track. Với file đã track mà có chỉnh sửa local, chỉ commit phần sửa của mình.
- Sao lưu DB trước mỗi lần migrate vào `.local-backups/`. Thư mục này đã được git bỏ qua.
- Mỗi PR phải có test cho: phân quyền, chuyển trạng thái, xử lý khi API từ chối, và tải lại dữ liệu sau thao tác. Mỗi test quan trọng được thử lỗi giả (bỏ phần sửa đi) để chắc test bắt được lỗi.

## Đã xong

| Bước | PR | Nội dung |
|---|---|---|
| 1 | #74 | Migration 0020–0021: device token, push outbox, bảng `maintenance_requests` |
| 2 | #75 | Thông báo (`notifications`) và hàng đợi push. Worker push tắt, trừ khi đặt `PUSH_WORKER_ENABLED=true` |
| 3 | #76 | Clerk guard nhận token Bearer của app native khi token không có `azp` |
| 4 | #77, #78 | Sửa khóa dòng; gửi duyệt và từ chối 4 loại phiếu kho theo mô hình lai |
| 5 | #79 | Ghi audit cho phiếu kho, thêm `GET /audit-logs` (lọc theo quyền) |
| 6a | #80 | Phiếu nhập chọn lô có sẵn (`lotId`), kiểm tra hạn dùng không trước ngày sản xuất, chi tiết dòng có thêm thông tin |
| 6b | #81 | `maintenance-requests`: nhân viên báo cần sửa, admin duyệt (tạo lịch bảo trì) hoặc từ chối |
| 6c | #82 | Mọi QR đều là URL web: `/scan/{assetCode}`, `/scan/item/{id}`, `/scan/inventory/{balanceId}` |
| 6d | #83 | `asset-transfer-requests` và trạng thái `TRANSFER_PENDING`. Yêu cầu bảo trì và yêu cầu chuyển được xử lý nối tiếp trên dòng tài sản (migration 0022) |
| 7a | #84, #85 | Web: gửi duyệt, xác nhận, từ chối phiếu kho theo vai trò; nhân viên tạo được phiếu trên web; xem/sửa dòng phiếu chuyển và phiếu kiểm |
| 7b | #86 | Web: phiếu nhập chọn lô có sẵn |
| 7c | #87 | Web: yêu cầu bảo trì và yêu cầu chuyển tài sản (`/requests`) |
| 7f | #88 | Web: chuông thông báo |
| 7d | #89 | Web: lịch sử thay đổi (`/history` và khung lịch sử); API `audit-logs` trả thêm `references` (id → mã/tên) |
| — | #91 | Web: mỗi lúc chỉ một thao tác trên phiếu chuyển/kiểm (khóa khi đang sửa nháp, lưu, xác nhận, hủy, gửi duyệt, từ chối) |
| 7e | #90 | Web: quét 3 loại nhãn QR, trang `/scan/item` và `/scan/inventory`, in nhãn QR mặt hàng |

### Quy tắc đã chốt

**Phiếu kho:**
- Admin/chủ trại xác nhận thẳng phiếu nháp.
- Nhân viên chỉ sửa, hủy, gửi duyệt phiếu do mình tạo.
- GUEST không có quyền ghi.
- Phiếu bị từ chối thì kết thúc, không gửi lại được. Phiếu đã gửi duyệt thì không rút lại được.
- Phiếu xuất gắn với đơn hàng đi theo luồng đơn hàng.

**Yêu cầu bảo trì và yêu cầu chuyển tài sản:**
- Chỉ nhân viên (EMPLOYEE) được tạo.
- Admin xem tất cả yêu cầu, nhân viên chỉ xem yêu cầu của mình.
- Mỗi tài sản chỉ có 1 yêu cầu đang chờ duyệt. Tạm thời nhân viên không rút được yêu cầu.

**Yêu cầu chuyển tài sản:**
- Nhân viên chọn kho và vị trí đích.
- Trong lúc chờ duyệt, tài sản ở trạng thái "Chờ chuyển" và mọi thao tác khác đều bị chặn.

**Người duyệt:** hiện là ADMIN và FARM_OWNER. Sau này sẽ thêm vai trò nhân viên kho được quyền duyệt; quyền duyệt chỉ kiểm tra ở một chỗ nên chỉ cần thêm mã vai trò vào danh sách đó.

## Việc tiếp theo

Thứ tự đã thống nhất: **7b → 7c → 7f → 7d → 7e → 8 → 9**.

### 7b. Web: phiếu nhập chọn lô có sẵn
- Dòng hàng theo lô có hai lựa chọn: "Lô mới" (nhập số lô, ngày sản xuất, hạn dùng) hoặc "Lô có sẵn" (chọn từ các lô cùng mặt hàng, gửi `lotId`, không gửi thông tin lô mới).
- Chặn ngay trên form nếu hạn dùng trước ngày sản xuất.
- Màn chi tiết dùng các trường mới của API (tên và mã hàng, đơn vị, số lô và hạn dùng của lô, vị trí). Bỏ bớt các lệnh gọi API phụ đang dùng để lấy tên hàng.
- Sửa `receipt-draft.logic` cho dòng có `lotId`: xác nhận được mà không cần số lô.
- Test: kiểm tra dữ liệu lô mới so với lô có sẵn; xử lý khi API báo lô không tồn tại (404) hoặc dữ liệu không hợp lệ (400); sau khi lưu thì tải lại.

### 7c. Web: yêu cầu bảo trì và yêu cầu chuyển tài sản
- Một trang danh sách dùng cho cả hai nhóm, có bộ lọc trạng thái và phân trang trên server:
  - Admin thấy các yêu cầu được phép duyệt.
  - Nhân viên thấy yêu cầu đã gửi cùng kết quả xử lý (người duyệt, thời điểm, lý do từ chối, lịch bảo trì đã tạo).
- **Admin:**
  - Duyệt yêu cầu bảo trì: chọn ngày hẹn (`scheduledAt`).
  - Duyệt yêu cầu chuyển: xác nhận một lần.
  - Từ chối: nhập lý do từ 3 ký tự.
- **Nhân viên, ở trang chi tiết tài sản:**
  - Nút "Báo cần sửa": loại sửa chữa hoặc kiểm tra, kèm mô tả.
  - Nút "Yêu cầu chuyển": chọn kho, rồi chọn vị trí đang hoạt động trong kho đó.
  - Gửi yêu cầu chuyển thành công thì **tải lại tài sản** để hiện "Chờ chuyển" và khóa các thao tác.
- **Duyệt thất bại** (ví dụ 409 vì kho hoặc vị trí đã đổi trạng thái): yêu cầu vẫn giữ nguyên ở trạng thái chờ, màn hình hiện lỗi rõ ràng và tải lại.
- Test: quyền theo vai trò; ánh xạ lỗi 403/404/409; tải lại sau khi gửi, duyệt, từ chối.

### 7f. Web: chuông thông báo
- Làm ngay sau 7c, khi các màn hình đích đã có.
- Hiện số thông báo chưa đọc, danh sách có phân trang, đánh dấu đã đọc.
- Bấm vào một thông báo thì mở đúng phiếu hoặc yêu cầu (dựa theo `entityType` và `entityId`).
- Cập nhật số chưa đọc khi người dùng quay lại trang. Chưa cần realtime.

### 7d. Web: lịch sử thay đổi
- Dùng `GET /audit-logs` **đúng phạm vi quyền của API**: admin xem toàn trại, nhân viên chỉ xem lịch sử phiếu và yêu cầu do mình tạo.
- **Không tải toàn bộ rồi lọc trên trình duyệt.** Mọi bộ lọc (loại đối tượng, mã đối tượng, hành động) đều gửi lên server.
- Khung "Lịch sử" trong chi tiết mỗi phiếu và yêu cầu: chỉ tải khi mở ra, có phân trang.
- Một trang `/history` chung.
- Test: tham số gửi lên API, phân trang, xử lý 403.

### 7e. Web: QR
- `scan.logic` nhận cả 3 loại mã (tài sản, mặt hàng, tồn kho) và vẫn nhận mã tài sản trần cho nhãn đã in theo kiểu cũ.
- Thêm trang `/scan/item/[itemId]` và `/scan/inventory/[balanceId]`.
- Thêm nút xem và in QR ở trang vật tư (`GET /items/:id/qr`).
- Kiểm tra cả **quét bằng trình quét trong web** lẫn **mở URL khi quét bằng camera điện thoại** (phải đăng nhập rồi quay về đúng trang).
- Lưu ý: `WEB_APP_URL` (hoặc `WEB_ORIGIN`) phải đúng tên miền web, vì trình quét chỉ nhận URL cùng tên miền.

### 8. Thư mục `mobile/` (app Expo)
- Đưa thư mục `mobile/` vào repo. Phần này độc lập với code hiện tại.
- Sửa app cho khớp với `dev`:
  - Tra tài sản bằng mã (`/assets/by-code/{code}`), không dùng `by-qr`. Ô nhập tay đổi chữ thành "mã tài sản".
  - Màn mặt hàng lấy thông tin bằng `GET /items/:id`, không gọi endpoint QR chỉ để lấy tên.
  - Chuyển tài sản: dùng `asset-transfer-requests`. Bỏ cách chuyển tài sản qua phiếu chuyển kho.
  - Màn phiếu kiểm không cho chọn mặt hàng theo tài sản (ASSET).
  - Phiếu xuất: không cho chọn loại SALE, và không xuất tài sản với loại DAMAGE hoặc MAINTENANCE.
  - Khớp quy ước QR.
- Thử bằng token Expo thật để chắc token không có `azp`.

### 9. Tài liệu và dữ liệu mẫu
Phần này đụng file `.md`, nên cần bạn đồng ý trước khi commit.
- `api/README.md`: cập nhật quy tắc duyệt phiếu, các endpoint yêu cầu, trạng thái `TRANSFER_PENDING`, quy ước QR.
- `CLAUDE.md`: bỏ dòng "bảng `notifications` có nhưng chưa dùng", và thêm quy tắc duyệt.
- Dữ liệu mẫu (seed): thêm tài khoản nhân viên và vài phiếu hoặc yêu cầu ở trạng thái chờ duyệt để demo.

## Để sau (đã ghi nhận)

- Thời gian giữ và dọn dẹp `notifications` và `notification_push_outbox`.
- Biểu đồ tồn kho trên dashboard; lọc vật tư theo danh mục và theo kho (phần thêm của nhánh mobile).
- Vai trò nhân viên kho có quyền duyệt.
- Cho nhân viên rút yêu cầu hoặc phiếu đã gửi.
- Bộ chọn lô của phiếu chuyển và phiếu kiểm chỉ liệt kê 100 dòng tồn đầu tiên (`shortcut:` trong code).
- Có thể xóa nhánh `fix` cũ trên remote.
- Vài test đã track trên `dev` (spec cũ của auth, `web/shared/config/*.test.mjs`) đang hỏng trên bản checkout sạch. Bản sửa nằm ở các file local của bạn, đang tạm giữ local.

## Lệnh kiểm tra hay dùng

```bash
# api/
npx tsc --noEmit -p tsconfig.json
node node_modules/eslint/bin/eslint.js "{src,apps,libs,test}/**/*.ts"
node node_modules/jest/bin/jest.js                                      # unit
node node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand
TEST_DATABASE_URL=<url DB dev, đổi tên DB thành nuoi_ong_test> node node_modules/jest/bin/jest.js --config ./test/jest-assets.config.cjs --runInBand

# web/
npx tsc --noEmit
pnpm lint
node --test $(find features shared -name '*.test.mjs')
pnpm build
```

- Toàn bộ test tích hợp chạy trên DB dev thì luôn có 2 bộ hỏng: `storefront-seed` và `storefront-schema`. Đây là bình thường, vì hai bộ này cần DB test.
- DB `nuoi_ong_test` đã được tạo và migrate đến 0022, dùng cho `test:assets`.
