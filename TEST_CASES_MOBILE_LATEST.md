# Báo Cáo Test Case Mobile Mới Nhất (Sau `TEST_CASES_REPORT.md`)

> **Mốc đối chiếu gốc:** [`TEST_CASES_REPORT.md`](TEST_CASES_REPORT.md) (cập nhật lúc `2026-11-11 15:00:40`)  
> **Thời điểm tổng hợp & chạy kiểm tra:** `2026-11-11 16:48`  
> **Phạm vi:** Các test case **Mobile** mới thêm hoặc mở rộng phát sinh sau lần chỉnh sửa [`TEST_CASES_REPORT.md`](TEST_CASES_REPORT.md) gần nhất, kèm kiểm tra toàn bộ suite Mobile hiện tại.

---

## 1. Tổng Quan Chênh Lệch So Với `TEST_CASES_REPORT.md`

| Chỉ số Mobile Unit Tests | Tại mốc `TEST_CASES_REPORT.md` (`15:00:40`) | Hiện tại (`16:48`) | Biến động mới nhất |
| --- | ---: | ---: | --- |
| **Số file test (`mobile/src/**/*.test.ts`)** | `23` file | **`25` file** | **`+2` file mới** |
| **Tổng số test case (Runtime)** | `139` case | **`151` case** | **`+12` case mới** |
| **PASS** | `139` | **`151`** | **`+12` PASS (100%)** |
| **FAIL / BLOCKED** | `0` | **`0`** | `0` |

### Kết quả chạy thực tế mới nhất
- `pnpm --dir mobile typecheck`: **PASS** (exit code `0`)
- `pnpm --dir mobile test`: **25/25 test suites passed, 151/151 tests passed** (`16.112 s`)
- `pnpm --dir mobile test -- --verbose src/features/inventory/receipt-list.logic.test.ts src/features/home/dashboard.logic.test.ts src/features/activity/model.test.ts`: **3/3 test suites passed, 20/20 tests passed** (`2.612 s`, gồm `12` test case mới + `8` test case cũ trong `model.test.ts`)

---

## 2. Tóm Tắt Theo Suite Mới / Cập Nhật

| File Test | Trạng thái cập nhật | Thời gian sửa gần nhất | Tổng case | Case cũ | Case mới | Kết quả |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `mobile/src/features/inventory/receipt-list.logic.test.ts` | **File test mới** | `2026-11-11 15:28:31` | 7 | 0 | **7** | **PASS (7/7)** |
| `mobile/src/features/home/dashboard.logic.test.ts` | **File test mới** | `2026-11-11 16:22:59` | 2 | 0 | **2** | **PASS (2/2)** |
| `mobile/src/features/activity/model.test.ts` | **Mở rộng thêm test** | `2026-11-11 16:43:13` | 11 | 8 | **3** | **PASS (11/11)** |
| **Tổng cộng phần mới nhất** | **3 file (2 mới, 1 mở rộng)** | `15:28 – 16:43` | **20** | **8** | **12** | **PASS (20/20)** |

> Lưu ý: Để liên thông mã báo cáo với [`TEST_CASES_REPORT.md`](TEST_CASES_REPORT.md) (kết thúc ở `MOB-U-139`), các test case mới nhất trong tài liệu này được đánh mã tiếp nối **`MOB-U-140` → `MOB-U-151`**.

---

## 3. Chi Tiết 12 Test Case Mobile Mới Nhất (`MOB-U-140` → `MOB-U-151`)

### 3.1. `mobile/src/features/inventory/receipt-list.logic.test.ts` — File Mới (`7/7 PASS`)

