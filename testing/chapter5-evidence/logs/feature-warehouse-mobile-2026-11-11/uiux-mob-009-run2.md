# UIUX-MOB-009 Run #2 Execution Log (`feature/warehouse` local)

- **Test Case ID / Run #:** `UIUX-MOB-009` / Run `#2`
- **Branch / Build SHA:** `feature/warehouse` @ `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` *(dirty working tree: 284 mục baseline chưa commit)*
- **Execution Window:** `2026-11-11T20:52:04+07:00` → `2026-11-11T21:05:33+07:00`
- **Device / OS / App Build:**
  - Android device: `HUAWEI P30 lite` (`MAR-LX2`, ADB serial `8RB4C19306020053`), Android `10`
  - App package: `com.nuoi.ong.mobile`, `versionName=1.0.0`, `versionCode=4`, `lastUpdateTime=2026-11-11 18:34:01`
  - Metro bundler: `http://192.168.2.14:8081` (`--dev-client --lan`)
  - API Base URL (Mobile LAN): `http://192.168.2.14:5050/api/v1` (API local `http://127.0.0.1:5050/api/v1`)
  - PostgreSQL local test: Docker `nuoi-ong-db-local` (`127.0.0.1:5436 / nuoi_ong_local`)
  - Tài khoản kiểm thử: `Quốc Khánh` (`EMPLOYEE`, `member_id = 8f25cfb5-256a-4dd2-babd-ff4fc0d3da69`) và `quản lý kho` (`WAREHOUSE_MANAGER`, `member_id = 1eac0b3f-5646-4345-b461-889c33bc1f9a`)

---

## Pre-state & Dữ liệu điều kiện

1. **Kiểm tra dữ liệu Transfer sẵn có trong `nuoi_ong_local` (`FARM-DEMO`):**
   - Toàn bộ bảng `stock_transfers` của farm hiện chỉ có `3` phiếu lịch sử đã `CONFIRMED` (`CK-2026-000001`, `TRF-MANUAL-001`, `TRF-DEMO-001`) + `1` phiếu synthetic vừa tạo ở dưới (`CK-1dd4a25b` ở trạng thái `DRAFT`).
   - **Số phiếu đang ở `DISCREPANCY` / `IN_TRANSIT` / `PENDING_APPROVAL`:** `0`.
2. **Pre-state tồn kho `SURV-078` (`Túi lưới vận chuyển nuc`):**
   - Kho nguồn `WH-FIELD` (`1eb6a938-594a-443c-beb2-d6e981f49c5c`): `quantity_on_hand = 194.000`.
   - Kho đích `WH-MAIN` (`3045a35e-8769-4ade-8ea8-3d33346f11f6`): chưa có dòng tồn (`0`).

---

## Quá trình tạo Precondition hợp lệ bằng API & Thực thi trên Mobile

> **Ràng buộc QA:** Không sửa trực tiếp `status` trong DB; không sửa source code. Trạng thái `DISCREPANCY` phải được tạo bằng workflow API hợp lệ (`POST /stock-transfers` → `/submit` → `/confirm` (dispatch `10`) → `/receive` (`8`, thiếu `2` kèm lý do)).

1. **Tạo phiếu `DRAFT` qua API (`20:52:04.728+07:00`):**
   - `POST /api/v1/stock-transfers?farmId=59e1ddf2-...` dưới tài khoản `Quốc Khánh`: **`201 Created`**.
   - Tạo phiếu `1dd4a25b-003d-43b6-9c77-8c23af5010be` (`status: "DRAFT"`, `note: "QA-MOB009-20261111-DISCREPANCY"`, `SURV-078`, `quantity: "10.000"`, `WH-FIELD → WH-MAIN`).

2. **Chuyển trạng thái sang chờ duyệt / xuất kho / nhận thiếu qua API (`20:52:04.810` – `.929+07:00`):**
   - `POST /api/v1/stock-transfers/1dd4a25b-.../submit` (`Quốc Khánh`): **`500 Internal server error`**.
   - `POST /api/v1/stock-transfers/1dd4a25b-.../confirm` (`quản lý kho`, dự phòng dispatch thẳng từ `DRAFT`): **`500 Internal server error`**.
   - `POST /stock-transfers/.../receive` (`receivedQuantity: "8"`) **không thể thực hiện** vì phiếu chưa qua được `/confirm` sang `IN_TRANSIT`.

