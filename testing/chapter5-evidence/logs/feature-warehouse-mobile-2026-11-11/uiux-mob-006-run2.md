# UIUX-MOB-006 Run #2 Execution Log (`feature/warehouse` local)

- **Test Case ID / Run #:** `UIUX-MOB-006` / Run `#2`
- **Branch / Build SHA:** `feature/warehouse` @ `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` *(dirty working tree: 284 mục baseline chưa commit)*
- **Execution Window:** `2026-11-11T20:25:48+07:00` → `2026-11-11T20:42:41+07:00` *(+ web readback `2026-11-11T20:46+07:00`)*
- **Device / OS / App Build:**
  - Android device: `HUAWEI P30 lite` (`MAR-LX2`, ADB serial `8RB4C19306020053`), Android `10`
  - App package: `com.nuoi.ong.mobile`, `versionName=1.0.0`, `versionCode=4`, `lastUpdateTime=2026-11-11 18:34:01`
  - Metro bundler: `http://192.168.2.14:8081` (`--dev-client --lan`)
  - API Base URL (Mobile LAN): `http://192.168.2.14:5050/api/v1` (API local `http://127.0.0.1:5050/api/v1`)
  - Web đối chiếu: `http://localhost:3000`
  - PostgreSQL local test: Docker `nuoi-ong-db-local` (`127.0.0.1:5436 / nuoi_ong_local`)
  - Tài khoản Mobile: `Quốc Khánh` (`EMPLOYEE`, `member_id = 8f25cfb5-256a-4dd2-babd-ff4fc0d3da69`, farm `FARM-DEMO` / `Trại ong Hướng Dương`)

---

## Fixture & Pre-state

- **Receipt ID:** `36015b5a-f202-4959-a1f6-9a01ca09dfc3` (`PN-36015b5a`, created `2026-11-11T13:25:48.110Z` = `20:25:48+07:00`)
- **Warehouse:** `WH-FIELD` · `Kho điểm nuôi số 1` (`1eb6a938-594a-443c-beb2-d6e981f49c5c`)
- **Initial State (`DRAFT`):**
  - Header `note`: `QA-MOB006-20261111-INITIAL`
  - Line 1 (`SURV-078` / `Túi lưới vận chuyển nuc`, `QUANTITY`): `quantity = 5.000`, `note = "QA-MOB006-QTY-LINE"`, `location_id = null`
  - Line 2 (`SURV-001` / `Bộ thùng ong Langstroth`, `ASSET`): `quantity = 1.000`, `assetCode = "QA-MOB006-AST-01"`, `serialNumber = "QA-MOB006-SN-01"`, `location_id = null` (`Chọn vị trí lưu kho *`), `note = "QA-MOB006-ASSET-LINE"`

---

## Step-by-Step Observed Behavior

1. **Bước 1–2 (Mở Receipt Detail & ghi nhận dữ liệu ban đầu):**
   - Mở `/receipts/36015b5a-f202-4959-a1f6-9a01ca09dfc3` trên Mobile: hiển thị `BẢN NHÁP`, `MÃ PHIẾU: PN-36015b5a`, tổng `6 đơn vị hàng hóa`, ghi chú `QA-MOB006-20261111-INITIAL`, dòng `SURV-078 = 5`, dòng `SURV-001 = 1` chưa chọn vị trí (`Chọn vị trí lưu kho *`).
   - Ảnh: `uiux-mob-006-01-before-top.png`, `uiux-mob-006-01-before-items.png`.

