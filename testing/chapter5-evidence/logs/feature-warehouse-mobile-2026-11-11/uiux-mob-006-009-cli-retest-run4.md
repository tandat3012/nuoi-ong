# UIUX-MOB-006 và UIUX-MOB-009 — CLI retest Run #4

## Thông tin lần chạy

- **Run ID:** `FW-MOB-20261111-04`
- **Thời điểm ghi nhận hoàn tất:** `2026-11-11 21:54:55 +07:00`
- **Tester:** QA CLI
- **Repository / branch:** `nuoi-ong` / `feature/warehouse`
- **HEAD SHA:** `6f4996574ca793ac4a3bf3e55821359ce3acc520`
- **Working tree:** dirty trước và sau chạy; có thay đổi local tại API/Mobile và nhiều tài liệu chưa commit. Các kết quả dưới đây áp dụng cho source working tree đang có tại thời điểm chạy, không phải APK hoặc commit sạch.
- **Android device / OS / app build:** Không có APK/AAB trong repository; `adb` không có trên PATH. Không khởi chạy Android app/emulator. Không có SHA build Mobile tương ứng.
- **API / Web / database / Metro:** Các cổng `127.0.0.1:5050` (API), `:3000` (Web), `:5432`, `:5435`, `:5436`, `:55432` (PostgreSQL) và `:8081` (Metro) đều đóng tại lần pre-check. Không đăng nhập Clerk Development hoặc gọi API.
- **Database safety:** Không kết nối database; không migration, reset, seed, truncate hoặc ghi dữ liệu. Không sử dụng production, DB dùng chung hay thanh toán thật.
- **Fixture tag / pre-state:** Không tạo fixture. Receipt `DRAFT` và transfer `DISCREPANCY` không được đọc hoặc thay đổi do API/database test không hoạt động.

## Lệnh dự án đã chạy

| Thư mục | Lệnh | Kết quả thực tế |
|---|---|---|
| `mobile/` | `pnpm exec jest --runInBand` | Exit `0`; **25 suites passed, 151 tests passed**. Trong đó `receipt-payload.test.ts`, `receipt-list.logic.test.ts`, `push-response.test.ts`, `notifications/api.test.ts` đều PASS. Đây là unit tests, không mount/render hai screen. |
| `mobile/` | `pnpm typecheck` | Exit `1`; FAIL ở `src/features/assets/presentation/MaintenanceHistoryScreen.tsx:92:38`: `recordId` không có trong kiểu options của API. Không phải lỗi tại hai màn hình được kiểm thử, nhưng source Mobile hiện không qua typecheck toàn cục. |
| `api/` | `pnpm exec jest --runInBand modules/notifications/notification-push.worker.spec.ts modules/warehouses/warehouses.service.spec.ts` | Exit `0`; **2 suites passed, 16 tests passed**. Các test này không chạy workflow thực tế của receipt submit hoặc transfer receive/discrepancy. |
| `api/` | `pnpm exec jest --runInBand` | Exit `1`; **29 suites passed, 2 suites failed; 166 tests passed, 3 failed**. Hai lỗi được báo: `materials.service.spec.ts` kỳ vọng thiếu trường `summary`; `assets.service.spec.ts` mock query bị `undefined` khi đọc `.from`. Đây là lỗi của các suite khác, không phải bằng chứng PASS/FAIL cho hai nghiệp vụ Mobile này. |
| `api/` | `pnpm build` | Exit `0`; Nest build thành công. Đây chỉ xác nhận API TypeScript build, không xác nhận SQL chạy được trên PostgreSQL. |

## UIUX-MOB-006 — Sửa Receipt rồi submit giữ dữ liệu mới

- **Test Case ID / Priority / Platform:** `UIUX-MOB-006` / `P0` / Mobile `/receipts/[id]`.
- **Expected Result (giữ nguyên nguồn):** `Submit chỉ dùng dữ liệu sau PATCH/lưu thành công; nếu save thất bại thì không submit dữ liệu cũ như mới; Web thấy nội dung giống Mobile.`
- **Các bước UI:** Không chạy được các bước mở Receipt, ghi pre-state, sửa trường, bấm Lưu nháp, reload, submit và đối chiếu Web/API/DB vì thiếu Android app runtime, API và database test.
- **Kiểm tra qua lệnh:** Mobile Jest PASS 25/25 suites, 151/151 tests; hai suite liên quan helper/payload (`receipt-payload`, `receipt-list.logic`) PASS. Không có test component/integration tự động cho Save/PATCH → reload → submit trong `ReceiptDetailScreen`.
- **Save thất bại:** Chưa chạy; repository không có fault-injection harness phù hợp và API đang tắt.
- **Actual Result:** Chỉ các unit checks đã liệt kê là PASS. Expected Result của toàn case chưa được xác minh bằng runtime.
- **Status:** `BLOCKED` — thiếu app/build/thiết bị, API, Web và PostgreSQL test; không có fixture `DRAFT`.
- **Screenshots / API logs / DB evidence:** Không có cho Run #4; không tạo ảnh/log giả. Không có DB readback.

## UIUX-MOB-009 — Transfer DISCREPANCY hiển thị đang chờ xử lý

- **Test Case ID / Priority / Platform:** `UIUX-MOB-009` / `P0` / Mobile `/transfers/[id]`.
- **Expected Result (giữ nguyên nguồn):** `DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.`
- **Các bước workflow/UI:** Không tạo transfer `10` xuất / `8` nhận / lệch `2`, không mở notification/detail và không resolve vì API/PostgreSQL test, Metro và app runtime đều không hoạt động. Không sửa status trực tiếp trong DB.
- **Kiểm tra qua lệnh:** Mobile Jest PASS 25/25 suites, 151/151 tests; `push-response.test.ts` và `notifications/api.test.ts` PASS cho các helper hợp đồng/navigation. Hai API unit suites liên quan push worker/quyền kho PASS 16 tests tổng cộng. Chúng không render `TransferNotificationDetailScreen` và không tạo trạng thái `DISCREPANCY` thật.
- **Actual Result:** UI badge, quantities, warehouses, reason, resolution flow, balance và ledger chưa được kiểm chứng runtime.
- **Status:** `BLOCKED` — thiếu app/build/thiết bị, API và PostgreSQL test; không có fixture `DISCREPANCY`.
- **Screenshots / API logs / DB evidence:** Không có cho Run #4; không tạo ảnh/log giả. Không có DB readback.

## Kết luận và bước retest

Hai Test Case giữ nguyên Expected Result và đều **BLOCKED ở cấp độ nghiệm thu nghiệp vụ**; unit tests PASS không được tính là PASS cho toàn case. Để hoàn tất, cần bật API/Web và PostgreSQL test độc lập, có Android build tương ứng với source SHA hoặc development client chạy source hiện tại, rồi thực hiện fixture workflow synthetic và lưu ảnh/API/DB evidence thật. Không dùng lại fixture cũ trước khi đọc pre-state.