3. **Kiểm tra danh sách và mở chi tiết trên Mobile thật (`21:01` – `21:04+07:00`):**
   - Trên tab `Phiếu kho` → `Phiếu điều chuyển`, thiết bị hiển thị `CK-1dd4a25b` (`BẢN NHÁP` — `QA-MOB009-20261111-DISCREPANCY`, `uiux-mob-009-01-transfers-list.png`).
   - Mở màn `/transfers/1dd4a25b-003d-43b6-9c77-8c23af5010be`: hiển thị route `WH-FIELD → WH-MAIN`, note `QA-MOB009-20261111-DISCREPANCY`, `10 cái` `SURV-078`, thông báo nháp và nút `Gửi duyệt` (`uiux-mob-009-02-draft-detail.png`, `uiux-mob-009-03-draft-detail-bottom.png`).
   - Bấm trực tiếp nút **`Gửi duyệt`** trên điện thoại lúc `21:03:58+07:00`: Mobile bật hộp thoại **`Không thể gửi duyệt / Internal server error`** (`uiux-mob-009-04-submit-error.png`).

4. **Log API & Truy vết nguyên nhân gốc (`task-8945.log`):**
   - Cả 3 lời gọi (`API submit 20:52:04`, `API confirm 20:52:04`, `Mobile Gửi duyệt 21:03:58`) đều sập cùng một lỗi trong DB transaction:
     ```text
     [Nest] 27880 - 20:52:04 / 21:03:58 11/11/2026 ERROR [ExceptionsHandler] DrizzleQueryError: Failed query: select "notifications"."id", "device_push_tokens"."id" from "notifications" ...
     cause: error: syntax error at end of input (code: '42601', position: '16882' / '16877', routine: 'scanner_yyerror')
     at enqueueDocumentPushes (api/src/modules/notifications/notification-push-outbox.ts:179:17)
     at insertForUsers (api/src/modules/notifications/notification-events.ts:185:3)
     at notifyFarmApprovers (api/src/modules/notifications/notification-events.ts:224:3)
     at StockTransfersService.submit (stock-transfers.service.ts:363:7) / confirm (stock-transfers.service.ts:527:7)
     ```
   - Vì bảng `device_push_tokens` hiện có `1` token `is_active = true`, hàm `enqueueDocumentPushes()` chạy câu SQL `documentPushEligibility()` nằm **bên trong transaction** của `submit` và `confirm`, dẫn tới lỗi cú pháp PostgreSQL `42601` ở mệnh đề `maintenanceCondition` và làm rollback toàn bộ giao dịch.

5. **Kiểm chứng DB read-only sau lần thử trên Mobile (`21:05:33+07:00`):**
   - `stock_transfers` (`1dd4a25b-...`): vẫn nguyên trạng thái `DRAFT`, `transfer_code = null`, `dispatched_at = null`, `confirmed_at = null`.
   - `inventory_balances`: `WH-FIELD` `SURV-078` giữ nguyên `194.000` (không trừ nhầm, không sai ledger).
   - `audit_logs`: chỉ có `1` dòng `CREATE` (`DRAFT`); `notifications`: `0` dòng; `inventory_transactions`: `0` dòng.

---

## Expected Result (trích nguyên văn spec — không sửa)

`DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.`

## Kết luận

- **Verdict:** **`BLOCKED`**
  - Không thể tạo dữ liệu điều chuyển ở trạng thái `DISCREPANCY` bằng workflow API hợp lệ (`submit` và `confirm` đều trả HTTP `500 Internal server error` do lỗi SQL `42601` trong `notification-push-outbox.ts:179`), và trong DB local cũng không có sẵn phiếu `DISCREPANCY` nào, nên chưa thể mở/đánh giá hành vi runtime của màn `/transfers/[id]` ở trạng thái `DISCREPANCY` và sau bước `resolve`.
  - *(Ghi chú kiểm tra tĩnh đọc source — không tính là kết quả Fail runtime: [`TransferNotificationDetailScreen.tsx`](../../../../mobile/src/features/notifications/presentation/TransferNotificationDetailScreen.tsx#L29-L138) hiện chưa có nhánh riêng cho `DISCREPANCY` ở `statusTone()`, chưa tính/hiển thị số lượng lệch `quantity - receivedQuantity`, và `noticeText` vẫn rơi về nhánh fallback `'Phiếu đã kết thúc; tồn kho không thay đổi.'`.)*