2. **Bước 3–6 (Sửa dữ liệu → không có nút Save/PATCH → quay lại danh sách → mở lại):**
   - Sửa trên Mobile: tăng `SURV-078` lên `7`, chọn vị trí cho `SURV-001` là `LOC-FIELD-A · Kệ A - kho điểm nuôi`, sửa `Ghi chú phiếu` thành `QA-MOB006-20261111-EDITED` (`uiux-mob-006-02-edited-bottom.png`).
   - Trên màn `/receipts/[id]`, thanh thao tác dưới cùng chỉ có nút `Quay lại danh sách` (`←`), `Gửi duyệt Nhập kho`, `Xuất` — **không có nút Save/Lưu nháp (`PATCH`) riêng**.
   - Bấm `Quay lại danh sách` (`←`): app điều hướng ngay về danh sách (`uiux-mob-006-03-after-back.png`), **không hỏi cảnh báo chưa lưu**, **không gửi `PATCH`**.
   - Mở lại `PN-36015b5a`: toàn bộ dữ liệu vừa sửa **bị mất sạch**, trở về giá trị cũ `SURV-078 = 5`, `Chọn vị trí lưu kho *`, `QA-MOB006-20261111-INITIAL` (`uiux-mob-006-04-after-reopen-top.png`, `uiux-mob-006-04-after-reopen-items.png`).
   - Đối chiếu read-only nguồn: tại [`ReceiptDetailScreen.tsx`](../../../../mobile/src/features/inventory/presentation/ReceiptDetailScreen.tsx#L333-L337), `hasUnsavedChanges` cố ý loại trừ phiếu đã có `params.id` (`!params.id && !createdDocumentId`).

3. **Quan sát lỗi reload đè state trong khi đang sửa (Mid-edit Token Refresh Race):**
   - Khi đang sửa lại `SURV-078 = 7` và chọn lại vị trí `LOC-FIELD-A` trong cùng phiên mở màn hình, Clerk token refresh làm `getAccessToken` đổi tham chiếu -> kích hoạt `useEffect` gọi lại `reloadDocumentById` ([`AuthContext.tsx`](../../../../mobile/src/features/auth/context/AuthContext.tsx#L114), [`ReceiptDetailScreen.tsx`](../../../../mobile/src/features/inventory/presentation/ReceiptDetailScreen.tsx#L646-L657)), màn hình thoáng khóa edit (`Chỉ phiếu nháp mới được chỉnh sửa`) và ghi đè `SURV-078` từ `7` quay về `5`.

4. **Bước 7 (Sửa sạch lại toàn bộ → Submit):**
   - Tăng lại `SURV-078 = 7` (`Tổng 8 đơn vị hàng hóa`), giữ `LOC-FIELD-A`, sửa lại `Ghi chú phiếu` thành `QA-MOB006-20261111-EDITED` (`uiux-mob-006-05-pre-submit.png`).
   - Lúc `20:38:04+07:00`, bấm `Gửi duyệt Nhập kho`:
     - Request `PATCH /api/v1/stock-receipts/36015b5a-...` chạy **thành công** (`updated_at = 2026-11-11 13:38:04.72+00`, ghi bản ghi `audit_logs` action `UPDATE`).
     - Request tiếp theo `POST /api/v1/stock-receipts/36015b5a-.../submit` bị **HTTP `500 Internal server error`**.
     - Mobile bật hộp thoại **`Không thể gửi phiếu / Internal server error`**, đồng thời giao diện phía sau hộp thoại hiển thị trạng thái cũ (`Chọn vị trí lưu kho *`, `QA-MOB006-20261111-INITIAL`) trong bức `uiux-mob-006-06-submitted.png`.
   - Log API (`task-8945.log`, `20:38:04 11/11/2026`):
     ```text
     [Nest] 27880 - 20:38:04 11/11/2026 ERROR [ExceptionsHandler] DrizzleQueryError: Failed query: select "notifications"."id", "device_push_tokens"."id" from "notifications" inner join "device_push_tokens" ...
     cause: error: syntax error at end of input (code: '42601', position: '16882', routine: 'scanner_yyerror')
     at enqueueDocumentPushes (api/src/modules/notifications/notification-push-outbox.ts:179:17)
     at insertForUsers (api/src/modules/notifications/notification-events.ts:185:3)
     at notifyFarmApprovers (api/src/modules/notifications/notification-events.ts:224:3)
     at StockReceiptsService.submitReceipt (api/src/modules/warehouses/stock-receipts.service.ts:550:7)
     ```
   - Vì `submitReceipt` mở DB transaction riêng sau `PATCH`, `PATCH` đã commit dữ liệu mới (`7`, `LOC-FIELD-A`, `QA-MOB006-20261111-EDITED`) còn transaction `submit` rollback sạch về `DRAFT` (`0` notification, `0` inventory transaction trùng).

5. **Bước 8 (Mở lại Mobile / API / DB / Web Readback đối chiếu):**
   - Đóng và mở lại `PN-36015b5a` trên Mobile lúc `20:42`: sau nhịp loading đầu (`uiux-mob-006-07-after-patch-reopen-top.png`), màn hình tải lại đầy đủ dữ liệu đã PATCH (`8 đơn vị hàng hóa`, `LOC-FIELD-A · Kệ A - kho điểm nuôi`, `QA-MOB006-20261111-EDITED`, `uiux-mob-006-07-after-patch-reopen-bottom.png`).
   - API readback bằng token `EMPLOYEE` và `WAREHOUSE_MANAGER`: cùng trả HTTP `200`, `status: "DRAFT"`, `note: "QA-MOB006-20261111-EDITED"`, `SURV-078 = 7.000`, `SURV-001` có `LOC-FIELD-A` (`uiux-mob-006-run2-api-db.redacted.json`).
   - PostgreSQL read-only (`stock_receipts`, `stock_receipt_items`, `audit_logs`, `notifications`, `inventory_transactions`): khớp hoàn toàn dữ liệu sau PATCH; chỉ có 2 bản ghi `audit_logs` (`CREATE`, `UPDATE`), `0` notification, `0` inventory transaction.
   - Web đối chiếu (`http://localhost:3000/receipts?id=36015b5a-f202-4959-a1f6-9a01ca09dfc3`): hiển thị `PN-36015b5a`, `Nháp`, `QA-MOB006-20261111-EDITED`, `7 cái` `SURV-078`, `1 bộ` `SURV-001` tại `LOC-FIELD-A — Kệ A - kho điểm nuôi` (`uiux-mob-006-08-web-readback.png`).

6. **Bước 9 (Save thất bại / fault injection):**
   - Trong `testing/` chưa có QA fault-injection harness sẵn cho kịch bản mô phỏng Save thất bại; đồng thời trên `/receipts/[id]` không có nút Save tách rời khỏi Submit (`PATCH` chỉ chạy ngay bên trong `performSubmitDocument` dòng `1609` trước `POST /submit` dòng `1611`, do đó không có bước Save thất bại riêng rồi bấm Submit).

---

## Expected Result (trích nguyên văn spec — không sửa)

`Submit chỉ dùng dữ liệu sau PATCH/lưu thành công; nếu save thất bại thì không submit dữ liệu cũ như mới; Web thấy nội dung giống Mobile.`

## Kết luận

- **Verdict:** **`FAIL`**
  1. Không đáp ứng kỳ vọng giữ dữ liệu khi sửa rồi đóng/reload trước submit: `/receipts/[id]` thiếu nút Save/PATCH và thiếu cảnh báo thoát, làm mất toàn bộ chỉnh sửa (`7 -> 5`, mất `LOC-FIELD-A`, mất `EDITED`) khi quay lại danh sách và mở lại; ngoài ra `reloadDocumentById` bị kích hoạt lại theo token refresh đã ghi đè state đang nhập trong phiên.
  2. Thao tác Submit thực tế bị lỗi HTTP `500 Internal server error` (`DrizzleQueryError`, PostgreSQL `42601` tại `notification-push-outbox.ts:179`), không chuyển được phiếu sang `PENDING_APPROVAL`, và UI phía sau hộp thoại lỗi bị flash hiển thị dữ liệu cũ trước khi mở lại phiếu. *(Ghi nhận tích cực: `PATCH` vẫn lưu chuẩn xuống API/DB/Web mà không tạo giao dịch tồn kho trùng.)*
