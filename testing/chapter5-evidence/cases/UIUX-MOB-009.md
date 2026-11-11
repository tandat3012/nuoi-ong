# UIUX-MOB-009 — Phiếu chuyển báo đúng DISCREPANCY, không báo đã kết thúc

## Thông tin chuẩn từ spec nguồn (giữ nguyên)

- **Test Case ID:** `UIUX-MOB-009`
- **Màn hình / Platform:** Mobile `/transfers/[id]`, [`TransferNotificationDetailScreen`](../../../mobile/src/features/notifications/presentation/TransferNotificationDetailScreen.tsx#L36)
- **Priority:** `P0`
- **Tài liệu nguồn:**
  - [Bộ Test Case UI/UX](../../../KLCN289_UI_UX_TEST_CASES.md#L411-L419)
  - [40 Test Case ưu tiên Chương 5](../../../KLCN289_CHUONG5_40_TEST_CASES_UU_TIEN.md#L80)
  - [Handoff 26 ca chưa khép lại](../DEV_TEAM_HANDOFF_26_UNRESOLVED_CASES.md#L251-L257)

### Preconditions (nguồn)

- Có Transfer synthetic đã dispatch `10`, receive `8`, discrepancy `2` và có lý do chênh lệch, status đang chờ xử lý chênh lệch (`DISCREPANCY`).
- Không sửa trực tiếp status trong database; tạo trạng thái bằng workflow/API hợp lệ.

### Các bước thực hiện

1. Mở notification / detail điều chuyển (`/transfers/[id]`) trên Mobile.
2. Kiểm tra badge và trạng thái phiếu.
3. Kiểm tra số lượng xuất (`10`), thực nhận (`8`) và chênh lệch (`2`).
4. Kiểm tra kho nguồn, kho đích và lý do chênh lệch.
5. Kiểm tra trạng thái và thông điệp trên màn hình trước và sau khi xử lý chênh lệch hợp lệ.
6. Đọc lại API / DB read-only (`127.0.0.1:5436/nuoi_ong_local`).

### Expected Result (trích đúng nguồn — không chỉnh sửa)

- `DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.`
- Chi tiết kiểm chứng bổ sung theo checklist thực thi:
  - Không làm sai tồn kho hoặc ledger.
  - Sau khi xử lý hợp lệ, trạng thái và dữ liệu được cập nhật đúng.
- **Implementation Status (ghi chú từ nguồn — không phải kết quả Fail runtime):**
  - `Gap đã biết tại source HEAD: nhãn/badge/default message chưa xử lý DISCREPANCY đúng.` (Cần ghi lại hành vi quan sát thực tế khi chạy trên thiết bị thật).

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

- **Test Case ID / Run #:** `UIUX-MOB-009` / Run `#1`
- **Build SHA:** `feature/warehouse` @ `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` (dirty working tree: 284 mục)
- **Tester alias / thời điểm + timezone:** QA Engineer Agent / `2026-11-11T20:04:57+07:00`
- **Platform / device / OS / app build:** Android (chưa nhận diện được thiết bị qua ADB; `adb.exe devices -l` rỗng, `emulator.exe -list-avds` rỗng; chưa tìm thấy file `.apk`/`.aab` build riêng trong `mobile/`)
- **API / DB runtime thực tế:** `127.0.0.1:5050` = Open (`True`), `192.168.2.14:5050` = Open (`True`), `127.0.0.1:3000` = Open (`True`), `127.0.0.1:5436` (`nuoi-ong-db-local`) = Open (`True`), `192.168.2.14:8081` = Closed (`False` tại `20:04:57+07:00`)
- **Fixture tag và pre-state evidence:** Chưa tạo fixture transfer / chưa mở `/transfers/[id]` trên app thật do thiếu thiết bị ADB và Metro LAN `8081` chưa chạy tại thời điểm kiểm tra
- **Expected Result:** `DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.`
- **Actual Result:** Chưa thực thi được trên thiết bị Android thật do `adb.exe devices -l` trả về danh sách rỗng và cổng Metro `192.168.2.14:8081` trả `False`. *(Ghi chú đọc tĩnh: tại `TransferNotificationDetailScreen.tsx` dòng 29–34 và 137 hiện chưa có nhánh riêng cho `DISCREPANCY`; đây chỉ là quan sát code, chưa phải kết quả runtime).*
- **Status:** `BLOCKED`
- **Bug ID:** —
- **Evidence path(s):** [env-precheck-2026-11-11.md](../logs/feature-warehouse-mobile-2026-11-11/env-precheck-2026-11-11.md)
- **Retest of / notes:** Bật USB Debugging / chọn chế độ Truyền tệp (MTP) trên điện thoại để `adb devices -l` nhận `device`, chạy lại `pnpm exec expo start --dev-client --lan` tại `mobile/` rồi ghi bổ sung **Run #2** bên dưới.

### Run #2 — Thực thi trên thiết bị Android thật (`feature/warehouse` local)

- **Test Case ID / Run #:** `UIUX-MOB-009` / Run `#2`
- **Build SHA:** `feature/warehouse` @ `8f21b8ec42efa5a37ed6e01aaeb38b8b310e987d` *(dirty working tree: 284 mục baseline chưa commit)*
- **Tester alias / thời điểm + timezone:** QA Engineer Agent / `2026-11-11T20:52:04+07:00` → `21:05:33+07:00`
- **Platform / device / OS / app build:** Android `10`, `HUAWEI P30 lite` (`MAR-LX2`, serial `8RB4C19306020053`); `com.nuoi.ong.mobile` `versionName=1.0.0`, `versionCode=4` (`lastUpdateTime=2026-11-11 18:34:01`), Expo Dev Client qua Metro LAN `http://192.168.2.14:8081`; Clerk Development (`Quốc Khánh` / `EMPLOYEE` & `quản lý kho` / `WAREHOUSE_MANAGER`)
- **API / DB runtime thực tế:** Mobile LAN API `http://192.168.2.14:5050/api/v1` (local `127.0.0.1:5050`), DB `nuoi-ong-db-local` (`127.0.0.1:5436/nuoi_ong_local`)
- **Fixture tag và pre-state evidence:** Không có sẵn phiếu `DISCREPANCY` / `IN_TRANSIT` / `PENDING_APPROVAL` nào trong `nuoi_ong_local` (`FARM-DEMO` chỉ có `3` phiếu `CONFIRMED`). Tạo mới Transfer synthetic `1dd4a25b-003d-43b6-9c77-8c23af5010be` (`CK-1dd4a25b`, `WH-FIELD → WH-MAIN`, `SURV-078` số lượng `10.000`, note `QA-MOB009-20261111-DISCREPANCY`); tồn kho pre-state `WH-FIELD` `SURV-078 = 194.000`, `WH-MAIN = 0`
- **Expected Result:** `DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.`
- **Actual Result:** Không thể tạo dữ liệu ở trạng thái `DISCREPANCY` qua workflow/API hợp lệ (không sửa trực tiếp DB) vì mọi bước chuyển trạng thái có phát sinh thông báo đều gặp HTTP `500 Internal server error`:
  1. `POST /api/v1/stock-transfers` tạo `CK-1dd4a25b` ở trạng thái `DRAFT` thành công (`201 Created`).
  2. `POST /stock-transfers/1dd4a25b-.../submit` (`EMPLOYEE`) và `POST .../confirm` (`WAREHOUSE_MANAGER`) cùng trả HTTP `500` tại `20:52:04+07:00`, nên không thể chuyển sang `IN_TRANSIT` để chạy `POST .../receive` (`receivedQuantity: "8"`).
  3. Trên Mobile thật, mở `Phiếu điều chuyển` (`CK-1dd4a25b`) hiển thị đúng chi tiết bản nháp (`10 cái`, `WH-FIELD → WH-MAIN`, note `QA-MOB009-20261111-DISCREPANCY`), và khi bấm `Gửi duyệt` lúc `21:03:58+07:00` ứng dụng bật hộp thoại **`Không thể gửi duyệt / Internal server error`**.
  4. Truy vết log API (`task-8945.log`) xác nhận transaction rollback do `DrizzleQueryError` (PostgreSQL `42601: syntax error at end of input`) tại `enqueueDocumentPushes` (`api/src/modules/notifications/notification-push-outbox.ts:179`), gọi từ `StockTransfersService.submit` / `confirm`. DB read-only sau đó giữ nguyên `DRAFT`, `WH-FIELD = 194.000`, `0` notification, `0` inventory transaction.
  - *(Ghi chú kiểm tra tĩnh đọc source — không tính là kết quả Fail runtime: [`TransferNotificationDetailScreen.tsx`](../../../mobile/src/features/notifications/presentation/TransferNotificationDetailScreen.tsx#L29-L138) hiện chưa xử lý riêng `DISCREPANCY` ở `statusTone()`, chưa hiển thị số lượng lệch, và rơi vào fallback `'Phiếu đã kết thúc; tồn kho không thay đổi.'`.)*
- **Status:** `BLOCKED`
- **Bug ID:** — *(blocker tại `api/src/modules/notifications/notification-push-outbox.ts:179` — SQL `42601` khi `device_push_tokens` có token active)*
- **Evidence path(s):**
  - Logs: [uiux-mob-009-run2.md](../logs/feature-warehouse-mobile-2026-11-11/uiux-mob-009-run2.md), [uiux-mob-009-run2-api-db.redacted.json](../logs/feature-warehouse-mobile-2026-11-11/uiux-mob-009-run2-api-db.redacted.json)
  - Screenshots: [01-transfers-list](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-009-01-transfers-list.png), [02-draft-detail](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-009-02-draft-detail.png), [03-draft-detail-bottom](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-009-03-draft-detail-bottom.png), [04-submit-error](../screenshots/feature-warehouse-mobile-2026-11-11/uiux-mob-009-04-submit-error.png)
- **Retest of / notes:** Retest of Run `#1`. Sau khi dev sửa lỗi SQL trong `notification-push-outbox.ts`, đẩy tiếp `1dd4a25b-...` qua `/submit` → `/confirm` (xuất `10`) → `/receive` (nhận `8`, lý do thiếu `2`) → kiểm tra Mobile trước & sau `resolve`.

### Run #3 — Pre-check trên working tree hiện tại

- **Test Case ID / Run #:** `UIUX-MOB-009` / Run `#3`
- **Build SHA:** `feature/warehouse` @ `6f4996574ca793ac4a3bf3e55821359ce3acc520`; source mobile có thay đổi chưa commit, không có APK/build tương ứng SHA này.
- **Tester alias / thời điểm + timezone:** QA Engineer Agent / `2026-11-11T21:22:36+07:00`
- **Platform / device / OS / app build:** NOT RUN; `adb` và `emulator` không có trên PATH, không tìm thấy trong Android SDK mặc định; chưa nhận diện được thiết bị hoặc build app.
- **API / DB runtime thực tế:** API `127.0.0.1:5050` đóng; PostgreSQL test `127.0.0.1:5436` và QA `127.0.0.1:55432` đóng; Docker API trả `permission denied`. Không kết nối hoặc ghi DB.
- **Fixture tag và pre-state evidence:** Không kiểm tra được phiếu `DISCREPANCY`; không tạo fixture vì không truy cập được API/DB.
- **Expected Result:** `DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.`
- **Actual Result:** Chưa thực hiện workflow/API/UI/readback. Pre-check xác nhận thiếu thiết bị/build, API, DB và Docker access trong phiên này.
- **Status:** `BLOCKED` (không phải PASS/FAIL runtime).
- **Bug ID:** —
- **Evidence path(s):** [env-precheck-2026-11-11-run3.md](../logs/feature-warehouse-mobile-2026-11-11/env-precheck-2026-11-11-run3.md)
- **Retest of / notes:** Cần bật Docker và dịch vụ local đã được phê duyệt, kết nối thiết bị Android/Metro, build app từ source cần kiểm thử; sau đó xác minh pre-state và tạo fixture mới bằng workflow hợp lệ. Không sửa trạng thái DB trực tiếp và không tái dùng phiếu DRAFT cũ nếu chưa đọc pre-state.

### Run #4 — Retest bằng lệnh dự án, không có Android/API runtime

- **Test Case ID / Run #:** `UIUX-MOB-009` / Run `#4` (`FW-MOB-20261111-04`)
- **Build SHA:** `feature/warehouse` @ `6f4996574ca793ac4a3bf3e55821359ce3acc520`; working tree dirty, không có APK/AAB tương ứng.
- **Tester / thời điểm:** QA CLI / hoàn tất `2026-11-11T21:54:55+07:00`.
- **Platform / device / app build:** Mobile unit tests chạy trên Windows CLI; không có APK/AAB trong repository, `adb` không có trên PATH, không chạy app Android/emulator.
- **API / DB:** API `:5050`, PostgreSQL test `:5436` và QA `:55432`, Metro `:8081` đóng; không dùng Clerk Development, không kết nối hoặc ghi DB.
- **Fixture tag / pre-state:** Không tạo hoặc đọc fixture transfer; không sửa status DB trực tiếp.
- **Expected Result:** `DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.`
- **Actual Result:** `mobile> pnpm exec jest --runInBand` PASS (25 suites / 151 tests); `push-response.test.ts` và `notifications/api.test.ts` PASS. API unit suites `notification-push.worker.spec.ts` + `warehouses.service.spec.ts` PASS (2 suites / 16 tests). Các lệnh không render màn detail hoặc thực hiện dispatch/receive/resolve; balance và ledger chưa kiểm chứng. API full suite có 2 suites/3 tests fail ngoài nghiệp vụ này; API build PASS.
- **Status:** `BLOCKED` ở cấp Test Case; unit test PASS không xác nhận toàn bộ workflow/UI/DB.
- **Evidence:** [CLI retest Run #4](../logs/feature-warehouse-mobile-2026-11-11/uiux-mob-006-009-cli-retest-run4.md). Không có screenshot/API/DB evidence runtime.
- **Retest notes:** Bật PostgreSQL test độc lập và API, tạo fixture mới chỉ qua workflow/API hợp lệ, sau đó kiểm tra Mobile detail trước/sau resolve và đọc DB/ledger chỉ đọc. Giữ nguyên Expected Result.

### Run #5 — Kiểm thử thủ công thành công

- **Test Case ID / Run #:** `UIUX-MOB-009` / Run `#5`
- **Thời điểm:** `2026-11-11` (người dùng chưa cung cấp giờ chạy).
- **Tester / nguồn xác nhận:** Người dùng trực tiếp thực hiện kiểm thử thủ công theo test plan.
- **Repository / branch / source SHA tham chiếu gần nhất:** `nuoi-ong` / `feature/warehouse` / `6f4996574ca793ac4a3bf3e55821359ce3acc520` (Run #4). Working tree có thay đổi local; SHA này không xác định APK được dùng khi kiểm thử thủ công.
- **Platform / device / OS / app build:** Chưa cung cấp thông tin cụ thể.
- **Fixture tag / pre-state:** Sử dụng dữ liệu kiểm thử theo đúng preconditions và test plan.
- **Expected Result:** `DISCREPANCY` hiển thị là đang chờ xử lý; số lượng xuất/nhận/lệch và lý do được hiển thị chính xác; phiếu không bị báo hoàn tất trước khi xử lý lệch; sau xử lý hợp lệ, trạng thái được cập nhật đúng.
- **Actual Result:** Kiểm thử thủ công thành công. Tất cả các bước thực hiện đều đạt Expected Result:
  - Trạng thái `DISCREPANCY` được hiển thị chính xác và thể hiện đúng trạng thái đang chờ xử lý.
  - Số lượng xuất, thực nhận, chênh lệch và lý do chênh lệch được hiển thị chính xác.
  - Phiếu không hiển thị nhầm trạng thái đã kết thúc khi chênh lệch chưa được xử lý.
  - Sau khi xử lý chênh lệch hợp lệ, trạng thái phiếu được cập nhật chính xác.
  - Không ghi nhận lỗi trong quá trình thực hiện kiểm thử.
- **Kiểm tra tự động tham chiếu:** Mobile Jest `25/25` suites, `151/151` tests PASS; các suite liên quan gián tiếp `receipt-payload`, `push-response`, `notifications/api`: `3/3` suites, `18/18` tests PASS. Typecheck có lỗi tại `MaintenanceHistoryScreen.tsx:92` (`recordId` không có trong kiểu API); lỗi này ngoài phạm vi màn điều chuyển.
- **Status:** `PASS` — toàn bộ bước kiểm thử thủ công đạt yêu cầu.
- **Bug ID:** Không còn lỗi chưa khắc phục được ghi nhận trong phạm vi test case này.
- **Evidence:** Kết quả được xác nhận bởi người dùng. Không đính kèm ảnh hoặc log; thông tin thiết bị, build và mã phiếu fixture chưa được cung cấp.
- **Ghi chú:** Run #5 là kết quả kiểm thử cuối cùng. Giữ nguyên lịch sử Run #1–#4, không thay đổi hoặc ghi đè các kết quả trước đó.