> **Mục đích:** Bảo vệ logic phân tích tham số tab trên danh sách phiếu, khóa chỉnh sửa chứng từ sau khi rời trạng thái nháp (`DRAFT` / `COUNTING`), và điều hướng quay đúng về màn danh sách phiếu sau khi hoàn thành thao tác (bao gồm phiếu điều chuyển `TRANSFER` và kiểm kê `COUNT`).  
> **Code được test:** [`mobile/src/features/inventory/receipt-list.logic.ts`](mobile/src/features/inventory/receipt-list.logic.ts)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-140` | -- | Mobile — Logic Danh sách & Khóa Phiếu | `[receipt-list.logic] extracts trimmed first route param value` — Rút trích và `trim()` giá trị đầu tiên của route param (`string`, `string[]`, `undefined`, chuỗi toàn khoảng trắng). | `mobile/src/features/inventory/receipt-list.logic.test.ts:11` | **PASS** *(14 ms)* |
| `MOB-U-141` | -- | Mobile — Logic Danh sách & Khóa Phiếu | `[receipt-list.logic] normalizes valid receipt list tab params case-insensitively` — Chuẩn hóa `tab` (`COUNT`, `receipt`, `issue`, `['transfer']`, `MAINTENANCE`) không phân biệt chữ hoa/thường. | `mobile/src/features/inventory/receipt-list.logic.test.ts:18` | **PASS** |
| `MOB-U-142` | -- | Mobile — Logic Danh sách & Khóa Phiếu | `[receipt-list.logic] falls back to MAINTENANCE when maintenanceAssetId is set and tab is missing or invalid` — Tự rơi về tab `MAINTENANCE` khi có `maintenanceAssetId` mà `tab` bị thiếu hoặc không hợp lệ. | `mobile/src/features/inventory/receipt-list.logic.test.ts:26` | **PASS** *(1 ms)* |
| `MOB-U-143` | -- | Mobile — Logic Danh sách & Khóa Phiếu | `[receipt-list.logic] prefers explicit valid tab over maintenanceAssetId and defaults to RECEIPT` — Ưu tiên `tab` hợp lệ nếu truyền đồng thời với `maintenanceAssetId`; mặc định `RECEIPT` khi không có cả hai hoặc invalid. | `mobile/src/features/inventory/receipt-list.logic.test.ts:31` | **PASS** |
| `MOB-U-144` | -- | Mobile — Khóa Chỉnh sửa Phiếu Nhập/Xuất | `[receipt-list.logic] enforces editable lock for stock receipts/issues after leaving DRAFT or on error/loading` — [`isReceiptDocumentEditable`](mobile/src/features/inventory/receipt-list.logic.ts#L31-L37) chỉ cho sửa khi không loading, không error và `status === 'DRAFT'`; chặn khi ở `PENDING_APPROVAL`, `CONFIRMED`, `REJECTED`, `CANCELLED`. | `mobile/src/features/inventory/receipt-list.logic.test.ts:37` | **PASS** |
| `MOB-U-145` | -- | Mobile — Khóa Chỉnh sửa Phiếu Kiểm kê | `[receipt-list.logic] enforces editable lock for stock counts after leaving DRAFT/COUNTING or on error/loading` — [`isStockCountEditable`](mobile/src/features/inventory/receipt-list.logic.ts#L39-L45) chỉ cho sửa khi không loading, không error và ở `DRAFT` hoặc `COUNTING`; khóa ở các trạng thái sau khi gửi duyệt/hoàn thành/hủy. | `mobile/src/features/inventory/receipt-list.logic.test.ts:47` | **PASS** *(1 ms)* |
| `MOB-U-146` | -- | Mobile — Điều hướng về Danh sách Phiếu | `[receipt-list.logic] navigates back to existing receipt list screen when present in stack, otherwise replaces` — [`navigateToReceiptList`](mobile/src/features/inventory/receipt-list.logic.ts#L53-L65) dùng `router.navigate('/receipts?tab=...')` nếu `receipts/index` đang có trong stack, ngược lại dùng `router.replace(...)` tránh kẹt màn trung gian. | `mobile/src/features/inventory/receipt-list.logic.test.ts:58` | **PASS** |

---

### 3.2. `mobile/src/features/home/dashboard.logic.test.ts` — File Mới (`2/2 PASS`)

> **Mục đích:** Bảo vệ logic tạo đường dẫn cho mục **Phiếu gần đây** trên màn hình Tổng quan (`DashboardScreen`) để bấm vào mở đúng màn hình chi tiết từng loại phiếu, đồng thời chặn trường hợp `id` rỗng/null/cần encode ký tự đặc biệt.  
> **Code được test:** [`mobile/src/features/home/dashboard.logic.ts`](mobile/src/features/home/dashboard.logic.ts)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-147` | -- | Mobile — Liên kết Phiếu Gần Đây (Dashboard) | `[dashboard.logic] builds detail routes for recent receipt, issue, transfer, count, and maintenance items` — [`recentDocumentRoute`](mobile/src/features/home/dashboard.logic.ts#L3-L12) ánh xạ đúng `RECEIPT` → `/receipts/:id?type=receipt`, `ISSUE` → `/receipts/:id?type=issue`, `TRANSFER` → `/transfers/:id`, `COUNT` → `/counts/:id`, `MAINTENANCE` → `/maintenance/requests/:id`. | `mobile/src/features/home/dashboard.logic.test.ts:5` | **PASS** *(13 ms)* |
| `MOB-U-148` | -- | Mobile — Liên kết Phiếu Gần Đây (Dashboard) | `[dashboard.logic] encodes special characters and returns null for missing or blank document ids` — Trim khoảng trắng, URL-encode ký tự đặc biệt trong ID và trả `null` (không điều hướng) nếu ID là `''`, `'   '`, `null`, hoặc `undefined`. | `mobile/src/features/home/dashboard.logic.test.ts:13` | **PASS** *(1 ms)* |

---

### 3.3. `mobile/src/features/activity/model.test.ts` — Mở Rộng Thêm (`+3` Case Mới, Tổng `11/11 PASS`)

> **Mục đích:** Bảo vệ phần nâng cấp hiển thị trực quan **Chi tiết lịch sử thao tác** và **Dữ liệu trước/sau thao tác**: giải mã UUID thành tên/mã thật (`references`), che UUID lạ thay vì lộ chuỗi hex kỹ thuật, dịch enum, format ngày/tiền VND, gom tuyến chuyển kho `Kho nguồn → Kho đích`, dựng thẻ vật tư (`items`) và bỏ các trường ID nội bộ.  
> **Code được test:** [`mobile/src/features/activity/model.ts`](mobile/src/features/activity/model.ts)

#### A. 3 test case mới bổ sung

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-149` | -- | Mobile — Giải mã UUID & Format giá trị Lịch sử | `[Audit history presentation] resolves UUID references, masks unknown UUIDs, and formats enums, dates and VND money` — [`formatValue`](mobile/src/features/activity/model.ts#L440-L484) đổi UUID kho/thành viên/lô (`Lô ...`) và UUID nhúng trong chuỗi văn bản bằng `references`; che UUID không rõ thành `Chưa xác định` / `Trang trại khác`; dịch `issueType`, `codeSource`, `resolution`, `finalDecision`; format ngày `YYYY-MM-DD` → `DD/MM/YYYY` và tiền `đ`. | `mobile/src/features/activity/model.test.ts:94` | **PASS** *(2 ms)* |
| `MOB-U-150` | -- | Mobile — Snapshot trực quan Trước/Sau Thao tác | `[Audit history presentation] builds a clean visual snapshot without internal surrogate IDs and pairs warehouse transfer routes` — [`presentSnapshot`](mobile/src/features/activity/model.ts#L591-L817) gom `fromWarehouseId`/`toWarehouseId` thành `warehouseRoute`, đưa `Trạng thái` lên đầu dạng status pill, ẩn `id`/`farmId`/`stockTransferId` và tạo card `items` kèm chỉ số `Hệ thống`, `Thực tế`, `Chênh lệch` (tone màu), `Đơn giá`, chi tiết `Lô` & `Lý do lệch`. | `mobile/src/features/activity/model.test.ts:123` | **PASS** *(6 ms)* |
| `MOB-U-151` | -- | Mobile — Tổng hợp Tham chiếu & Nhãn Diff Vật tư | `[Audit history presentation] synthesizes references across wrapped related records and enriches diff item labels` — [`synthesizeReferences`](mobile/src/features/activity/model.ts#L314-L361) giải mã chéo bản ghi lồng (`asset`, `itemCode`, `locationName`); [`presentSnapshot`](mobile/src/features/activity/model.ts#L591-L817) ẩn `qrToken` và trường tên lặp; [`visibleChanges`](mobile/src/features/activity/model.ts#L521-L529) lọc bỏ `updatedAt`; [`readableChangeLabel`](mobile/src/features/activity/model.ts#L486-L519) hiển thị `Vật tư: EQ-008 — Đáy nhựa Hive Doctor • Số lượng` và `recordLabel` trả `TS-009`. | `mobile/src/features/activity/model.test.ts:194` | **PASS** *(1 ms)* |

#### B. 8 test case đã có từ trước trong cùng suite (`MOB-U-001` → `MOB-U-008` — vẫn giữ nguyên & `PASS`)

> Lưu ý: Số dòng bên dưới là vị trí hiện tại trong [`mobile/src/features/activity/model.test.ts`](mobile/src/features/activity/model.test.ts) (dịch nhẹ so với dòng `10..57` ở `TEST_CASES_REPORT.md` do format import đa dòng).

| Mã BC | Chi tiết case cũ trong `model.test.ts` | Ở đâu | Trạng thái |
| --- | --- | --- | --- |
| `MOB-U-001` | handles seeded lower-case entity types and opens an existing issue, never a new form | `mobile/src/features/activity/model.test.ts:24` | **PASS** *(16 ms)* |
| `MOB-U-002` | does not invent a diff when a snapshot was not stored | `mobile/src/features/activity/model.test.ts:32` | **PASS** *(1 ms)* |
| `MOB-U-003` | reads document snapshots without borrowing the status of line items | `mobile/src/features/activity/model.test.ts:37` | **PASS** |
| `MOB-U-004` | compares nested fields independent of key order or SQL/JS naming | `mobile/src/features/activity/model.test.ts:44` | **PASS** *(1 ms)* |
| `MOB-U-005` | distinguishes absent fields, null, zero, false and empty strings | `mobile/src/features/activity/model.test.ts:52` | **PASS** *(14 ms)* |
| `MOB-U-006` | does not mistake reordered receipt lines for quantity changes | `mobile/src/features/activity/model.test.ts:61` | **PASS** *(1 ms)* |
| `MOB-U-007` | keeps snapshots available but does not link deleted or unsupported records | `mobile/src/features/activity/model.test.ts:70` | **PASS** |
| `MOB-U-008` | uses the farm name only when the snapshot matches the selected farm | `mobile/src/features/activity/model.test.ts:78` | **PASS** *(1 ms)* |

---

## 4. Thay Đổi Mobile Kèm Theo Chưa Có Test UI Tự Động (Cần Test Tay Trên App)

Sau mốc `2026-11-11 15:00:40`, ngoài 3 phần logic đã có 12 test tự động ở trên, các màn hình UI React Native và API client dưới đây cũng được cập nhật/tạo mới nhưng **chưa có component/E2E test tự động** (cùng lý do chung với Mục 7.2 trong [`TEST_CASES_REPORT.md`](TEST_CASES_REPORT.md) là Mobile chưa cài `@testing-library/react-native` hoặc Detox/Maestro):

1. **[`mobile/src/shared/ui/OperationResultDialog.tsx`](mobile/src/shared/ui/OperationResultDialog.tsx):** Chuyển hộp thoại thông báo thành công sau khi lập/gửi phiếu sang giao diện toàn màn hình riêng biệt (`Modal` fullscreen có danh sách chi tiết & danh sách vật tư, nút quay về danh sách phiếu và xử lý vùng an toàn).
2. **[`mobile/src/features/inventory/presentation/ReceiptListScreen.tsx`](mobile/src/features/inventory/presentation/ReceiptListScreen.tsx), [`ReceiptDetailScreen.tsx`](mobile/src/features/inventory/presentation/ReceiptDetailScreen.tsx), [`StockCountScreen.tsx`](mobile/src/features/inventory/presentation/StockCountScreen.tsx), [`InventoryActionScreen.tsx`](mobile/src/features/inventory/presentation/InventoryActionScreen.tsx), [`TransferNotificationDetailScreen.tsx`](mobile/src/features/notifications/presentation/TransferNotificationDetailScreen.tsx) & [`AssetTransferRequestScreen.tsx`](mobile/src/features/assets/presentation/AssetTransferRequestScreen.tsx):** UI khóa thao tác sửa khi phiếu đã rời `DRAFT`/`COUNTING`, đọc/giữ đúng tab `RECEIPT`/`ISSUE`/`TRANSFER`/`COUNT`/`MAINTENANCE` khi quay về danh sách phiếu (kể cả điều chuyển), dùng màn hình kết quả mới (`OperationResultDialog`), và bỏ nút thừa ở chi tiết.
3. **[`mobile/src/features/inventory/presentation/ItemMultiSelectModal.tsx`](mobile/src/features/inventory/presentation/ItemMultiSelectModal.tsx), [`LotPickerModal.tsx`](mobile/src/features/inventory/presentation/LotPickerModal.tsx) & [`LotDetailScreen.tsx`](mobile/src/features/inventory/presentation/LotDetailScreen.tsx):** Tinh chỉnh safe area (`useSafeAreaInsets`), khoảng cách đáy các modal chọn vật tư/lô và liên kết sang tab kiểm kê.
4. **[`mobile/src/features/home/presentation/DashboardScreen.tsx`](mobile/src/features/home/presentation/DashboardScreen.tsx):** Gắn điều hướng tap vào từng thẻ mục **Phiếu gần đây** qua `recentDocumentRoute`, và truyền `references` + dùng bộ nhãn chuẩn cho mục **Lịch sử thao tác**.
5. **[`mobile/src/features/activity/presentation/ActivityDetailScreen.tsx`](mobile/src/features/activity/presentation/ActivityDetailScreen.tsx), [`ActivityScreen.tsx`](mobile/src/features/activity/presentation/ActivityScreen.tsx), [`RelatedRecordScreen.tsx`](mobile/src/features/activity/presentation/RelatedRecordScreen.tsx) & [`activity/api.ts`](mobile/src/features/activity/api.ts):** Giao diện mới của **Chi tiết lịch sử** và **Dữ liệu trước/sau thao tác** (ẩn ID kỹ thuật, hiển thị badge trạng thái, tuyến `Kho nguồn → Kho đích`, card vật tư) và hàm [`getAuditLogDetail`](mobile/src/features/activity/api.ts#L50-L74) có fallback `references`.
