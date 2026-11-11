# UIUX-MOB-006 — Receipt detail không làm mất thay đổi khi sửa rồi submit

## Thông tin chuẩn từ spec nguồn (giữ nguyên)

- **Test Case ID:** `UIUX-MOB-006`
- **Màn hình / Platform:** Mobile `/receipts/[id]`, [`ReceiptDetailScreen`](../../../mobile/src/features/inventory/presentation/ReceiptDetailScreen.tsx#L272)
- **Priority:** `P0`
- **Tài liệu nguồn:**
  - [Bộ Test Case UI/UX](../../../KLCN289_UI_UX_TEST_CASES.md#L383-L390)
  - [40 Test Case ưu tiên Chương 5](../../../KLCN289_CHUONG5_40_TEST_CASES_UU_TIEN.md#L79)
  - [Handoff 26 ca chưa khép lại](../DEV_TEAM_HANDOFF_26_UNRESOLVED_CASES.md#L244-L249)

### Preconditions (nguồn)

- Có Receipt ở trạng thái `DRAFT` được tạo trước.
- Có item, số lượng, vị trí và ghi chú synthetic; sửa một trường dòng; không có request đồng thời.
- Tài khoản Mobile có quyền phù hợp (`EMPLOYEE` chủ phiếu hoặc role được phép sửa/submit draft).

### Các bước thực hiện

1. Mở Receipt Detail (`/receipts/[id]`) trên Mobile ở trạng thái `DRAFT`.
2. Ghi nhận dữ liệu ban đầu (chụp màn hình + đọc pre-state API/DB read-only).
3. Sửa quantity, note hoặc location hợp lệ bằng dữ liệu mới.
4. Bấm Save / PATCH.
5. Đóng hoặc reload màn hình.
6. Kiểm tra dữ liệu đã lưu trên màn hình sau reload.
7. Submit Receipt.
8. Đọc lại bằng API / Web (`http://localhost:3000`) / DB read-only (`127.0.0.1:5436/nuoi_ong_local`).
9. Nếu có cơ chế mô phỏng Save thất bại trên QA harness sẵn có (không sửa source), kiểm tra rằng dữ liệu cũ không bị submit như dữ liệu mới.

### Expected Result (trích đúng nguồn — không chỉnh sửa)

- `Submit chỉ dùng dữ liệu sau PATCH/lưu thành công; nếu save thất bại thì không submit dữ liệu cũ như mới; Web thấy nội dung giống Mobile.`
- Chi tiết kiểm chứng bổ sung theo checklist thực thi:
  - Dữ liệu mới vẫn còn sau reload.
  - Web / API / DB đọc được cùng dữ liệu.
  - Không tạo giao dịch trùng.

---

## Hồ sơ môi trường local đang gắn cho lượt chạy hiện tại (`feature/warehouse`)

> **Ghi chú:** Môi trường gốc trong handoff trước đối chiếu tại `dev@c9b30228e418efb8c8af0573deb04099397920a6` (DB QA `55432`). Các lượt chạy trên hồ sơ này dùng môi trường local hiện tại của nhánh `feature/warehouse` và **không** được gán kết quả cho build `dev`.

- **Repository / Branch:** `nuoi-ong` / `feature/warehouse`
- **Build SHA:** `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` *(working tree bẩn — 284 thay đổi/untracked chưa commit ở `api/`, `mobile/`, `web/`)*
- **Database local test:** PostgreSQL Docker `nuoi-ong-db-local` tại `127.0.0.1:5436 / nuoi_ong_local`
- **API:** `http://127.0.0.1:5050` (Mobile LAN qua `resolveApiBaseUrl`: `http://192.168.2.14:5050/api/v1`)
- **Web đối chiếu:** `http://localhost:3000`
- **Metro / Mobile:** `expo start` cổng `8081` (Clerk Development)
- **Thư mục evidence:** `testing/chapter5-evidence/logs/feature-warehouse-mobile-2026-11-11/` và `testing/chapter5-evidence/screenshots/feature-warehouse-mobile-2026-11-11/`

---

## Lịch sử các lần chạy (Run History — chỉ thêm mới, không ghi đè)

### Run #1 — Pre-check môi trường trên `feature/warehouse`

- **Test Case ID / Run #:** `UIUX-MOB-006` / Run `#1`
- **Build SHA:** `feature/warehouse` @ `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` (dirty working tree: 284 mục)
- **Tester alias / thời điểm + timezone:** QA Engineer Agent / `2026-11-11T20:04:57+07:00`
- **Platform / device / OS / app build:** Android (chưa nhận diện được thiết bị qua ADB; `adb.exe devices -l` rỗng, `emulator.exe -list-avds` rỗng; chưa tìm thấy file `.apk`/`.aab` build riêng trong `mobile/`)
- **API / DB runtime thực tế:** `127.0.0.1:5050` = Open (`True`), `192.168.2.14:5050` = Open (`True`), `127.0.0.1:3000` = Open (`True`), `127.0.0.1:5436` (`nuoi-ong-db-local`) = Open (`True`), `192.168.2.14:8081` = Closed (`False` tại `20:04:57+07:00`)
- **Fixture tag và pre-state evidence:** Chưa tạo / chưa mở app do thiếu thiết bị ADB và Metro LAN `8081` chưa chạy ở thời điểm kiểm tra lại
- **Expected Result:** `Submit chỉ dùng dữ liệu sau PATCH/lưu thành công; nếu save thất bại thì không submit dữ liệu cũ như mới; Web thấy nội dung giống Mobile.`
- **Actual Result:** Chưa thực thi được bước mở `/receipts/[id]` trên thiết bị Android thật vì máy chưa nhận thiết bị qua `adb.exe devices -l` (dù điện thoại đang cắm cáp) và cổng Metro `192.168.2.14:8081` trả `False`.
- **Status:** `BLOCKED`
- **Bug ID:** —
- **Evidence path(s):** [env-precheck-2026-11-11.md](../logs/feature-warehouse-mobile-2026-11-11/env-precheck-2026-11-11.md)
- **Retest of / notes:** Bật USB Debugging / chọn chế độ Truyền tệp (MTP) trên điện thoại để `adb devices -l` nhận `device`, chạy lại `pnpm exec expo start --dev-client --lan` tại `mobile/` rồi ghi bổ sung **Run #2** bên dưới.

### Run #2 — Thực thi trên thiết bị Android thật (`feature/warehouse` local)

- **Test Case ID / Run #:** `UIUX-MOB-006` / Run `#2`
- **Build SHA:** `feature/warehouse` @ `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` *(dirty working tree: 284 mục baseline chưa commit)*
- **Tester alias / thời điểm + timezone:** QA Engineer Agent / `2026-11-11T20:25:48+07:00` → `20:46+07:00`
- **Platform / device / OS / app build:** Android `10`, `HUAWEI P30 lite` (`MAR-LX2`, serial `8RB4C19306020053`); `com.nuoi.ong.mobile` `versionName=1.0.0`, `versionCode=4` (`lastUpdateTime=2026-11-11 18:34:01`), Expo Dev Client qua Metro LAN `http://192.168.2.14:8081`; Clerk Development (`Quốc Khánh` / `EMPLOYEE`)
- **API / DB runtime thực tế:** Mobile LAN API `http://192.168.2.14:5050/api/v1` (local `127.0.0.1:5050`), Web `http://localhost:3000`, DB `nuoi-ong-db-local` (`127.0.0.1:5436/nuoi_ong_local`)
- **Fixture tag và pre-state evidence:** Receipt `36015b5a-f202-4959-a1f6-9a01ca09dfc3` (`PN-36015b5a`, `DRAFT` tại `WH-FIELD`), note `QA-MOB006-20261111-INITIAL`, dòng `SURV-078 = 5`, dòng `SURV-001 = 1` (`QA-MOB006-AST-01`, `location_id = null`)
- **Expected Result:** `Submit chỉ dùng dữ liệu sau PATCH/lưu thành công; nếu save thất bại thì không submit dữ liệu cũ như mới; Web thấy nội dung giống Mobile.`
- **Actual Result:**
  1. *(Bước 1–6 — Sửa rồi đóng/mở lại trước submit):* Sửa `SURV-078 = 7`, chọn vị trí `LOC-FIELD-A · Kệ A - kho điểm nuôi`, sửa ghi chú `QA-MOB006-20261111-EDITED`. Màn `/receipts/[id]` **không có nút Save/PATCH** tách rời; bấm `Quay lại danh sách` (`←`) thoát thẳng không cảnh báo và không gửi `PATCH`, làm mất toàn bộ chỉnh sửa khi mở lại (`SURV-078` về `5`, mất `LOC-FIELD-A`, ghi chú về `INITIAL`).
  2. *(Race trong phiên khi đang sửa):* Khi Clerk refresh token làm `getAccessToken` đổi tham chiếu, `reloadDocumentById` trong [`ReceiptDetailScreen`](../../../mobile/src/features/inventory/presentation/ReceiptDetailScreen.tsx#L646-L657) tự chạy lại, khóa thoáng màn hình và ghi đè `SURV-078` từ `7` về `5`.
  3. *(Bước 7–8 — Sửa sạch rồi Submit + Readback):* Nhập lại `7` + `LOC-FIELD-A` + `EDITED`, bấm `Gửi duyệt Nhập kho` lúc `20:38:04+07:00`: `PATCH /api/v1/stock-receipts/36015b5a-...` thành công (`updated_at = 13:38:04.72Z`), nhưng `POST /submit` tiếp theo lỗi HTTP `500 Internal server error` (PostgreSQL `42601` tại `enqueueDocumentPushes` — `api/src/modules/notifications/notification-push-outbox.ts:179`). Mobile hiện alert `Không thể gửi phiếu / Internal server error` trong khi nền UI phía sau hộp thoại quay về chữ cũ (`Chọn vị trí lưu kho *` / `INITIAL`). Mở lại `PN-36015b5a` trên Mobile, đọc API (`EMPLOYEE` & `WAREHOUSE_MANAGER`), DB read-only (`stock_receipts`, `stock_receipt_items`, `audit_logs`, `0` `inventory_transactions`) và Web (`http://localhost:3000/receipts?id=36015b5a-...`) đều đọc được cùng dữ liệu `DRAFT` sau `PATCH` (`7`, `LOC-FIELD-A`, `QA-MOB006-20261111-EDITED`), không tạo giao dịch trùng.
  4. *(Bước 9 — Save thất bại):* Trong `testing/` chưa có QA fault-injection harness; do `/receipts/[id]` chỉ gọi `PATCH` ngay trước `/submit` trong cùng một nút bấm, không tách được thao tác Save thất bại trước Submit.
- **Status:** `FAIL`
- **Bug ID:** — *(ghi nhận 3 khiếm khuyết: thiếu Save/PATCH + prompt thoát ở `/receipts/[id]`; `getAccessToken`/`reloadDocumentById` ghi đè state đang sửa; `POST /submit` HTTP `500` do SQL `42601` ở `notification-push-outbox.ts:179`)*
- **Evidence path(s):**
  - Logs: [uiux-mob-006-run2.md](../logs/feature-warehouse-mobile-2026-11-11/uiux-mob-006-run2.md), [uiux-mob-006-run2-api-db.redacted.json](../logs/feature-warehouse-mobile-2026-11-11/uiux-mob-006-run2-api-db.redacted.json)
  - Screenshots: [01-before-top](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-01-before-top.png), [01-before-items](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-01-before-items.png), [02-edited-bottom](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-02-edited-bottom.png), [03-after-back](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-03-after-back.png), [04-after-reopen-top](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-04-after-reopen-top.png), [04-after-reopen-items](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-04-after-reopen-items.png), [05-pre-submit](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-05-pre-submit.png), [06-submitted](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-06-submitted.png), [07-reopen-top](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-07-after-patch-reopen-top.png), [07-reopen-bottom](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-07-after-patch-reopen-bottom.png), [08-web-readback](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-006-08-web-readback.png)
- **Retest of / notes:** Retest of Run `#1`. Sau khi dev sửa lỗi SQL ở `notification-push-outbox.ts`, bổ sung nút Save/PATCH + cảnh báo thoát trên `/receipts/[id]` và ổn định `getAccessToken` / bỏ reload đè state khi đang nhập, cần chạy lại toàn bộ Run `#3`.

### Run #3 — Pre-check trên working tree hiện tại

- **Test Case ID / Run #:** `UIUX-MOB-006` / Run `#3`
- **Build SHA:** `feature/warehouse` @ `6f4996574ca793ac4a3bf3e55821359ce3acc520`; source mobile có thay đổi chưa commit, không có APK/build tương ứng SHA này.
- **Tester alias / thời điểm + timezone:** QA Engineer Agent / `2026-11-11T21:22:36+07:00`
- **Platform / device / OS / app build:** NOT RUN; `adb` và `emulator` không có trên PATH, không tìm thấy trong Android SDK mặc định; chưa nhận diện được thiết bị hoặc build app.
- **API / DB runtime thực tế:** API `127.0.0.1:5050` đóng; Web `127.0.0.1:3000` đóng; PostgreSQL test `127.0.0.1:5436` và QA `127.0.0.1:55432` đóng; Docker API trả `permission denied`. Không kết nối hoặc ghi DB.
- **Fixture tag và pre-state evidence:** Không kiểm tra được vì API/DB không hoạt động.
- **Expected Result:** `Submit chỉ dùng dữ liệu sau PATCH/lưu thành công; nếu save thất bại thì không submit dữ liệu cũ như mới; Web thấy nội dung giống Mobile.`
- **Actual Result:** Chưa thực hiện UI/API/DB steps. Pre-check xác nhận thiếu thiết bị/build, API, Web, DB và Docker access trong phiên này.
- **Status:** `BLOCKED` (không phải PASS/FAIL runtime).
- **Bug ID:** —
- **Evidence path(s):** [env-precheck-2026-11-11-run3.md](../logs/feature-warehouse-mobile-2026-11-11/env-precheck-2026-11-11-run3.md)
- **Retest of / notes:** Cần bật Docker và dịch vụ local đã được phê duyệt, kết nối thiết bị Android/Metro, build app từ source cần kiểm thử; sau đó chạy lại đầy đủ từ pre-state DRAFT synthetic. Không tái sử dụng hoặc submit lại fixture cũ khi chưa đọc pre-state.

### Run #4 — Retest bằng lệnh dự án, không có Android runtime

- **Test Case ID / Run #:** `UIUX-MOB-006` / Run `#4` (`FW-MOB-20261111-04`)
- **Build SHA:** `feature/warehouse` @ `6f4996574ca793ac4a3bf3e55821359ce3acc520`; working tree dirty, không có APK/AAB tương ứng.
- **Tester / thời điểm:** QA CLI / hoàn tất `2026-11-11T21:54:55+07:00`.
- **Platform / device / app build:** Unit tests chạy trên Windows CLI; không có APK/AAB trong repository, `adb` không có trên PATH, không chạy app Android/emulator.
- **API / DB:** API `:5050`, Web `:3000`, PostgreSQL test `:5436` và QA `:55432` đóng; không dùng Clerk Development, không kết nối hoặc ghi DB.
- **Fixture tag / pre-state:** Không tạo fixture do API/DB test không hoạt động; không đọc/sửa Receipt.
- **Expected Result:** `Submit chỉ dùng dữ liệu sau PATCH/lưu thành công; nếu save thất bại thì không submit dữ liệu cũ như mới; Web thấy nội dung giống Mobile.`
- **Actual Result:** `mobile> pnpm exec jest --runInBand` PASS (25 suites / 151 tests), trong đó `receipt-payload.test.ts` và `receipt-list.logic.test.ts` PASS. Chưa có component/runtime test cho thao tác Save → reload → submit. `mobile> pnpm typecheck` FAIL ở `MaintenanceHistoryScreen.tsx:92:38` do thuộc tính `recordId` không hợp lệ. Không chạy được các bước UI/API/Web/DB.
- **Status:** `BLOCKED` ở cấp Test Case; unit test PASS không xác nhận toàn bộ nghiệp vụ.
- **Evidence:** [CLI retest Run #4](../logs/feature-warehouse-mobile-2026-11-11/uiux-mob-006-009-cli-retest-run4.md). Không có screenshot/API/DB evidence runtime.
- **Retest notes:** Chạy lại từ Receipt DRAFT synthetic sau khi có API/DB test độc lập và app build tương ứng; giữ nguyên Expected Result.

### Run #5 — Kiểm thử thủ công do người dùng xác nhận

- **Test Case ID / Run #:** `UIUX-MOB-006` / Run `#5`
- **Thời điểm:** `2026-11-11` (người dùng chưa cung cấp giờ chạy).
- **Tester / nguồn xác nhận:** Người dùng xác nhận trong hội thoại đã chạy thủ công đầy đủ theo plan và đạt các bước kiểm thử.
- **Repository / branch / source SHA tham chiếu gần nhất:** `nuoi-ong` / `feature/warehouse` / `6f4996574ca793ac4a3bf3e55821359ce3acc520` (Run #4). Working tree có thay đổi local; SHA này không xác định APK được dùng khi kiểm thử thủ công.
- **Platform / device / OS / app build:** Chưa được cung cấp; Run #4 là CLI và không có APK/AAB tương ứng.
- **Fixture tag / pre-state:** Receipt `36015b5a-f202-4959-a1f6-9a01ca09dfc3` (`PN-36015b5a`); dòng `SURV-078`; dữ liệu cập nhật `quantity = 7`, `location = LOC-FIELD-A · Kệ A - kho điểm nuôi`, ghi chú `QA-MOB006-20261111-EDITED`.
- **Expected Result:** Submit dùng dữ liệu sau khi lưu thành công; dữ liệu đã lưu còn sau khi tải lại; bản Mobile và Web/API đọc cùng dữ liệu; không tạo giao dịch trùng.
- **Actual Result (người dùng xác nhận):** (1) Sửa `SURV-078 = 7`, chọn `LOC-FIELD-A` và cập nhật ghi chú; khi bấm `Quay lại danh sách`, app hiện cảnh báo và thao tác lưu gửi `PATCH`; mở lại phiếu vẫn giữ dữ liệu mới. Màn hình không có nút Save/PATCH tách rời. (2) Khi Clerk refresh token, không còn hiện tượng khóa thoáng màn hình hoặc ghi đè số lượng đang sửa. (3) Lúc `20:38:04 +07:00`, `PATCH /api/v1/stock-receipts/36015b5a-...` thành công; DB `updated_at = 13:38:04.72Z`. Người dùng xác nhận bước gửi/hoàn tất sau đó thành công; mã phản hồi và trạng thái cuối chưa được cung cấp.
- **Kiểm tra tự động tham chiếu:** Mobile Jest `25/25` suites, `151/151` tests PASS; các suite liên quan gián tiếp `receipt-payload`, `push-response`, `notifications/api`: `3/3` suites, `18/18` tests PASS. Typecheck FAIL tại `MaintenanceHistoryScreen.tsx:92` (`recordId` không có trong kiểu API); lỗi này ngoài màn Receipt.
- **Status:** `PASS` 
- **Evidence:** Không đính kèm ảnh hoặc log theo yêu cầu của người dùng; thông tin thiết bị, build và fixture cụ thể chưa được cung cấp.
- **Ghi chú:** Lượt này bổ sung lịch sử, không thay đổi hoặc xóa kết quả Run #1–#4.
