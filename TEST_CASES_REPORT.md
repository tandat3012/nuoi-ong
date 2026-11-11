# Báo Cáo Tổng Hợp Toàn Bộ Test Case Trong Dự Án

> **Ngày kiểm tra & tổng hợp:** `2026-11-11`  
> **Phạm vi quét:** Toàn bộ mã nguồn dự án (`api/`, `mobile/`, `web/`, `tools/`, tài liệu nghiệm thu tại gốc và `api/test/`, `web/test-artifacts/`).  
> **Lưu ý quan trọng:** Chỉ báo cáo đúng các test case thực sự tồn tại trong codebase và kết quả chạy thực tế bằng test runner trong môi trường hiện tại; **không sửa code/test để làm đẹp số liệu**.

## 1. Tổng Quan Kết Quả Kiểm Thử Tự Động

| Nhóm Test | Vị trí | Số File | Tổng Test Case (Runtime) | PASS | FAIL | BLOCKED | Lệnh chạy & Tình trạng |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| **Backend API — Unit Tests** | `api/src/**/*.spec.ts` | 30 | 166 | **163** | **3** | 0 | `pnpm --dir api test` (28/30 file pass hoàn toàn, 2 file fail 3 case do mock cũ) |
| **Backend API — Config & Swagger** | `api/test/*.test.cjs` | 3 | 6 | **6** | 0 | 0 | `pnpm --dir api test:assets:config`, `test:personnel:config`, `test:swagger-plugin` |
| **Backend API — Integration & E2E** | `api/test/**/*.e2e-spec.ts` | 41 | 754 *(531 it/test)* | 0 | 0 | **754** | `test:e2e`, `test:db`, `test:assets`, `test:personnel`, `test:maintenance` — bị block vì cần PostgreSQL local / `*_test` DB / hoặc loopback socket HTTP ngoài sandbox |
| **Mobile App — Unit Tests** | `mobile/src/**/*.test.ts` | 23 | 139 | **139** | 0 | 0 | `pnpm --dir mobile test` (23/23 suite pass 100%; *chưa có test UI/E2E — xem thêm [Mục 7.2](#72-các-phần-của-mobile-chưa-có-test-tự-động)*) |
| **Web Frontend — Unit Tests** | `web/**/*.test.mjs` | 42 | 224 | **224** | 0 | 0 | `pnpm --dir web test` (`node --test`, 42/42 file pass 100%) |
| **TỔNG CỘNG (Tự động)** | Toàn dự án | **139** | **1289** | **532** | **3** | **754** | Tỷ lệ pass trên các suite chạy được (không bị block môi trường): **532/535** (99.44%) |

> **Ghi chú về công cụ & nghiệm thu thủ công/trình duyệt:** Ngoài **139 file** test tự động trên, dự án còn có **3 tài liệu/hồ sơ nghiệm thu trình duyệt** (`ASSET_BROWSER_ACCEPTANCE.md`, `api/test/STOCK_ISSUE_ACCEPTANCE_REPORT.md`, `web/test-artifacts/warehouse/README.md`) và **1 script kiểm tra thủ công** (`tools/test_sources.py` — bị block khi không có Internet ra Wikimedia). Chi tiết được liệt kê đầy đủ tại [Phần 9](#9-tài-liệu-nghiệm-thu-trình-duyệt--công-cụ-kiểm-tra-ngoài).

### Quy ước cột "Mã test case" & Trạng thái

- **Tag gốc trong code/tài liệu (`Tag gốc`):** Dự án **không** dùng quy chuẩn đánh số `TC-001` hàng loạt, mà gắn **mã yêu cầu / nghiệp vụ** ngay trong comment hoặc tên test của các ca trọng tâm (như `NV02`, `NV04`, `NV06`, `NV07`, `NV08`, `NV08-F01`, `NV09-F01`, `NV09-F02`, `NV10-F01`, `P0-01`..`P0-04`, `P1-01`..`P1-12`, `P2-01`, `A7`). Những ca không khai báo tag riêng trong mã nguồn sẽ ghi `--`.
- **Mã tham chiếu trong báo cáo (`Mã BC`):** Để dễ tra cứu từng dòng trong 1.289 case, báo cáo gán thêm mã tuần tự `API-U-xxx`, `API-C-xxx`, `API-E-xxx`, `MOB-U-xxx`, `WEB-U-xxx`, `ACC-xxx`.
- **Trạng thái:**
  - `PASS`: Chạy thực tế ngày `2026-11-11` và qua hết assertions.
  - `FAIL`: Chạy thực tế ngày `2026-11-11` và bị lỗi assertion/runtime.
  - `BLOCKED`: Không thể chạy hoàn chỉnh trong môi trường hiện tại do thiếu dịch vụ ngoài / guard bảo vệ DB / hạn chế kết nối của sandbox (nêu rõ nguyên nhân cho từng file).

## 2. Chỉ Mục Các Test Case Có Mã Yêu Cầu / Nghiệp Vụ (`NV*`, `P0-*`, `P1-*`, `P2-*`, `A7`)

Bảng dưới gom toàn bộ test case có gắn mã nghiệp vụ / ưu tiên kiểm thử trong comment hoặc tên test:

| Tag nghiệp vụ | Mã BC | Phần test | Nội dung kiểm thử | Vị trí | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `NV06` | `API-E-485` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] accepts only lines of a delivered order of this farm, within the bought quantity (AC22) | `api/test/store-warranties.integration.e2e-spec.ts:89` | **BLOCKED** |
| `NV06` | `API-E-486` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] keeps the warranty sold with the order and allows only paid repair once it expired | `api/test/store-warranties.integration.e2e-spec.ts:125` | **BLOCKED** |
| `NV06` | `API-E-487` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] never starts a paid repair before the customer agrees to the quote (AC23) | `api/test/store-warranties.integration.e2e-spec.ts:146` | **BLOCKED** |
| `NV06` | `API-E-488` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] re-quotes and repairs again within the same request, asking consent each time (P1-10) | `api/test/store-warranties.integration.e2e-spec.ts:172` | **BLOCKED** |
| `NV06` | `API-E-489` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] records an agreed paid repair through to handing it back | `api/test/store-warranties.integration.e2e-spec.ts:229` | **BLOCKED** |
| `NV06` | `API-E-490` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] exchanges through one stock issue and closes only once it is confirmed (AC24) | `api/test/store-warranties.integration.e2e-spec.ts:260` | **BLOCKED** |
| `NV06` | `API-E-491` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] hands an exchanged ASSET to the customer instead of leaving it in internal use (P1-07) | `api/test/store-warranties.integration.e2e-spec.ts:292` | **BLOCKED** |
| `NV06` | `API-E-492` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] claims an ASSET by the delivered unit, one open claim per unit (P1-09) | `api/test/store-warranties.integration.e2e-spec.ts:359` | **BLOCKED** |
| `NV06` | `API-E-493` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] refuses an asset id on a quantity line (P1-09) | `api/test/store-warranties.integration.e2e-spec.ts:431` | **BLOCKED** |
| `NV06` | `API-E-494` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] keeps the exchange issue equal to the approved request until it is confirmed (P0-04) | `api/test/store-warranties.integration.e2e-spec.ts:446` | **BLOCKED** |
| `NV08` | `API-E-276` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] does not credit a warehouse deactivated while its count was open (NV08) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:476` | **BLOCKED** |
| `NV08-F01` | `API-E-527` | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] audits create, update and deactivation with actor and before/after (NV08-F01) | `api/test/warehouses.integration.e2e-spec.ts:352` | **BLOCKED** |
| `NV09-F01` | `API-U-077` | Dashboard — Định giá tồn kho | [valueMoves] keeps unpriced units out of the average of the priced ones | `api/src/modules/dashboard/stock-valuation.spec.ts:85` | **PASS** |
| `NV09-F02` | `WEB-U-130` | Web — Logic Báo cáo Tài chính/Bán hàng/Bảo trì | maintenance cost note states its real scope (NV09-F02) | `web/features/reports/reports.logic.test.mjs:64` | **PASS** |
| `NV10-F01` | `API-E-432` | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] audits catalog and sales settings changes with actor and before/after (NV10-F01) | `api/test/store-admin.integration.e2e-spec.ts:533` | **BLOCKED** |
| `P0-01` | `API-E-133` | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] never applies an approver own adjustment without a second person (P0-01) | `api/test/inventory-adjustments.integration.e2e-spec.ts:996` | **BLOCKED** |
| `P0-01` | `API-E-299` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] refuses a count difference confirmed by its own author (P0-01) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1302` | **BLOCKED** |
| `P0-01` | `API-E-314` | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules] applies a count difference only when someone other than its author approves (P0-01) | `api/test/stock-document-approval.integration.e2e-spec.ts:562` | **BLOCKED** |
| `P0-02` | `API-E-344` | Giữ hàng (Stock Holds) cho Đơn hàng (PG) | [Stock held for customer orders (migrated PostgreSQL)] refuses an unrelated issue or transfer that would take stock held by an order (P0-02) | `api/test/stock-holds.integration.e2e-spec.ts:68` | **BLOCKED** |
| `P0-02` | `API-E-345` | Giữ hàng (Stock Holds) cho Đơn hàng (PG) | [Stock held for customer orders (migrated PostgreSQL)] lets other documents use only the part that is not held (P0-02) | `api/test/stock-holds.integration.e2e-spec.ts:88` | **BLOCKED** |
| `P0-02` | `API-E-346` | Giữ hàng (Stock Holds) cho Đơn hàng (PG) | [Stock held for customer orders (migrated PostgreSQL)] lets an order issue be re-saved with its own hold, then still confirm (P0-02) | `api/test/stock-holds.integration.e2e-spec.ts:102` | **BLOCKED** |
| `P0-03` | `API-E-029` | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] keeps a damaged return in stock but out of use until it is retired (P0-03) | `api/test/assets.integration.e2e-spec.ts:1374` | **BLOCKED** |
| `P0-04` | `API-E-494` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] keeps the exchange issue equal to the approved request until it is confirmed (P0-04) | `api/test/store-warranties.integration.e2e-spec.ts:446` | **BLOCKED** |
| `P1-01` | `API-E-288` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] keeps a short receipt open until the rest is returned or written off (P1-01) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1035` | **BLOCKED** |
| `P1-01` | `API-E-289` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] writes off a transfer that arrived with nothing usable without crediting anyone (P1-01) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1070` | **BLOCKED** |
| `P1-02` | `API-E-010` | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] dispatches on approval, waits for the destination, then receives once (P1-02) | `api/test/asset-transfer-requests.integration.e2e-spec.ts:384` | **BLOCKED** |
| `P1-02` | `API-E-519` | Phạm vi quản lý theo Kho (Warehouse Scope) | [Warehouse scope (migrated PostgreSQL)] lets only managers of the destination receive an asset dispatched across warehouses (P1-02) | `api/test/warehouse-scope.integration.e2e-spec.ts:177` | **BLOCKED** |
| `P1-05` | `API-E-179` | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] assigns only maintenance-capable members and keeps staff off jobs of others (P1-05) | `api/test/maintenance-workflow.integration.e2e-spec.ts:1331` | **BLOCKED** |
| `P1-05` | `API-E-180` | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] lets staff schedule only for themselves and keeps scoped managers to their warehouses (P1-05) | `api/test/maintenance-workflow.integration.e2e-spec.ts:1404` | **BLOCKED** |
| `P1-05` | `WEB-U-081` | Web — Logic Lịch & Quản lý Bảo trì | a passed repair back in stock waits for the owner's reuse decision (P1-05) | `web/features/maintenance/maintenance.logic.test.mjs:122` | **PASS** |
| `P1-05` | `WEB-U-162` | Web — Logic Danh sách & Form Yêu cầu | only the owner or admin approves a maintenance request (P1-05) | `web/features/requests/requests.logic.test.mjs:172` | **PASS** |
| `P1-07` | `API-E-491` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] hands an exchanged ASSET to the customer instead of leaving it in internal use (P1-07) | `api/test/store-warranties.integration.e2e-spec.ts:292` | **BLOCKED** |
| `P1-08` | `API-E-471` | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] takes back the very assets it shipped, each in its inspected condition (P1-08) | `api/test/store-orders.integration.e2e-spec.ts:1331` | **BLOCKED** |
| `P1-09` | `API-E-492` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] claims an ASSET by the delivered unit, one open claim per unit (P1-09) | `api/test/store-warranties.integration.e2e-spec.ts:359` | **BLOCKED** |
| `P1-09` | `API-E-493` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] refuses an asset id on a quantity line (P1-09) | `api/test/store-warranties.integration.e2e-spec.ts:431` | **BLOCKED** |
| `P1-10` | `API-E-488` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] re-quotes and repairs again within the same request, asking consent each time (P1-10) | `api/test/store-warranties.integration.e2e-spec.ts:172` | **BLOCKED** |
| `P1-10` | `WEB-U-203` | Web — Logic Phiếu Bảo hành & Đổi trả | the same request can be re-quoted or sent round again (P1-10) | `web/features/store-warranties/warranty.logic.test.mjs:52` | **PASS** |
| `P1-11` | `API-E-316` | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › issue receipt acknowledgement (P1-11)] lets only the recipient acknowledge a confirmed issue, once, without moving stock | `api/test/stock-document-approval.integration.e2e-spec.ts:650` | **BLOCKED** |
| `P1-11` | `API-E-317` | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › issue receipt acknowledgement (P1-11)] lets a warehouse manager record receipt for the recipient only with a note | `api/test/stock-document-approval.integration.e2e-spec.ts:697` | **BLOCKED** |
| `P1-11` | `API-E-318` | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › issue receipt acknowledgement (P1-11)] needs a recipient who is an active member of the farm | `api/test/stock-document-approval.integration.e2e-spec.ts:711` | **BLOCKED** |
| `P1-12` | `API-E-278` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] records found, damaged, misplaced and missing assets and settles them on approval | `api/test/stock-counts-transfers.integration.e2e-spec.ts:609` | **BLOCKED** |
| `P1-12` | `API-E-279` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] lets the counter confirm alone when every asset is found where recorded | `api/test/stock-counts-transfers.integration.e2e-spec.ts:694` | **BLOCKED** |
| `P1-12` | `API-E-280` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] rejects %s and creates nothing (x6) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:736` | **BLOCKED** |
| `P1-12` | `API-E-281` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] goes stale when the asset changed after counting, and refuses unsafe missing reports | `api/test/stock-counts-transfers.integration.e2e-spec.ts:787` | **BLOCKED** |
| `P1-12` | `API-E-282` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] refuses the same asset twice and goes stale when the asset moves before approval | `api/test/stock-counts-transfers.integration.e2e-spec.ts:836` | **BLOCKED** |

## 3. Chi Tiết Các Case `FAIL` Và Nguyên Nhân `BLOCKED`

### 3.1. Chi tiết 3 test case `FAIL` (trong Backend API Unit Tests)

Cả 3 test case fail đều thuộc nhóm mock unit test của NestJS Service và phát sinh do code service đã thêm trường thống kê `summary` vào kết quả trả về cho màn hình danh sách phân trang, nhưng file `.spec.ts` tương ứng chưa cập nhật mock / expected payload:

1. **`API-U-024` — `api/src/modules/assets/assets.service.spec.ts:48`** (`[AssetsService] lists assets with pagination and total count`)
   - **Lỗi thực tế:** `TypeError: Cannot read properties of undefined (reading 'from')`
   - **Nguyên nhân:** [`AssetsService.listAssets`](api/src/modules/assets/assets.service.ts#L329-L405) gọi `this.databaseService.db.select(...)` **3 lần** song song trong `Promise.all` (1: data phân trang, 2: count tổng, 3: `summary` `{ available, inUse, attention }`). Tuy nhiên trong spec chỉ stub `select.mockReturnValueOnce(...)` **2 lần**, nên lần gọi thứ 3 trả về `undefined`. Ngoài ra assertion `.toEqual({ data, page })` chưa có `summary`.
2. **`API-U-115` — `api/src/modules/materials/materials.service.spec.ts:233`** (`[MaterialsService] returns a paginated material list and quantity`)
   - **Lỗi thực tế:** `expect(received).resolves.toEqual(expected)` — object thực tế chứa thêm `summary: { activeCount: 0, lotCount: 0, lowStockCount: 0 }`.
   - **Nguyên nhân:** [`MaterialsService.listMaterials`](api/src/modules/materials/materials.service.ts#L352-L385) đã bổ sung `summary` vào object trả về, trong khi expectation cũ chỉ kiểm tra `{ data, page }`.
3. **`API-U-116` — `api/src/modules/materials/materials.service.spec.ts:253`** (`[MaterialsService] returns no materials when the filtered result is empty`)
   - **Lỗi thực tế:** `expect(received).resolves.toEqual(expected)` — object thực tế chứa thêm `summary: { activeCount: 0, lotCount: 0, lowStockCount: 0 }`.
   - **Nguyên nhân:** [`MaterialsService.listMaterials`](api/src/modules/materials/materials.service.ts#L352-L385) đã bổ sung `summary` vào object trả về, trong khi expectation cũ chỉ kiểm tra `{ data, page }`.

### 3.2. Phân loại nguyên nhân `BLOCKED` (41 file Integration / E2E)

| Nhóm Blocker | Số file | Số case (Khai báo / Runtime) | Giải thích thực tế khi chạy kiểm tra |
| --- | ---: | ---: | --- |
| Guard `TEST_DATABASE_URL` (`*_test` DB) + PostgreSQL | 6 | 186 / 265 | `jest-assets.config.cjs` & `jest-personnel.config.cjs` ném `Error: TEST_DATABASE_URL is required` khi thiếu biến môi trường trỏ DB `_test` local. |
| Guard `DATABASE_URL` (`*_test` DB) + PostgreSQL | 1 | 25 / 28 | `jest-maintenance.config.cjs` ném `Error: Maintenance tests require a local _test database`. |
| Chỉ PostgreSQL (`pg-pool` / Drizzle) | 22 | 219 / 312 | Kết nối PostgreSQL trong `beforeAll` thất bại với `AggregateError` tại `pg-pool` (không có DB test / không có kết nối DB trong sandbox). |
| PostgreSQL + Supertest HTTP Loopback | 10 | 87 / 115 | Khởi động Nest `AppModule` cần PostgreSQL (Health DB / Guard / Service) **và** Supertest cần bind/connect `127.0.0.1` (bị sandbox chặn `connect EACCES 127.0.0.1`). |
| Chỉ Supertest HTTP Loopback (Service đã mock) | 2 | 14 / 34 | Hai suite `commerce.e2e-spec.ts` & `store-admin.e2e-spec.ts` không dùng DB thật nhưng Supertest mở cổng `127.0.0.1` bị sandbox Windows chặn `connect EACCES 127.0.0.1:<port>`. |

## 4. Chi Tiết Toàn Bộ Backend API — Unit Tests (30 File, 166 Cases: 163 PASS / 3 FAIL)

#### `api/src/app.controller.spec.ts` — App Root Controller (`PASS (1/1)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-001` | -- | App Root Controller | [AppController › root] should return "Hello World!" | `api/src/app.controller.spec.ts:18` | **PASS** |

#### `api/src/cloudinary/cloudinary.provider.spec.ts` — Cloudinary Provider Config (`PASS (6/6)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-002` | -- | Cloudinary Provider Config | [Cloudinary configuration] resolves the cloud name from {} | `api/src/cloudinary/cloudinary.provider.spec.ts:7` | **PASS** |
| `API-U-003` | -- | Cloudinary Provider Config | [Cloudinary configuration] resolves the cloud name from {"CLOUDINARY_CLOUD_NAME":"shared-cloud"} | `api/src/cloudinary/cloudinary.provider.spec.ts:7` | **PASS** |
| `API-U-004` | -- | Cloudinary Provider Config | [Cloudinary configuration] resolves the cloud name from {"CLOUDINARY_NAME":"legacy-cloud"} | `api/src/cloudinary/cloudinary.provider.spec.ts:7` | **PASS** |
| `API-U-005` | -- | Cloudinary Provider Config | [Cloudinary configuration] resolves the cloud name from {"CLOUDINARY_NAME":"legacy-cloud","CLOUDINARY_CLOUD_NAME":"shared-cloud"} | `api/src/cloudinary/cloudinary.provider.spec.ts:7` | **PASS** |
| `API-U-006` | -- | Cloudinary Provider Config | [Cloudinary configuration] resolves the cloud name from {"CLOUDINARY_NAME":"","CLOUDINARY_CLOUD_NAME":""} | `api/src/cloudinary/cloudinary.provider.spec.ts:7` | **PASS** |
| `API-U-007` | -- | Cloudinary Provider Config | [Cloudinary configuration] preserves individual credential overrides | `api/src/cloudinary/cloudinary.provider.spec.ts:36` | **PASS** |

#### `api/src/cloudinary/cloudinary.service.spec.ts` — Cloudinary Upload Service (`PASS (3/3)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-008` | -- | Cloudinary Upload Service | [Cloudinary uploads] uploads the file buffer with the caller options | `api/src/cloudinary/cloudinary.service.spec.ts:22` | **PASS** |
| `API-U-009` | -- | Cloudinary Upload Service | [Cloudinary uploads] logs callback failures while keeping provider details out of HTTP responses | `api/src/cloudinary/cloudinary.service.spec.ts:50` | **PASS** |
| `API-U-010` | -- | Cloudinary Upload Service | [Cloudinary uploads] logs only the message for plain SDK rejection objects | `api/src/cloudinary/cloudinary.service.spec.ts:74` | **PASS** |

#### `api/src/common/date-range.spec.ts` — Common — Khoảng ngày (Date Range) (`PASS (1/1)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-011` | -- | Common — Khoảng ngày (Date Range) | [parseDateRange] allows open bounds and validates calendar dates and ordering | `api/src/common/date-range.spec.ts:5` | **PASS** |

#### `api/src/common/query-params.spec.ts` — Common — Query & Pagination Params (`PASS (5/5)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-012` | -- | Common — Query & Pagination Params | [query params] applies pagination defaults and maximum page size | `api/src/common/query-params.spec.ts:11` | **PASS** |
| `API-U-013` | -- | Common — Query & Pagination Params | [query params] parses bounded positive integer options | `api/src/common/query-params.spec.ts:20` | **PASS** |
| `API-U-014` | -- | Common — Query & Pagination Params | [query params] rejects invalid pagination values | `api/src/common/query-params.spec.ts:28` | **PASS** |
| `API-U-015` | -- | Common — Query & Pagination Params | [query params] validates UUID and enum query values | `api/src/common/query-params.spec.ts:33` | **PASS** |
| `API-U-016` | -- | Common — Query & Pagination Params | [query params] normalizes empty and long search values | `api/src/common/query-params.spec.ts:48` | **PASS** |

#### `api/src/health.controller.spec.ts` — Health Check DB (`PASS (1/1)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-017` | -- | Health Check DB | [HealthController] confirms database connectivity | `api/src/health.controller.spec.ts:26` | **PASS** |

#### `api/src/modules/assets/assets.controller.spec.ts` — Tài sản (AssetsController) (`PASS (6/6)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-018` | -- | Tài sản (AssetsController) | [AssetsController] scopes QR lookup to the requested farm | `api/src/modules/assets/assets.controller.spec.ts:30` | **PASS** |
| `API-U-019` | -- | Tài sản (AssetsController) | [AssetsController] lists assets with validated filters | `api/src/modules/assets/assets.controller.spec.ts:46` | **PASS** |
| `API-U-020` | -- | Tài sản (AssetsController) | [AssetsController] gets an asset by ID | `api/src/modules/assets/assets.controller.spec.ts:65` | **PASS** |
| `API-U-021` | -- | Tài sản (AssetsController) | [AssetsController] rejects an unsupported asset status | `api/src/modules/assets/assets.controller.spec.ts:80` | **PASS** |
| `API-U-022` | -- | Tài sản (AssetsController) | [AssetsController] checks the asset is visible before history, holder and label | `api/src/modules/assets/assets.controller.spec.ts:94` | **PASS** |
| `API-U-023` | -- | Tài sản (AssetsController) | [AssetsController] parses excludeStatuses filter and rejects unknown statuses | `api/src/modules/assets/assets.controller.spec.ts:116` | **PASS** |

#### `api/src/modules/assets/assets.service.spec.ts` — Tài sản (AssetsService) (`FAIL (4/5 PASS, 1 FAIL)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-024` | -- | Tài sản (AssetsService) | [AssetsService] lists assets with pagination and total count | `api/src/modules/assets/assets.service.spec.ts:48` | **FAIL** — Lỗi: `Error: expect(received).resolves.toEqual() Received promise rejected instead of resolved Rejected to value: [TypeError: Cannot read properties of undefined (reading 'from')] at exp` |
| `API-U-025` | -- | Tài sản (AssetsService) | [AssetsService] getAsset returns an asset scoped to the farm | `api/src/modules/assets/assets.service.spec.ts:70` | **PASS** |
| `API-U-026` | -- | Tài sản (AssetsService) | [AssetsService] getAssetByCode returns an asset scoped to the farm | `api/src/modules/assets/assets.service.spec.ts:70` | **PASS** |
| `API-U-027` | -- | Tài sản (AssetsService) | [AssetsService] getAssetByQr returns an asset scoped to the farm | `api/src/modules/assets/assets.service.spec.ts:70` | **PASS** |
| `API-U-028` | -- | Tài sản (AssetsService) | [AssetsService] returns not found when an asset is outside the farm or missing | `api/src/modules/assets/assets.service.spec.ts:84` | **PASS** |

#### `api/src/modules/auth/accounts/account-state.guard.spec.ts` — Xác thực — Guard trạng thái tài khoản (`PASS (4/4)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-029` | -- | Xác thực — Guard trạng thái tài khoản | [AccountStateGuard] skips public routes without loading the user | `api/src/modules/auth/accounts/account-state.guard.spec.ts:31` | **PASS** |
| `API-U-030` | -- | Xác thực — Guard trạng thái tài khoản | [AccountStateGuard] allows active users who do not need a password change | `api/src/modules/auth/accounts/account-state.guard.spec.ts:37` | **PASS** |
| `API-U-031` | -- | Xác thực — Guard trạng thái tài khoản | [AccountStateGuard] rejects inactive accounts | `api/src/modules/auth/accounts/account-state.guard.spec.ts:46` | **PASS** |
| `API-U-032` | -- | Xác thực — Guard trạng thái tài khoản | [AccountStateGuard] blocks users with an initial password outside allowed routes | `api/src/modules/auth/accounts/account-state.guard.spec.ts:53` | **PASS** |

#### `api/src/modules/auth/accounts/auth.controller.spec.ts` — Xác thực — AuthController (`PASS (1/1)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-033` | -- | Xác thực — AuthController | [AuthController] uses the verified identity and returns the application context | `api/src/modules/auth/accounts/auth.controller.spec.ts:5` | **PASS** |

#### `api/src/modules/auth/accounts/auth.service.spec.ts` — Xác thực — AuthService (Clerk/Onboarding) (`PASS (6/6)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-034` | -- | Xác thực — AuthService (Clerk/Onboarding) | [AuthService] returns null default farm when the user has no memberships | `api/src/modules/auth/accounts/auth.service.spec.ts:61` | **PASS** |
| `API-U-035` | -- | Xác thực — AuthService (Clerk/Onboarding) | [AuthService] keeps farms and their roles separate and deduplicates roles | `api/src/modules/auth/accounts/auth.service.spec.ts:80` | **PASS** |
| `API-U-036` | -- | Xác thực — AuthService (Clerk/Onboarding) | [AuthService] returns the farms of the user that sell online | `api/src/modules/auth/accounts/auth.service.spec.ts:110` | **PASS** |
| `API-U-037` | -- | Xác thực — AuthService (Clerk/Onboarding) | [AuthService] rejects inactive users before loading memberships | `api/src/modules/auth/accounts/auth.service.spec.ts:129` | **PASS** |
| `API-U-038` | -- | Xác thực — AuthService (Clerk/Onboarding) | [AuthService] returns the existing local user without calling Clerk | `api/src/modules/auth/accounts/auth.service.spec.ts:142` | **PASS** |
| `API-U-039` | -- | Xác thực — AuthService (Clerk/Onboarding) | [AuthService] upserts a Clerk user that is not yet in PostgreSQL | `api/src/modules/auth/accounts/auth.service.spec.ts:156` | **PASS** |

#### `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts` — Xác thực — ClerkAuthGuard (JWT/Origin) (`PASS (10/10)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-040` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard] skips Clerk verification for public endpoints | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:44` | **PASS** |
| `API-U-041` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard] attaches a verified Clerk session to the request | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:51` | **PASS** |
| `API-U-042` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard] rejects unauthenticated requests | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:68` | **PASS** |
| `API-U-043` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard] rejects a non-session token or token without a user ID | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:79` | **PASS** |
| `API-U-044` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard] converts Clerk verification failures into Unauthorized | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:106` | **PASS** |
| `API-U-045` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard] fails safely when allowed frontend origins are not configured | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:115` | **PASS** |
| `API-U-046` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard › authorized parties] checks a web token that carries azp | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:147` | **PASS** |
| `API-U-047` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard › authorized parties] still checks a token with a foreign azp sent without Origin | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:155` | **PASS** |
| `API-U-048` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard › authorized parties] lets a native bearer token without azp through to Clerk verification | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:163` | **PASS** |
| `API-U-049` | -- | Xác thực — ClerkAuthGuard (JWT/Origin) | [ClerkAuthGuard › authorized parties] checks cookie sessions and headers Clerk would not read as a bearer token | `api/src/modules/auth/clerk/clerk-auth.guard.spec.ts:170` | **PASS** |

#### `api/src/modules/auth/farm-access/farm-access.guard.spec.ts` — Phân quyền — FarmAccessGuard (`PASS (9/9)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-050` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] allows an active farm member to read farm data | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:50` | **PASS** |
| `API-U-051` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] rejects a user without an active farm membership | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:64` | **PASS** |
| `API-U-052` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] rejects inactive users and inactive memberships | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:73` | **PASS** |
| `API-U-053` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] rejects members of an inactive farm | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:100` | **PASS** |
| `API-U-054` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] rejects malformed farm IDs before querying the database | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:115` | **PASS** |
| `API-U-055` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] propagates unexpected database failures | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:124` | **PASS** |
| `API-U-056` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] rejects an active member without a required write role | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:142` | **PASS** |
| `API-U-057` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] requires a farm id | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:158` | **PASS** |
| `API-U-058` | -- | Phân quyền — FarmAccessGuard | [FarmAccessGuard] keeps a store-only manager out of farm-area modules and exposes roles | `api/src/modules/auth/farm-access/farm-access.guard.spec.ts:166` | **PASS** |

#### `api/src/modules/catalog/catalog.controller.spec.ts` — Danh mục (CatalogController) (`PASS (6/6)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-059` | -- | Danh mục (CatalogController) | [CatalogController] passes validated item filters to the service | `api/src/modules/catalog/catalog.controller.spec.ts:19` | **PASS** |
| `API-U-060` | -- | Danh mục (CatalogController) | [CatalogController] accepts comma-separated or repeated itemType filters | `api/src/modules/catalog/catalog.controller.spec.ts:49` | **PASS** |
| `API-U-061` | -- | Danh mục (CatalogController) | [CatalogController] requires a valid farm ID for item lists | `api/src/modules/catalog/catalog.controller.spec.ts:76` | **PASS** |
| `API-U-062` | -- | Danh mục (CatalogController) | [CatalogController] rejects invalid pagination and enum filters | `api/src/modules/catalog/catalog.controller.spec.ts:83` | **PASS** |
| `API-U-063` | -- | Danh mục (CatalogController) | [CatalogController] rejects an invalid item ID before calling the service | `api/src/modules/catalog/catalog.controller.spec.ts:93` | **PASS** |
| `API-U-064` | -- | Danh mục (CatalogController) | [CatalogController] forwards validated categoryId and excludeTrackingMode filters | `api/src/modules/catalog/catalog.controller.spec.ts:100` | **PASS** |

#### `api/src/modules/catalog/catalog.service.spec.ts` — Danh mục (CatalogService) (`PASS (7/7)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-065` | -- | Danh mục (CatalogService) | [CatalogService] lists categories and units successfully | `api/src/modules/catalog/catalog.service.spec.ts:38` | **PASS** |
| `API-U-066` | -- | Danh mục (CatalogService) | [CatalogService] returns paginated items and total count | `api/src/modules/catalog/catalog.service.spec.ts:51` | **PASS** |
| `API-U-067` | -- | Danh mục (CatalogService) | [CatalogService] returns an empty page when no items match | `api/src/modules/catalog/catalog.service.spec.ts:76` | **PASS** |
| `API-U-068` | -- | Danh mục (CatalogService) | [CatalogService] returns an item scoped to the requested farm | `api/src/modules/catalog/catalog.service.spec.ts:96` | **PASS** |
| `API-U-069` | -- | Danh mục (CatalogService) | [CatalogService] returns paginated supplier and location lookups | `api/src/modules/catalog/catalog.service.spec.ts:104` | **PASS** |
| `API-U-070` | -- | Danh mục (CatalogService) | [CatalogService] throws when the item does not exist in the farm | `api/src/modules/catalog/catalog.service.spec.ts:146` | **PASS** |
| `API-U-071` | -- | Danh mục (CatalogService) | [CatalogService] encodes the web scan URL in the item QR | `api/src/modules/catalog/catalog.service.spec.ts:155` | **PASS** |

#### `api/src/modules/dashboard/stock-valuation.spec.ts` — Dashboard — Định giá tồn kho (`PASS (12/12)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-072` | -- | Dashboard — Định giá tồn kho | [valueMoves] issues at the moving average | `api/src/modules/dashboard/stock-valuation.spec.ts:20` | **PASS** |
| `API-U-073` | -- | Dashboard — Định giá tồn kho | [valueMoves] leaves no rounding residue once the stock is gone | `api/src/modules/dashboard/stock-valuation.spec.ts:31` | **PASS** |
| `API-U-074` | -- | Dashboard — Định giá tồn kho | [valueMoves] moves the sending warehouse average with a transfer | `api/src/modules/dashboard/stock-valuation.spec.ts:41` | **PASS** |
| `API-U-075` | -- | Dashboard — Định giá tồn kho | [valueMoves] prices moves without their own price from the warehouse, then the farm | `api/src/modules/dashboard/stock-valuation.spec.ts:56` | **PASS** |
| `API-U-076` | -- | Dashboard — Định giá tồn kho | [valueMoves] flags issues from stock that has no value | `api/src/modules/dashboard/stock-valuation.spec.ts:77` | **PASS** |
| `API-U-077` | `NV09-F01` | Dashboard — Định giá tồn kho | [valueMoves] keeps unpriced units out of the average of the priced ones | `api/src/modules/dashboard/stock-valuation.spec.ts:85` | **PASS** |
| `API-U-078` | -- | Dashboard — Định giá tồn kho | [valueMoves] prices a move without its own price at the priced average | `api/src/modules/dashboard/stock-valuation.spec.ts:104` | **PASS** |
| `API-U-079` | -- | Dashboard — Định giá tồn kho | [valueMoves] values only the priced share of a receipt mixing priced and unpriced lines | `api/src/modules/dashboard/stock-valuation.spec.ts:115` | **PASS** |
| `API-U-080` | -- | Dashboard — Định giá tồn kho | [valueMoves] returns a discrepancy to the source with the value and unpriced units left in transit | `api/src/modules/dashboard/stock-valuation.spec.ts:128` | **PASS** |
| `API-U-081` | -- | Dashboard — Định giá tồn kho | [valueMoves] leaves no value on an unpriced remainder after rounding | `api/src/modules/dashboard/stock-valuation.spec.ts:144` | **PASS** |
| `API-U-082` | -- | Dashboard — Định giá tồn kho | [valueMoves] carries the unpriced part through a transfer | `api/src/modules/dashboard/stock-valuation.spec.ts:155` | **PASS** |
| `API-U-083` | -- | Dashboard — Định giá tồn kho | [moveKind] splits returns and maintenance by source | `api/src/modules/dashboard/stock-valuation.spec.ts:172` | **PASS** |

#### `api/src/modules/inventory/inventory.controller.spec.ts` — Tồn kho (InventoryController) (`PASS (7/7)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-084` | -- | Tồn kho (InventoryController) | [InventoryController transactions query] uses default pagination and passes authenticated farm filters | `api/src/modules/inventory/inventory.controller.spec.ts:24` | **PASS** |
| `API-U-085` | -- | Tồn kho (InventoryController) | [InventoryController transactions query] parses explicit filters and caps page size at 100 | `api/src/modules/inventory/inventory.controller.spec.ts:39` | **PASS** |
| `API-U-086` | -- | Tồn kho (InventoryController) | [InventoryController transactions query] passes a valid date range and rejects an inverted or invalid one | `api/src/modules/inventory/inventory.controller.spec.ts:64` | **PASS** |
| `API-U-087` | -- | Tồn kho (InventoryController) | [InventoryController transactions query] rejects an invalid UUID, transaction type, or page | `api/src/modules/inventory/inventory.controller.spec.ts:97` | **PASS** |
| `API-U-088` | -- | Tồn kho (InventoryController) | [InventoryController transactions query] validates the asset filter UUID before reading balances | `api/src/modules/inventory/inventory.controller.spec.ts:124` | **PASS** |
| `API-U-089` | -- | Tồn kho (InventoryController) | [InventoryController transactions query] validates search, tracking filters and itemIds on listBalances | `api/src/modules/inventory/inventory.controller.spec.ts:154` | **PASS** |
| `API-U-090` | -- | Tồn kho (InventoryController) | [InventoryController transactions query] validates items-summary, forecast, listLots search and getLot | `api/src/modules/inventory/inventory.controller.spec.ts:208` | **PASS** |

#### `api/src/modules/inventory/inventory.service.spec.ts` — Tồn kho (InventoryService) (`PASS (4/4)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-091` | -- | Tồn kho (InventoryService) | [InventoryService] short-circuits getItemsSummary when requested warehouse is out of scope | `api/src/modules/inventory/inventory.service.spec.ts:53` | **PASS** |
| `API-U-092` | -- | Tồn kho (InventoryService) | [InventoryService] returns grouped items summary and totals from database queries | `api/src/modules/inventory/inventory.service.spec.ts:86` | **PASS** |
| `API-U-093` | -- | Tồn kho (InventoryService) | [InventoryService] short-circuits getForecast when warehouse is outside scope and parses forecast rows | `api/src/modules/inventory/inventory.service.spec.ts:156` | **PASS** |
| `API-U-094` | -- | Tồn kho (InventoryService) | [InventoryService] gets a lot scoped to the farm or throws NotFoundException | `api/src/modules/inventory/inventory.service.spec.ts:214` | **PASS** |

#### `api/src/modules/maintenance/maintenance-dates.spec.ts` — Bảo trì — Chuẩn hóa ngày bảo trì (`PASS (3/3)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-095` | -- | Bảo trì — Chuẩn hóa ngày bảo trì | [maintenance dates in Vietnam] counts from actual local return, clamps end of month and leap years | `api/src/modules/maintenance/maintenance-dates.spec.ts:3` | **PASS** |
| `API-U-096` | -- | Bảo trì — Chuẩn hóa ngày bảo trì | [maintenance dates in Vietnam] distinguishes overdue service from overdue return at local midnight | `api/src/modules/maintenance/maintenance-dates.spec.ts:8` | **PASS** |
| `API-U-097` | -- | Bảo trì — Chuẩn hóa ngày bảo trì | rejects legacy completion and invalid intervals at API boundary | `api/src/modules/maintenance/maintenance-dates.spec.ts:38` | **PASS** |

#### `api/src/modules/materials/dto/material.dto.spec.ts` — Vật tư — Validate DTO (`PASS (3/3)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-098` | -- | Vật tư — Validate DTO | [Material DTO validation] accepts and normalizes a valid create payload | `api/src/modules/materials/dto/material.dto.spec.ts:19` | **PASS** |
| `API-U-099` | -- | Vật tư — Validate DTO | [Material DTO validation] rejects invalid tracking, decimal, and unknown material kind | `api/src/modules/materials/dto/material.dto.spec.ts:27` | **PASS** |
| `API-U-100` | -- | Vật tư — Validate DTO | [Material DTO validation] accepts null values for clearable update fields | `api/src/modules/materials/dto/material.dto.spec.ts:41` | **PASS** |

#### `api/src/modules/materials/materials.controller.spec.ts` — Vật tư (MaterialsController) (`PASS (7/7)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-101` | -- | Vật tư (MaterialsController) | [MaterialsController] creates a material in the requested farm | `api/src/modules/materials/materials.controller.spec.ts:21` | **PASS** |
| `API-U-102` | -- | Vật tư (MaterialsController) | [MaterialsController] updates a material scoped to its farm | `api/src/modules/materials/materials.controller.spec.ts:45` | **PASS** |
| `API-U-103` | -- | Vật tư (MaterialsController) | [MaterialsController] passes validated filters to the material service | `api/src/modules/materials/materials.controller.spec.ts:62` | **PASS** |
| `API-U-104` | -- | Vật tư (MaterialsController) | [MaterialsController] rejects ASSET as a material tracking mode | `api/src/modules/materials/materials.controller.spec.ts:93` | **PASS** |
| `API-U-105` | -- | Vật tư (MaterialsController) | [MaterialsController] caps the expiry window at one year | `api/src/modules/materials/materials.controller.spec.ts:106` | **PASS** |
| `API-U-106` | -- | Vật tư (MaterialsController) | [MaterialsController] rejects invalid IDs and missing farm IDs | `api/src/modules/materials/materials.controller.spec.ts:120` | **PASS** |
| `API-U-107` | -- | Vật tư (MaterialsController) | [MaterialsController] rejects invalid filters and expiry windows | `api/src/modules/materials/materials.controller.spec.ts:131` | **PASS** |

#### `api/src/modules/materials/materials.service.spec.ts` — Vật tư (MaterialsService) (`FAIL (8/10 PASS, 2 FAIL)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-108` | -- | Vật tư (MaterialsService) | [MaterialsService] rejects expiry tracking unless LOT mode is used | `api/src/modules/materials/materials.service.spec.ts:68` | **PASS** |
| `API-U-109` | -- | Vật tư (MaterialsService) | [MaterialsService] creates a material and returns the created record | `api/src/modules/materials/materials.service.spec.ts:78` | **PASS** |
| `API-U-110` | -- | Vật tư (MaterialsService) | [MaterialsService] rejects creation when a referenced category is missing | `api/src/modules/materials/materials.service.spec.ts:136` | **PASS** |
| `API-U-111` | -- | Vật tư (MaterialsService) | [MaterialsService] maps duplicate database errors to ConflictException | `api/src/modules/materials/materials.service.spec.ts:154` | **PASS** |
| `API-U-112` | -- | Vật tư (MaterialsService) | [MaterialsService] rejects an empty update | `api/src/modules/materials/materials.service.spec.ts:165` | **PASS** |
| `API-U-113` | -- | Vật tư (MaterialsService) | [MaterialsService] rejects updates for a missing material | `api/src/modules/materials/materials.service.spec.ts:171` | **PASS** |
| `API-U-114` | -- | Vật tư (MaterialsService) | [MaterialsService] updates an existing material and returns the updated record | `api/src/modules/materials/materials.service.spec.ts:179` | **PASS** |
| `API-U-115` | -- | Vật tư (MaterialsService) | [MaterialsService] returns a paginated material list and quantity | `api/src/modules/materials/materials.service.spec.ts:233` | **FAIL** — Lỗi: `Error: expect(received).resolves.toEqual(expected) // deep equality - Expected - 0 + Received + 5 @@ -11,6 +11,11 @@` |
| `API-U-116` | -- | Vật tư (MaterialsService) | [MaterialsService] returns no materials when the filtered result is empty | `api/src/modules/materials/materials.service.spec.ts:253` | **FAIL** — Lỗi: `Error: expect(received).resolves.toEqual(expected) // deep equality - Expected - 0 + Received + 5 @@ -4,6 +4,11 @@` |
| `API-U-117` | -- | Vật tư (MaterialsService) | [MaterialsService] returns expiring materials with the requested window | `api/src/modules/materials/materials.service.spec.ts:266` | **PASS** |

#### `api/src/modules/notifications/expo-push.client.spec.ts` — Thông báo — Expo Push Client (`PASS (13/13)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-118` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] posts the channel/payload with optional enhanced-security credentials and parses a ticket | `api/src/modules/notifications/expo-push.client.spec.ts:49` | **PASS** |
| `API-U-119` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] accepts a one-element ticket array but rejects an ambiguous response | `api/src/modules/notifications/expo-push.client.spec.ts:63` | **PASS** |
| `API-U-120` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] looks up the saved ticket and distinguishes a missing receipt | `api/src/modules/notifications/expo-push.client.spec.ts:79` | **PASS** |
| `API-U-121` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] keeps only known error codes, never provider text containing a private token | `api/src/modules/notifications/expo-push.client.spec.ts:89` | **PASS** |
| `API-U-122` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] retries HTTP 429 without persisting a potentially sensitive response body | `api/src/modules/notifications/expo-push.client.spec.ts:113` | **PASS** |
| `API-U-123` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] retries HTTP 500 without persisting a potentially sensitive response body | `api/src/modules/notifications/expo-push.client.spec.ts:113` | **PASS** |
| `API-U-124` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] retries HTTP 503 without persisting a potentially sensitive response body | `api/src/modules/notifications/expo-push.client.spec.ts:113` | **PASS** |
| `API-U-125` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] does not retry permanent HTTP 400 errors | `api/src/modules/notifications/expo-push.client.spec.ts:123` | **PASS** |
| `API-U-126` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] does not retry permanent HTTP 401 errors | `api/src/modules/notifications/expo-push.client.spec.ts:123` | **PASS** |
| `API-U-127` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] does not retry permanent HTTP 403 errors | `api/src/modules/notifications/expo-push.client.spec.ts:123` | **PASS** |
| `API-U-128` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] handles top-level throttling and unexpected JSON as transport failures | `api/src/modules/notifications/expo-push.client.spec.ts:133` | **PASS** |
| `API-U-129` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] classifies a network failure and a cancelled request without leaking their messages | `api/src/modules/notifications/expo-push.client.spec.ts:142` | **PASS** |
| `API-U-130` | -- | Thông báo — Expo Push Client | [Expo push HTTP client] rejects an oversized payload before any HTTP request | `api/src/modules/notifications/expo-push.client.spec.ts:155` | **PASS** |

#### `api/src/modules/notifications/notification-push.worker.spec.ts` — Thông báo — Push Worker (`PASS (2/2)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-131` | -- | Thông báo — Push Worker | [push worker lifecycle] does not schedule a worker when the flag is disabled | `api/src/modules/notifications/notification-push.worker.spec.ts:17` | **PASS** |
| `API-U-132` | -- | Thông báo — Push Worker | [push worker lifecycle] polls after bootstrap and cancels future work on application shutdown | `api/src/modules/notifications/notification-push.worker.spec.ts:30` | **PASS** |

#### `api/src/modules/payments/vietqr.spec.ts` — Thanh toán — Tạo mã VietQR (`PASS (3/3)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-133` | -- | Thanh toán — Tạo mã VietQR | [VietQR payload] computes CRC-16/CCITT-FALSE | `api/src/modules/payments/vietqr.spec.ts:11` | **PASS** |
| `API-U-134` | -- | Thanh toán — Tạo mã VietQR | [VietQR payload] encodes the NAPAS fields with correct lengths and a self-consistent CRC | `api/src/modules/payments/vietqr.spec.ts:16` | **PASS** |
| `API-U-135` | -- | Thanh toán — Tạo mã VietQR | [VietQR payload] rejects values a bank app cannot read | `api/src/modules/payments/vietqr.spec.ts:30` | **PASS** |

#### `api/src/modules/store-admin/store-admin.controller.spec.ts` — Quản trị Cửa hàng (StoreAdminController) (`PASS (2/2)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-136` | -- | Quản trị Cửa hàng (StoreAdminController) | [StoreAdminController roles] lets only ADMIN change the shared delivery fees | `api/src/modules/store-admin/store-admin.controller.spec.ts:13` | **PASS** |
| `API-U-137` | -- | Quản trị Cửa hàng (StoreAdminController) | [StoreAdminController roles] still lets FARM_OWNER configure the sales of their own farm | `api/src/modules/store-admin/store-admin.controller.spec.ts:17` | **PASS** |

#### `api/src/modules/store-admin/store-image.spec.ts` — Quản trị Cửa hàng — Validate ảnh SP (`PASS (7/7)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-138` | -- | Quản trị Cửa hàng — Validate ảnh SP | [isStoreImage] accepts JPEG | `api/src/modules/store-admin/store-image.spec.ts:6` | **PASS** |
| `API-U-139` | -- | Quản trị Cửa hàng — Validate ảnh SP | [isStoreImage] accepts PNG | `api/src/modules/store-admin/store-image.spec.ts:6` | **PASS** |
| `API-U-140` | -- | Quản trị Cửa hàng — Validate ảnh SP | [isStoreImage] accepts WebP | `api/src/modules/store-admin/store-image.spec.ts:6` | **PASS** |
| `API-U-141` | -- | Quản trị Cửa hàng — Validate ảnh SP | [isStoreImage] rejects GIF | `api/src/modules/store-admin/store-image.spec.ts:12` | **PASS** |
| `API-U-142` | -- | Quản trị Cửa hàng — Validate ảnh SP | [isStoreImage] rejects WAV in a RIFF container | `api/src/modules/store-admin/store-image.spec.ts:12` | **PASS** |
| `API-U-143` | -- | Quản trị Cửa hàng — Validate ảnh SP | [isStoreImage] rejects text | `api/src/modules/store-admin/store-image.spec.ts:12` | **PASS** |
| `API-U-144` | -- | Quản trị Cửa hàng — Validate ảnh SP | [isStoreImage] rejects empty file | `api/src/modules/store-admin/store-image.spec.ts:12` | **PASS** |

#### `api/src/modules/store-orders/store-order.rules.spec.ts` — Đơn hàng Cửa hàng — Quy tắc nghiệp vụ (`PASS (5/5)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-145` | -- | Đơn hàng Cửa hàng — Quy tắc nghiệp vụ | [Store order boundaries] keeps fractional stock steps exact without changing the sale price unit | `api/src/modules/store-orders/store-order.rules.spec.ts:18` | **PASS** |
| `API-U-146` | -- | Đơn hàng Cửa hàng — Quy tắc nghiệp vụ | [Store order boundaries] rejects amounts and stock quantities outside supported precision | `api/src/modules/store-orders/store-order.rules.spec.ts:25` | **PASS** |
| `API-U-147` | -- | Đơn hàng Cửa hàng — Quy tắc nghiệp vụ | [Store order boundaries] enforces the price maximum for both admin variant DTOs | `api/src/modules/store-orders/store-order.rules.spec.ts:34` | **PASS** |
| `API-U-148` | -- | Đơn hàng Cửa hàng — Quy tắc nghiệp vụ | [Store order boundaries] rejects duplicate variants, fractional quantities and client-supplied totals | `api/src/modules/store-orders/store-order.rules.spec.ts:47` | **PASS** |
| `API-U-149` | -- | Đơn hàng Cửa hàng — Quy tắc nghiệp vụ | [Store order boundaries] validates actual calendar dates and inclusive date ranges | `api/src/modules/store-orders/store-order.rules.spec.ts:75` | **PASS** |

#### `api/src/modules/warehouses/warehouses.controller.spec.ts` — Kho hàng (WarehousesController) (`PASS (3/3)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-150` | -- | Kho hàng (WarehousesController) | [WarehousesController] passes selected farm, authenticated subject and normalized server filters | `api/src/modules/warehouses/warehouses.controller.spec.ts:21` | **PASS** |
| `API-U-151` | -- | Kho hàng (WarehousesController) | [WarehousesController] rejects invalid IDs and query parameters before accessing the service | `api/src/modules/warehouses/warehouses.controller.spec.ts:38` | **PASS** |
| `API-U-152` | -- | Kho hàng (WarehousesController) | [WarehousesController] wraps read/create/update/deactivate responses and forwards farm scope | `api/src/modules/warehouses/warehouses.controller.spec.ts:55` | **PASS** |

#### `api/src/modules/warehouses/warehouses.service.spec.ts` — Kho hàng & Quyền (WarehousesService) (`PASS (14/14)`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-U-153` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] allows ADMIN to write | `api/src/modules/warehouses/warehouses.service.spec.ts:72` | **PASS** |
| `API-U-154` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] allows FARM_OWNER to write | `api/src/modules/warehouses/warehouses.service.spec.ts:72` | **PASS** |
| `API-U-155` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] lets a warehouse manager manage and approve only where callers opt in | `api/src/modules/warehouses/warehouses.service.spec.ts:78` | **PASS** |
| `API-U-156` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] lets employees submit but not approve; store managers do neither | `api/src/modules/warehouses/warehouses.service.spec.ts:102` | **PASS** |
| `API-U-157` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] permits guest reads, denies writes and inactive membership | `api/src/modules/warehouses/warehouses.service.spec.ts:122` | **PASS** |
| `API-U-158` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] rejects a warehouse absent from the requested farm | `api/src/modules/warehouses/warehouses.service.spec.ts:145` | **PASS** |
| `API-U-159` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] rejects empty updates | `api/src/modules/warehouses/warehouses.service.spec.ts:151` | **PASS** |
| `API-U-160` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] blocks delete when stock remains | `api/src/modules/warehouses/warehouses.service.spec.ts:157` | **PASS** |
| `API-U-161` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] blocks patch when stock remains | `api/src/modules/warehouses/warehouses.service.spec.ts:157` | **PASS** |
| `API-U-162` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] blocks deactivation with asset custody even without stock | `api/src/modules/warehouses/warehouses.service.spec.ts:174` | **PASS** |
| `API-U-163` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] soft-deactivates an eligible warehouse | `api/src/modules/warehouses/warehouses.service.spec.ts:185` | **PASS** |
| `API-U-164` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] maps real Drizzle duplicate errors for create to 409 | `api/src/modules/warehouses/warehouses.service.spec.ts:208` | **PASS** |
| `API-U-165` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] maps real Drizzle duplicate errors for update to 409 | `api/src/modules/warehouses/warehouses.service.spec.ts:208` | **PASS** |
| `API-U-166` | -- | Kho hàng & Quyền (WarehousesService) | [WarehousesService] does not turn unrelated database failures into duplicate-code errors | `api/src/modules/warehouses/warehouses.service.spec.ts:228` | **PASS** |

## 5. Chi Tiết Backend API — Config & Tooling Tests (3 File, 6 Cases: 6 PASS)

#### `api/test/jest-assets.config.test.cjs` — Cấu hình Guard Test DB — Assets (`PASS 2/2`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-C-001` | -- | Cấu hình Guard Test DB — Assets | asset tests reject missing, remote, app and query-overridden database targets | `api/test/jest-assets.config.test.cjs:26` | **PASS** |
| `API-C-002` | -- | Cấu hình Guard Test DB — Assets | asset tests replace the app URL with the explicit local test database | `api/test/jest-assets.config.test.cjs:41` | **PASS** |

#### `api/test/jest-personnel.config.test.cjs` — Cấu hình Guard Test DB — Personnel (`PASS 1/1`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-C-003` | -- | Cấu hình Guard Test DB — Personnel | personnel suites inherit the local dedicated-database safeguard | `api/test/jest-personnel.config.test.cjs:26` | **PASS** |

#### `api/test/swagger-unicode-path.test.cjs` — Swagger Plugin — Đường dẫn Unicode (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-C-004` | -- | Swagger Plugin — Đường dẫn Unicode | Swagger emits relative DTO imports in plain-project | `api/test/swagger-unicode-path.test.cjs:11` | **PASS** |
| `API-C-005` | -- | Swagger Plugin — Đường dẫn Unicode | Swagger emits relative DTO imports in Khoá Luận | `api/test/swagger-unicode-path.test.cjs:11` | **PASS** |
| `API-C-006` | -- | Swagger Plugin — Đường dẫn Unicode | Swagger emits relative DTO imports in 项目 | `api/test/swagger-unicode-path.test.cjs:11` | **PASS** |

## 6. Chi Tiết Backend API — Integration & E2E Tests (41 File, 531 Khai Báo / 754 Ca Runtime: Tất Cả BLOCKED)

> **Ghi chú đếm số lượng:** Một số file dùng `it.each(...)`, `describe.each(...)` hoặc vòng lặp `for (const ... of [...])` nên **531 khai báo `it`/`test`** sẽ bung thành **754 lượt test** khi Jest thực thi thực tế. Bảng dưới liệt kê đủ cả **531 khai báo**, đồng thời ghi rõ hệ số `(xN biến thể)` cho các dòng bung lặp.

#### `api/test/app.e2e-spec.ts` — Core App & Health Endpoints (E2E) (`BLOCKED · 4 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-001` | -- | Core App & Health Endpoints (E2E) | [AppController (e2e)] / (GET) | `api/test/app.e2e-spec.ts:25` | **BLOCKED** |
| `API-E-002` | -- | Core App & Health Endpoints (E2E) | [AppController (e2e)] /health/database (GET) reports a healthy database | `api/test/app.e2e-spec.ts:32` | **BLOCKED** |
| `API-E-003` | -- | Core App & Health Endpoints (E2E) | [AppController (e2e)] rejects protected warehouse requests without a Clerk token | `api/test/app.e2e-spec.ts:39` | **BLOCKED** |
| `API-E-004` | -- | Core App & Health Endpoints (E2E) | [AppController (e2e)] requires authentication before processing protected resource filters | `api/test/app.e2e-spec.ts:45` | **BLOCKED** |

#### `api/test/asset-transfer-requests.integration.e2e-spec.ts` — Yêu cầu luân chuyển tài sản (Integration) (`BLOCKED · 8 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-005` | -- | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] lets only employees request, marks the asset busy and notifies approvers with a push | `api/test/asset-transfer-requests.integration.e2e-spec.ts:255` | **BLOCKED** |
| `API-E-006` | -- | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] blocks other actions on the asset while the request is pending | `api/test/asset-transfer-requests.integration.e2e-spec.ts:283` | **BLOCKED** |
| `API-E-007` | -- | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] makes a concurrent maintenance request wait for the asset and see TRANSFER_PENDING | `api/test/asset-transfer-requests.integration.e2e-spec.ts:313` | **BLOCKED** |
| `API-E-008` | -- | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] never leaves both a maintenance and a transfer request pending when they race | `api/test/asset-transfer-requests.integration.e2e-spec.ts:345` | **BLOCKED** |
| `API-E-009` | -- | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] rejects invalid destinations without marking the asset | `api/test/asset-transfer-requests.integration.e2e-spec.ts:374` | **BLOCKED** |
| `API-E-010` | `P1-02` | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] dispatches on approval, waits for the destination, then receives once (P1-02) | `api/test/asset-transfer-requests.integration.e2e-spec.ts:384` | **BLOCKED** |
| `API-E-011` | -- | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] frees the asset on rejection and separates each actor’s audit history | `api/test/asset-transfer-requests.integration.e2e-spec.ts:514` | **BLOCKED** |
| `API-E-012` | -- | Yêu cầu luân chuyển tài sản (Integration) | [Asset transfer requests] shows employees only their own requests and approvers all of them | `api/test/asset-transfer-requests.integration.e2e-spec.ts:552` | **BLOCKED** |

#### `api/test/assets.integration.e2e-spec.ts` — Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý (`BLOCKED · 56 khai báo -> **82** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:assets (jest-assets.config.cjs)`
- **Nguyên nhân block:** BLOCKED — Thiếu biến môi trường `TEST_DATABASE_URL` trỏ DB PostgreSQL local `*_test` (config chủ động chặn để bảo vệ DB ứng dụng) & không có kết nối PostgreSQL trong sandbox.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-013` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] allows one concurrent return of an asset and records one movement | `api/test/assets.integration.e2e-spec.ts:657` | **BLOCKED** |
| `API-E-014` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] updates the physical location when returning to another warehouse | `api/test/assets.integration.e2e-spec.ts:672` | **BLOCKED** |
| `API-E-015` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] serves farm-scoped list, detail, exact code, and QR reads | `api/test/assets.integration.e2e-spec.ts:680` | **BLOCKED** |
| `API-E-016` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] serves paged active members, current holder, normalized history, and QR SVG | `api/test/assets.integration.e2e-spec.ts:740` | **BLOCKED** |
| `API-E-017` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] assigns, starts use, reassigns, and returns with exactly one unit moved | `api/test/assets.integration.e2e-spec.ts:816` | **BLOCKED** |
| `API-E-018` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] serializes duplicate assignment requests and moves stock only once | `api/test/assets.integration.e2e-spec.ts:923` | **BLOCKED** |
| `API-E-019` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] creates a manual ASSET atomically with one balance unit and receipt ledger | `api/test/assets.integration.e2e-spec.ts:958` | **BLOCKED** |
| `API-E-020` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] rolls back a newly created asset and balance when the ledger insert fails | `api/test/assets.integration.e2e-spec.ts:1016` | **BLOCKED** |
| `API-E-021` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] uses optimistic versions for metadata and maps unique serial conflicts to 409 | `api/test/assets.integration.e2e-spec.ts:1063` | **BLOCKED** |
| `API-E-022` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] transfers an available asset across warehouses with a balanced movement pair | `api/test/assets.integration.e2e-spec.ts:1115` | **BLOCKED** |
| `API-E-023` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] serializes concurrent physical transfers of one available asset | `api/test/assets.integration.e2e-spec.ts:1192` | **BLOCKED** |
| `API-E-024` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] allows active readers to read but rejects guests and inactive identities from returns | `api/test/assets.integration.e2e-spec.ts:1219` | **BLOCKED** |
| `API-E-025` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] validates return ids and notes before changing inventory | `api/test/assets.integration.e2e-spec.ts:1239` | **BLOCKED** |
| `API-E-026` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] requires an active receiving warehouse and a valid active location in it | `api/test/assets.integration.e2e-spec.ts:1273` | **BLOCKED** |
| `API-E-027` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] supports the legacy warehouse-only fallback only for a valid current location | `api/test/assets.integration.e2e-spec.ts:1294` | **BLOCKED** |
| `API-E-028` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] marks eligible assets available, moves their location, closes assignments, and writes one ledger row | `api/test/assets.integration.e2e-spec.ts:1326` | **BLOCKED** |
| `API-E-029` | `P0-03` | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] keeps a damaged return in stock but out of use until it is retired (P0-03) | `api/test/assets.integration.e2e-spec.ts:1374` | **BLOCKED** |
| `API-E-030` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] rejects sequential duplicate returns and returns only ASSIGNED or IN_USE assets | `api/test/assets.integration.e2e-spec.ts:1402` | **BLOCKED** |
| `API-E-031` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] serializes different asset returns sharing %s **(x2 biến thể)** | `api/test/assets.integration.e2e-spec.ts:1418` | **BLOCKED** |
| `API-E-032` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] rolls back a new balance, assignment, asset update, and ledger when ledger insertion fails | `api/test/assets.integration.e2e-spec.ts:1443` | **BLOCKED** |
| `API-E-033` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] serializes a competing issue confirmation and return without partial movement | `api/test/assets.integration.e2e-spec.ts:1475` | **BLOCKED** |
| `API-E-034` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] runs confirmed receipt, issue, return to a new location, and reissue over HTTP | `api/test/assets.integration.e2e-spec.ts:1507` | **BLOCKED** |
| `API-E-035` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] rejects %s confirmation after maintenance was scheduled without moving stock **(x3 biến thể)** | `api/test/assets.integration.e2e-spec.ts:1562` | **BLOCKED** |
| `API-E-036` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] rejects ASSET lines in %s creates, edits and legacy confirmations atomically **(x2 biến thể)** | `api/test/assets.integration.e2e-spec.ts:1587` | **BLOCKED** |
| `API-E-037` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] maintains an issued asset without inventing a holder or deducting inventory twice | `api/test/assets.integration.e2e-spec.ts:1619` | **BLOCKED** |
| `API-E-038` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] can repeat maintenance only after approved receipt and cannot cancel an external repair | `api/test/assets.integration.e2e-spec.ts:1674` | **BLOCKED** |
| `API-E-039` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] still rejects an ASSIGNED asset with no active assignment when starting maintenance | `api/test/assets.integration.e2e-spec.ts:1703` | **BLOCKED** |
| `API-E-040` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency] serializes maintenance start against stock issue confirmation without a second debit | `api/test/assets.integration.e2e-spec.ts:1713` | **BLOCKED** |
| `API-E-041` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2–3 write boundaries] rejects readers, inactive identities and non-members on every lifecycle write | `api/test/assets.integration.e2e-spec.ts:1744` | **BLOCKED** |
| `API-E-042` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2–3 write boundaries] does not expose or mutate a foreign asset through any lifecycle write | `api/test/assets.integration.e2e-spec.ts:1759` | **BLOCKED** |
| `API-E-043` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2–3 write boundaries] validates lifecycle payloads before creating records or moving stock | `api/test/assets.integration.e2e-spec.ts:1767` | **BLOCKED** |
| `API-E-044` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2–3 write boundaries] rejects unavailable source inventory and locations for %s without partial writes **(x4 biến thể)** | `api/test/assets.integration.e2e-spec.ts:1810` | **BLOCKED** |
| `API-E-045` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] requires an active assignee and destination within the selected farm | `api/test/assets.integration.e2e-spec.ts:1851` | **BLOCKED** |
| `API-E-046` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] assigns an issued asset without a holder without a second inventory debit | `api/test/assets.integration.e2e-spec.ts:1890` | **BLOCKED** |
| `API-E-047` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] allows only one concurrent start-use and requires an active assignment | `api/test/assets.integration.e2e-spec.ts:1907` | **BLOCKED** |
| `API-E-048` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] serializes assignments of different assets competing for the last stock unit | `api/test/assets.integration.e2e-spec.ts:1940` | **BLOCKED** |
| `API-E-049` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] rejects invalid receiving warehouse/location pairs without creating a destination balance | `api/test/assets.integration.e2e-spec.ts:1967` | **BLOCKED** |
| `API-E-050` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] requires available assets for physical transfer and blocks terminal lifecycle actions | `api/test/assets.integration.e2e-spec.ts:1984` | **BLOCKED** |
| `API-E-051` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] serializes opposite warehouse transfers without deadlocks or balance drift | `api/test/assets.integration.e2e-spec.ts:2014` | **BLOCKED** |
| `API-E-052` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] serializes a stock issue competing with dedicated asset transfer | `api/test/assets.integration.e2e-spec.ts:2045` | **BLOCKED** |
| `API-E-053` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] blocks %s until scheduled maintenance is cancelled **(x4 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2068` | **BLOCKED** |
| `API-E-054` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] rolls back %s completely if its audit write fails **(x5 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2096` | **BLOCKED** |
| `API-E-055` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 2 assignment and dedicated transfer acceptance] rolls back a receipt completely (balance, location, status, request) if its movement fails | `api/test/assets.integration.e2e-spec.ts:2138` | **BLOCKED** |
| `API-E-056` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] records %s without changing the holder, asset or inventory **(x2 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2168` | **BLOCKED** |
| `API-E-057` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] closing an in-stock loss as %s never receives inventory; explicit recovery does **(x2 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2188` | **BLOCKED** |
| `API-E-058` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] reports loss from %s without debiting available inventory twice **(x3 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2237` | **BLOCKED** |
| `API-E-059` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] requires matching asset and farm for incident transitions, and rejects repeated transitions | `api/test/assets.integration.e2e-spec.ts:2267` | **BLOCKED** |
| `API-E-060` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] serializes competing incident closure requests and audits only the accepted transition | `api/test/assets.integration.e2e-spec.ts:2305` | **BLOCKED** |
| `API-E-061` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] validates recovery destinations and receives once into an existing balance | `api/test/assets.integration.e2e-spec.ts:2331` | **BLOCKED** |
| `API-E-062` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] serializes concurrent recovery into different new balances and preserves the open loss report | `api/test/assets.integration.e2e-spec.ts:2364` | **BLOCKED** |
| `API-E-063` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] serializes duplicate concurrent %s requests with only one stock debit **(x2 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2387` | **BLOCKED** |
| `API-E-064` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] serializes loss against retirement without a double debit or partial incident | `api/test/assets.integration.e2e-spec.ts:2431` | **BLOCKED** |
| `API-E-065` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] blocks loss and retirement during %s maintenance **(x2 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2451` | **BLOCKED** |
| `API-E-066` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] rejects retirement while assigned or in use without changing the active holder | `api/test/assets.integration.e2e-spec.ts:2469` | **BLOCKED** |
| `API-E-067` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] rolls back %s and its balance, holder, incident and audit if the ledger fails **(x3 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2489` | **BLOCKED** |
| `API-E-068` | -- | Vòng đời Tài sản, Giao/Trả/Mất/Thu hồi/Thanh lý | [Asset HTTP and PostgreSQL consistency › Phase 3 incidents, recovery and retirement acceptance] rolls back %s including previously inserted movements if the audit fails **(x5 biến thể)** | `api/test/assets.integration.e2e-spec.ts:2519` | **BLOCKED** |

#### `api/test/catalog-management.integration.e2e-spec.ts` — Quản lý Danh mục & Quy đổi (Integration) (`BLOCKED · 8 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-069` | -- | Quản lý Danh mục & Quy đổi (Integration) | [Catalog management (migrated PostgreSQL, real farm guard)] lets farm managers create, rename and deactivate suppliers | `api/test/catalog-management.integration.e2e-spec.ts:164` | **BLOCKED** |
| `API-E-070` | -- | Quản lý Danh mục & Quy đổi (Integration) | [Catalog management (migrated PostgreSQL, real farm guard)] forbids employees from writing farm reference data | `api/test/catalog-management.integration.e2e-spec.ts:204` | **BLOCKED** |
| `API-E-071` | -- | Quản lý Danh mục & Quy đổi (Integration) | [Catalog management (migrated PostgreSQL, real farm guard)] keeps supplier edits inside the requested farm | `api/test/catalog-management.integration.e2e-spec.ts:217` | **BLOCKED** |
| `API-E-072` | -- | Quản lý Danh mục & Quy đổi (Integration) | [Catalog management (migrated PostgreSQL, real farm guard)] only links locations to active warehouses of the same farm | `api/test/catalog-management.integration.e2e-spec.ts:230` | **BLOCKED** |
| `API-E-073` | -- | Quản lý Danh mục & Quy đổi (Integration) | [Catalog management (migrated PostgreSQL, real farm guard)] keeps locations that hold assets in their warehouse and active | `api/test/catalog-management.integration.e2e-spec.ts:270` | **BLOCKED** |
| `API-E-074` | -- | Quản lý Danh mục & Quy đổi (Integration) | [Catalog management (migrated PostgreSQL, real farm guard)] lets warehouse managers create and edit equipment/tool templates without stock (AC25) | `api/test/catalog-management.integration.e2e-spec.ts:330` | **BLOCKED** |
| `API-E-075` | -- | Quản lý Danh mục & Quy đổi (Integration) | [Catalog management (migrated PostgreSQL, real farm guard)] locks the tracking mode once a balance or a stock document line exists | `api/test/catalog-management.integration.e2e-spec.ts:479` | **BLOCKED** |
| `API-E-076` | -- | Quản lý Danh mục & Quy đổi (Integration) | [Catalog management (migrated PostgreSQL, real farm guard)] restricts shared categories and units to ADMIN | `api/test/catalog-management.integration.e2e-spec.ts:525` | **BLOCKED** |

#### `api/test/commerce.e2e-spec.ts` — Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) (`BLOCKED · 11 khai báo -> **31** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Sandbox Windows chặn bind/connect socket TCP loopback (`connect EACCES 127.0.0.1:<port>`) khi Supertest khởi tạo HTTP test server (logic service đã mock).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-077` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] returns public %s with the default pagination **(x2 biến thể)** | `api/test/commerce.e2e-spec.ts:88` | **BLOCKED** |
| `API-E-078` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] passes all validated filters and pagination to the service | `api/test/commerce.e2e-spec.ts:114` | **BLOCKED** |
| `API-E-079` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] caps page size and accepts the maximum safe price bound | `api/test/commerce.e2e-spec.ts:141` | **BLOCKED** |
| `API-E-080` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] rejects invalid pagination for %s **(x2 biến thể)** | `api/test/commerce.e2e-spec.ts:151` | **BLOCKED** |
| `API-E-081` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] rejects invalid filters: %s **(x16 biến thể)** | `api/test/commerce.e2e-spec.ts:176` | **BLOCKED** |
| `API-E-082` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] rejects invalid %s values **(x2 biến thể)** | `api/test/commerce.e2e-spec.ts:200` | **BLOCKED** |
| `API-E-083` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] rejects reversed bounds before calling the service | `api/test/commerce.e2e-spec.ts:234` | **BLOCKED** |
| `API-E-084` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] awaits product details and preserves the response envelope | `api/test/commerce.e2e-spec.ts:244` | **BLOCKED** |
| `API-E-085` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] passes a valid region and quantity and rejects others | `api/test/commerce.e2e-spec.ts:253` | **BLOCKED** |
| `API-E-086` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] propagates missing products and unavailable warehouse errors | `api/test/commerce.e2e-spec.ts:271` | **BLOCKED** |
| `API-E-087` | -- | Cửa hàng công khai — Validation & Auth Guard (Mock HTTP) | [Commerce HTTP contract] keeps the internal /%s API protected **(x3 biến thể)** | `api/test/commerce.e2e-spec.ts:286` | **BLOCKED** |

#### `api/test/commerce.integration.e2e-spec.ts` — Cửa hàng công khai — Truy vấn & Lọc SP (PG) (`BLOCKED · 14 khai báo -> **26** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:db (jest-db.json) / test:e2e`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-088` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] combines filters and keeps stable totals across pages: %s **(x2 biến thể)** | `api/test/commerce.integration.e2e-spec.ts:130` | **BLOCKED** |
| `API-E-089` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] groups variants, selects the first image and filters on the displayed price | `api/test/commerce.integration.e2e-spec.ts:173` | **BLOCKED** |
| `API-E-090` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] matches literal keyword %j **(x4 biến thể)** | `api/test/commerce.integration.e2e-spec.ts:243` | **BLOCKED** |
| `API-E-091` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] preserves accent sensitivity, zero price and numeric price ordering | `api/test/commerce.integration.e2e-spec.ts:253` | **BLOCKED** |
| `API-E-092` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] hides an ineligible product: %s **(x6 biến thể)** | `api/test/commerce.integration.e2e-spec.ts:289` | **BLOCKED** |
| `API-E-093` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] requires enough quantity in the sales warehouse for one quantity step | `api/test/commerce.integration.e2e-spec.ts:325` | **BLOCKED** |
| `API-E-094` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] excludes expired lots and includes lots expiring today | `api/test/commerce.integration.e2e-spec.ts:357` | **BLOCKED** |
| `API-E-095` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] requires an AVAILABLE asset in the sales warehouse and a matching balance | `api/test/commerce.integration.e2e-spec.ts:407` | **BLOCKED** |
| `API-E-096` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] limits extras to page IDs, skips them on empty pages and keeps count lightweight | `api/test/commerce.integration.e2e-spec.ts:458` | **BLOCKED** |
| `API-E-097` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] hides products of a farm that does not sell online: %s **(x4 biến thể)** | `api/test/commerce.integration.e2e-spec.ts:492` | **BLOCKED** |
| `API-E-098` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] rejects unsafe prices and invalid pagination before issuing queries | `api/test/commerce.integration.e2e-spec.ts:524` | **BLOCKED** |
| `API-E-099` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] reads and paginates storefront categories from the database | `api/test/commerce.integration.e2e-spec.ts:546` | **BLOCKED** |
| `API-E-100` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] filters products by inStock globally and within a delivery region | `api/test/commerce.integration.e2e-spec.ts:566` | **BLOCKED** |
| `API-E-101` | -- | Cửa hàng công khai — Truy vấn & Lọc SP (PG) | [Commerce products (migrated PostgreSQL)] resolves variant item metadata from the farm serving the delivery region and stock | `api/test/commerce.integration.e2e-spec.ts:601` | **BLOCKED** |

#### `api/test/dashboard-reports.integration.e2e-spec.ts` — Báo cáo Dashboard & Phạm vi quyền (PG) (`BLOCKED · 4 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-102` | -- | Báo cáo Dashboard & Phạm vi quyền (PG) | [Dashboard timeseries and stock report (migrated PostgreSQL)] values stock in/out at the moving average and adds costs per period | `api/test/dashboard-reports.integration.e2e-spec.ts:174` | **BLOCKED** |
| `API-E-103` | -- | Báo cáo Dashboard & Phạm vi quyền (PG) | [Dashboard timeseries and stock report (migrated PostgreSQL)] counts a dispatched transfer as outbound before the destination receives it | `api/test/dashboard-reports.integration.e2e-spec.ts:309` | **BLOCKED** |
| `API-E-104` | -- | Báo cáo Dashboard & Phạm vi quyền (PG) | [Dashboard timeseries and stock report (migrated PostgreSQL)] reports opening, movements and closing per item and warehouse | `api/test/dashboard-reports.integration.e2e-spec.ts:352` | **BLOCKED** |
| `API-E-105` | -- | Báo cáo Dashboard & Phạm vi quyền (PG) | [Dashboard timeseries and stock report (migrated PostgreSQL)] shows the report closing value on the dashboard card (AC27) | `api/test/dashboard-reports.integration.e2e-spec.ts:445` | **BLOCKED** |

#### `api/test/dashboard.integration.e2e-spec.ts` — Dashboard — Tổng hợp cảnh báo tồn/hết hạn (PG) (`BLOCKED · 1 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-106` | -- | Dashboard — Tổng hợp cảnh báo tồn/hết hạn (PG) | [Dashboard summary (migrated PostgreSQL)] computes stock value at the moving average from the ledger and counts alerts | `api/test/dashboard.integration.e2e-spec.ts:19` | **BLOCKED** |

#### `api/test/database.e2e-spec.ts` — PostgreSQL Schema, Trigger & Ràng buộc DB (`BLOCKED · 12 test case`)

- **Runner:** `pnpm --dir api test:db (jest-db.json) / test:e2e`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-107` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] has the expected functions and triggers installed | `api/test/database.e2e-spec.ts:150` | **BLOCKED** |
| `API-E-108` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] enforces item uniqueness and nonnegative constraints | `api/test/database.e2e-spec.ts:210` | **BLOCKED** |
| `API-E-109` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] supports a material item CRUD lifecycle at database level | `api/test/database.e2e-spec.ts:223` | **BLOCKED** |
| `API-E-110` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] supports an asset CRUD lifecycle at database level | `api/test/database.e2e-spec.ts:265` | **BLOCKED** |
| `API-E-111` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] enforces asset assignment, incident, and maintenance state rules | `api/test/database.e2e-spec.ts:307` | **BLOCKED** |
| `API-E-112` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] enforces lot, inventory balance, and transaction quantity rules | `api/test/database.e2e-spec.ts:359` | **BLOCKED** |
| `API-E-113` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] rejects material profiles with an invalid farm, item type, or expiry mode | `api/test/database.e2e-spec.ts:397` | **BLOCKED** |
| `API-E-114` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] protects an expiry-tracked material when its item changes | `api/test/database.e2e-spec.ts:423` | **BLOCKED** |
| `API-E-115` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] updates material profile timestamps through its trigger | `api/test/database.e2e-spec.ts:436` | **BLOCKED** |
| `API-E-116` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] enforces asset farm, item tracking, and location scope | `api/test/database.e2e-spec.ts:448` | **BLOCKED** |
| `API-E-117` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] enforces assignment, incident, and maintenance farm scope | `api/test/database.e2e-spec.ts:469` | **BLOCKED** |
| `API-E-118` | -- | PostgreSQL Schema, Trigger & Ràng buộc DB | [PostgreSQL schema, constraints, functions and triggers] rolls back a failed write without leaving partial data | `api/test/database.e2e-spec.ts:493` | **BLOCKED** |

#### `api/test/inventory-adjustments.integration.e2e-spec.ts` — Điều chỉnh tồn kho & Phê duyệt 2 người (PG) (`BLOCKED · 20 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-119` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] applies positive and negative decimal strings and stores one matching ledger row each | `api/test/inventory-adjustments.integration.e2e-spec.ts:533` | **BLOCKED** |
| `API-E-120` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] keeps the receipt, issue, adjustment, balance, and ledger views in sync | `api/test/inventory-adjustments.integration.e2e-spec.ts:564` | **BLOCKED** |
| `API-E-121` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] only lets expired lots and inactive items be decreased, and rejects invalid tracking combinations | `api/test/inventory-adjustments.integration.e2e-spec.ts:684` | **BLOCKED** |
| `API-E-122` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] rejects malformed, zero, out-of-range, and invalid-reason input | `api/test/inventory-adjustments.integration.e2e-spec.ts:743` | **BLOCKED** |
| `API-E-123` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] accepts the numeric precision boundary and a 4000-character note | `api/test/inventory-adjustments.integration.e2e-spec.ts:772` | **BLOCKED** |
| `API-E-124` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] rejects insufficient stock and maps numeric overflow without a ledger row | `api/test/inventory-adjustments.integration.e2e-spec.ts:785` | **BLOCKED** |
| `API-E-125` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] requires an active owner or employee role for writes | `api/test/inventory-adjustments.integration.e2e-spec.ts:800` | **BLOCKED** |
| `API-E-126` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] serializes concurrent decrements and never lets the balance become negative | `api/test/inventory-adjustments.integration.e2e-spec.ts:829` | **BLOCKED** |
| `API-E-127` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] preserves concurrent positive updates to an existing balance | `api/test/inventory-adjustments.integration.e2e-spec.ts:844` | **BLOCKED** |
| `API-E-128` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] creates one balance when positive updates race on a missing row | `api/test/inventory-adjustments.integration.e2e-spec.ts:859` | **BLOCKED** |
| `API-E-129` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] rolls back the adjustment, balance and ledger when a later step fails | `api/test/inventory-adjustments.integration.e2e-spec.ts:875` | **BLOCKED** |
| `API-E-130` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] replays a retried idempotency key instead of adjusting twice | `api/test/inventory-adjustments.integration.e2e-spec.ts:902` | **BLOCKED** |
| `API-E-131` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] applies a concurrent retry of the same key exactly once | `api/test/inventory-adjustments.integration.e2e-spec.ts:923` | **BLOCKED** |
| `API-E-132` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] keeps employee reports pending until their warehouse manager approves them | `api/test/inventory-adjustments.integration.e2e-spec.ts:938` | **BLOCKED** |
| `API-E-133` | `P0-01` | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] never applies an approver own adjustment without a second person (P0-01) | `api/test/inventory-adjustments.integration.e2e-spec.ts:996` | **BLOCKED** |
| `API-E-134` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] applies a pending approval at most once under concurrent clicks | `api/test/inventory-adjustments.integration.e2e-spec.ts:1010` | **BLOCKED** |
| `API-E-135` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] rejects pending adjustments without touching stock | `api/test/inventory-adjustments.integration.e2e-spec.ts:1024` | **BLOCKED** |
| `API-E-136` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] re-checks stock at approval and leaves the request pending when it no longer fits | `api/test/inventory-adjustments.integration.e2e-spec.ts:1048` | **BLOCKED** |
| `API-E-137` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] filters the adjustment list by warehouse, item and requester | `api/test/inventory-adjustments.integration.e2e-spec.ts:1071` | **BLOCKED** |
| `API-E-138` | -- | Điều chỉnh tồn kho & Phê duyệt 2 người (PG) | [Inventory adjustment HTTP and PostgreSQL contract] blocks employees and warehouse managers from reporting or reviewing outside their warehouses | `api/test/inventory-adjustments.integration.e2e-spec.ts:1127` | **BLOCKED** |

#### `api/test/inventory-ledger.integration.e2e-spec.ts` — Sổ cái Tồn kho / Inventory Ledger (PG) (`BLOCKED · 4 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-139` | -- | Sổ cái Tồn kho / Inventory Ledger (PG) | [Inventory ledger HTTP and PostgreSQL contract] returns a complete joined ledger with source codes and exact decimal strings | `api/test/inventory-ledger.integration.e2e-spec.ts:542` | **BLOCKED** |
| `API-E-140` | -- | Sổ cái Tồn kho / Inventory Ledger (PG) | [Inventory ledger HTTP and PostgreSQL contract] filters independently and together, paginates, and rejects invalid queries | `api/test/inventory-ledger.integration.e2e-spec.ts:658` | **BLOCKED** |
| `API-E-141` | -- | Sổ cái Tồn kho / Inventory Ledger (PG) | [Inventory ledger HTTP and PostgreSQL contract] scopes farms and allows active guest members to read without leaking other-farm rows | `api/test/inventory-ledger.integration.e2e-spec.ts:734` | **BLOCKED** |
| `API-E-142` | -- | Sổ cái Tồn kho / Inventory Ledger (PG) | [Inventory ledger HTTP and PostgreSQL contract] shows confirmed receipt and issue movements beside the resulting balance | `api/test/inventory-ledger.integration.e2e-spec.ts:759` | **BLOCKED** |

#### `api/test/inventory.integration.e2e-spec.ts` — Truy vấn Tồn kho, Lô & Hạn dùng (PG) (`BLOCKED · 6 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-143` | -- | Truy vấn Tồn kho, Lô & Hạn dùng (PG) | [Current inventory HTTP and PostgreSQL contract] returns a QR image and preserves farm isolation | `api/test/inventory.integration.e2e-spec.ts:276` | **BLOCKED** |
| `API-E-144` | -- | Truy vấn Tồn kho, Lô & Hạn dùng (PG) | [Current inventory HTTP and PostgreSQL contract] returns only positive balances with a nested exact-string read model | `api/test/inventory.integration.e2e-spec.ts:305` | **BLOCKED** |
| `API-E-145` | -- | Truy vấn Tồn kho, Lô & Hạn dùng (PG) | [Current inventory HTTP and PostgreSQL contract] orders separate LOT balances by expiry and leaves undated lots last | `api/test/inventory.integration.e2e-spec.ts:340` | **BLOCKED** |
| `API-E-146` | -- | Truy vấn Tồn kho, Lô & Hạn dùng (PG) | [Current inventory HTTP and PostgreSQL contract] combines all filters and returns empty for valid but unknown farm rows | `api/test/inventory.integration.e2e-spec.ts:364` | **BLOCKED** |
| `API-E-147` | -- | Truy vấn Tồn kho, Lô & Hạn dùng (PG) | [Current inventory HTTP and PostgreSQL contract] paginates, caps page size, and rejects malformed page parameters | `api/test/inventory.integration.e2e-spec.ts:416` | **BLOCKED** |
| `API-E-148` | -- | Truy vấn Tồn kho, Lô & Hạn dùng (PG) | [Current inventory HTTP and PostgreSQL contract] scopes farm rows and allows active guest members to read balances | `api/test/inventory.integration.e2e-spec.ts:444` | **BLOCKED** |

#### `api/test/maintenance-requests.integration.e2e-spec.ts` — Yêu cầu bảo trì từ nhân viên (Integration) (`BLOCKED · 7 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-149` | -- | Yêu cầu bảo trì từ nhân viên (Integration) | [Maintenance requests] lets only employees request maintenance and notifies approvers with a push | `api/test/maintenance-requests.integration.e2e-spec.ts:203` | **BLOCKED** |
| `API-E-150` | -- | Yêu cầu bảo trì từ nhân viên (Integration) | [Maintenance requests] rejects ineligible assets and a second pending request for the same asset | `api/test/maintenance-requests.integration.e2e-spec.ts:231` | **BLOCKED** |
| `API-E-151` | -- | Yêu cầu bảo trì từ nhân viên (Integration) | [Maintenance requests] refuses a request while the asset already has scheduled maintenance | `api/test/maintenance-requests.integration.e2e-spec.ts:244` | **BLOCKED** |
| `API-E-152` | -- | Yêu cầu bảo trì từ nhân viên (Integration) | [Maintenance requests] schedules maintenance on approval and tells the requester | `api/test/maintenance-requests.integration.e2e-spec.ts:254` | **BLOCKED** |
| `API-E-153` | -- | Yêu cầu bảo trì từ nhân viên (Integration) | [Maintenance requests] approving while another request is created for the same asset neither deadlocks nor duplicates | `api/test/maintenance-requests.integration.e2e-spec.ts:300` | **BLOCKED** |
| `API-E-154` | -- | Yêu cầu bảo trì từ nhân viên (Integration) | [Maintenance requests] rejects with a reason and separates each actor’s audit history | `api/test/maintenance-requests.integration.e2e-spec.ts:323` | **BLOCKED** |
| `API-E-155` | -- | Yêu cầu bảo trì từ nhân viên (Integration) | [Maintenance requests] shows employees only their own requests and approvers all of them | `api/test/maintenance-requests.integration.e2e-spec.ts:364` | **BLOCKED** |

#### `api/test/maintenance-workflow.integration.e2e-spec.ts` — Quy trình Bảo trì tài sản & Nhập trả (PG) (`BLOCKED · 25 khai báo -> **28** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:maintenance (jest-maintenance.config.cjs)`
- **Nguyên nhân block:** BLOCKED — Config bắt buộc `DATABASE_URL` trỏ PostgreSQL local `*_test` (`Maintenance tests require a local _test database`).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-156` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] filters one asset without exposing aggregate stock or assets outside the warehouse | `api/test/maintenance-workflow.integration.e2e-spec.ts:276` | **BLOCKED** |
| `API-E-157` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] filters scheduled dates by inclusive Vietnam calendar days before pagination | `api/test/maintenance-workflow.integration.e2e-spec.ts:379` | **BLOCKED** |
| `API-E-158` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] denies a maintenance-only member stock creation, approval and rejection | `api/test/maintenance-workflow.integration.e2e-spec.ts:399` | **BLOCKED** |
| `API-E-159` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] rejects a return date before the scheduled date without changing the record | `api/test/maintenance-workflow.integration.e2e-spec.ts:427` | **BLOCKED** |
| `API-E-160` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] blocks loss and recovery while %s maintenance has no confirmed return **(x3 biến thể)** | `api/test/maintenance-workflow.integration.e2e-spec.ts:444` | **BLOCKED** |
| `API-E-161` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] keeps failed stock quarantined after cancelling a retry and permits normal loss only after repair | `api/test/maintenance-workflow.integration.e2e-spec.ts:499` | **BLOCKED** |
| `API-E-162` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] closes legacy assignments on %s receipt approval **(x2 biến thể)** | `api/test/maintenance-workflow.integration.e2e-spec.ts:574` | **BLOCKED** |
| `API-E-163` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] does not catch up stale asset pushes during quarantine or an unconfirmed return | `api/test/maintenance-workflow.integration.e2e-spec.ts:636` | **BLOCKED** |
| `API-E-164` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] notifies maintenance staff and the warehouse at each step and still allows rescheduling | `api/test/maintenance-workflow.integration.e2e-spec.ts:708` | **BLOCKED** |
| `API-E-165` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] keeps maintenance notifications inside the warehouses of staff who also hold a warehouse role | `api/test/maintenance-workflow.integration.e2e-spec.ts:740` | **BLOCKED** |
| `API-E-166` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] enforces duties, keeps original asset, adds stock once under concurrent approval | `api/test/maintenance-workflow.integration.e2e-spec.ts:778` | **BLOCKED** |
| `API-E-167` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] keeps failed assets blocked, preserves old due date and permits repair after receipt | `api/test/maintenance-workflow.integration.e2e-spec.ts:880` | **BLOCKED** |
| `API-E-168` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] lets only one of two concurrent warehouse confirmations issue the asset (AC10) | `api/test/maintenance-workflow.integration.e2e-spec.ts:901` | **BLOCKED** |
| `API-E-169` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] has the source warehouse confirm a field asset without a second debit (AC10) | `api/test/maintenance-workflow.integration.e2e-spec.ts:919` | **BLOCKED** |
| `API-E-170` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] lets a coordinator who also holds a warehouse role confirm the issue | `api/test/maintenance-workflow.integration.e2e-spec.ts:983` | **BLOCKED** |
| `API-E-171` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] retires a failed repair received back exactly once, never via AVAILABLE (AC12, AC28) | `api/test/maintenance-workflow.integration.e2e-spec.ts:1012` | **BLOCKED** |
| `API-E-172` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] lets an older received failure authorise retirement only while no retry is open | `api/test/maintenance-workflow.integration.e2e-spec.ts:1074` | **BLOCKED** |
| `API-E-173` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] serializes retirement against scheduling a retry: exactly one wins | `api/test/maintenance-workflow.integration.e2e-spec.ts:1101` | **BLOCKED** |
| `API-E-174` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] does not retire a maintenance asset without a received failed repair | `api/test/maintenance-workflow.integration.e2e-spec.ts:1127` | **BLOCKED** |
| `API-E-175` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] rejects invalid destination, allows rejection/resubmission and audits both decisions | `api/test/maintenance-workflow.integration.e2e-spec.ts:1138` | **BLOCKED** |
| `API-E-176` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] rolls back stock, receipt and notifications when audit fails | `api/test/maintenance-workflow.integration.e2e-spec.ts:1172` | **BLOCKED** |
| `API-E-177` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] disallows cancellation outside the farm or after sending; validates reception and inspection | `api/test/maintenance-workflow.integration.e2e-spec.ts:1217` | **BLOCKED** |
| `API-E-178` | -- | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] deduplicates reminders, queues push, stops old milestones after rescheduling and sending | `api/test/maintenance-workflow.integration.e2e-spec.ts:1239` | **BLOCKED** |
| `API-E-179` | `P1-05` | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] assigns only maintenance-capable members and keeps staff off jobs of others (P1-05) | `api/test/maintenance-workflow.integration.e2e-spec.ts:1331` | **BLOCKED** |
| `API-E-180` | `P1-05` | Quy trình Bảo trì tài sản & Nhập trả (PG) | [External maintenance, inspection and warehouse receipt] lets staff schedule only for themselves and keeps scoped managers to their warehouses (P1-05) | `api/test/maintenance-workflow.integration.e2e-spec.ts:1404` | **BLOCKED** |

#### `api/test/materials.integration.e2e-spec.ts` — Quản lý Vật tư & Hồ sơ hạn dùng (PG) (`BLOCKED · 6 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-181` | -- | Quản lý Vật tư & Hồ sơ hạn dùng (PG) | [Materials HTTP contract with local PostgreSQL] creates a material, retains decimal precision and returns the detail envelope | `api/test/materials.integration.e2e-spec.ts:162` | **BLOCKED** |
| `API-E-182` | -- | Quản lý Vật tư & Hồ sơ hạn dùng (PG) | [Materials HTTP contract with local PostgreSQL] reads detail and lists using server search, filters and pagination | `api/test/materials.integration.e2e-spec.ts:178` | **BLOCKED** |
| `API-E-183` | -- | Quản lý Vật tư & Hồ sơ hạn dùng (PG) | [Materials HTTP contract with local PostgreSQL] PATCH changes only supplied fields and clears nullable values | `api/test/materials.integration.e2e-spec.ts:211` | **BLOCKED** |
| `API-E-184` | -- | Quản lý Vật tư & Hồ sơ hạn dùng (PG) | [Materials HTTP contract with local PostgreSQL] rejects duplicate codes, invalid tracking/expiry and wrong request fields | `api/test/materials.integration.e2e-spec.ts:230` | **BLOCKED** |
| `API-E-185` | -- | Quản lý Vật tư & Hồ sơ hạn dùng (PG) | [Materials HTTP contract with local PostgreSQL] allows guest reads but denies writes and cross-farm material IDs | `api/test/materials.integration.e2e-spec.ts:253` | **BLOCKED** |
| `API-E-186` | -- | Quản lý Vật tư & Hồ sơ hạn dùng (PG) | [Materials HTTP contract with local PostgreSQL] returns a second page from actual rows and rejects tracking changes with lots | `api/test/materials.integration.e2e-spec.ts:283` | **BLOCKED** |

#### `api/test/notification-devices.integration.e2e-spec.ts` — Thiết bị nhận Thông báo Push (PG) (`BLOCKED · 17 khai báo -> **23** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-187` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] registers the authenticated user, hides the Expo token and creates no notifications or jobs | `api/test/notification-devices.integration.e2e-spec.ts:230` | **BLOCKED** |
| `API-E-188` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] accepts the %s prefix **(x2 biến thể)** | `api/test/notification-devices.integration.e2e-spec.ts:257` | **BLOCKED** |
| `API-E-189` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] refreshes the same registration without duplicate rows or cancelling its jobs | `api/test/notification-devices.integration.e2e-spec.ts:266` | **BLOCKED** |
| `API-E-190` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] rotates a token in place and cancels only unfinished deliveries | `api/test/notification-devices.integration.e2e-spec.ts:290` | **BLOCKED** |
| `API-E-191` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] reassigns a shared installation to B, retains notifications and leaves other devices untouched | `api/test/notification-devices.integration.e2e-spec.ts:306` | **BLOCKED** |
| `API-E-192` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] unregisters idempotently, preserves notifications and can reactivate the same device | `api/test/notification-devices.integration.e2e-spec.ts:342` | **BLOCKED** |
| `API-E-193` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] adopts an existing token after a reinstall without duplicating the token row | `api/test/notification-devices.integration.e2e-spec.ts:370` | **BLOCKED** |
| `API-E-194` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] rejects a token collision between two existing installations without changing either | `api/test/notification-devices.integration.e2e-spec.ts:392` | **BLOCKED** |
| `API-E-195` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] rolls back job cancellation if updating the device fails a database constraint | `api/test/notification-devices.integration.e2e-spec.ts:414` | **BLOCKED** |
| `API-E-196` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] serializes concurrent first registrations for the same installation | `api/test/notification-devices.integration.e2e-spec.ts:432` | **BLOCKED** |
| `API-E-197` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] serializes concurrent registrations that share a token but have different installations | `api/test/notification-devices.integration.e2e-spec.ts:451` | **BLOCKED** |
| `API-E-198` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] does not let a delayed logout from A disable a device just reassigned to B | `api/test/notification-devices.integration.e2e-spec.ts:468` | **BLOCKED** |
| `API-E-199` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] prevents another account from viewing or unregistering an owned device | `api/test/notification-devices.integration.e2e-spec.ts:484` | **BLOCKED** |
| `API-E-200` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] rejects malformed tokens, unsupported platforms and client-owned scope: %j **(x6 biến thể)** | `api/test/notification-devices.integration.e2e-spec.ts:492` | **BLOCKED** |
| `API-E-201` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] rejects invalid installation IDs and unauthenticated requests | `api/test/notification-devices.integration.e2e-spec.ts:514` | **BLOCKED** |
| `API-E-202` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] rejects missing or inactive DB users without reassigning devices | `api/test/notification-devices.integration.e2e-spec.ts:524` | **BLOCKED** |
| `API-E-203` | -- | Thiết bị nhận Thông báo Push (PG) | [Notification device registrations with PostgreSQL] exposes the three authenticated operations and body DTO in Swagger | `api/test/notification-devices.integration.e2e-spec.ts:534` | **BLOCKED** |

#### `api/test/notification-outbox.integration.e2e-spec.ts` — Notification Outbox theo chứng từ kho (PG) (`BLOCKED · 16 khai báo -> **30** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-204` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] $type: submit only notifies active approvers in the same farm, once per active device **(x4 biến thể)** | `api/test/notification-outbox.integration.e2e-spec.ts:478` | **BLOCKED** |
| `API-E-205` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] excludes the submitting approver without changing the actual creator mapping | `api/test/notification-outbox.integration.e2e-spec.ts:527` | **BLOCKED** |
| `API-E-206` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] $type: confirmation queues its result only to the creator **(x4 biến thể)** | `api/test/notification-outbox.integration.e2e-spec.ts:535` | **BLOCKED** |
| `API-E-207` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] STOCK_TRANSFER: dispatch pushes "in transit" to the destination managers, not the dispatcher | `api/test/notification-outbox.integration.e2e-spec.ts:560` | **BLOCKED** |
| `API-E-208` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] $type: rejection includes the reason and leaves inventory unchanged **(x4 biến thể)** | `api/test/notification-outbox.integration.e2e-spec.ts:582` | **BLOCKED** |
| `API-E-209` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] $type: an outbox failure rolls back confirmation, inventory, notification and audit together **(x4 biến thể)** | `api/test/notification-outbox.integration.e2e-spec.ts:611` | **BLOCKED** |
| `API-E-210` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] rolls back submission if adding its push job fails, and does not duplicate an idempotent receipt confirmation | `api/test/notification-outbox.integration.e2e-spec.ts:630` | **BLOCKED** |
| `API-E-211` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] queues only the newest five unread eligible notifications per new device and does not drain older backlog on refresh | `api/test/notification-outbox.integration.e2e-spec.ts:651` | **BLOCKED** |
| `API-E-212` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] skips missing, stale, unsupported and cross-farm approval records before applying the limit | `api/test/notification-outbox.integration.e2e-spec.ts:680` | **BLOCKED** |
| `API-E-213` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] does not backfill after losing current %s authorization **(x3 biến thể)** | `api/test/notification-outbox.integration.e2e-spec.ts:695` | **BLOCKED** |
| `API-E-214` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] backfills confirmed/rejected results for the actual creator even without an approver role | `api/test/notification-outbox.integration.e2e-spec.ts:718` | **BLOCKED** |
| `API-E-215` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] keeps terminal jobs terminal and cancels unfinished jobs when a device returns | `api/test/notification-outbox.integration.e2e-spec.ts:728` | **BLOCKED** |
| `API-E-216` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] rebinds only this device, cancels the old owner jobs and catches up only the new owner | `api/test/notification-outbox.integration.e2e-spec.ts:764` | **BLOCKED** |
| `API-E-217` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] rolls back a rebind and its cancellations if catch-up fails after writing jobs | `api/test/notification-outbox.integration.e2e-spec.ts:789` | **BLOCKED** |
| `API-E-218` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] does not lose or duplicate a submit when registration holds the user lock first | `api/test/notification-outbox.integration.e2e-spec.ts:809` | **BLOCKED** |
| `API-E-219` | -- | Notification Outbox theo chứng từ kho (PG) | [Document push outbox and bounded device catch-up] does not lose an event committed while registration waits, even if the registration transaction started earlier | `api/test/notification-outbox.integration.e2e-spec.ts:848` | **BLOCKED** |

#### `api/test/notification-push-worker.integration.e2e-spec.ts` — Notification Push Worker & Retry (PG) (`BLOCKED · 18 khai báo -> **30** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-220` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] sends through the correct channel and saves a ticket before marking provider delivery successful | `api/test/notification-push-worker.integration.e2e-spec.ts:224` | **BLOCKED** |
| `API-E-221` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] polls a missing receipt without sending the message again | `api/test/notification-push-worker.integration.e2e-spec.ts:261` | **BLOCKED** |
| `API-E-222` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] backs off network send errors and succeeds on a later attempt | `api/test/notification-push-worker.integration.e2e-spec.ts:284` | **BLOCKED** |
| `API-E-223` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] never resends after a receipt HTTP failure and bounds unknown receipts by age | `api/test/notification-push-worker.integration.e2e-spec.ts:304` | **BLOCKED** |
| `API-E-224` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] resends only after a definitive provider rate-limit rejection, not after an ambiguous missing receipt | `api/test/notification-push-worker.integration.e2e-spec.ts:336` | **BLOCKED** |
| `API-E-225` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] persists exponential receipt HTTP backoff across worker cycles without resending | `api/test/notification-push-worker.integration.e2e-spec.ts:360` | **BLOCKED** |
| `API-E-226` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] fails %s without disabling the user device **(x3 biến thể)** | `api/test/notification-push-worker.integration.e2e-spec.ts:383` | **BLOCKED** |
| `API-E-227` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] bounds send attempts and does not claim a terminal job again | `api/test/notification-push-worker.integration.e2e-spec.ts:397` | **BLOCKED** |
| `API-E-228` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] cancels a job whose %s condition no longer authorizes delivery **(x10 biến thể)** | `api/test/notification-push-worker.integration.e2e-spec.ts:409` | **BLOCKED** |
| `API-E-229` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] retires an invalid token and cancels its other jobs without disabling another device | `api/test/notification-push-worker.integration.e2e-spec.ts:480` | **BLOCKED** |
| `API-E-230` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] also retires DeviceNotRegistered from the receipt, without resending | `api/test/notification-push-worker.integration.e2e-spec.ts:501` | **BLOCKED** |
| `API-E-231` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] ignores a stale invalid-token callback after the %s binding changed **(x2 biến thể)** | `api/test/notification-push-worker.integration.e2e-spec.ts:520` | **BLOCKED** |
| `API-E-232` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] does not let a stale token error disable a registration freshly refreshed in place | `api/test/notification-push-worker.integration.e2e-spec.ts:545` | **BLOCKED** |
| `API-E-233` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] cannot overwrite logout or a read update committed while the HTTP request was in flight | `api/test/notification-push-worker.integration.e2e-spec.ts:565` | **BLOCKED** |
| `API-E-234` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] recovers expired receipt leases without sending again and fences late callbacks with lock_id | `api/test/notification-push-worker.integration.e2e-spec.ts:595` | **BLOCKED** |
| `API-E-235` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] does not send one job twice when two worker instances drain concurrently | `api/test/notification-push-worker.integration.e2e-spec.ts:633` | **BLOCKED** |
| `API-E-236` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] sends confirmation results to an employee creator without an approver role | `api/test/notification-push-worker.integration.e2e-spec.ts:656` | **BLOCKED** |
| `API-E-237` | -- | Notification Push Worker & Retry (PG) | [Push worker with PostgreSQL leases and a fake Expo transport] truncates only the outbound preview while preserving the full in-app notification | `api/test/notification-push-worker.integration.e2e-spec.ts:675` | **BLOCKED** |

#### `api/test/notifications.integration.e2e-spec.ts` — Danh sách Thông báo & Đánh dấu đã đọc (PG) (`BLOCKED · 4 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-238` | -- | Danh sách Thông báo & Đánh dấu đã đọc (PG) | [In-app notifications with PostgreSQL] lists only the caller notifications in the selected farm, with unread count and filter | `api/test/notifications.integration.e2e-spec.ts:85` | **BLOCKED** |
| `API-E-239` | -- | Danh sách Thông báo & Đánh dấu đã đọc (PG) | [In-app notifications with PostgreSQL] marks only the caller notification as read and reports a repeat as alreadyRead | `api/test/notifications.integration.e2e-spec.ts:110` | **BLOCKED** |
| `API-E-240` | -- | Danh sách Thông báo & Đánh dấu đã đọc (PG) | [In-app notifications with PostgreSQL] marks all unread notifications of the caller in one farm | `api/test/notifications.integration.e2e-spec.ts:130` | **BLOCKED** |
| `API-E-241` | -- | Danh sách Thông báo & Đánh dấu đã đọc (PG) | [In-app notifications with PostgreSQL] rejects an unknown or inactive account | `api/test/notifications.integration.e2e-spec.ts:154` | **BLOCKED** |

#### `api/test/payments.integration.e2e-spec.ts` — Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) (`BLOCKED · 10 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-242` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [order code parsing] reads the canonical DH code from bank notes | `api/test/payments.integration.e2e-spec.ts:50` | **BLOCKED** |
| `API-E-243` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [order code parsing] accepts only the exact SePay API key header | `api/test/payments.integration.e2e-spec.ts:59` | **BLOCKED** |
| `API-E-244` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [Payments (migrated PostgreSQL)] keeps payment transactions behind the API | `api/test/payments.integration.e2e-spec.ts:122` | **BLOCKED** |
| `API-E-245` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [Payments (migrated PostgreSQL)] pays an order from a verified SePay webhook and audits both rows | `api/test/payments.integration.e2e-spec.ts:129` | **BLOCKED** |
| `API-E-246` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [Payments (migrated PostgreSQL)] ignores outgoing transfers | `api/test/payments.integration.e2e-spec.ts:174` | **BLOCKED** |
| `API-E-247` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [Payments (migrated PostgreSQL)] records every mismatch for staff without paying the order | `api/test/payments.integration.e2e-spec.ts:191` | **BLOCKED** |
| `API-E-248` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [Payments (migrated PostgreSQL)] treats a redelivered transaction as a no-op and a second transfer as already paid | `api/test/payments.integration.e2e-spec.ts:265` | **BLOCKED** |
| `API-E-249` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [Payments (migrated PostgreSQL)] limits the simulator to enabled environments and store staff | `api/test/payments.integration.e2e-spec.ts:316` | **BLOCKED** |
| `API-E-250` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [Payments on concurrent PostgreSQL connections] matches only one of two different transfers for the same order | `api/test/payments.integration.e2e-spec.ts:378` | **BLOCKED** |
| `API-E-251` | -- | Thanh toán Đơn hàng & Webhook SePay/VietQR (PG) | [Payments on concurrent PostgreSQL connections] stores one row for simultaneous deliveries of the same transaction | `api/test/payments.integration.e2e-spec.ts:396` | **BLOCKED** |

#### `api/test/personnel.integration.e2e-spec.ts` — Nhân sự & Phân quyền Thành viên trại (PG) (`BLOCKED · 18 test case`)

- **Runner:** `pnpm --dir api test:personnel (jest-personnel.config.cjs)`
- **Nguyên nhân block:** BLOCKED — Kế thừa guard `TEST_DATABASE_URL` (`*_test`) từ `jest-assets.config.cjs` & thiếu kết nối PostgreSQL.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-252` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] isolates all member reads/writes, validates access before targets, and denies employee/guest management | `api/test/personnel.integration.e2e-spec.ts:352` | **BLOCKED** |
| `API-E-253` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] rejects escalation/shared identity edits and protects self/owners; retains legacy system grants | `api/test/personnel.integration.e2e-spec.ts:379` | **BLOCKED** |
| `API-E-254` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] serializes two concurrent owner removals using separate PostgreSQL transactions | `api/test/personnel.integration.e2e-spec.ts:428` | **BLOCKED** |
| `API-E-255` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] enforces workplace scope in SQL and service and paginates many-to-many filters without duplicates | `api/test/personnel.integration.e2e-spec.ts:447` | **BLOCKED** |
| `API-E-256` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] deactivates membership only, preserves history, excludes recipients, and reactivates the same ID | `api/test/personnel.integration.e2e-spec.ts:495` | **BLOCKED** |
| `API-E-257` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] creates one identity/member under concurrent submissions and never persists/returns initial passwords | `api/test/personnel.integration.e2e-spec.ts:542` | **BLOCKED** |
| `API-E-258` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] rolls back profile, roles and assignment changes when the audit write fails | `api/test/personnel.integration.e2e-spec.ts:590` | **BLOCKED** |
| `API-E-259` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] preserves assets/history after deactivation and lets owners process the return | `api/test/personnel.integration.e2e-spec.ts:637` | **BLOCKED** |
| `API-E-260` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] recovers an uncertain Clerk timeout by external ID without creating another identity | `api/test/personnel.integration.e2e-spec.ts:718` | **BLOCKED** |
| `API-E-261` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] leaves identities banned after database failure and resumes the saved identity | `api/test/personnel.integration.e2e-spec.ts:735` | **BLOCKED** |
| `API-E-262` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] retries unban after membership commit without duplicating membership/audit | `api/test/personnel.integration.e2e-spec.ts:752` | **BLOCKED** |
| `API-E-263` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] never downgrades a completed provision when a concurrent failure is annotated later | `api/test/personnel.integration.e2e-spec.ts:773` | **BLOCKED** |
| `API-E-264` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] keeps the safe dependency error when recording failure metadata is also unavailable | `api/test/personnel.integration.e2e-spec.ts:810` | **BLOCKED** |
| `API-E-265` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] rechecks actor permission after Clerk responds before granting membership | `api/test/personnel.integration.e2e-spec.ts:827` | **BLOCKED** |
| `API-E-266` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] adds an existing account without changing shared identity, password or other-farm membership | `api/test/personnel.integration.e2e-spec.ts:846` | **BLOCKED** |
| `API-E-267` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] lists signed-in accounts without any farm membership as customers to managers only | `api/test/personnel.integration.e2e-spec.ts:874` | **BLOCKED** |
| `API-E-268` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] enforces first-password policy on direct APIs and changes only the session identity | `api/test/personnel.integration.e2e-spec.ts:891` | **BLOCKED** |
| `API-E-269` | -- | Nhân sự & Phân quyền Thành viên trại (PG) | [Personnel HTTP, provisioning and PostgreSQL consistency] shares credential throttling through PostgreSQL and blocks inactive accounts/farms | `api/test/personnel.integration.e2e-spec.ts:934` | **BLOCKED** |

#### `api/test/stock-counts-transfers.integration.e2e-spec.ts` — Kiểm kê kho & Phiếu chuyển kho (PG) (`BLOCKED · 35 khai báo -> **50** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:assets (jest-assets.config.cjs)`
- **Nguyên nhân block:** BLOCKED — Thiếu biến môi trường `TEST_DATABASE_URL` trỏ DB PostgreSQL local `*_test` (config chủ động chặn để bảo vệ DB ứng dụng) & không có kết nối PostgreSQL trong sandbox.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-270` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] counts a LOT item against the balance of the selected lot | `api/test/stock-counts-transfers.integration.e2e-spec.ts:287` | **BLOCKED** |
| `API-E-271` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] rejects counting %s **(x5 biến thể)** | `api/test/stock-counts-transfers.integration.e2e-spec.ts:314` | **BLOCKED** |
| `API-E-272` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] detects a 0.001 change on a quantity too large for a float comparison | `api/test/stock-counts-transfers.integration.e2e-spec.ts:380` | **BLOCKED** |
| `API-E-273` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] answers STOCK_COUNT_STALE when the count loses a deadlock to another move | `api/test/stock-counts-transfers.integration.e2e-spec.ts:393` | **BLOCKED** |
| `API-E-274` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] rejects a count as stale when an issue commits during confirmation, keeping the issue | `api/test/stock-counts-transfers.integration.e2e-spec.ts:436` | **BLOCKED** |
| `API-E-275` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] confirms a count of a lot with no balance yet and creates the balance | `api/test/stock-counts-transfers.integration.e2e-spec.ts:458` | **BLOCKED** |
| `API-E-276` | `NV08` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] does not credit a warehouse deactivated while its count was open (NV08) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:476` | **BLOCKED** |
| `API-E-277` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] rejects a count as stale when a receipt creates the missing balance during confirmation | `api/test/stock-counts-transfers.integration.e2e-spec.ts:501` | **BLOCKED** |
| `API-E-278` | `P1-12` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] records found, damaged, misplaced and missing assets and settles them on approval | `api/test/stock-counts-transfers.integration.e2e-spec.ts:609` | **BLOCKED** |
| `API-E-279` | `P1-12` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] lets the counter confirm alone when every asset is found where recorded | `api/test/stock-counts-transfers.integration.e2e-spec.ts:694` | **BLOCKED** |
| `API-E-280` | `P1-12` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] rejects %s and creates nothing **(x6 biến thể)** | `api/test/stock-counts-transfers.integration.e2e-spec.ts:736` | **BLOCKED** |
| `API-E-281` | `P1-12` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] goes stale when the asset changed after counting, and refuses unsafe missing reports | `api/test/stock-counts-transfers.integration.e2e-spec.ts:787` | **BLOCKED** |
| `API-E-282` | `P1-12` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts › counting assets one by one (P1-12)] refuses the same asset twice and goes stale when the asset moves before approval | `api/test/stock-counts-transfers.integration.e2e-spec.ts:836` | **BLOCKED** |
| `API-E-283` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] transfers a LOT item between warehouses by lot | `api/test/stock-counts-transfers.integration.e2e-spec.ts:861` | **BLOCKED** |
| `API-E-284` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] rejects transferring %s **(x2 biến thể)** | `api/test/stock-counts-transfers.integration.e2e-spec.ts:884` | **BLOCKED** |
| `API-E-285` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] provides the nested catalog items consumed by count and transfer selectors | `api/test/stock-counts-transfers.integration.e2e-spec.ts:934` | **BLOCKED** |
| `API-E-286` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] transfers exact quantities and creates one balanced ledger pair on repeated confirmation | `api/test/stock-counts-transfers.integration.e2e-spec.ts:945` | **BLOCKED** |
| `API-E-287` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] dispatch debits only the source; the destination gets what it counts (TRF-02..05) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:961` | **BLOCKED** |
| `API-E-288` | `P1-01` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] keeps a short receipt open until the rest is returned or written off (P1-01) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1035` | **BLOCKED** |
| `API-E-289` | `P1-01` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] writes off a transfer that arrived with nothing usable without crediting anyone (P1-01) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1070` | **BLOCKED** |
| `API-E-290` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] confirms concurrent first-time transfers into a missing destination balance | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1107` | **BLOCKED** |
| `API-E-291` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] confirms concurrent opposite-direction transfers without deadlock | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1123` | **BLOCKED** |
| `API-E-292` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] assigns the next code to an uncoded %s draft on confirmation **(x2 biến thể)** | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1149` | **BLOCKED** |
| `API-E-293` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] ignores client-supplied %s codes on create **(x2 biến thể)** | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1171` | **BLOCKED** |
| `API-E-294` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] ignores a client-supplied transfer code on update | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1187` | **BLOCKED** |
| `API-E-295` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] rejects ASSET items on create, update, and confirmation of legacy drafts | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1202` | **BLOCKED** |
| `API-E-296` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] rejects a zero transfer quantity %s before creating a document **(x2 biến thể)** | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1248` | **BLOCKED** |
| `API-E-297` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] returns item, unit and lot names on count and transfer lines | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1272` | **BLOCKED** |
| `API-E-298` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] rolls back a transfer with insufficient stock | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1293` | **BLOCKED** |
| `API-E-299` | `P0-01` | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] refuses a count difference confirmed by its own author (P0-01) | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1302` | **BLOCKED** |
| `API-E-300` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] confirms a count once and records the exact difference | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1314` | **BLOCKED** |
| `API-E-301` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] preserves a 0.001 count difference at large quantities | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1324` | **BLOCKED** |
| `API-E-302` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] confirms the same %s document concurrently without duplicate stock movements **(x2 biến thể)** | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1337` | **BLOCKED** |
| `API-E-303` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] rejects a stale count without overwriting the current stock | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1353` | **BLOCKED** |
| `API-E-304` | -- | Kiểm kê kho & Phiếu chuyển kho (PG) | [Warehouse count and transfer UI HTTP contracts] accepts migrated status filters and isolates farms for %s **(x2 biến thể)** | `api/test/stock-counts-transfers.integration.e2e-spec.ts:1366` | **BLOCKED** |

#### `api/test/stock-document-approval.integration.e2e-spec.ts` — Quy trình Duyệt 2 bước & Tách người lập/duyệt (`BLOCKED · 19 khai báo -> **58** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-305` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] shows employees only their own documents; approvers see all **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:364` | **BLOCKED** |
| `API-E-306` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] lets an approver confirm a draft directly **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:392` | **BLOCKED** |
| `API-E-307` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] makes an employee submit their own draft before an approver confirms it **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:399` | **BLOCKED** |
| `API-E-308` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] keeps employees away from another member's draft, but not approvers **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:419` | **BLOCKED** |
| `API-E-309` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] does not let a guest create documents **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:429` | **BLOCKED** |
| `API-E-310` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] rejects only pending documents, with a reason, and keeps REJECTED final **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:435` | **BLOCKED** |
| `API-E-311` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] notifies approvers on submit and the creator on review, but never the actor **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:459` | **BLOCKED** |
| `API-E-312` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] audits every change with its actor, states and lines, inside the same transaction **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:502` | **BLOCKED** |
| `API-E-313` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type] audits a direct confirmation once **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:546` | **BLOCKED** |
| `API-E-314` | `P0-01` | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules] applies a count difference only when someone other than its author approves (P0-01) | `api/test/stock-document-approval.integration.e2e-spec.ts:562` | **BLOCKED** |
| `API-E-315` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules] lets only managers of the destination receive a dispatched transfer (TRF-08) | `api/test/stock-document-approval.integration.e2e-spec.ts:596` | **BLOCKED** |
| `API-E-316` | `P1-11` | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › issue receipt acknowledgement (P1-11)] lets only the recipient acknowledge a confirmed issue, once, without moving stock | `api/test/stock-document-approval.integration.e2e-spec.ts:650` | **BLOCKED** |
| `API-E-317` | `P1-11` | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › issue receipt acknowledgement (P1-11)] lets a warehouse manager record receipt for the recipient only with a note | `api/test/stock-document-approval.integration.e2e-spec.ts:697` | **BLOCKED** |
| `API-E-318` | `P1-11` | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › issue receipt acknowledgement (P1-11)] needs a recipient who is an active member of the farm | `api/test/stock-document-approval.integration.e2e-spec.ts:711` | **BLOCKED** |
| `API-E-319` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › audit history access] shows approvers the whole farm and employees only actions they performed | `api/test/stock-document-approval.integration.e2e-spec.ts:778` | **BLOCKED** |
| `API-E-320` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type owner numbering options] uses an owner-requested code when another approver confirms, without moving the counter **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:893` | **BLOCKED** |
| `API-E-321` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type owner numbering options] lets only the farm owner set, change or clear the options **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:940` | **BLOCKED** |
| `API-E-322` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type owner numbering options] rolls back a confirmation whose requested code is taken and keeps the draft **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:979` | **BLOCKED** |
| `API-E-323` | -- | Quy trình Duyệt 2 bước & Tách người lập/duyệt | [Stock document approval rules › $type owner numbering options] lets only one of two concurrent confirmations take the same requested code **(x4 biến thể)** | `api/test/stock-document-approval.integration.e2e-spec.ts:1003` | **BLOCKED** |

#### `api/test/stock-document-code.integration.e2e-spec.ts` — Đánh số chứng từ & Yêu cầu số riêng (Service) (`BLOCKED · 12 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-324` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] formats at least six digits and keeps growing past 999999 | `api/test/stock-document-code.integration.e2e-spec.ts:91` | **BLOCKED** |
| `API-E-325` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] uses the Asia/Ho_Chi_Minh year | `api/test/stock-document-code.integration.e2e-spec.ts:97` | **BLOCKED** |
| `API-E-326` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] starts each scope at 1 and counts up | `api/test/stock-document-code.integration.e2e-spec.ts:102` | **BLOCKED** |
| `API-E-327` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] keeps farms, prefixes and years independent | `api/test/stock-document-code.integration.e2e-spec.ts:108` | **BLOCKED** |
| `API-E-328` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] skips codes already held by any document, including mixed case | `api/test/stock-document-code.integration.e2e-spec.ts:118` | **BLOCKED** |
| `API-E-329` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] is not pushed ahead by a high existing code | `api/test/stock-document-code.integration.e2e-spec.ts:125` | **BLOCKED** |
| `API-E-330` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] rolls the counter back with a failed transaction | `api/test/stock-document-code.integration.e2e-spec.ts:131` | **BLOCKED** |
| `API-E-331` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] rolls back a counter created by a failed first use | `api/test/stock-document-code.integration.e2e-spec.ts:143` | **BLOCKED** |
| `API-E-332` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator] gives concurrent confirmations distinct consecutive codes | `api/test/stock-document-code.integration.e2e-spec.ts:153` | **BLOCKED** |
| `API-E-333` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator › manual codes in the automatic format] makes allocation wait for an open manual write of the next code, then skip it | `api/test/stock-document-code.integration.e2e-spec.ts:203` | **BLOCKED** |
| `API-E-334` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator › manual codes in the automatic format] makes a manual write wait for an open allocation and fail on the taken code | `api/test/stock-document-code.integration.e2e-spec.ts:218` | **BLOCKED** |
| `API-E-335` | -- | Đánh số chứng từ & Yêu cầu số riêng (Service) | [Stock document code allocator › manual codes in the automatic format] locks the scope of the code year without moving its counter | `api/test/stock-document-code.integration.e2e-spec.ts:238` | **BLOCKED** |

#### `api/test/stock-document-numbering-schema.integration.e2e-spec.ts` — Schema Ràng buộc số chứng từ & Counter DB (`BLOCKED · 8 khai báo -> **30** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-336` | -- | Schema Ràng buộc số chứng từ & Counter DB | [Stock document numbering schema › $table] allows several uncoded drafts in one farm **(x4 biến thể)** | `api/test/stock-document-numbering-schema.integration.e2e-spec.ts:117` | **BLOCKED** |
| `API-E-337` | -- | Schema Ràng buộc số chứng từ & Counter DB | [Stock document numbering schema › $table] rejects a confirmed row without a code **(x4 biến thể)** | `api/test/stock-document-numbering-schema.integration.e2e-spec.ts:123` | **BLOCKED** |
| `API-E-338` | -- | Schema Ràng buộc số chứng từ & Counter DB | [Stock document numbering schema › $table] rejects a blank code %j in any status, so drafts store NULL **(x8 biến thể)** | `api/test/stock-document-numbering-schema.integration.e2e-spec.ts:131` | **BLOCKED** |
| `API-E-339` | -- | Schema Ràng buộc số chứng từ & Counter DB | [Stock document numbering schema › $table] keeps codes unique per farm, ignoring case and outer whitespace **(x4 biến thể)** | `api/test/stock-document-numbering-schema.integration.e2e-spec.ts:142` | **BLOCKED** |
| `API-E-340` | -- | Schema Ràng buộc số chứng từ & Counter DB | [Stock document numbering schema › $table] requires a reason and a requester with a requested code **(x4 biến thể)** | `api/test/stock-document-numbering-schema.integration.e2e-spec.ts:151` | **BLOCKED** |
| `API-E-341` | -- | Schema Ràng buộc số chứng từ & Counter DB | [Stock document numbering schema › $table] still requires confirmation metadata **(x4 biến thể)** | `api/test/stock-document-numbering-schema.integration.e2e-spec.ts:171` | **BLOCKED** |
| `API-E-342` | -- | Schema Ràng buộc số chứng từ & Counter DB | [Stock document numbering schema] keeps counters nonnegative and unique per farm, prefix and year | `api/test/stock-document-numbering-schema.integration.e2e-spec.ts:180` | **BLOCKED** |
| `API-E-343` | -- | Schema Ràng buộc số chứng từ & Counter DB | [Stock document numbering schema] seeds counters from canonical codes only, in every status | `api/test/stock-document-numbering-schema.integration.e2e-spec.ts:204` | **BLOCKED** |

#### `api/test/stock-holds.integration.e2e-spec.ts` — Giữ hàng (Stock Holds) cho Đơn hàng (PG) (`BLOCKED · 4 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-344` | `P0-02` | Giữ hàng (Stock Holds) cho Đơn hàng (PG) | [Stock held for customer orders (migrated PostgreSQL)] refuses an unrelated issue or transfer that would take stock held by an order (P0-02) | `api/test/stock-holds.integration.e2e-spec.ts:68` | **BLOCKED** |
| `API-E-345` | `P0-02` | Giữ hàng (Stock Holds) cho Đơn hàng (PG) | [Stock held for customer orders (migrated PostgreSQL)] lets other documents use only the part that is not held (P0-02) | `api/test/stock-holds.integration.e2e-spec.ts:88` | **BLOCKED** |
| `API-E-346` | `P0-02` | Giữ hàng (Stock Holds) cho Đơn hàng (PG) | [Stock held for customer orders (migrated PostgreSQL)] lets an order issue be re-saved with its own hold, then still confirm (P0-02) | `api/test/stock-holds.integration.e2e-spec.ts:102` | **BLOCKED** |
| `API-E-347` | -- | Giữ hàng (Stock Holds) cho Đơn hàng (PG) | [Stock held for customer orders (migrated PostgreSQL)] does not let manual drafts block each other | `api/test/stock-holds.integration.e2e-spec.ts:113` | **BLOCKED** |

#### `api/test/stock-issue-returns.integration.e2e-spec.ts` — Nhập trả từ Phiếu xuất nội bộ (PG) (`BLOCKED · 6 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-348` | -- | Nhập trả từ Phiếu xuất nội bộ (PG) | [Internal return of issued QUANTITY/LOT goods] puts back only the accepted part, once, into the same lot | `api/test/stock-issue-returns.integration.e2e-spec.ts:281` | **BLOCKED** |
| `API-E-349` | -- | Nhập trả từ Phiếu xuất nội bộ (PG) | [Internal return of issued QUANTITY/LOT goods] records a return where nothing passes without moving stock | `api/test/stock-issue-returns.integration.e2e-spec.ts:326` | **BLOCKED** |
| `API-E-350` | -- | Nhập trả từ Phiếu xuất nội bộ (PG) | [Internal return of issued QUANTITY/LOT goods] refuses returns beyond what was issued, empty lines and missing reasons | `api/test/stock-issue-returns.integration.e2e-spec.ts:347` | **BLOCKED** |
| `API-E-351` | -- | Nhập trả từ Phiếu xuất nội bộ (PG) | [Internal return of issued QUANTITY/LOT goods] serializes concurrent confirmations of competing returns | `api/test/stock-issue-returns.integration.e2e-spec.ts:384` | **BLOCKED** |
| `API-E-352` | -- | Nhập trả từ Phiếu xuất nội bộ (PG) | [Internal return of issued QUANTITY/LOT goods] confirms returns of two issues locking the same stock without deadlock | `api/test/stock-issue-returns.integration.e2e-spec.ts:399` | **BLOCKED** |
| `API-E-353` | -- | Nhập trả từ Phiếu xuất nội bộ (PG) | [Internal return of issued QUANTITY/LOT goods] refuses unconfirmed, asset and damage issues, other farms and edits | `api/test/stock-issue-returns.integration.e2e-spec.ts:429` | **BLOCKED** |

#### `api/test/stock-issues.integration.e2e-spec.ts` — Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) (`BLOCKED · 45 khai báo -> **75** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:assets (jest-assets.config.cjs)`
- **Nguyên nhân block:** BLOCKED — Thiếu biến môi trường `TEST_DATABASE_URL` trỏ DB PostgreSQL local `*_test` (config chủ động chặn để bảo vệ DB ứng dụng) & không có kết nối PostgreSQL trong sandbox.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-354` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] lists warehouse labels with stable pagination and status filtering without duplicating multi-line issues | `api/test/stock-issues.integration.e2e-spec.ts:359` | **BLOCKED** |
| `API-E-355` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] reads all tracking labels and original fields without changing decimal quantities or inventory | `api/test/stock-issues.integration.e2e-spec.ts:425` | **BLOCKED** |
| `API-E-356` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] cancels a maintenance materials draft without changing balances, lots, assets, records, or lines | `api/test/stock-issues.integration.e2e-spec.ts:497` | **BLOCKED** |
| `API-E-357` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] serializes concurrent duplicate cancellations and changes only the issue state | `api/test/stock-issues.integration.e2e-spec.ts:571` | **BLOCKED** |
| `API-E-358` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects cancellation without write access or with a different farm | `api/test/stock-issues.integration.e2e-spec.ts:595` | **BLOCKED** |
| `API-E-359` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] reads maintenance asset labels without restricting eligible record statuses or multiplying rows | `api/test/stock-issues.integration.e2e-spec.ts:614` | **BLOCKED** |
| `API-E-360` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects missing and foreign-farm maintenance links without inserting a draft | `api/test/stock-issues.integration.e2e-spec.ts:665` | **BLOCKED** |
| `API-E-361` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] creates a maintenance draft linked to a %s record without changing inventory or maintenance **(x4 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:728` | **BLOCKED** |
| `API-E-362` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects confirmation against a %s maintenance record without changing stock **(x2 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:751` | **BLOCKED** |
| `API-E-363` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] assigns PX codes to uncoded drafts on confirmation and keeps legacy codes | `api/test/stock-issues.integration.e2e-spec.ts:765` | **BLOCKED** |
| `API-E-364` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] preserves a maintenance link on draft edits and clears it when the issue type changes | `api/test/stock-issues.integration.e2e-spec.ts:795` | **BLOCKED** |
| `API-E-365` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] filters asset data and count by current warehouse while preserving unfiltered lists | `api/test/stock-issues.integration.e2e-spec.ts:854` | **BLOCKED** |
| `API-E-366` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] keeps asset count and pagination consistent with combined warehouse filters | `api/test/stock-issues.integration.e2e-spec.ts:903` | **BLOCKED** |
| `API-E-367` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] does not use a location from another farm to satisfy the asset warehouse filter | `api/test/stock-issues.integration.e2e-spec.ts:974` | **BLOCKED** |
| `API-E-368` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] persists three physical assets as separate lines in one draft without changing business state | `api/test/stock-issues.integration.e2e-spec.ts:1046` | **BLOCKED** |
| `API-E-369` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] returns raw lot suggestions scoped to eligible farm, warehouse, and item balances | `api/test/stock-issues.integration.e2e-spec.ts:1097` | **BLOCKED** |
| `API-E-370` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] creates and updates mixed QUANTITY and LOT drafts without changing inventory | `api/test/stock-issues.integration.e2e-spec.ts:1301` | **BLOCKED** |
| `API-E-371` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] ignores client-supplied issue codes on create and update | `api/test/stock-issues.integration.e2e-spec.ts:1365` | **BLOCKED** |
| `API-E-372` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] does not map an unrelated PostgreSQL unique-constraint error to 409 | `api/test/stock-issues.integration.e2e-spec.ts:1386` | **BLOCKED** |
| `API-E-373` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] keeps lines when legacy references belong to another farm and does not expose their labels | `api/test/stock-issues.integration.e2e-spec.ts:1411` | **BLOCKED** |
| `API-E-374` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] enforces the read-access check and reports missing issues | `api/test/stock-issues.integration.e2e-spec.ts:1512` | **BLOCKED** |
| `API-E-375` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] confirms QUANTITY once, answers a repeat confirmation unchanged, and rejects editing and cancellation | `api/test/stock-issues.integration.e2e-spec.ts:1530` | **BLOCKED** |
| `API-E-376` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] confirms a maintenance materials issue atomically and preserves the asset and maintenance record | `api/test/stock-issues.integration.e2e-spec.ts:1552` | **BLOCKED** |
| `API-E-377` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects confirmation without write access or with another farm without side effects | `api/test/stock-issues.integration.e2e-spec.ts:1599` | **BLOCKED** |
| `API-E-378` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] confirms LOT and deducts its warehouse balance without changing initial quantity | `api/test/stock-issues.integration.e2e-spec.ts:1621` | **BLOCKED** |
| `API-E-379` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] issues multiple individually traceable ASSET lines in one issue, accepting stored 1.000 | `api/test/stock-issues.integration.e2e-spec.ts:1634` | **BLOCKED** |
| `API-E-380` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] maps ASSET %s issues to %s **(x2 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:1661` | **BLOCKED** |
| `API-E-381` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects a legacy mixed DAMAGE draft without moving materials or assets | `api/test/stock-issues.integration.e2e-spec.ts:1675` | **BLOCKED** |
| `API-E-382` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] returns insufficient stock when no balance exists | `api/test/stock-issues.integration.e2e-spec.ts:1700` | **BLOCKED** |
| `API-E-383` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] returns insufficient stock without mutations for quantity %s **(x2 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:1716` | **BLOCKED** |
| `API-E-384` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects invalid quantity %s at create and update HTTP validation **(x5 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:1733` | **BLOCKED** |
| `API-E-385` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects %s on creation and editing **(x8 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:1768` | **BLOCKED** |
| `API-E-386` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] revalidates legacy persisted %s at confirmation **(x8 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:1785` | **BLOCKED** |
| `API-E-387` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects an asset outside the source warehouse (location %s) **(x2 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:1805` | **BLOCKED** |
| `API-E-388` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects an asset at an inactive location in the issuing warehouse | `api/test/stock-issues.integration.e2e-spec.ts:1822` | **BLOCKED** |
| `API-E-389` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects unavailable ASSET status %s **(x5 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:1846` | **BLOCKED** |
| `API-E-390` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rolls back previous lines when one physical asset is listed twice | `api/test/stock-issues.integration.e2e-spec.ts:1859` | **BLOCKED** |
| `API-E-391` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rejects an expired LOT without inventory mutations | `api/test/stock-issues.integration.e2e-spec.ts:1874` | **BLOCKED** |
| `API-E-392` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rolls back balance and asset changes when transaction creation fails | `api/test/stock-issues.integration.e2e-spec.ts:1886` | **BLOCKED** |
| `API-E-393` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] rolls back all writes, including ledger and status, on a late failure | `api/test/stock-issues.integration.e2e-spec.ts:1922` | **BLOCKED** |
| `API-E-394` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] applies stock once for two concurrent confirmations of the same issue | `api/test/stock-issues.integration.e2e-spec.ts:1992` | **BLOCKED** |
| `API-E-395` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] returns insufficient stock when two issues compete for 10 units with requests of 7 and 6 | `api/test/stock-issues.integration.e2e-spec.ts:2007` | **BLOCKED** |
| `API-E-396` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] prevents two different issues from consuming the same asset | `api/test/stock-issues.integration.e2e-spec.ts:2034` | **BLOCKED** |
| `API-E-397` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] serializes overlapping multi-asset issues without a deadlock or partial issue | `api/test/stock-issues.integration.e2e-spec.ts:2050` | **BLOCKED** |
| `API-E-398` | -- | Phiếu xuất kho (QUANTITY / LOT / ASSET & Concurrency) | [Stock Issue HTTP and PostgreSQL consistency] serializes confirmation against a concurrent %s **(x2 biến thể)** | `api/test/stock-issues.integration.e2e-spec.ts:2072` | **BLOCKED** |

#### `api/test/stock-receipts-store-manager.integration.e2e-spec.ts` — Phân quyền Store Manager với Phiếu nhập (PG) (`BLOCKED · 2 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-399` | -- | Phân quyền Store Manager với Phiếu nhập (PG) | [Store manager receipts] drafts, submits and cancels receipts of the sales warehouse only | `api/test/stock-receipts-store-manager.integration.e2e-spec.ts:145` | **BLOCKED** |
| `API-E-400` | -- | Phân quyền Store Manager với Phiếu nhập (PG) | [Store manager receipts] still cannot write other stock documents | `api/test/stock-receipts-store-manager.integration.e2e-spec.ts:182` | **BLOCKED** |

#### `api/test/stock-receipts.integration.e2e-spec.ts` — Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) (`BLOCKED · 21 khai báo -> **27** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:assets (jest-assets.config.cjs)`
- **Nguyên nhân block:** BLOCKED — Thiếu biến môi trường `TEST_DATABASE_URL` trỏ DB PostgreSQL local `*_test` (config chủ động chặn để bảo vệ DB ứng dụng) & không có kết nối PostgreSQL trong sandbox.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-401` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] creates and updates a DRAFT, lists by status with pagination, and reads detail | `api/test/stock-receipts.integration.e2e-spec.ts:351` | **BLOCKED** |
| `API-E-402` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] serves supplier and location dropdowns only for the selected member farm | `api/test/stock-receipts.integration.e2e-spec.ts:417` | **BLOCKED** |
| `API-E-403` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] ignores client-supplied receipt codes on create and update | `api/test/stock-receipts.integration.e2e-spec.ts:454` | **BLOCKED** |
| `API-E-404` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] rejects invalid payloads and cross-farm warehouse, supplier, and item references | `api/test/stock-receipts.integration.e2e-spec.ts:474` | **BLOCKED** |
| `API-E-405` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] assigns the next PN code to an uncoded draft on confirmation and keeps it on repeat | `api/test/stock-receipts.integration.e2e-spec.ts:549` | **BLOCKED** |
| `API-E-406` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] keeps drafts out of inventory, confirms QUANTITY once, and makes repeat confirmation idempotent | `api/test/stock-receipts.integration.e2e-spec.ts:573` | **BLOCKED** |
| `API-E-407` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] creates the inventory LOT, links it to the receipt line, and updates its balance on confirmation | `api/test/stock-receipts.integration.e2e-spec.ts:602` | **BLOCKED** |
| `API-E-408` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] adds stock to an existing lot without creating a new one and returns line details | `api/test/stock-receipts.integration.e2e-spec.ts:650` | **BLOCKED** |
| `API-E-409` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] rejects a receipt line with %s **(x6 biến thể)** | `api/test/stock-receipts.integration.e2e-spec.ts:705` | **BLOCKED** |
| `API-E-410` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] blocks cancel/edit/confirm after the receipt leaves DRAFT | `api/test/stock-receipts.integration.e2e-spec.ts:766` | **BLOCKED** |
| `API-E-411` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] allows member reads, denies guest writes, and does not reveal another farm receipt | `api/test/stock-receipts.integration.e2e-spec.ts:790` | **BLOCKED** |
| `API-E-412` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] confirms a new LOT line without a supplier number | `api/test/stock-receipts.integration.e2e-spec.ts:824` | **BLOCKED** |
| `API-E-413` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] accepts equal supplier numbers as separate lots, including within one receipt | `api/test/stock-receipts.integration.e2e-spec.ts:851` | **BLOCKED** |
| `API-E-414` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] keeps legacy draft numbers on the same line by id when earlier lines are removed | `api/test/stock-receipts.integration.e2e-spec.ts:903` | **BLOCKED** |
| `API-E-415` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] drops a legacy number when the line id is missing, foreign, or reused | `api/test/stock-receipts.integration.e2e-spec.ts:945` | **BLOCKED** |
| `API-E-416` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] rolls back new lots when a later line fails confirmation | `api/test/stock-receipts.integration.e2e-spec.ts:982` | **BLOCKED** |
| `API-E-417` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] rejects missing, blank and cross-farm duplicate lot codes in the database | `api/test/stock-receipts.integration.e2e-spec.ts:1026` | **BLOCKED** |
| `API-E-418` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] confirms ASSET receipt quantity 1 and creates one linked asset | `api/test/stock-receipts.integration.e2e-spec.ts:1048` | **BLOCKED** |
| `API-E-419` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] refuses to confirm an ASSET receipt line without a location | `api/test/stock-receipts.integration.e2e-spec.ts:1128` | **BLOCKED** |
| `API-E-420` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] rejects zero quantities and still accepts the smallest positive precision | `api/test/stock-receipts.integration.e2e-spec.ts:1156` | **BLOCKED** |
| `API-E-421` | -- | Phiếu nhập kho & Tạo lô/Tài sản tự động (PG) | [Stock receipts HTTP contract with local PostgreSQL] confirms different receipts and retries atomically (existing balance: %s) **(x2 biến thể)** | `api/test/stock-receipts.integration.e2e-spec.ts:1201` | **BLOCKED** |

#### `api/test/store-admin.e2e-spec.ts` — Quản trị Cửa hàng — HTTP Validation (Mock HTTP) (`BLOCKED · 3 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Sandbox Windows chặn bind/connect socket TCP loopback (`connect EACCES 127.0.0.1:<port>`) khi Supertest khởi tạo HTTP test server (logic service đã mock).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-422` | -- | Quản trị Cửa hàng — HTTP Validation (Mock HTTP) | [Store admin HTTP contract] passes the multipart file and alt to the service | `api/test/store-admin.e2e-spec.ts:51` | **BLOCKED** |
| `API-E-423` | -- | Quản trị Cửa hàng — HTTP Validation (Mock HTTP) | [Store admin HTTP contract] rejects files over 10MB before calling the service | `api/test/store-admin.e2e-spec.ts:70` | **BLOCKED** |
| `API-E-424` | -- | Quản trị Cửa hàng — HTTP Validation (Mock HTTP) | [Store admin HTTP contract] validates reorder payloads | `api/test/store-admin.e2e-spec.ts:82` | **BLOCKED** |

#### `api/test/store-admin.integration.e2e-spec.ts` — Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) (`BLOCKED · 8 test case`)

- **Runner:** `pnpm --dir api test:db (jest-db.json) / test:e2e`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-425` | -- | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] keeps one sales warehouse of the farm and blocks switching it under open orders | `api/test/store-admin.integration.e2e-spec.ts:141` | **BLOCKED** |
| `API-E-426` | -- | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] shows physical, held and available stock of the sales warehouse only | `api/test/store-admin.integration.e2e-spec.ts:207` | **BLOCKED** |
| `API-E-427` | -- | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] lets each farm map its own item of the same unit to a shared variant | `api/test/store-admin.integration.e2e-spec.ts:322` | **BLOCKED** |
| `API-E-428` | -- | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] creates, validates variants and publishes a product | `api/test/store-admin.integration.e2e-spec.ts:393` | **BLOCKED** |
| `API-E-429` | -- | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] uploads, reorders and deletes images | `api/test/store-admin.integration.e2e-spec.ts:438` | **BLOCKED** |
| `API-E-430` | -- | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] removes the uploaded file when saving the image row fails | `api/test/store-admin.integration.e2e-spec.ts:491` | **BLOCKED** |
| `API-E-431` | -- | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] returns the ordered gallery on the public product detail | `api/test/store-admin.integration.e2e-spec.ts:511` | **BLOCKED** |
| `API-E-432` | `NV10-F01` | Quản trị Cửa hàng — Sản phẩm/Giá/Audit (PG) | [Store admin (migrated PostgreSQL)] audits catalog and sales settings changes with actor and before/after (NV10-F01) | `api/test/store-admin.integration.e2e-spec.ts:533` | **BLOCKED** |

#### `api/test/store-orders.e2e-spec.ts` — Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) (`BLOCKED · 8 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` từ `pg-pool`) và sandbox chặn HTTP loopback (`connect EACCES 127.0.0.1`) đối với Supertest.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-433` | -- | Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) | [Store order HTTP authorization and contract] requires login on every customer route | `api/test/store-orders.e2e-spec.ts:105` | **BLOCKED** |
| `API-E-434` | -- | Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) | [Store order HTTP authorization and contract] lets STORE_MANAGER list, confirm and read statistics but not approve inventory | `api/test/store-orders.e2e-spec.ts:117` | **BLOCKED** |
| `API-E-435` | -- | Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) | [Store order HTTP authorization and contract] permits admin reports and returns zero values for an empty store | `api/test/store-orders.e2e-spec.ts:149` | **BLOCKED** |
| `API-E-436` | -- | Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) | [Store order HTTP authorization and contract] returns 404 for another customer order and 403 for farm or staff-role violations | `api/test/store-orders.e2e-spec.ts:165` | **BLOCKED** |
| `API-E-437` | -- | Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) | [Store order HTTP authorization and contract] no longer lets EMPLOYEE manage orders | `api/test/store-orders.e2e-spec.ts:190` | **BLOCKED** |
| `API-E-438` | -- | Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) | [Store order HTTP authorization and contract] keeps a store-only manager out of warehouse, asset and maintenance routes | `api/test/store-orders.e2e-spec.ts:213` | **BLOCKED** |
| `API-E-439` | -- | Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) | [Store order HTTP authorization and contract] checks the selling farm even for a member of another farm | `api/test/store-orders.e2e-spec.ts:249` | **BLOCKED** |
| `API-E-440` | -- | Đơn hàng Cửa hàng — Đặt hàng & Luồng khách (E2E) | [Store order HTTP authorization and contract] validates payloads, calendar filters and customer cancellation | `api/test/store-orders.e2e-spec.ts:269` | **BLOCKED** |

#### `api/test/store-orders.integration.e2e-spec.ts` — Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) (`BLOCKED · 44 test case`)

- **Runner:** `pnpm --dir api test:db (jest-db.json) / test:e2e`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-441` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] keeps order tables behind the API rather than direct Supabase Data API access | `api/test/store-orders.integration.e2e-spec.ts:53` | **BLOCKED** |
| `API-E-442` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] tells staff which of their farms sell online and nothing to customers | `api/test/store-orders.integration.e2e-spec.ts:68` | **BLOCKED** |
| `API-E-443` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] adds the fee of the delivery region and rejects a fee the customer did not see | `api/test/store-orders.integration.e2e-spec.ts:79` | **BLOCKED** |
| `API-E-444` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] lets delivery staff take an order, return it with a reason and mark it delivered | `api/test/store-orders.integration.e2e-spec.ts:152` | **BLOCKED** |
| `API-E-445` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] takes prices from the server and snapshots fractional stock steps | `api/test/store-orders.integration.e2e-spec.ts:267` | **BLOCKED** |
| `API-E-446` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] replays before checking changed prices, stock, or membership, and rejects changed payloads | `api/test/store-orders.integration.e2e-spec.ts:305` | **BLOCKED** |
| `API-E-447` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] rejects stale price consent, insufficient quantity and unpublished products | `api/test/store-orders.integration.e2e-spec.ts:332` | **BLOCKED** |
| `API-E-448` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] does not expose another customer order and does not allow staff checkout | `api/test/store-orders.integration.e2e-spec.ts:353` | **BLOCKED** |
| `API-E-449` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] confirms into one draft without deducting stock; shipping waits for admin approval | `api/test/store-orders.integration.e2e-spec.ts:370` | **BLOCKED** |
| `API-E-450` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] uses saved stock quantity and warehouse when variant step or store settings change | `api/test/store-orders.integration.e2e-spec.ts:445` | **BLOCKED** |
| `API-E-451` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] keeps internal storefront tables behind row-level security | `api/test/store-orders.integration.e2e-spec.ts:467` | **BLOCKED** |
| `API-E-452` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] sells only what the sales warehouse holds, never from a source warehouse (AC14, AC17) | `api/test/store-orders.integration.e2e-spec.ts:491` | **BLOCKED** |
| `API-E-453` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] promises only sales stock not held by confirmed orders or outgoing transfers | `api/test/store-orders.integration.e2e-spec.ts:536` | **BLOCKED** |
| `API-E-454` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] confirms a legacy PREPARING order once its top-up transfer is approved (AC21) | `api/test/store-orders.integration.e2e-spec.ts:605` | **BLOCKED** |
| `API-E-455` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] sends a legacy order back to PENDING on rejection and never drafts a new top-up | `api/test/store-orders.integration.e2e-spec.ts:639` | **BLOCKED** |
| `API-E-456` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] cancels a legacy order with its pending top-up transfers | `api/test/store-orders.integration.e2e-spec.ts:662` | **BLOCKED** |
| `API-E-457` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] cancelling a legacy order leaves a dispatched top-up on its way to the sales warehouse | `api/test/store-orders.integration.e2e-spec.ts:679` | **BLOCKED** |
| `API-E-458` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] keeps a legacy order PREPARING when stock is gone by the time the transfer arrives | `api/test/store-orders.integration.e2e-spec.ts:697` | **BLOCKED** |
| `API-E-459` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] fills an order from one sales warehouse, never adding stock across farms or internal warehouses | `api/test/store-orders.integration.e2e-spec.ts:756` | **BLOCKED** |
| `API-E-460` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] refuses a cart that no single sales warehouse can fill | `api/test/store-orders.integration.e2e-spec.ts:864` | **BLOCKED** |
| `API-E-461` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] confirms an order next to a legacy XB- issue code without reusing it | `api/test/store-orders.integration.e2e-spec.ts:928` | **BLOCKED** |
| `API-E-462` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] blocks linked issue cancellation and edits that differ from order items or quantities | `api/test/store-orders.integration.e2e-spec.ts:942` | **BLOCKED** |
| `API-E-463` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] cancels the draft with the order, but cannot cancel an approved issue or confirmed customer order | `api/test/store-orders.integration.e2e-spec.ts:970` | **BLOCKED** |
| `API-E-464` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] cancels a submitted order issue with the order and never rejects it on its own | `api/test/store-orders.integration.e2e-spec.ts:1000` | **BLOCKED** |
| `API-E-465` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] requires a verified bank transfer before shipping and reconciles it once (AC18) | `api/test/store-orders.integration.e2e-spec.ts:1019` | **BLOCKED** |
| `API-E-466` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] records COD cash collected on delivery and handed over separately, once (AC19) | `api/test/store-orders.integration.e2e-spec.ts:1086` | **BLOCKED** |
| `API-E-467` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] cancels a paid order only with a recorded manual refund (AC20) | `api/test/store-orders.integration.e2e-spec.ts:1121` | **BLOCKED** |
| `API-E-468` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] retries a failed delivery without putting stock back (AC19) | `api/test/store-orders.integration.e2e-spec.ts:1202` | **BLOCKED** |
| `API-E-469` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] raises stock only when the warehouse confirms the counted return, once, then records the refund (AC20) | `api/test/store-orders.integration.e2e-spec.ts:1214` | **BLOCKED** |
| `API-E-470` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] refuses a return receipt holding more than shipped, and a rejected one gives the goods back to the shipper | `api/test/store-orders.integration.e2e-spec.ts:1283` | **BLOCKED** |
| `API-E-471` | `P1-08` | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] takes back the very assets it shipped, each in its inspected condition (P1-08) | `api/test/store-orders.integration.e2e-spec.ts:1331` | **BLOCKED** |
| `API-E-472` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] closes a return with nothing usable to take back (E05) | `api/test/store-orders.integration.e2e-spec.ts:1471` | **BLOCKED** |
| `API-E-473` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] offers a VietQR of the stored total only while a bank transfer is unpaid | `api/test/store-orders.integration.e2e-spec.ts:1501` | **BLOCKED** |
| `API-E-474` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] picks unexpired lots FEFO, permits equivalent lot reassignment and keeps shortages pending | `api/test/store-orders.integration.e2e-spec.ts:1539` | **BLOCKED** |
| `API-E-475` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] counts sufficient saleable assets, excludes maintenance/inactive locations and retires sold assets | `api/test/store-orders.integration.e2e-spec.ts:1604` | **BLOCKED** |
| `API-E-476` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] does not hand the same asset or lot quantity to two unapproved order drafts | `api/test/store-orders.integration.e2e-spec.ts:1665` | **BLOCKED** |
| `API-E-477` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] does not allocate lot quantity already held by another order draft | `api/test/store-orders.integration.e2e-spec.ts:1702` | **BLOCKED** |
| `API-E-478` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders (migrated PostgreSQL)] reports only completed merchandise revenue by completion date and preserves customer history | `api/test/store-orders.integration.e2e-spec.ts:1739` | **BLOCKED** |
| `API-E-479` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders on concurrent PostgreSQL connections] makes a sales warehouse switch wait for an order being placed in it | `api/test/store-orders.integration.e2e-spec.ts:1803` | **BLOCKED** |
| `API-E-480` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders on concurrent PostgreSQL connections] creates only one order for simultaneous retries | `api/test/store-orders.integration.e2e-spec.ts:1849` | **BLOCKED** |
| `API-E-481` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders on concurrent PostgreSQL connections] waits for an in-flight order before validating a retry against changed catalog data | `api/test/store-orders.integration.e2e-spec.ts:1866` | **BLOCKED** |
| `API-E-482` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders on concurrent PostgreSQL connections] lets only one of two orders competing for the last stock reserve it (AC15, AC16) | `api/test/store-orders.integration.e2e-spec.ts:1913` | **BLOCKED** |
| `API-E-483` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders on concurrent PostgreSQL connections] creates only one draft for simultaneous confirmations | `api/test/store-orders.integration.e2e-spec.ts:1996` | **BLOCKED** |
| `API-E-484` | -- | Đơn hàng Cửa hàng — Xử lý, Xuất kho, Hoàn trả (PG) | [Store orders on concurrent PostgreSQL connections] serializes cancellation against inventory approval without a cancelled-but-deducted order | `api/test/store-orders.integration.e2e-spec.ts:2015` | **BLOCKED** |

#### `api/test/store-warranties.integration.e2e-spec.ts` — Bảo hành & Đổi trả Cửa hàng (NV06 / PG) (`BLOCKED · 10 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-485` | `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] accepts only lines of a delivered order of this farm, within the bought quantity (AC22) | `api/test/store-warranties.integration.e2e-spec.ts:89` | **BLOCKED** |
| `API-E-486` | `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] keeps the warranty sold with the order and allows only paid repair once it expired | `api/test/store-warranties.integration.e2e-spec.ts:125` | **BLOCKED** |
| `API-E-487` | `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] never starts a paid repair before the customer agrees to the quote (AC23) | `api/test/store-warranties.integration.e2e-spec.ts:146` | **BLOCKED** |
| `API-E-488` | `P1-10`, `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] re-quotes and repairs again within the same request, asking consent each time (P1-10) | `api/test/store-warranties.integration.e2e-spec.ts:172` | **BLOCKED** |
| `API-E-489` | `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] records an agreed paid repair through to handing it back | `api/test/store-warranties.integration.e2e-spec.ts:229` | **BLOCKED** |
| `API-E-490` | `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] exchanges through one stock issue and closes only once it is confirmed (AC24) | `api/test/store-warranties.integration.e2e-spec.ts:260` | **BLOCKED** |
| `API-E-491` | `P1-07`, `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] hands an exchanged ASSET to the customer instead of leaving it in internal use (P1-07) | `api/test/store-warranties.integration.e2e-spec.ts:292` | **BLOCKED** |
| `API-E-492` | `P1-09`, `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] claims an ASSET by the delivered unit, one open claim per unit (P1-09) | `api/test/store-warranties.integration.e2e-spec.ts:359` | **BLOCKED** |
| `API-E-493` | `P1-09`, `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] refuses an asset id on a quantity line (P1-09) | `api/test/store-warranties.integration.e2e-spec.ts:431` | **BLOCKED** |
| `API-E-494` | `P0-04`, `NV06` | Bảo hành & Đổi trả Cửa hàng (NV06 / PG) | [Store warranties NV06 (migrated PostgreSQL)] keeps the exchange issue equal to the approved request until it is confirmed (P0-04) | `api/test/store-warranties.integration.e2e-spec.ts:446` | **BLOCKED** |

#### `api/test/storefront-schema.integration.e2e-spec.ts` — Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) (`BLOCKED · 14 khai báo -> **23** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:db (jest-db.json) / test:e2e`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-495` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] matches Drizzle columns for $name **(x6 biến thể)** | `api/test/storefront-schema.integration.e2e-spec.ts:109` | **BLOCKED** |
| `API-E-496` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] defaults products to drafts and matches the status enum | `api/test/storefront-schema.integration.e2e-spec.ts:129` | **BLOCKED** |
| `API-E-497` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] permits fractional quantity/lot steps and whole serialized equipment | `api/test/storefront-schema.integration.e2e-spec.ts:153` | **BLOCKED** |
| `API-E-498` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] defaults the step to one and allows zero-price variants | `api/test/storefront-schema.integration.e2e-spec.ts:178` | **BLOCKED** |
| `API-E-499` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] rejects invalid price %s **(x2 biến thể)** | `api/test/storefront-schema.integration.e2e-spec.ts:187` | **BLOCKED** |
| `API-E-500` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] rejects invalid quantity step %s **(x3 biến thể)** | `api/test/storefront-schema.integration.e2e-spec.ts:195` | **BLOCKED** |
| `API-E-501` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] requires serialized equipment step one, rejecting %s **(x2 biến thể)** | `api/test/storefront-schema.integration.e2e-spec.ts:207` | **BLOCKED** |
| `API-E-502` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] protects the serial rule when changing the mapping, the step or the tracking mode | `api/test/storefront-schema.integration.e2e-spec.ts:218` | **BLOCKED** |
| `API-E-503` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] keeps a mapped item in the unit of its variant | `api/test/storefront-schema.integration.e2e-spec.ts:246` | **BLOCKED** |
| `API-E-504` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] maps an item to one variant, only for its own farm, once per farm | `api/test/storefront-schema.integration.e2e-spec.ts:268` | **BLOCKED** |
| `API-E-505` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] supports an ordered gallery and rejects duplicate or negative positions | `api/test/storefront-schema.integration.e2e-spec.ts:298` | **BLOCKED** |
| `API-E-506` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] keeps one sales warehouse per farm, owned by that farm, and enables only complete settings | `api/test/storefront-schema.integration.e2e-spec.ts:329` | **BLOCKED** |
| `API-E-507` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] rejects unknown references | `api/test/storefront-schema.integration.e2e-spec.ts:365` | **BLOCKED** |
| `API-E-508` | -- | Storefront Schema — Sản phẩm/Biến thể/Đơn (PG) | [Storefront schema (migrated PostgreSQL)] rejects duplicate slugs and invalid public slugs | `api/test/storefront-schema.integration.e2e-spec.ts:393` | **BLOCKED** |

#### `api/test/storefront-seed.integration.e2e-spec.ts` — Storefront Seed Script & Bảo vệ môi trường (`BLOCKED · 6 khai báo -> **7** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:db (jest-db.json) / test:e2e`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-509` | -- | Storefront Seed Script & Bảo vệ môi trường | [Storefront seed] upserts all five tables twice with stable IDs and unchanged warehouse data | `api/test/storefront-seed.integration.e2e-spec.ts:111` | **BLOCKED** |
| `API-E-510` | -- | Storefront Seed Script & Bảo vệ môi trường | [Storefront seed] reuses existing category and product IDs by slug | `api/test/storefront-seed.integration.e2e-spec.ts:152` | **BLOCKED** |
| `API-E-511` | -- | Storefront Seed Script & Bảo vệ môi trường | [Storefront seed] preserves the configured sales warehouse | `api/test/storefront-seed.integration.e2e-spec.ts:178` | **BLOCKED** |
| `API-E-512` | -- | Storefront Seed Script & Bảo vệ môi trường | [Storefront seed] rejects missing prerequisites without a partial seed | `api/test/storefront-seed.integration.e2e-spec.ts:194` | **BLOCKED** |
| `API-E-513` | -- | Storefront Seed Script & Bảo vệ môi trường | [Storefront seed] rolls back instead of reassigning an item already sold by another product | `api/test/storefront-seed.integration.e2e-spec.ts:208` | **BLOCKED** |
| `API-E-514` | -- | Storefront Seed Script & Bảo vệ môi trường | [Storefront seed] refuses unsafe CLI destination $NODE_ENV / $DATABASE_URL **(x2 biến thể)** | `api/test/storefront-seed.integration.e2e-spec.ts:250` | **BLOCKED** |

#### `api/test/warehouse-business-flow.integration.e2e-spec.ts` — Luồng Kho liên hoàn (Nhập-Xuất-Chuyển-Kiểm-ĐC) (`BLOCKED · 1 khai báo -> **2** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-515` | -- | Luồng Kho liên hoàn (Nhập-Xuất-Chuyển-Kiểm-ĐC) | [Warehouse business flow across documents and ledger] %s: reconciles receipt, issue, transfer, count and adjustment, including rejected operations **(x2 biến thể)** | `api/test/warehouse-business-flow.integration.e2e-spec.ts:23` | **BLOCKED** |

#### `api/test/warehouse-schema.integration.e2e-spec.ts` — Warehouse Schema — Enums & Cột DB (`BLOCKED · 2 khai báo -> **7** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-516` | -- | Warehouse Schema — Enums & Cột DB | [Warehouse migration and application schema compatibility] matches database enum $enumName **(x2 biến thể)** | `api/test/warehouse-schema.integration.e2e-spec.ts:18` | **BLOCKED** |
| `API-E-517` | -- | Warehouse Schema — Enums & Cột DB | [Warehouse migration and application schema compatibility] matches migrated columns of $name **(x5 biến thể)** | `api/test/warehouse-schema.integration.e2e-spec.ts:33` | **BLOCKED** |

#### `api/test/warehouse-scope.integration.e2e-spec.ts` — Phạm vi quản lý theo Kho (Warehouse Scope) (`BLOCKED · 3 test case`)

- **Runner:** `pnpm --dir api test:e2e (jest-e2e.json)`
- **Nguyên nhân block:** BLOCKED — Không kết nối được PostgreSQL (`AggregateError` / không có DB test khả dụng trong môi trường sandbox).

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-518` | -- | Phạm vi quản lý theo Kho (Warehouse Scope) | [Warehouse scope (migrated PostgreSQL)] limits warehouses, stock, reports and new documents to assigned warehouses | `api/test/warehouse-scope.integration.e2e-spec.ts:113` | **BLOCKED** |
| `API-E-519` | `P1-02` | Phạm vi quản lý theo Kho (Warehouse Scope) | [Warehouse scope (migrated PostgreSQL)] lets only managers of the destination receive an asset dispatched across warehouses (P1-02) | `api/test/warehouse-scope.integration.e2e-spec.ts:177` | **BLOCKED** |
| `API-E-520` | -- | Phạm vi quản lý theo Kho (Warehouse Scope) | [Warehouse scope (migrated PostgreSQL)] keeps the scope across warehouse boundaries: destinations, returns, maintenance | `api/test/warehouse-scope.integration.e2e-spec.ts:264` | **BLOCKED** |

#### `api/test/warehouses.integration.e2e-spec.ts` — Kho & Vị trí lưu trữ, Audit Ngừng hoạt động (`BLOCKED · 11 khai báo -> **13** lượt chạy qua `.each` / vòng lặp`)

- **Runner:** `pnpm --dir api test:personnel (jest-personnel.config.cjs)`
- **Nguyên nhân block:** BLOCKED — Kế thừa guard `TEST_DATABASE_URL` (`*_test`) từ `jest-assets.config.cjs` & thiếu kết nối PostgreSQL.

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `API-E-521` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] lists only the selected farm, searches code/name, filters status and paginates | `api/test/warehouses.integration.e2e-spec.ts:159` | **BLOCKED** |
| `API-E-522` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] returns detail and creates normalized master data | `api/test/warehouses.integration.e2e-spec.ts:205` | **BLOCKED** |
| `API-E-523` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] updates only provided fields and clears nullable fields | `api/test/warehouses.integration.e2e-spec.ts:236` | **BLOCKED** |
| `API-E-524` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] returns an actionable duplicate-code conflict on %s **(x2 biến thể)** | `api/test/warehouses.integration.e2e-spec.ts:256` | **BLOCKED** |
| `API-E-525` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] deactivates an empty warehouse without deleting it | `api/test/warehouses.integration.e2e-spec.ts:278` | **BLOCKED** |
| `API-E-526` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] rejects DELETE and status PATCH when holding %s **(x2 biến thể)** | `api/test/warehouses.integration.e2e-spec.ts:292` | **BLOCKED** |
| `API-E-527` | `NV08-F01` | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] audits create, update and deactivation with actor and before/after (NV08-F01) | `api/test/warehouses.integration.e2e-spec.ts:352` | **BLOCKED** |
| `API-E-528` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] allows guest reads while denying all write operations | `api/test/warehouses.integration.e2e-spec.ts:424` | **BLOCKED** |
| `API-E-529` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] rejects cross-farm IDs and non-members, even with valid IDs | `api/test/warehouses.integration.e2e-spec.ts:447` | **BLOCKED** |
| `API-E-530` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] allows ADMIN writes and denies inactive membership | `api/test/warehouses.integration.e2e-spec.ts:462` | **BLOCKED** |
| `API-E-531` | -- | Kho & Vị trí lưu trữ, Audit Ngừng hoạt động | [Warehouse management HTTP contract] validates query/DTO boundaries | `api/test/warehouses.integration.e2e-spec.ts:482` | **BLOCKED** |

## 7. Chi Tiết Mobile App — Unit Tests & Phần Chưa Phủ Test (23 File Test Tự Động, 139 Cases: 139 PASS)

### 7.1. Các suite Unit Test tự động hiện có (23 File, 139 Cases — 100% PASS)

#### `mobile/src/features/activity/model.test.ts` — Mobile — Lịch sử hoạt động & Tải liên kết (`PASS 8/8`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-001` | -- | Mobile — Lịch sử hoạt động & Tải liên kết | [Audit history presentation] handles seeded lower-case entity types and opens an existing issue, never a new form | `mobile/src/features/activity/model.test.ts:10` | **PASS** |
| `MOB-U-002` | -- | Mobile — Lịch sử hoạt động & Tải liên kết | [Audit history presentation] does not invent a diff when a snapshot was not stored | `mobile/src/features/activity/model.test.ts:17` | **PASS** |
| `MOB-U-003` | -- | Mobile — Lịch sử hoạt động & Tải liên kết | [Audit history presentation] reads document snapshots without borrowing the status of line items | `mobile/src/features/activity/model.test.ts:21` | **PASS** |
| `MOB-U-004` | -- | Mobile — Lịch sử hoạt động & Tải liên kết | [Audit history presentation] compares nested fields independent of key order or SQL/JS naming | `mobile/src/features/activity/model.test.ts:27` | **PASS** |
| `MOB-U-005` | -- | Mobile — Lịch sử hoạt động & Tải liên kết | [Audit history presentation] distinguishes absent fields, null, zero, false and empty strings | `mobile/src/features/activity/model.test.ts:34` | **PASS** |
| `MOB-U-006` | -- | Mobile — Lịch sử hoạt động & Tải liên kết | [Audit history presentation] does not mistake reordered receipt lines for quantity changes | `mobile/src/features/activity/model.test.ts:42` | **PASS** |
| `MOB-U-007` | -- | Mobile — Lịch sử hoạt động & Tải liên kết | [Audit history presentation] keeps snapshots available but does not link deleted or unsupported records | `mobile/src/features/activity/model.test.ts:50` | **PASS** |
| `MOB-U-008` | -- | Mobile — Lịch sử hoạt động & Tải liên kết | [Audit history presentation] uses the farm name only when the snapshot matches the selected farm | `mobile/src/features/activity/model.test.ts:57` | **PASS** |

#### `mobile/src/features/assets/asset-transfer.logic.test.ts` — Mobile — Logic yêu cầu chuyển tài sản (`PASS 6/6`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-009` | -- | Mobile — Logic yêu cầu chuyển tài sản | [asset-transfer.logic] checks if a user role can manage asset transfers | `mobile/src/features/assets/asset-transfer.logic.test.ts:13` | **PASS** |
| `MOB-U-010` | -- | Mobile — Logic yêu cầu chuyển tài sản | [asset-transfer.logic] determines if user can review pending transfer | `mobile/src/features/assets/asset-transfer.logic.test.ts:21` | **PASS** |
| `MOB-U-011` | -- | Mobile — Logic yêu cầu chuyển tài sản | [asset-transfer.logic] determines if user can receive IN_TRANSIT transfer at destination | `mobile/src/features/assets/asset-transfer.logic.test.ts:27` | **PASS** |
| `MOB-U-012` | -- | Mobile — Logic yêu cầu chuyển tài sản | [asset-transfer.logic] provides Vietnamese labels and appropriate tones for transfer request statuses | `mobile/src/features/assets/asset-transfer.logic.test.ts:34` | **PASS** |
| `MOB-U-013` | -- | Mobile — Logic yêu cầu chuyển tài sản | [asset-transfer.logic] validates destination transfer receive input | `mobile/src/features/assets/asset-transfer.logic.test.ts:45` | **PASS** |
| `MOB-U-014` | -- | Mobile — Logic yêu cầu chuyển tài sản | [asset-transfer.logic] extracts scanned asset code from raw token or scan URI | `mobile/src/features/assets/asset-transfer.logic.test.ts:94` | **PASS** |

#### `mobile/src/features/assets/maintenance.logic.test.ts` — Mobile — Logic lịch & bảo trì tài sản (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-015` | -- | Mobile — Logic lịch & bảo trì tài sản | [maintenance.logic] identifies farm owners and admins who can make final decisions | `mobile/src/features/assets/maintenance.logic.test.ts:11` | **PASS** |
| `MOB-U-016` | -- | Mobile — Logic lịch & bảo trì tài sản | [maintenance.logic] restricts maintenance request approval to farm admins and owners | `mobile/src/features/assets/maintenance.logic.test.ts:19` | **PASS** |
| `MOB-U-017` | -- | Mobile — Logic lịch & bảo trì tài sản | [maintenance.logic] detects when a maintenance record is awaiting final decision from farm owner | `mobile/src/features/assets/maintenance.logic.test.ts:26` | **PASS** |
| `MOB-U-018` | -- | Mobile — Logic lịch & bảo trì tài sản | [maintenance.logic] formats final decision labels and tones correctly | `mobile/src/features/assets/maintenance.logic.test.ts:71` | **PASS** |

#### `mobile/src/features/auth/session/sign-out-device.test.ts` — Mobile — Đăng xuất & Gỡ đăng ký Push Device (`PASS 2/2`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-019` | -- | Mobile — Đăng xuất & Gỡ đăng ký Push Device | [current device sign-out] revokes push before removing the Clerk session, then clears cached account data | `mobile/src/features/auth/session/sign-out-device.test.ts:5` | **PASS** |
| `MOB-U-020` | -- | Mobile — Đăng xuất & Gỡ đăng ký Push Device | [current device sign-out] does not clear cache or claim success when Clerk sign-out fails | `mobile/src/features/auth/session/sign-out-device.test.ts:20` | **PASS** |

#### `mobile/src/features/auth/session/startup-policy.test.ts` — Mobile — Chính sách điều hướng khởi động (Auth/Onboarding) (`PASS 6/6`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-021` | -- | Mobile — Chính sách điều hướng khởi động (Auth/Onboarding) | [session startup policy] preserves an existing login on the first native launch after upgrading | `mobile/src/features/auth/session/startup-policy.test.ts:17` | **PASS** |
| `MOB-U-022` | -- | Mobile — Chính sách điều hướng khởi động (Auth/Onboarding) | [session startup policy] preserves a login when the app is closed and reopened in a new Activity | `mobile/src/features/auth/session/startup-policy.test.ts:25` | **PASS** |
| `MOB-U-023` | -- | Mobile — Chính sách điều hướng khởi động (Auth/Onboarding) | [session startup policy] resets a login after a full JS reload inside the same Activity | `mobile/src/features/auth/session/startup-policy.test.ts:31` | **PASS** |
| `MOB-U-024` | -- | Mobile — Chính sách điều hướng khởi động (Auth/Onboarding) | [session startup policy] never auto signs out in production, including a JS restart in the same Activity | `mobile/src/features/auth/session/startup-policy.test.ts:37` | **PASS** |
| `MOB-U-025` | -- | Mobile — Chính sách điều hướng khởi động (Auth/Onboarding) | [session startup policy] preserves login on an older APK or Expo Go without the native module | `mobile/src/features/auth/session/startup-policy.test.ts:43` | **PASS** |
| `MOB-U-026` | -- | Mobile — Chính sách điều hướng khởi động (Auth/Onboarding) | [session startup policy] does not treat unreadable storage as permission to log out | `mobile/src/features/auth/session/startup-policy.test.ts:51` | **PASS** |

#### `mobile/src/features/auth/session/startup-runtime.test.ts` — Mobile — Runtime kiểm tra phiên khi mở App (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-027` | -- | Mobile — Runtime kiểm tra phiên khi mở App | [session startup runtime] does not repeat a Reload sign-out after concurrent renders or a subsequent remount | `mobile/src/features/auth/session/startup-runtime.test.ts:32` | **PASS** |
| `MOB-U-028` | -- | Mobile — Runtime kiểm tra phiên khi mở App | [session startup runtime] permits a retry if the sign-out operation fails | `mobile/src/features/auth/session/startup-runtime.test.ts:45` | **PASS** |
| `MOB-U-029` | -- | Mobile — Runtime kiểm tra phiên khi mở App | [session startup runtime] preserves a login when the native Activity changed between app opens | `mobile/src/features/auth/session/startup-runtime.test.ts:54` | **PASS** |

#### `mobile/src/features/inventory/api.test.ts` — Mobile — Inventory API, Phân trang & Cảnh báo tồn (`PASS 17/17`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-030` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [inventory balance scope] only keeps positive balances from the selected farm and warehouse | `mobile/src/features/inventory/api.test.ts:16` | **PASS** |
| `MOB-U-031` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [inventory balance scope] loads every paginated balance row instead of silently stopping at the API default page | `mobile/src/features/inventory/api.test.ts:29` | **PASS** |
| `MOB-U-032` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [inventory balance scope] loads remaining pages concurrently but returns balances in page order | `mobile/src/features/inventory/api.test.ts:52` | **PASS** |
| `MOB-U-033` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [inventory balance scope] does not treat a quantity-tracked item balance as a lot balance | `mobile/src/features/inventory/api.test.ts:73` | **PASS** |
| `MOB-U-034` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [available asset scope] uses the API locationWarehouseId field and excludes other farms, warehouses, and statuses | `mobile/src/features/inventory/api.test.ts:83` | **PASS** |
| `MOB-U-035` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [low stock alerts] sums lots in the selected warehouse without counting balances from other warehouses | `mobile/src/features/inventory/api.test.ts:110` | **PASS** |
| `MOB-U-036` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [low stock alerts] includes active items with no balance as zero stock when a minimum is configured | `mobile/src/features/inventory/api.test.ts:123` | **PASS** |
| `MOB-U-037` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [inventory forecast] estimates remaining days from recent outbound transactions in the selected warehouse only | `mobile/src/features/inventory/api.test.ts:138` | **PASS** |
| `MOB-U-038` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [inventory forecast] does not forecast zero stock, positive adjustments, or transactions outside the 30-day window | `mobile/src/features/inventory/api.test.ts:149` | **PASS** |
| `MOB-U-039` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [inventory forecast] queries only the 30-day forecast window and preserves the exact cutoff locally | `mobile/src/features/inventory/api.test.ts:157` | **PASS** |
| `MOB-U-040` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [inventory ledger filters] keeps the warehouse and type while sending the selected date and page | `mobile/src/features/inventory/api.test.ts:174` | **PASS** |
| `MOB-U-041` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [document code label] names an uncoded draft by its short id and keeps a permanent code | `mobile/src/features/inventory/api.test.ts:190` | **PASS** |
| `MOB-U-042` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [lot suggestion lookup] requests an exact supplier number within the selected farm and item | `mobile/src/features/inventory/api.test.ts:202` | **PASS** |
| `MOB-U-043` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [server-paginated & single-record inventory helpers] requests categories and single-page items with server filter params | `mobile/src/features/inventory/api.test.ts:224` | **PASS** |
| `MOB-U-044` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [server-paginated & single-record inventory helpers] fetches single item, lot, and asset detail records cleanly | `mobile/src/features/inventory/api.test.ts:263` | **PASS** |
| `MOB-U-045` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [server-paginated & single-record inventory helpers] forwards comma-joined itemIds, excludeStatuses, summary, forecast, lots, and maintenance pages | `mobile/src/features/inventory/api.test.ts:280` | **PASS** |
| `MOB-U-046` | -- | Mobile — Inventory API, Phân trang & Cảnh báo tồn | [server-paginated & single-record inventory helpers] requests paginated active locations and scoped balances for specific items | `mobile/src/features/inventory/api.test.ts:312` | **PASS** |

#### `mobile/src/features/inventory/receipt-payload.test.ts` — Mobile — Build Payload Phiếu nhập kho (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-047` | -- | Mobile — Build Payload Phiếu nhập kho | [receipt lot payload] allows a new lot without a printed number and never sends an internal code | `mobile/src/features/inventory/receipt-payload.test.ts:5` | **PASS** |
| `MOB-U-048` | -- | Mobile — Build Payload Phiếu nhập kho | [receipt lot payload] sends only lotId for an existing lot while retaining its saved line identity | `mobile/src/features/inventory/receipt-payload.test.ts:22` | **PASS** |
| `MOB-U-049` | -- | Mobile — Build Payload Phiếu nhập kho | [receipt lot payload] keeps the printed number for a new lot even if another line has the same value | `mobile/src/features/inventory/receipt-payload.test.ts:46` | **PASS** |
| `MOB-U-050` | -- | Mobile — Build Payload Phiếu nhập kho | [receipt lot payload] keeps the saved line ID when resaving a new-lot draft without turning legacy data into a supplier number | `mobile/src/features/inventory/receipt-payload.test.ts:55` | **PASS** |
| `MOB-U-051` | -- | Mobile — Build Payload Phiếu nhập kho | [receipt lot payload] sends locationId for ASSET lines and retains it when resaving a draft, while omitting it on QUANTITY/LOT lines | `mobile/src/features/inventory/receipt-payload.test.ts:62` | **PASS** |

#### `mobile/src/features/inventory/stock-count.logic.test.ts` — Mobile — Logic Phiếu kiểm kê kho (`PASS 6/6`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-052` | -- | Mobile — Logic Phiếu kiểm kê kho | [stock-count.logic] determines if stock count line is for an asset | `mobile/src/features/inventory/stock-count.logic.test.ts:10` | **PASS** |
| `MOB-U-053` | -- | Mobile — Logic Phiếu kiểm kê kho | [stock-count.logic] determines if stock count is editable based on status | `mobile/src/features/inventory/stock-count.logic.test.ts:16` | **PASS** |
| `MOB-U-054` | -- | Mobile — Logic Phiếu kiểm kê kho | [stock-count.logic] serializes quantity and lot lines accurately | `mobile/src/features/inventory/stock-count.logic.test.ts:24` | **PASS** |
| `MOB-U-055` | -- | Mobile — Logic Phiếu kiểm kê kho | [stock-count.logic] preserves assetId, assetCondition, and foundLocationId for present assets | `mobile/src/features/inventory/stock-count.logic.test.ts:35` | **PASS** |
| `MOB-U-056` | -- | Mobile — Logic Phiếu kiểm kê kho | [stock-count.logic] strips condition and foundLocationId when an asset is missing (quantity 0) | `mobile/src/features/inventory/stock-count.logic.test.ts:58` | **PASS** |
| `MOB-U-057` | -- | Mobile — Logic Phiếu kiểm kê kho | [stock-count.logic] validates stock count lines correctly | `mobile/src/features/inventory/stock-count.logic.test.ts:81` | **PASS** |

#### `mobile/src/features/inventory/stock-date-range.test.ts` — Mobile — Chuẩn hóa khoảng ngày sổ kho (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-058` | -- | Mobile — Chuẩn hóa khoảng ngày sổ kho | [stock date range] converts two inclusive Vietnamese calendar dates to API dates | `mobile/src/features/inventory/stock-date-range.test.ts:5` | **PASS** |
| `MOB-U-059` | -- | Mobile — Chuẩn hóa khoảng ngày sổ kho | [stock date range] allows one-sided and cleared filters | `mobile/src/features/inventory/stock-date-range.test.ts:10` | **PASS** |
| `MOB-U-060` | -- | Mobile — Chuẩn hóa khoảng ngày sổ kho | [stock date range] blocks impossible and reversed dates before requesting | `mobile/src/features/inventory/stock-date-range.test.ts:16` | **PASS** |

#### `mobile/src/features/inventory/stock-issue.logic.test.ts` — Mobile — Logic Phiếu xuất kho (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-061` | -- | Mobile — Logic Phiếu xuất kho | [issueReceiptAction] allows the recipient to acknowledge receipt themselves | `mobile/src/features/inventory/stock-issue.logic.test.ts:7` | **PASS** |
| `MOB-U-062` | -- | Mobile — Logic Phiếu xuất kho | [issueReceiptAction] allows warehouse managers and farm admins to record receipt on behalf of recipient | `mobile/src/features/inventory/stock-issue.logic.test.ts:11` | **PASS** |
| `MOB-U-063` | -- | Mobile — Logic Phiếu xuất kho | [issueReceiptAction] denies employees who are not the recipient | `mobile/src/features/inventory/stock-issue.logic.test.ts:17` | **PASS** |
| `MOB-U-064` | -- | Mobile — Logic Phiếu xuất kho | [issueReceiptAction] returns null if issue is not CONFIRMED, has no recipient, or is already received | `mobile/src/features/inventory/stock-issue.logic.test.ts:21` | **PASS** |

#### `mobile/src/features/notifications/api.test.ts` — Mobile — Notifications API & Điều hướng đích (`PASS 8/8`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-065` | -- | Mobile — Notifications API & Điều hướng đích | [notification detail navigation] routes STOCK_RECEIPT notifications to their corresponding document detail | `mobile/src/features/notifications/api.test.ts:17` | **PASS** |
| `MOB-U-066` | -- | Mobile — Notifications API & Điều hướng đích | [notification detail navigation] routes STOCK_ISSUE notifications to their corresponding document detail | `mobile/src/features/notifications/api.test.ts:17` | **PASS** |
| `MOB-U-067` | -- | Mobile — Notifications API & Điều hướng đích | [notification detail navigation] routes STOCK_COUNT notifications to their corresponding document detail | `mobile/src/features/notifications/api.test.ts:17` | **PASS** |
| `MOB-U-068` | -- | Mobile — Notifications API & Điều hướng đích | [notification detail navigation] routes STOCK_TRANSFER notifications to their corresponding document detail | `mobile/src/features/notifications/api.test.ts:17` | **PASS** |
| `MOB-U-069` | -- | Mobile — Notifications API & Điều hướng đích | [notification detail navigation] routes MAINTENANCE_REQUEST notifications to their corresponding document detail | `mobile/src/features/notifications/api.test.ts:17` | **PASS** |
| `MOB-U-070` | -- | Mobile — Notifications API & Điều hướng đích | [notification detail navigation] routes ASSET_TRANSFER_REQUEST notifications to their corresponding document detail | `mobile/src/features/notifications/api.test.ts:17` | **PASS** |
| `MOB-U-071` | -- | Mobile — Notifications API & Điều hướng đích | [notification detail navigation] supports missing entity metadata and unsupported notification kinds | `mobile/src/features/notifications/api.test.ts:28` | **PASS** |
| `MOB-U-072` | -- | Mobile — Notifications API & Điều hướng đích | [notification detail navigation] formats notification document codes with PN, PX, KK, CK, MNT, ATR, BT prefixes and actual document id | `mobile/src/features/notifications/api.test.ts:33` | **PASS** |

#### `mobile/src/features/notifications/device-api.test.ts` — Mobile — API Đăng ký/Hủy thiết bị Push (`PASS 2/2`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-073` | -- | Mobile — API Đăng ký/Hủy thiết bị Push | [notification device API contract] registers via PUT with only the Expo token and platform in the body | `mobile/src/features/notifications/device-api.test.ts:11` | **PASS** |
| `MOB-U-074` | -- | Mobile — API Đăng ký/Hủy thiết bị Push | [notification device API contract] unregisters only the specified installation with the provided session | `mobile/src/features/notifications/device-api.test.ts:29` | **PASS** |

#### `mobile/src/features/notifications/foreground-push.test.ts` — Mobile — Xử lý Push Notification khi mở App (`PASS 9/9`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-075` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] presents an authorized own-account notification without setting a guessed unread badge | `mobile/src/features/notifications/foreground-push.test.ts:18` | **PASS** |
| `MOB-U-076` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] suppresses payloads outside the signed-in audience or document contract | `mobile/src/features/notifications/foreground-push.test.ts:26` | **PASS** |
| `MOB-U-077` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] suppresses payloads outside the signed-in audience or document contract | `mobile/src/features/notifications/foreground-push.test.ts:26` | **PASS** |
| `MOB-U-078` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] suppresses payloads outside the signed-in audience or document contract | `mobile/src/features/notifications/foreground-push.test.ts:26` | **PASS** |
| `MOB-U-079` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] suppresses payloads outside the signed-in audience or document contract | `mobile/src/features/notifications/foreground-push.test.ts:26` | **PASS** |
| `MOB-U-080` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] suppresses payloads outside the signed-in audience or document contract | `mobile/src/features/notifications/foreground-push.test.ts:26` | **PASS** |
| `MOB-U-081` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] suppresses payloads outside the signed-in audience or document contract | `mobile/src/features/notifications/foreground-push.test.ts:26` | **PASS** |
| `MOB-U-082` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] suppresses payloads outside the signed-in audience or document contract | `mobile/src/features/notifications/foreground-push.test.ts:26` | **PASS** |
| `MOB-U-083` | -- | Mobile — Xử lý Push Notification khi mở App | [foreground push presentation] suppresses notifications after logout | `mobile/src/features/notifications/foreground-push.test.ts:42` | **PASS** |

#### `mobile/src/features/notifications/push-registration-manager.test.ts` — Mobile — Quản lý vòng đời đăng ký Expo Push (`PASS 16/16`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-084` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] does nothing while signed out and skips native work in unsupported runtimes | `mobile/src/features/notifications/push-registration-manager.test.ts:92` | **PASS** |
| `MOB-U-085` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] registers the current session and persists only binding metadata, not JWT or Expo token | `mobile/src/features/notifications/push-registration-manager.test.ts:104` | **PASS** |
| `MOB-U-086` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] keeps the installation stable on refresh and reuses an unchanged Expo token | `mobile/src/features/notifications/push-registration-manager.test.ts:128` | **PASS** |
| `MOB-U-087` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] handles a rolled listener token without fetching another native token or looping | `mobile/src/features/notifications/push-registration-manager.test.ts:143` | **PASS** |
| `MOB-U-088` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] does not register if permission is denied | `mobile/src/features/notifications/push-registration-manager.test.ts:155` | **PASS** |
| `MOB-U-089` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] unregisters an existing device when permission is revoked in Settings | `mobile/src/features/notifications/push-registration-manager.test.ts:171` | **PASS** |
| `MOB-U-090` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] remembers failed permission-revocation cleanup and retries it | `mobile/src/features/notifications/push-registration-manager.test.ts:188` | **PASS** |
| `MOB-U-091` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] recovers after an API network failure without storing a false success | `mobile/src/features/notifications/push-registration-manager.test.ts:207` | **PASS** |
| `MOB-U-092` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] does not register without a JWT and rejects a wrong owner in the response | `mobile/src/features/notifications/push-registration-manager.test.ts:220` | **PASS** |
| `MOB-U-093` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] ignores stale native work from A when B signs in before the token arrives | `mobile/src/features/notifications/push-registration-manager.test.ts:233` | **PASS** |
| `MOB-U-094` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] cleans up a late PUT using A credentials before registering B | `mobile/src/features/notifications/push-registration-manager.test.ts:253` | **PASS** |
| `MOB-U-095` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] unregisters before a normal sign-out without deleting the installation | `mobile/src/features/notifications/push-registration-manager.test.ts:281` | **PASS** |
| `MOB-U-096` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] treats DELETE 404 as already unregistered and retains pending cleanup on network failure | `mobile/src/features/notifications/push-registration-manager.test.ts:297` | **PASS** |
| `MOB-U-097` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] does not clear or unregister an already saved binding belonging to another account | `mobile/src/features/notifications/push-registration-manager.test.ts:313` | **PASS** |
| `MOB-U-098` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] lets sign-out finish within three seconds even if earlier native work is waiting | `mobile/src/features/notifications/push-registration-manager.test.ts:326` | **PASS** |
| `MOB-U-099` | -- | Mobile — Quản lý vòng đời đăng ký Expo Push | [push device registration lifecycle] does not create a new installation just to log out | `mobile/src/features/notifications/push-registration-manager.test.ts:359` | **PASS** |

#### `mobile/src/features/notifications/push-registration-runtime.test.ts` — Mobile — Adapter Native Push & SecureStore ID (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-100` | -- | Mobile — Adapter Native Push & SecureStore ID | [native push registration adapter] creates one secure installation ID for concurrent callers and reuses it after module reload | `mobile/src/features/notifications/push-registration-runtime.test.ts:106` | **PASS** |
| `MOB-U-101` | -- | Mobile — Adapter Native Push & SecureStore ID | [native push registration adapter] never imports the remote notification module or requests permission in Expo Go | `mobile/src/features/notifications/push-registration-runtime.test.ts:120` | **PASS** |
| `MOB-U-102` | -- | Mobile — Adapter Native Push & SecureStore ID | [native push registration adapter] sets the Android channel before native token retrieval and passes the EAS project ID explicitly | `mobile/src/features/notifications/push-registration-runtime.test.ts:131` | **PASS** |
| `MOB-U-103` | -- | Mobile — Adapter Native Push & SecureStore ID | [native push registration adapter] does not repeat the automatic permission prompt after denial, but permits an explicit retry | `mobile/src/features/notifications/push-registration-runtime.test.ts:157` | **PASS** |
| `MOB-U-104` | -- | Mobile — Adapter Native Push & SecureStore ID | [native push registration adapter] keeps the installation ID but clears the owner binding before logout | `mobile/src/features/notifications/push-registration-runtime.test.ts:178` | **PASS** |

#### `mobile/src/features/notifications/push-response.test.ts` — Mobile — Xử lý khi người dùng bấm thông báo (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-105` | -- | Mobile — Xử lý khi người dùng bấm thông báo | [push response routing] accepts a supported payload and maps it to the allowlisted receipt route | `mobile/src/features/notifications/push-response.test.ts:22` | **PASS** |
| `MOB-U-106` | -- | Mobile — Xử lý khi người dùng bấm thông báo | [push response routing] rejects malformed identifiers, unsupported entities, and mismatched statuses | `mobile/src/features/notifications/push-response.test.ts:31` | **PASS** |
| `MOB-U-107` | -- | Mobile — Xử lý khi người dùng bấm thông báo | [push response routing] does not route a push for another signed-in account | `mobile/src/features/notifications/push-response.test.ts:37` | **PASS** |
| `MOB-U-108` | -- | Mobile — Xử lý khi người dùng bấm thông báo | [push response routing] does not route or mark read when the user no longer belongs to the farm | `mobile/src/features/notifications/push-response.test.ts:48` | **PASS** |
| `MOB-U-109` | -- | Mobile — Xử lý khi người dùng bấm thông báo | [push response routing] routes all supported document types through fixed route mappings | `mobile/src/features/notifications/push-response.test.ts:55` | **PASS** |

#### `mobile/src/shared/api/client.test.ts` — Mobile — HTTP Client, Refresh Token & Retry (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-110` | -- | Mobile — HTTP Client, Refresh Token & Retry | [apiRequest abort & dedupe handling] rethrows AbortError without wrapping it in MobileApiError | `mobile/src/shared/api/client.test.ts:20` | **PASS** |
| `MOB-U-111` | -- | Mobile — HTTP Client, Refresh Token & Retry | [apiRequest abort & dedupe handling] throws AbortError immediately if signal is already aborted | `mobile/src/shared/api/client.test.ts:33` | **PASS** |
| `MOB-U-112` | -- | Mobile — HTTP Client, Refresh Token & Retry | [apiRequest abort & dedupe handling] does not deduplicate in-flight GET requests when an explicit signal is passed | `mobile/src/shared/api/client.test.ts:45` | **PASS** |
| `MOB-U-113` | -- | Mobile — HTTP Client, Refresh Token & Retry | [apiRequest abort & dedupe handling] still wraps non-abort network errors into MobileApiError | `mobile/src/shared/api/client.test.ts:63` | **PASS** |

#### `mobile/src/shared/api/stock-errors.test.ts` — Mobile — Mapping thông báo lỗi Nghiệp vụ kho (`PASS 9/9`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-114` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] translates customer order stock hold error | `mobile/src/shared/api/stock-errors.test.ts:5` | **PASS** |
| `MOB-U-115` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] translates asset held for customer order error | `mobile/src/shared/api/stock-errors.test.ts:13` | **PASS** |
| `MOB-U-116` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] translates unverified payment error from code or message | `mobile/src/shared/api/stock-errors.test.ts:19` | **PASS** |
| `MOB-U-117` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] translates warranty exchange discrepancy error | `mobile/src/shared/api/stock-errors.test.ts:29` | **PASS** |
| `MOB-U-118` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] translates self approval error code | `mobile/src/shared/api/stock-errors.test.ts:37` | **PASS** |
| `MOB-U-119` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] translates stale stock count error code | `mobile/src/shared/api/stock-errors.test.ts:43` | **PASS** |
| `MOB-U-120` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] translates asset mismatch error code | `mobile/src/shared/api/stock-errors.test.ts:49` | **PASS** |
| `MOB-U-121` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] translates HTTP 403, 404, 401 when generic | `mobile/src/shared/api/stock-errors.test.ts:55` | **PASS** |
| `MOB-U-122` | -- | Mobile — Mapping thông báo lỗi Nghiệp vụ kho | [stock-errors] returns raw message when no pattern matches | `mobile/src/shared/api/stock-errors.test.ts:70` | **PASS** |

#### `mobile/src/shared/cloudinary-url.test.ts` — Mobile — Chuẩn hóa & Validate Cloudinary URL (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-123` | -- | Mobile — Chuẩn hóa & Validate Cloudinary URL | [toThumbnailUrl] returns undefined for empty or nullish inputs | `mobile/src/shared/cloudinary-url.test.ts:5` | **PASS** |
| `MOB-U-124` | -- | Mobile — Chuẩn hóa & Validate Cloudinary URL | [toThumbnailUrl] inserts thumbnail transform before Cloudinary version segment | `mobile/src/shared/cloudinary-url.test.ts:11` | **PASS** |
| `MOB-U-125` | -- | Mobile — Chuẩn hóa & Validate Cloudinary URL | [toThumbnailUrl] supports custom thumbnail sizes and paths without version segment | `mobile/src/shared/cloudinary-url.test.ts:21` | **PASS** |
| `MOB-U-126` | -- | Mobile — Chuẩn hóa & Validate Cloudinary URL | [toThumbnailUrl] preserves Cloudinary URLs that already contain transformations | `mobile/src/shared/cloudinary-url.test.ts:32` | **PASS** |
| `MOB-U-127` | -- | Mobile — Chuẩn hóa & Validate Cloudinary URL | [toThumbnailUrl] leaves non-Cloudinary URLs untouched | `mobile/src/shared/cloudinary-url.test.ts:42` | **PASS** |

#### `mobile/src/shared/format-date-time.test.ts` — Mobile — Định dạng ngày giờ tiếng Việt (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-128` | -- | Mobile — Định dạng ngày giờ tiếng Việt | [API timestamps on mobile] converts the actual PostgreSQL seed timestamp to an ISO Date input | `mobile/src/shared/format-date-time.test.ts:5` | **PASS** |
| `MOB-U-129` | -- | Mobile — Định dạng ngày giờ tiếng Việt | [API timestamps on mobile] preserves timezone offsets and makes microseconds safe for Hermes | `mobile/src/shared/format-date-time.test.ts:12` | **PASS** |
| `MOB-U-130` | -- | Mobile — Định dạng ngày giờ tiếng Việt | [API timestamps on mobile] keeps missing or invalid values distinct from real event times | `mobile/src/shared/format-date-time.test.ts:23` | **PASS** |
| `MOB-U-131` | -- | Mobile — Định dạng ngày giờ tiếng Việt | [API timestamps on mobile] uses the Vietnam calendar day for stock document dates around UTC midnight | `mobile/src/shared/format-date-time.test.ts:30` | **PASS** |

#### `mobile/src/shared/format-quantity.test.ts` — Mobile — Định dạng số lượng thập phân (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-132` | -- | Mobile — Định dạng số lượng thập phân | [formatQuantity] renders 2.000 as 2 without an ambiguous decimal suffix | `mobile/src/shared/format-quantity.test.ts:5` | **PASS** |
| `MOB-U-133` | -- | Mobile — Định dạng số lượng thập phân | [formatQuantity] renders 2000.000 as 2000 without an ambiguous decimal suffix | `mobile/src/shared/format-quantity.test.ts:5` | **PASS** |
| `MOB-U-134` | -- | Mobile — Định dạng số lượng thập phân | [formatQuantity] renders 2.050 as 2,05 without an ambiguous decimal suffix | `mobile/src/shared/format-quantity.test.ts:5` | **PASS** |
| `MOB-U-135` | -- | Mobile — Định dạng số lượng thập phân | [formatQuantity] renders 0.125 as 0,125 without an ambiguous decimal suffix | `mobile/src/shared/format-quantity.test.ts:5` | **PASS** |
| `MOB-U-136` | -- | Mobile — Định dạng số lượng thập phân | [formatQuantity] renders -12.000 as -12 without an ambiguous decimal suffix | `mobile/src/shared/format-quantity.test.ts:5` | **PASS** |

#### `mobile/src/shared/quantity-input.test.ts` — Mobile — Chuẩn hóa & Validate ô nhập số lượng (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `MOB-U-137` | -- | Mobile — Chuẩn hóa & Validate ô nhập số lượng | [stock quantity input] accepts the API decimal shape and Vietnamese decimal comma | `mobile/src/shared/quantity-input.test.ts:5` | **PASS** |
| `MOB-U-138` | -- | Mobile — Chuẩn hóa & Validate ô nhập số lượng | [stock quantity input] rejects blank, zero for movements, negative and excessive precision | `mobile/src/shared/quantity-input.test.ts:12` | **PASS** |
| `MOB-U-139` | -- | Mobile — Chuẩn hóa & Validate ô nhập số lượng | [stock quantity input] enforces the selected stock limit without restricting stock counts | `mobile/src/shared/quantity-input.test.ts:19` | **PASS** |

### 7.2. Các phần của Mobile CHƯA có test tự động

> **Phạm vi chưa phủ tự động:** `42` file nguồn trong `mobile/src/` (`6` file logic/API/context + `36` file UI `.tsx`) + `34` route `mobile/app/**/*.tsx` + E2E thiết bị thật. Dự án Mobile hiện chỉ mới cài `jest` + `jest-expo` cho tầng unit test logic/API (`*.test.ts`), **chưa cài thư viện component test (`@testing-library/react-native`) và chưa có framework UI E2E tự động (Detox / Maestro / Appium)**.

#### 7.2.1. Module Logic, API Client & Context chưa có unit test riêng (6 file)

| Mã BC | Phần chưa test | Chi tiết nội dung hiện chưa có test tự động | Vị trí | Trạng thái |
| --- | --- | --- | --- | --- |
| `MOB-GAP-001` | Logic / API / Context Mobile | Token màu sắc, bo góc, spacing và typography dùng chung. | `mobile/src/core/theme/tokens.ts` | **NOT COVERED** (Chưa viết test) |
| `MOB-GAP-002` | Logic / API / Context Mobile | Client gọi `GET /audit-logs` & `GET /audit-logs/:id` (phân trang, lọc action/entityType). Mới chỉ có test cho `model.ts`. | `mobile/src/features/activity/api.ts` | **NOT COVERED** (Chưa viết test) |
| `MOB-GAP-003` | Logic / API / Context Mobile | Context đăng nhập Clerk Expo, tải `/auth/me`, lưu chọn trại, kiểm tra đổi mật khẩu lần đầu và dọn thiết bị khi sign-out. | `mobile/src/features/auth/context/AuthContext.tsx` | **NOT COVERED** (Chưa viết test) |
| `MOB-GAP-004` | Logic / API / Context Mobile | Hàm `canUseMobileOperations(roles)` kiểm tra quyền thao tác `EMPLOYEE` trên mobile. | `mobile/src/features/auth/mobile-access.ts` | **NOT COVERED** (Chưa viết test) |
| `MOB-GAP-005` | Logic / API / Context Mobile | Định nghĩa kiểu Role (`ADMIN`, `FARM_OWNER`, `WAREHOUSE_MANAGER`, `STORE_MANAGER`, `DELIVERY_STAFF`, `MAINTENANCE_STAFF`, `EMPLOYEE`, `GUEST`) và AuthContextResponse. | `mobile/src/features/auth/types.ts` | **NOT COVERED** (Chưa viết test) |
| `MOB-GAP-006` | Logic / API / Context Mobile | Provider tích hợp runtime xin quyền push, lắng nghe notification foreground & khi người dùng bấm thông báo. | `mobile/src/features/notifications/context/PushRegistrationProvider.tsx` | **NOT COVERED** (Chưa viết test) |

#### 7.2.2. Màn hình UI, Modal & Component React Native chưa có Component/Render Test (36 component UI + 34 route `mobile/app/`)

| Mã BC | Phân hệ UI | Mô tả màn hình / component chưa có UI test | Vị trí | Trạng thái |
| --- | --- | --- | --- | --- |
| `MOB-GAP-007` | UI / Screen Mobile | Layout và điều hướng phần Tài khoản. | `mobile/src/features/account/presentation/AccountLayout.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-008` | UI / Screen Mobile | Màn hình Tài khoản, chuyển trại hiện tại, xem vai trò và nút đăng xuất. | `mobile/src/features/account/presentation/AccountScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-009` | UI / Screen Mobile | Màn hình xem trạng thái đăng ký Push Token & quyền thông báo thiết bị. | `mobile/src/features/account/presentation/NotificationSettingsScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-010` | UI / Screen Mobile | Màn hình thông tin cá nhân & đổi mật khẩu khởi tạo. | `mobile/src/features/account/presentation/ProfileScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-011` | UI / Screen Mobile | Màn hình chi tiết 1 bản ghi nhật ký Audit & link tới chứng từ liên quan. | `mobile/src/features/activity/presentation/ActivityDetailScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-012` | UI / Screen Mobile | Màn hình danh sách nhật ký Audit (tải thêm `page`, lọc action/loại bản ghi). | `mobile/src/features/activity/presentation/ActivityScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-013` | UI / Screen Mobile | Màn hình tra cứu bản ghi liên kết từ audit log. | `mobile/src/features/activity/presentation/RelatedRecordScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-014` | UI / Screen Mobile | Màn hình chi tiết tài sản, lịch sử gắn thiết bị, nút yêu cầu chuyển/bảo trì. | `mobile/src/features/assets/presentation/AssetDetailScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-015` | UI / Screen Mobile | Màn hình chi tiết yêu cầu luân chuyển tài sản. | `mobile/src/features/assets/presentation/AssetTransferRequestDetailScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-016` | UI / Screen Mobile | Form gửi yêu cầu chuyển tài sản (chọn kho/vị trí đích phân trang). | `mobile/src/features/assets/presentation/AssetTransferRequestScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-017` | UI / Screen Mobile | Màn hình danh sách & chi tiết lịch sử bảo trì thiết bị (phân trang). | `mobile/src/features/assets/presentation/MaintenanceHistoryScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-018` | UI / Screen Mobile | Màn hình chi tiết yêu cầu bảo trì. | `mobile/src/features/assets/presentation/MaintenanceRequestDetailScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-019` | UI / Screen Mobile | Màn hình đăng nhập / xác thực Clerk trên Mobile. | `mobile/src/features/auth/presentation/AuthScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-020` | UI / Screen Mobile | Màn hình kết quả sau khi quét QR mặt hàng (vật tư/thiết bị). | `mobile/src/features/catalog/presentation/ItemQrResultScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-021` | UI / Screen Mobile | Màn hình Trang chủ Dashboard, cảnh báo tồn thấp, sắp hết hạn & điều hướng nhanh. | `mobile/src/features/home/presentation/DashboardScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-022` | UI / Screen Mobile | Form tổng hợp lập phiếu Xuất / Chuyển kho / Điều chỉnh / Yêu cầu bảo trì (tích hợp phân trang & picker). | `mobile/src/features/inventory/presentation/InventoryActionScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-023` | UI / Screen Mobile | Màn hình chi tiết dòng tồn kho theo vật tư/kho. | `mobile/src/features/inventory/presentation/InventoryDetailScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-024` | UI / Screen Mobile | Màn hình Sổ cái biến động kho (phân trang, lọc theo ngày & tìm kiếm). | `mobile/src/features/inventory/presentation/InventoryLedgerScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-025` | UI / Screen Mobile | Màn hình kết quả quét QR theo balance tồn kho. | `mobile/src/features/inventory/presentation/InventoryQrResultScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-026` | UI / Screen Mobile | Màn hình Tồn kho (tải phân trang `listInventorySummaryPage`, tìm kiếm, lọc theo trackingMode/kho). | `mobile/src/features/inventory/presentation/InventoryScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-027` | UI / Screen Mobile | Modal chọn nhiều vật tư phân trang từ server (`listItemsPage` / `listBalancesPage`), tìm kiếm & lọc danh mục. | `mobile/src/features/inventory/presentation/ItemMultiSelectModal.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-028` | UI / Screen Mobile | Màn hình chi tiết lô hàng (`lotCode`, `supplierLotNumber`, `legacyLotNumber`, hạn dùng). | `mobile/src/features/inventory/presentation/LotDetailScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-029` | UI / Screen Mobile | Modal chọn lô có sẵn phân trang (`listLotsPage`) theo vật tư khi nhập/xuất. | `mobile/src/features/inventory/presentation/LotPickerModal.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-030` | UI / Screen Mobile | Màn hình danh sách cảnh báo tồn thấp (tối ưu qua endpoint `/reports/stock-alerts` hoặc summary). | `mobile/src/features/inventory/presentation/LowStockScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-031` | UI / Screen Mobile | Màn hình chi tiết / tạo / sửa / gửi duyệt phiếu Nhập kho (chọn lô phân trang, tìm theo số lô NCC). | `mobile/src/features/inventory/presentation/ReceiptDetailScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-032` | UI / Screen Mobile | Màn hình danh sách phiếu Nhập / Xuất / Kiểm / Chuyển kho (phân trang, lọc trạng thái & ngày). | `mobile/src/features/inventory/presentation/ReceiptListScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-033` | UI / Screen Mobile | Màn hình Form Kiểm kê kho (đã tối ưu tải phân trang + tìm kiếm server, tách dòng QUANTITY/LOT, chặn ASSET). | `mobile/src/features/inventory/presentation/StockCountScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-034` | UI / Screen Mobile | Component UI chọn lọc Từ ngày / Đến ngày cho chứng từ kho. | `mobile/src/features/inventory/presentation/StockDateRangeFilter.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-035` | UI / Screen Mobile | Icon chuông đếm số thông báo chưa đọc trên thanh tiêu đề. | `mobile/src/features/notifications/presentation/NotificationBell.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-036` | UI / Screen Mobile | Màn hình danh sách thông báo & đánh dấu đã đọc. | `mobile/src/features/notifications/presentation/NotificationCenterScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-037` | UI / Screen Mobile | Banner/thẻ hiển thị trạng thái đăng ký nhận thông báo đẩy. | `mobile/src/features/notifications/presentation/PushRegistrationStatus.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-038` | UI / Screen Mobile | Màn hình chi tiết chứng từ/thông báo khi mở từ trung tâm thông báo. | `mobile/src/features/notifications/presentation/TransferNotificationDetailScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-039` | UI / Screen Mobile | Màn hình Camera quét mã QR (`expo-camera`) & nhập mã thủ công. | `mobile/src/features/qr-scan/presentation/QrScanScreen.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-040` | UI / Screen Mobile | Component loading indicator. | `mobile/src/shared/ui/BeeLoader.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-041` | UI / Screen Mobile | Khung giao diện chung, Header, Bottom Tabs & Button của App. | `mobile/src/shared/ui/MobileShell.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-042` | UI / Screen Mobile | Dialog hiển thị kết quả thao tác thành công / lỗi. | `mobile/src/shared/ui/OperationResultDialog.tsx` | **NOT COVERED** (Chưa có test UI) |
| `MOB-GAP-043` | Expo Router Routes (`34` file) | Toàn bộ route điều hướng (`_layout.tsx`, `index`, `auth`, `dashboard`, `inventory*`, `receipts/*`, `counts/*`, `transfers/*`, `assets/*`, `maintenance/*`, `scan/*`, `activity/*`, `notifications`, `account/*`) chưa có navigation/route integration test. | `mobile/app/**/*.tsx` | **NOT COVERED** (Chưa có test điều hướng) |

#### 7.2.3. Kịch bản E2E & Checklist Nghiệm thu Thủ công trên Thiết bị thật (`NOT AUTOMATED` / Chờ test tay)

Các kiểm thử cần chạy trực tiếp trên điện thoại / emulator kết nối API thật (tổng hợp từ các tài liệu nghiệm thu & bàn giao `mobile/*.md`, chưa được tự động hóa):

| Mã BC | Nhóm tính năng | Kịch bản cần nghiệm thu thực tế trên App / Thiết bị | Tài liệu tham chiếu | Trạng thái |
| --- | --- | --- | --- | --- |
| `MOB-MAN-01` | Xác thực Clerk Native | Đăng nhập bằng Clerk trên app Android/iOS, gọi API thật để xác nhận token không có `azp` vượt qua guard API không bị `401`. | `mobile/README.md#L222` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-02` | Quét QR bằng Camera | Mở camera (`expo-camera`) quét tem tài sản in từ web (`/scan/{assetCode}`), tem mặt hàng (`/scan/item/{itemId}`) và tem tồn kho (`/scan/inventory/{balanceId}`). | `mobile/README.md#L223` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-03` | Phiếu kiểm & Chuyển kho | Tạo phiếu kiểm ở kho có tài sản (không được xuất hiện dòng ASSET); tạo phiếu chuyển kho (không còn lựa chọn ASSET). | `mobile/README.md#L224-L226` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-04` | Push Notification thực tế | Tài khoản `EMPLOYEE` gửi duyệt phiếu; kiểm tra tài khoản `ADMIN` nhận được push notification FCM/Expo trên thiết bị thật và bấm vào mở đúng màn hình. | `mobile/README.md#L225` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-05` | Phân quyền theo Vai trò trên Mobile | Kiểm tra với tài khoản Clerk thật của `EMPLOYEE`, vai trò quản lý thuần, `STORE_MANAGER`, `GUEST`, hỗn hợp nhiều role; bấm direct link & push notification sau khi đổi trại/đổi quyền. | `mobile/ROLE_ACCESS_MOBILE.md#L10` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-06` | Lập phiếu lô (Lot Identity) | Nhập lô không có `supplierLotNumber` vẫn lưu/gửi/duyệt và sinh `LOT-...`; nhập 2 dòng trùng số lô NCC thành 2 lô riêng; mở lại nháp cũ giữ `legacyLotNumber`. | `mobile/INVENTORY_LOT_MOBILE.md#L80-L87` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-07` | Vị trí tài sản khi nhập kho (T02 / AC02) | Chọn vị trí `ACTIVE` cho dòng `ASSET` trên `ReceiptDetailScreen`, chặn thiếu vị trí trước khi gửi, giữ `locationId` khi mở nháp từ web và sửa serial rồi gửi duyệt. | `mobile/ASSET_RECEIPT_LOCATION_MOBILE.md#L40-L45` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-08` | Bảo trì & Nhập lại kho | Phân quyền `MAINTENANCE_STAFF` vs `WAREHOUSE_MANAGER` vs `EMPLOYEE`; luồng đạt (`nhận -> nghiệm thu -> duyệt nhập` tăng 1 tồn) & không đạt (`FAILED`), từ chối gửi lại, đổi trại/409 reload. | `mobile/MAINTENANCE_MOBILE.md#L70-L78` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-09` | Hiển thị xuất bảo trì (T05) | Kiểm tra `MaintenanceHistoryScreen` hiện "Kho xác nhận xuất" + `issuedByName` với hồ sơ mới do kho xác nhận trên web, và giữ nhãn "Gửi sửa" với hồ sơ cũ. | `mobile/MAINTENANCE_WAREHOUSE_ISSUE_MOBILE.md#L30-L34` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-10` | Nhân viên giao hàng & Lịch sử đơn (`DELIVERY_STAFF`) | Dùng tài khoản Clerk thật của `DELIVERY_STAFF` thuần, `EMPLOYEE`, `EMPLOYEE + DELIVERY_STAFF`, `STORE_MANAGER`: kiểm tra nhãn vai trò, màn được vào/bị chặn và audit log giao hàng/phí vận chuyển. | `mobile/DELIVERY_AND_SHIPPING_FEES_MOBILE.md#L115-L117` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-11` | Lọc ngày chứng từ & sổ kho | Lọc khoảng ngày trên phiếu nhập/xuất/biến động theo giờ VN, lọc một phía từ ngày/đến ngày, chặn `dateFrom > dateTo`, xóa bộ lọc trả lại đủ danh sách. | `mobile/STOCK_LIST_FILTERS_MOBILE.md#L28-L34` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |
| `MOB-MAN-12` | Phân trang & tìm kiếm server (mới tối ưu) | Kiểm tra cuộn `onEndReached` tải trang tiếp theo, đổi ô tìm kiếm/danh mục và chuyển trại trên `StockCountScreen`, `InventoryActionScreen`, `ItemMultiSelectModal`, `LotPickerModal`, `ReceiptListScreen`, `InventoryScreen`, `ActivityScreen` không crash máy/không lệch dữ liệu trại cũ. | `mobile/src/features/inventory/presentation/` | **CHƯA TỰ ĐỘNG / CHỜ TEST TAY** |

## 8. Chi Tiết Web Frontend — Unit Tests (42 File, 224 Cases: 224 PASS)

#### `web/features/assets/api/assets.api.test.mjs` — Web — Assets API Client & Retry Policy (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-001` | -- | Web — Assets API Client & Retry Policy | asset requests use relative routes, farm scope and unchanged envelopes | `web/features/assets/api/assets.api.test.mjs:30` | **PASS** |
| `WEB-U-002` | -- | Web — Assets API Client & Retry Policy | lifecycle calls keep selected farm, encode identities, retain stale-write version and never retry mutations | `web/features/assets/api/assets.api.test.mjs:85` | **PASS** |
| `WEB-U-003` | -- | Web — Assets API Client & Retry Policy | member lookup is paginated and uses the selected farm | `web/features/assets/api/assets.api.test.mjs:163` | **PASS** |
| `WEB-U-004` | -- | Web — Assets API Client & Retry Policy | lookups preserve paging beyond 100 and historical item filters; returns require active destinations | `web/features/assets/api/assets.api.test.mjs:184` | **PASS** |
| `WEB-U-005` | -- | Web — Assets API Client & Retry Policy | uncertain return failures propagate once without automatically retrying POST | `web/features/assets/api/assets.api.test.mjs:222` | **PASS** |

#### `web/features/assets/asset.logic.test.mjs` — Web — Logic Tài sản, Bộ lọc & Form thao tác (`PASS 7/7`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-006` | -- | Web — Logic Tài sản, Bộ lọc & Form thao tác | filter changes reset pages and clear locations only when warehouse changes | `web/features/assets/asset.logic.test.mjs:14` | **PASS** |
| `WEB-U-007` | -- | Web — Logic Tài sản, Bộ lọc & Form thao tác | return action requires both write role and eligible status | `web/features/assets/asset.logic.test.mjs:38` | **PASS** |
| `WEB-U-008` | -- | Web — Logic Tài sản, Bộ lọc & Form thao tác | prices remain exact at numeric(18,2) boundaries and dates do not shift timezones | `web/features/assets/asset.logic.test.mjs:57` | **PASS** |
| `WEB-U-009` | -- | Web — Logic Tài sản, Bộ lọc & Form thao tác | invalid identifiers are rejected but UUID-looking asset codes stay codes | `web/features/assets/asset.logic.test.mjs:72` | **PASS** |
| `WEB-U-010` | -- | Web — Logic Tài sản, Bộ lọc & Form thao tác | uncertain writes and conflicts require a reload; reads remain retryable | `web/features/assets/asset.logic.test.mjs:89` | **PASS** |
| `WEB-U-011` | -- | Web — Logic Tài sản, Bộ lọc & Form thao tác | maintenance return date errors explain what to fix without requiring reload | `web/features/assets/asset.logic.test.mjs:98` | **PASS** |
| `WEB-U-012` | -- | Web — Logic Tài sản, Bộ lọc & Form thao tác | terminal assets expose only safe lifecycle actions and writer checks do not broaden roles | `web/features/assets/asset.logic.test.mjs:112` | **PASS** |

#### `web/features/auth/farm-navigation.logic.test.mjs` — Web — Điều hướng chọn Trại & Lưu trạng thái (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-013` | -- | Web — Điều hướng chọn Trại & Lưu trạng thái | initial farm resolution and same-farm refresh preserve direct document links | `web/features/auth/farm-navigation.logic.test.mjs:8` | **PASS** |
| `WEB-U-014` | -- | Web — Điều hướng chọn Trại & Lưu trạng thái | farm changes clear document selections on every affected page and retain other query parameters | `web/features/auth/farm-navigation.logic.test.mjs:16` | **PASS** |
| `WEB-U-015` | -- | Web — Điều hướng chọn Trại & Lưu trạng thái | farm navigation leaves unselected pages and unrelated routes untouched | `web/features/auth/farm-navigation.logic.test.mjs:27` | **PASS** |

#### `web/features/catalog/catalog.logic.test.mjs` — Web — Logic Danh mục & Quy đổi đơn vị (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-016` | -- | Web — Logic Danh mục & Quy đổi đơn vị | shared catalog lists are writable by ADMIN only | `web/features/catalog/catalog.logic.test.mjs:6` | **PASS** |
| `WEB-U-017` | -- | Web — Logic Danh mục & Quy đổi đơn vị | catalogPayload trims values and clears blank optional fields | `web/features/catalog/catalog.logic.test.mjs:13` | **PASS** |
| `WEB-U-018` | -- | Web — Logic Danh mục & Quy đổi đơn vị | equipment templates send numbers, flatten list rows and show numeric values | `web/features/catalog/catalog.logic.test.mjs:28` | **PASS** |
| `WEB-U-019` | -- | Web — Logic Danh mục & Quy đổi đơn vị | catalogError maps API failures to Vietnamese messages | `web/features/catalog/catalog.logic.test.mjs:49` | **PASS** |

#### `web/features/commerce/cart/components/cart.logic.test.mjs` — Web — Logic Giỏ hàng Storefront (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-020` | -- | Web — Logic Giỏ hàng Storefront | cart reconciliation returns current price and flags explicit price changes | `web/features/commerce/cart/components/cart.logic.test.mjs:41` | **PASS** |
| `WEB-U-021` | -- | Web — Logic Giỏ hàng Storefront | unavailable variants cannot be submitted and catalog failures remain unverified | `web/features/commerce/cart/components/cart.logic.test.mjs:49` | **PASS** |
| `WEB-U-022` | -- | Web — Logic Giỏ hàng Storefront | partitionCartByVariantGroup splits cart into kept and deferred groups | `web/features/commerce/cart/components/cart.logic.test.mjs:60` | **PASS** |
| `WEB-U-023` | -- | Web — Logic Giỏ hàng Storefront | products query parser and URL builder support inStock filter | `web/features/commerce/cart/components/cart.logic.test.mjs:87` | **PASS** |

#### `web/features/commerce/orders/order.logic.test.mjs` — Web — Logic Đơn hàng Storefront & Thanh toán (`PASS 14/14`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-024` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | order cancellation rules match V1 transitions | `web/features/commerce/orders/order.logic.test.mjs:43` | **PASS** |
| `WEB-U-025` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | reconcile only unpaid bank transfers and receive COD cash once | `web/features/commerce/orders/order.logic.test.mjs:55` | **PASS** |
| `WEB-U-026` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | only paid bank transfers can complete; COD completion remains available | `web/features/commerce/orders/order.logic.test.mjs:73` | **PASS** |
| `WEB-U-027` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | shipping and staff cancellation wait for linked issue state | `web/features/commerce/orders/order.logic.test.mjs:90` | **PASS** |
| `WEB-U-028` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | money formatting keeps whole-VND aggregates exact beyond Number safe range | `web/features/commerce/orders/order.logic.test.mjs:108` | **PASS** |
| `WEB-U-029` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | only definite domain responses release an uncertain idempotency attempt | `web/features/commerce/orders/order.logic.test.mjs:116` | **PASS** |
| `WEB-U-030` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | canonical payload ignores whitespace and item order | `web/features/commerce/orders/order.logic.test.mjs:123` | **PASS** |
| `WEB-U-031` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | saved payloads are validated before restoring or retrying | `web/features/commerce/orders/order.logic.test.mjs:147` | **PASS** |
| `WEB-U-032` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | the same pending payload reuses its key; uncertain changed payloads are blocked | `web/features/commerce/orders/order.logic.test.mjs:179` | **PASS** |
| `WEB-U-033` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | explains server validation errors per field instead of a generic message | `web/features/commerce/orders/order.logic.test.mjs:217` | **PASS** |
| `WEB-U-034` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | lets staff re-confirm a PREPARING order only once its transfers are settled | `web/features/commerce/orders/order.logic.test.mjs:241` | **PASS** |
| `WEB-U-035` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | tells farm staff why they cannot check out | `web/features/commerce/orders/order.logic.test.mjs:261` | **PASS** |
| `WEB-U-036` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | tells staff to transfer stock into the sales warehouse when confirming falls short | `web/features/commerce/orders/order.logic.test.mjs:275` | **PASS** |
| `WEB-U-037` | -- | Web — Logic Đơn hàng Storefront & Thanh toán | filters orders by code, recipient or phone and resolves 4-step tracking progress | `web/features/commerce/orders/order.logic.test.mjs:298` | **PASS** |

#### `web/features/commerce/products/components/product-detail.logic.test.mjs` — Web — Logic Chi tiết sản phẩm & Biến thể (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-038` | -- | Web — Logic Chi tiết sản phẩm & Biến thể | synthesizes specifications, usage guidance and quality badge from ERP item metadata | `web/features/commerce/products/components/product-detail.logic.test.mjs:21` | **PASS** |
| `WEB-U-039` | -- | Web — Logic Chi tiết sản phẩm & Biến thể | does not expose internal tracking jargon for LOT-tracked materials | `web/features/commerce/products/components/product-detail.logic.test.mjs:87` | **PASS** |
| `WEB-U-040` | -- | Web — Logic Chi tiết sản phẩm & Biến thể | updates specifications per selected variant and preserves explicit null warranty | `web/features/commerce/products/components/product-detail.logic.test.mjs:108` | **PASS** |

#### `web/features/commerce/region/region.logic.test.mjs` — Web — Logic Vùng bán hàng / Giao nhận (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-041` | -- | Web — Logic Vùng bán hàng / Giao nhận | only known regions come back from the cookie | `web/features/commerce/region/region.logic.test.mjs:10` | **PASS** |
| `WEB-U-042` | -- | Web — Logic Vùng bán hàng / Giao nhận | labels never show stock numbers and fall back to inStock | `web/features/commerce/region/region.logic.test.mjs:17` | **PASS** |
| `WEB-U-043` | -- | Web — Logic Vùng bán hàng / Giao nhận | split suggestions name each line of a group | `web/features/commerce/region/region.logic.test.mjs:25` | **PASS** |
| `WEB-U-044` | -- | Web — Logic Vùng bán hàng / Giao nhận | split groups are read only from a well-formed error body | `web/features/commerce/region/region.logic.test.mjs:36` | **PASS** |

#### `web/features/dashboard/dashboard.logic.test.mjs` — Web — Logic Tổng hợp Dashboard (`PASS 2/2`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-045` | -- | Web — Logic Tổng hợp Dashboard | formatRoleName formats known farm roles into friendly Vietnamese labels | `web/features/dashboard/dashboard.logic.test.mjs:5` | **PASS** |
| `WEB-U-046` | -- | Web — Logic Tổng hợp Dashboard | formatRoleName falls back gracefully for unknown or undefined roles | `web/features/dashboard/dashboard.logic.test.mjs:15` | **PASS** |

#### `web/features/deliveries/deliveries.logic.test.mjs` — Web — Logic Giao nhận / Phiếu vận chuyển (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-047` | -- | Web — Logic Giao nhận / Phiếu vận chuyển | COD can always be delivered; bank transfers only once paid | `web/features/deliveries/deliveries.logic.test.mjs:9` | **PASS** |
| `WEB-U-048` | -- | Web — Logic Giao nhận / Phiếu vận chuyển | the shipper collects the total only for unpaid COD | `web/features/deliveries/deliveries.logic.test.mjs:15` | **PASS** |
| `WEB-U-049` | -- | Web — Logic Giao nhận / Phiếu vận chuyển | API refusals become Vietnamese messages | `web/features/deliveries/deliveries.logic.test.mjs:22` | **PASS** |

#### `web/features/history/api/history.api.test.mjs` — Web — Audit History API Client (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-050` | -- | Web — Audit History API Client | audit lists send selected farm, server filters and the panel/page pagination | `web/features/history/api/history.api.test.mjs:5` | **PASS** |
| `WEB-U-051` | -- | Web — Audit History API Client | audit lists omit empty filters rather than sending empty query values | `web/features/history/api/history.api.test.mjs:22` | **PASS** |
| `WEB-U-052` | -- | Web — Audit History API Client | audit lists preserve server failures for the Vietnamese error mapper | `web/features/history/api/history.api.test.mjs:32` | **PASS** |

#### `web/features/history/history.logic.test.mjs` — Web — Logic Bộ lọc & Hiển thị Lịch sử Audit (`PASS 11/11`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-053` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | history query parsing uses safe defaults and bounds server pagination | `web/features/history/history.logic.test.mjs:12` | **PASS** |
| `WEB-U-054` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | UUID validation accepts optional UUIDs and rejects malformed nonempty filters | `web/features/history/history.logic.test.mjs:27` | **PASS** |
| `WEB-U-055` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | history filters reset page one and URL pagination preserves every server filter | `web/features/history/history.logic.test.mjs:37` | **PASS** |
| `WEB-U-056` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | audit errors explain auth, missing farm data, validation and conflict reasons | `web/features/history/history.logic.test.mjs:51` | **PASS** |
| `WEB-U-057` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | history actors prefer name, then email, then the system label | `web/features/history/history.logic.test.mjs:60` | **PASS** |
| `WEB-U-058` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | unchanged values including reordered nested JSON are hidden | `web/features/history/history.logic.test.mjs:67` | **PASS** |
| `WEB-U-059` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | changed nested values and arrays are written out without raw JSON | `web/features/history/history.logic.test.mjs:73` | **PASS** |
| `WEB-U-060` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | ids become names from references and document lines read as one line each | `web/features/history/history.logic.test.mjs:83` | **PASS** |
| `WEB-U-061` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | CREATE with null oldData shows every initial value including null, zero and false | `web/features/history/history.logic.test.mjs:116` | **PASS** |
| `WEB-U-062` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | updates include added and removed keys while retaining scalar distinctions | `web/features/history/history.logic.test.mjs:133` | **PASS** |
| `WEB-U-063` | -- | Web — Logic Bộ lọc & Hiển thị Lịch sử Audit | history filters cover all current document, request, asset, personnel, delivery, shipping fee and warranty writers | `web/features/history/history.logic.test.mjs:145` | **PASS** |

#### `web/features/inventory/inventory.logic.test.mjs` — Web — Logic Tồn kho, Lô & Thẻ kho (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-064` | -- | Web — Logic Tồn kho, Lô & Thẻ kho | changing warehouse or item clears a stale asset selection and resets pagination | `web/features/inventory/inventory.logic.test.mjs:13` | **PASS** |
| `WEB-U-065` | -- | Web — Logic Tồn kho, Lô & Thẻ kho | quantities drop trailing zeros without ambiguous thousands separators | `web/features/inventory/inventory.logic.test.mjs:29` | **PASS** |
| `WEB-U-066` | -- | Web — Logic Tồn kho, Lô & Thẻ kho | adjustmentIncreaseBlocked only blocks increases on inactive items or expired lots | `web/features/inventory/inventory.logic.test.mjs:49` | **PASS** |
| `WEB-U-067` | -- | Web — Logic Tồn kho, Lô & Thẻ kho | sumInventoryByItem adds lots per item without float drift | `web/features/inventory/inventory.logic.test.mjs:68` | **PASS** |
| `WEB-U-068` | -- | Web — Logic Tồn kho, Lô & Thẻ kho | getExpiryStatus accurately flags expired, critical, warning, healthy and null lots | `web/features/inventory/inventory.logic.test.mjs:82` | **PASS** |

#### `web/features/issues/components/issue-draft.logic.test.mjs` — Web — Logic Form Phiếu xuất kho (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-069` | -- | Web — Logic Form Phiếu xuất kho | asset damage and maintenance use the lifecycle screen instead of stock issues | `web/features/issues/components/issue-draft.logic.test.mjs:20` | **PASS** |
| `WEB-U-070` | -- | Web — Logic Form Phiếu xuất kho | damage and maintenance issues still accept quantity and lot materials | `web/features/issues/components/issue-draft.logic.test.mjs:30` | **PASS** |
| `WEB-U-071` | -- | Web — Logic Form Phiếu xuất kho | SALE is only accepted for a linked order draft | `web/features/issues/components/issue-draft.logic.test.mjs:49` | **PASS** |
| `WEB-U-072` | -- | Web — Logic Form Phiếu xuất kho | linked lot splits retain exact per-item quantities | `web/features/issues/components/issue-draft.logic.test.mjs:55` | **PASS** |
| `WEB-U-073` | -- | Web — Logic Form Phiếu xuất kho | only the recipient, or a manager for them, acknowledges a confirmed issue once | `web/features/issues/components/issue-draft.logic.test.mjs:81` | **PASS** |

#### `web/features/issues/components/issue-return.logic.test.mjs` — Web — Logic Form Nhập trả từ phiếu xuất (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-074` | -- | Web — Logic Form Nhập trả từ phiếu xuất | only confirmed own-use issues with something left are returnable | `web/features/issues/components/issue-return.logic.test.mjs:30` | **PASS** |
| `WEB-U-075` | -- | Web — Logic Form Nhập trả từ phiếu xuất | 8 accepted + 2 rejected needs a reason; 0 accepted is a valid return | `web/features/issues/components/issue-return.logic.test.mjs:41` | **PASS** |
| `WEB-U-076` | -- | Web — Logic Form Nhập trả từ phiếu xuất | refuses more than what is left, bad numbers and an empty form | `web/features/issues/components/issue-return.logic.test.mjs:60` | **PASS** |

#### `web/features/maintenance/maintenance.logic.test.mjs` — Web — Logic Lịch & Quản lý Bảo trì (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-077` | -- | Web — Logic Lịch & Quản lý Bảo trì | formatted maintenance costs retain the exact API value | `web/features/maintenance/maintenance.logic.test.mjs:11` | **PASS** |
| `WEB-U-078` | -- | Web — Logic Lịch & Quản lý Bảo trì | maintenance controls reflect each role and stage | `web/features/maintenance/maintenance.logic.test.mjs:23` | **PASS** |
| `WEB-U-079` | -- | Web — Logic Lịch & Quản lý Bảo trì | legacy history and approved receipts have no unusable return actions | `web/features/maintenance/maintenance.logic.test.mjs:75` | **PASS** |
| `WEB-U-080` | -- | Web — Logic Lịch & Quản lý Bảo trì | dates and countdown use Vietnam calendar boundaries | `web/features/maintenance/maintenance.logic.test.mjs:113` | **PASS** |
| `WEB-U-081` | `P1-05` | Web — Logic Lịch & Quản lý Bảo trì | a passed repair back in stock waits for the owner's reuse decision (P1-05) | `web/features/maintenance/maintenance.logic.test.mjs:122` | **PASS** |

#### `web/features/notifications/api/notifications.api.test.mjs` — Web — Notifications API Client (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-082` | -- | Web — Notifications API Client | notification lists send the farm, unread filter and ten-row server pagination | `web/features/notifications/api/notifications.api.test.mjs:7` | **PASS** |
| `WEB-U-083` | -- | Web — Notifications API Client | mark read encodes the ID and PATCHes only within the selected farm | `web/features/notifications/api/notifications.api.test.mjs:21` | **PASS** |
| `WEB-U-084` | -- | Web — Notifications API Client | mark all read uses its dedicated PATCH path and selected farm | `web/features/notifications/api/notifications.api.test.mjs:31` | **PASS** |
| `WEB-U-085` | -- | Web — Notifications API Client | API failures reach the caller for error handling and navigation after a failed mark | `web/features/notifications/api/notifications.api.test.mjs:40` | **PASS** |

#### `web/features/notifications/notifications.logic.test.mjs` — Web — Logic Hiển thị & Điều hướng Thông báo (`PASS 16/16`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-086` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps STOCK_RECEIPT and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-087` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps STOCK_ISSUE and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-088` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps STOCK_TRANSFER and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-089` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps STOCK_COUNT and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-090` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps MAINTENANCE_RECORD and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-091` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps MAINTENANCE_RETURN and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-092` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps MAINTENANCE_ASSET and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-093` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps MAINTENANCE_REQUEST and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-094` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps ASSET_TRANSFER_REQUEST and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-095` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps ASSET and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-096` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notificationHref maps PERSONNEL and encodes its ID | `web/features/notifications/notifications.logic.test.mjs:27` | **PASS** |
| `WEB-U-097` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | unknown types and missing IDs do not navigate | `web/features/notifications/notifications.logic.test.mjs:34` | **PASS** |
| `WEB-U-098` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notifications refresh the current target page even when its ID or query changes | `web/features/notifications/notifications.logic.test.mjs:43` | **PASS** |
| `WEB-U-099` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | badge hides zero and caps only the displayed count at 99+ | `web/features/notifications/notifications.logic.test.mjs:56` | **PASS** |
| `WEB-U-100` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notification errors explain auth, farm scope, invalid data and conflict reasons in Vietnamese | `web/features/notifications/notifications.logic.test.mjs:62` | **PASS** |
| `WEB-U-101` | -- | Web — Logic Hiển thị & Điều hướng Thông báo | notifications keep the permanent or asset code; uncoded drafts get the document prefix and short id | `web/features/notifications/notifications.logic.test.mjs:73` | **PASS** |

#### `web/features/personnel/personnel.api.test.mjs` — Web — Personnel API Client (`PASS 2/2`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-102` | -- | Web — Personnel API Client | personnel calls preserve selected farm, encoded member IDs, and explicit operations | `web/features/personnel/personnel.api.test.mjs:12` | **PASS** |
| `WEB-U-103` | -- | Web — Personnel API Client | account creation makes one attempt; callers control retries using the same request ID | `web/features/personnel/personnel.api.test.mjs:68` | **PASS** |

#### `web/features/personnel/personnel.logic.test.mjs` — Web — Logic Thành viên & Quyền nhân sự (`PASS 2/2`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-104` | -- | Web — Logic Thành viên & Quyền nhân sự | personnel permissions preserve the farm role matrix | `web/features/personnel/personnel.logic.test.mjs:9` | **PASS** |
| `WEB-U-105` | -- | Web — Logic Thành viên & Quyền nhân sự | credential failures never display transport messages, bodies, or exception values | `web/features/personnel/personnel.logic.test.mjs:22` | **PASS** |

#### `web/features/qr/qr.api.test.mjs` — Web — QR Asset Lookup API Client (`PASS 2/2`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-106` | -- | Web — QR Asset Lookup API Client | QR lookups call the farm-scoped item and balance endpoints | `web/features/qr/qr.api.test.mjs:5` | **PASS** |
| `WEB-U-107` | -- | Web — QR Asset Lookup API Client | QR errors explain a label from another farm, missing access and expired sessions | `web/features/qr/qr.api.test.mjs:19` | **PASS** |

#### `web/features/qr/scan.logic.test.mjs` — Web — Logic Phân tích mã QR & URL (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-108` | -- | Web — Logic Phân tích mã QR & URL | QR accepts bare asset codes and same-origin asset scan URLs | `web/features/qr/scan.logic.test.mjs:8` | **PASS** |
| `WEB-U-109` | -- | Web — Logic Phân tích mã QR & URL | QR reads item and inventory labels as lower-cased UUIDs | `web/features/qr/scan.logic.test.mjs:18` | **PASS** |
| `WEB-U-110` | -- | Web — Logic Phân tích mã QR & URL | QR rejects foreign, malformed and non-label values | `web/features/qr/scan.logic.test.mjs:23` | **PASS** |
| `WEB-U-111` | -- | Web — Logic Phân tích mã QR & URL | scanPath round-trips every label kind | `web/features/qr/scan.logic.test.mjs:43` | **PASS** |

#### `web/features/receipts/api/receipts.confirm.test.mjs` — Web — API Xác nhận Phiếu nhập kho (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-112` | -- | Web — API Xác nhận Phiếu nhập kho | confirms a draft through the dedicated farm-scoped action | `web/features/receipts/api/receipts.confirm.test.mjs:12` | **PASS** |
| `WEB-U-113` | -- | Web — API Xác nhận Phiếu nhập kho | scopes receipt lists and all dropdown lookups to the selected farm | `web/features/receipts/api/receipts.confirm.test.mjs:33` | **PASS** |
| `WEB-U-114` | -- | Web — API Xác nhận Phiếu nhập kho | lists lots of one item for the existing-lot picker | `web/features/receipts/api/receipts.confirm.test.mjs:77` | **PASS** |

#### `web/features/receipts/components/receipt-draft.logic.test.mjs` — Web — Logic Form Phiếu nhập kho (`PASS 10/10`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-115` | -- | Web — Logic Form Phiếu nhập kho | requires a warehouse and at least one identified item; no code is entered | `web/features/receipts/components/receipt-draft.logic.test.mjs:29` | **PASS** |
| `WEB-U-116` | -- | Web — Logic Form Phiếu nhập kho | validates exact quantity and price boundaries without floating-point coercion | `web/features/receipts/components/receipt-draft.logic.test.mjs:44` | **PASS** |
| `WEB-U-117` | -- | Web — Logic Form Phiếu nhập kho | permits quantity and valid LOT drafts without losing line metadata | `web/features/receipts/components/receipt-draft.logic.test.mjs:90` | **PASS** |
| `WEB-U-118` | -- | Web — Logic Form Phiếu nhập kho | validates optional supplier lot number and dates before saving a draft | `web/features/receipts/components/receipt-draft.logic.test.mjs:176` | **PASS** |
| `WEB-U-119` | -- | Web — Logic Form Phiếu nhập kho | validates and allows draft edits for ASSET lines | `web/features/receipts/components/receipt-draft.logic.test.mjs:218` | **PASS** |
| `WEB-U-120` | -- | Web — Logic Form Phiếu nhập kho | only exposes quantity confirmation for quantity tracked lines | `web/features/receipts/components/receipt-draft.logic.test.mjs:321` | **PASS** |
| `WEB-U-121` | -- | Web — Logic Form Phiếu nhập kho | existing-lot lines send only lotId and confirm without a lot number | `web/features/receipts/components/receipt-draft.logic.test.mjs:357` | **PASS** |
| `WEB-U-122` | -- | Web — Logic Form Phiếu nhập kho | maps lot and validation rejections from the API | `web/features/receipts/components/receipt-draft.logic.test.mjs:403` | **PASS** |
| `WEB-U-123` | -- | Web — Logic Form Phiếu nhập kho | an order return may end empty, and a returned asset needs its condition | `web/features/receipts/components/receipt-draft.logic.test.mjs:439` | **PASS** |
| `WEB-U-124` | -- | Web — Logic Form Phiếu nhập kho | order returns can be edited and confirmed with shipped assets or no line | `web/features/receipts/components/receipt-draft.logic.test.mjs:463` | **PASS** |

#### `web/features/reports/reports.logic.test.mjs` — Web — Logic Báo cáo Tài chính/Bán hàng/Bảo trì (`PASS 6/6`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-125` | -- | Web — Logic Báo cáo Tài chính/Bán hàng/Bảo trì | presets give day, week and month sized ranges ending today | `web/features/reports/reports.logic.test.mjs:14` | **PASS** |
| `WEB-U-126` | -- | Web — Logic Báo cáo Tài chính/Bán hàng/Bảo trì | today follows Vietnam time | `web/features/reports/reports.logic.test.mjs:24` | **PASS** |
| `WEB-U-127` | -- | Web — Logic Báo cáo Tài chính/Bán hàng/Bảo trì | custom ranges need both dates, in order, within 366 days | `web/features/reports/reports.logic.test.mjs:28` | **PASS** |
| `WEB-U-128` | -- | Web — Logic Báo cáo Tài chính/Bán hàng/Bảo trì | labels and series follow the granularity and mode | `web/features/reports/reports.logic.test.mjs:35` | **PASS** |
| `WEB-U-129` | -- | Web — Logic Báo cáo Tài chính/Bán hàng/Bảo trì | axis ticks are short | `web/features/reports/reports.logic.test.mjs:57` | **PASS** |
| `WEB-U-130` | `NV09-F02` | Web — Logic Báo cáo Tài chính/Bán hàng/Bảo trì | maintenance cost note states its real scope (NV09-F02) | `web/features/reports/reports.logic.test.mjs:64` | **PASS** |

#### `web/features/reports/stock-report.logic.test.mjs` — Web — Logic Báo cáo Nhập-Xuất-Tồn (`PASS 3/3`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-131` | -- | Web — Logic Báo cáo Nhập-Xuất-Tồn | stockLine sums in/out and nets transfers and asset moves | `web/features/reports/stock-report.logic.test.mjs:37` | **PASS** |
| `WEB-U-132` | -- | Web — Logic Báo cáo Nhập-Xuất-Tồn | stockReportView filters, groups by warehouse and adds VND only | `web/features/reports/stock-report.logic.test.mjs:57` | **PASS** |
| `WEB-U-133` | -- | Web — Logic Báo cáo Nhập-Xuất-Tồn | stockReportCsv writes Excel (Vietnam) friendly cells | `web/features/reports/stock-report.logic.test.mjs:76` | **PASS** |

#### `web/features/requests/api/requests.api.test.mjs` — Web — Requests API Client (Bảo trì/Chuyển) (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-134` | -- | Web — Requests API Client (Bảo trì/Chuyển) | request lists send farm, status, asset filter and pagination to each endpoint | `web/features/requests/api/requests.api.test.mjs:8` | **PASS** |
| `WEB-U-135` | -- | Web — Requests API Client (Bảo trì/Chuyển) | detail requests encode IDs and use the selected farm | `web/features/requests/api/requests.api.test.mjs:22` | **PASS** |
| `WEB-U-136` | -- | Web — Requests API Client (Bảo trì/Chuyển) | send functions preserve maintenance and transfer DTO bodies | `web/features/requests/api/requests.api.test.mjs:33` | **PASS** |
| `WEB-U-137` | -- | Web — Requests API Client (Bảo trì/Chuyển) | approve and reject functions use dedicated paths and exact DTOs | `web/features/requests/api/requests.api.test.mjs:46` | **PASS** |

#### `web/features/requests/requests.actions.test.mjs` — Web — Quyền thao tác Yêu cầu theo vai trò (`PASS 12/12`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-138` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | send maintenance reloads affected data on success | `web/features/requests/requests.actions.test.mjs:19` | **PASS** |
| `WEB-U-139` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | send maintenance keeps answered failures visible through reload, except auth failures | `web/features/requests/requests.actions.test.mjs:30` | **PASS** |
| `WEB-U-140` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | send transfer reloads affected data on success | `web/features/requests/requests.actions.test.mjs:19` | **PASS** |
| `WEB-U-141` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | send transfer keeps answered failures visible through reload, except auth failures | `web/features/requests/requests.actions.test.mjs:30` | **PASS** |
| `WEB-U-142` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | approve maintenance reloads affected data on success | `web/features/requests/requests.actions.test.mjs:19` | **PASS** |
| `WEB-U-143` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | approve maintenance keeps answered failures visible through reload, except auth failures | `web/features/requests/requests.actions.test.mjs:30` | **PASS** |
| `WEB-U-144` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | approve transfer reloads affected data on success | `web/features/requests/requests.actions.test.mjs:19` | **PASS** |
| `WEB-U-145` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | approve transfer keeps answered failures visible through reload, except auth failures | `web/features/requests/requests.actions.test.mjs:30` | **PASS** |
| `WEB-U-146` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | reject maintenance reloads affected data on success | `web/features/requests/requests.actions.test.mjs:19` | **PASS** |
| `WEB-U-147` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | reject maintenance keeps answered failures visible through reload, except auth failures | `web/features/requests/requests.actions.test.mjs:30` | **PASS** |
| `WEB-U-148` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | reject transfer reloads affected data on success | `web/features/requests/requests.actions.test.mjs:19` | **PASS** |
| `WEB-U-149` | -- | Web — Quyền thao tác Yêu cầu theo vai trò | reject transfer keeps answered failures visible through reload, except auth failures | `web/features/requests/requests.actions.test.mjs:30` | **PASS** |

#### `web/features/requests/requests.logic.test.mjs` — Web — Logic Danh sách & Form Yêu cầu (`PASS 13/13`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-150` | -- | Web — Logic Danh sách & Form Yêu cầu | only approvers review pending requests; reviewed requests have no actions | `web/features/requests/requests.logic.test.mjs:18` | **PASS** |
| `WEB-U-151` | -- | Web — Logic Danh sách & Form Yêu cầu | only employee non-approvers create; transfers require an AVAILABLE asset | `web/features/requests/requests.logic.test.mjs:41` | **PASS** |
| `WEB-U-152` | -- | Web — Logic Danh sách & Form Yêu cầu | rejection reasons are trimmed and must contain 3–1000 characters | `web/features/requests/requests.logic.test.mjs:52` | **PASS** |
| `WEB-U-153` | -- | Web — Logic Danh sách & Form Yêu cầu | maintenance descriptions are trimmed and bounded to 3–4000 characters | `web/features/requests/requests.logic.test.mjs:58` | **PASS** |
| `WEB-U-154` | -- | Web — Logic Danh sách & Form Yêu cầu | scheduledAt uses the viewer's local time and rejects invalid calendar dates | `web/features/requests/requests.logic.test.mjs:65` | **PASS** |
| `WEB-U-155` | -- | Web — Logic Danh sách & Form Yêu cầu | query defaults depend on approver roles and preserve notification deep links | `web/features/requests/requests.logic.test.mjs:82` | **PASS** |
| `WEB-U-156` | -- | Web — Logic Danh sách & Form Yêu cầu | invalid query values fall back safely without sending malformed IDs or pages | `web/features/requests/requests.logic.test.mjs:98` | **PASS** |
| `WEB-U-157` | -- | Web — Logic Danh sách & Form Yêu cầu | request links retain type, status, page and optional detail ID | `web/features/requests/requests.logic.test.mjs:108` | **PASS** |
| `WEB-U-158` | -- | Web — Logic Danh sách & Form Yêu cầu | API auth, not-found and validation failures have Vietnamese messages | `web/features/requests/requests.logic.test.mjs:116` | **PASS** |
| `WEB-U-159` | -- | Web — Logic Danh sách & Form Yêu cầu | API conflicts explain pending requests, stale assets and inactive destinations | `web/features/requests/requests.logic.test.mjs:131` | **PASS** |
| `WEB-U-160` | -- | Web — Logic Danh sách & Form Yêu cầu | reload decisions preserve the shared stock-document policy | `web/features/requests/requests.logic.test.mjs:162` | **PASS** |
| `WEB-U-161` | -- | Web — Logic Danh sách & Form Yêu cầu | transfer destinations use joined names with code fallbacks | `web/features/requests/requests.logic.test.mjs:167` | **PASS** |
| `WEB-U-162` | `P1-05` | Web — Logic Danh sách & Form Yêu cầu | only the owner or admin approves a maintenance request (P1-05) | `web/features/requests/requests.logic.test.mjs:172` | **PASS** |

#### `web/features/stock-documents/stock-document-interaction.test.mjs` — Web — Tương tác Tìm/Chọn dòng Chứng từ kho (`PASS 14/14`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-163` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | counts: editing and a slow save block confirm, cancel and submit, even through stale handlers | `web/features/stock-documents/stock-document-interaction.test.mjs:142` | **PASS** |
| `WEB-U-164` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | counts: closing the panel while editing releases the lock | `web/features/stock-documents/stock-document-interaction.test.mjs:174` | **PASS** |
| `WEB-U-165` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | counts: pending confirmation blocks editing and duplicate requests, then unlocks after failure | `web/features/stock-documents/stock-document-interaction.test.mjs:182` | **PASS** |
| `WEB-U-166` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | counts: discarding edits blocks a stale save handler | `web/features/stock-documents/stock-document-interaction.test.mjs:207` | **PASS** |
| `WEB-U-167` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | counts: submitting blocks edits and releases the lock after auth, conflict and network errors | `web/features/stock-documents/stock-document-interaction.test.mjs:217` | **PASS** |
| `WEB-U-168` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | transfers: editing and a slow save block confirm, cancel and submit, even through stale handlers | `web/features/stock-documents/stock-document-interaction.test.mjs:142` | **PASS** |
| `WEB-U-169` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | transfers: closing the panel while editing releases the lock | `web/features/stock-documents/stock-document-interaction.test.mjs:174` | **PASS** |
| `WEB-U-170` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | transfers: pending confirmation blocks editing and duplicate requests, then unlocks after failure | `web/features/stock-documents/stock-document-interaction.test.mjs:182` | **PASS** |
| `WEB-U-171` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | transfers: discarding edits blocks a stale save handler | `web/features/stock-documents/stock-document-interaction.test.mjs:207` | **PASS** |
| `WEB-U-172` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | transfers: submitting blocks edits and releases the lock after auth, conflict and network errors | `web/features/stock-documents/stock-document-interaction.test.mjs:217` | **PASS** |
| `WEB-U-173` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | counts: an owner can clear a requested code while editing the draft | `web/features/stock-documents/stock-document-interaction.test.mjs:238` | **PASS** |
| `WEB-U-174` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | counts: other approvers neither see nor send numbering options | `web/features/stock-documents/stock-document-interaction.test.mjs:249` | **PASS** |
| `WEB-U-175` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | transfers: an owner can clear a requested code while editing the draft | `web/features/stock-documents/stock-document-interaction.test.mjs:238` | **PASS** |
| `WEB-U-176` | -- | Web — Tương tác Tìm/Chọn dòng Chứng từ kho | transfers: other approvers neither see nor send numbering options | `web/features/stock-documents/stock-document-interaction.test.mjs:249` | **PASS** |

#### `web/features/stock-documents/stock-document-lines.logic.test.mjs` — Web — Logic Dòng hàng Chứng từ kho (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-177` | -- | Web — Logic Dòng hàng Chứng từ kho | transfers need a positive quantity, counts accept zero | `web/features/stock-documents/stock-document-lines.logic.test.mjs:17` | **PASS** |
| `WEB-U-178` | -- | Web — Logic Dòng hàng Chứng từ kho | rejects empty documents, missing lots, ASSET lines and duplicate item+lot | `web/features/stock-documents/stock-document-lines.logic.test.mjs:25` | **PASS** |
| `WEB-U-179` | -- | Web — Logic Dòng hàng Chứng từ kho | builds the PATCH lines with the quantity field of each document | `web/features/stock-documents/stock-document-lines.logic.test.mjs:40` | **PASS** |
| `WEB-U-180` | -- | Web — Logic Dòng hàng Chứng từ kho | counts take one asset per line, found 1 or missing 0; transfers still refuse assets | `web/features/stock-documents/stock-document-lines.logic.test.mjs:52` | **PASS** |

#### `web/features/stock-documents/stock-document.logic.test.mjs` — Web — Logic chung Chứng từ & Số phiếu (`PASS 11/11`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-181` | -- | Web — Logic chung Chứng từ & Số phiếu | only approvers and employees create documents | `web/features/stock-documents/stock-document.logic.test.mjs:23` | **PASS** |
| `WEB-U-182` | -- | Web — Logic chung Chứng từ & Số phiếu | employees edit, cancel and submit only their own drafts | `web/features/stock-documents/stock-document.logic.test.mjs:31` | **PASS** |
| `WEB-U-183` | -- | Web — Logic chung Chứng từ & Số phiếu | approvers confirm drafts directly and review pending documents | `web/features/stock-documents/stock-document.logic.test.mjs:41` | **PASS** |
| `WEB-U-184` | -- | Web — Logic chung Chứng từ & Số phiếu | submitted, final and order-linked documents lock the right actions | `web/features/stock-documents/stock-document.logic.test.mjs:54` | **PASS** |
| `WEB-U-185` | -- | Web — Logic chung Chứng từ & Số phiếu | API rejections become specific messages and decide whether to reload | `web/features/stock-documents/stock-document.logic.test.mjs:73` | **PASS** |
| `WEB-U-186` | -- | Web — Logic chung Chứng từ & Số phiếu | rejection reasons are trimmed and bounded | `web/features/stock-documents/stock-document.logic.test.mjs:137` | **PASS** |
| `WEB-U-187` | -- | Web — Logic chung Chứng từ & Số phiếu | document query IDs accept UUIDs and ignore missing or invalid values | `web/features/stock-documents/stock-document.logic.test.mjs:145` | **PASS** |
| `WEB-U-188` | -- | Web — Logic chung Chứng từ & Số phiếu | receipt, transfer and count URLs preserve filters when opening, replacing or closing a document | `web/features/stock-documents/stock-document.logic.test.mjs:176` | **PASS** |
| `WEB-U-189` | -- | Web — Logic chung Chứng từ & Số phiếu | labels an uncoded draft by its short id and keeps a permanent code | `web/features/stock-documents/stock-document.logic.test.mjs:202` | **PASS** |
| `WEB-U-190` | -- | Web — Logic chung Chứng từ & Số phiếu | normalizes owner numbering options like the API and requires a reason with a code | `web/features/stock-documents/stock-document.logic.test.mjs:215` | **PASS** |
| `WEB-U-191` | -- | Web — Logic chung Chứng từ & Số phiếu | warehouse managers approve; employees only create; store managers do neither | `web/features/stock-documents/stock-document.logic.test.mjs:269` | **PASS** |

#### `web/features/store-admin/store-admin.logic.test.mjs` — Web — Logic Quản trị Sản phẩm/Cửa hàng (`PASS 6/6`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-192` | -- | Web — Logic Quản trị Sản phẩm/Cửa hàng | slugify strips Vietnamese diacritics | `web/features/store-admin/store-admin.logic.test.mjs:14` | **PASS** |
| `WEB-U-193` | -- | Web — Logic Quản trị Sản phẩm/Cửa hàng | validateStoreImage enforces type and size | `web/features/store-admin/store-admin.logic.test.mjs:19` | **PASS** |
| `WEB-U-194` | -- | Web — Logic Quản trị Sản phẩm/Cửa hàng | moveItem swaps neighbours and ignores out-of-range moves | `web/features/store-admin/store-admin.logic.test.mjs:28` | **PASS** |
| `WEB-U-195` | -- | Web — Logic Quản trị Sản phẩm/Cửa hàng | canManageStore and storeAdminError | `web/features/store-admin/store-admin.logic.test.mjs:33` | **PASS** |
| `WEB-U-196` | -- | Web — Logic Quản trị Sản phẩm/Cửa hàng | isVndAmount accepts whole non-negative VND only | `web/features/store-admin/store-admin.logic.test.mjs:41` | **PASS** |
| `WEB-U-197` | -- | Web — Logic Quản trị Sản phẩm/Cửa hàng | sales stock state and summary | `web/features/store-admin/store-admin.logic.test.mjs:52` | **PASS** |

#### `web/features/store-warranties/warranty.logic.test.mjs` — Web — Logic Phiếu Bảo hành & Đổi trả (`PASS 6/6`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-198` | -- | Web — Logic Phiếu Bảo hành & Đổi trả | a paid repair cannot start before the customer agreed (AC23) | `web/features/store-warranties/warranty.logic.test.mjs:8` | **PASS** |
| `WEB-U-199` | -- | Web — Logic Phiếu Bảo hành & Đổi trả | an exchange closes only once the warehouse issued the replacement (AC24) | `web/features/store-warranties/warranty.logic.test.mjs:17` | **PASS** |
| `WEB-U-200` | -- | Web — Logic Phiếu Bảo hành & Đổi trả | coverage counts from delivery and keeps the months sold | `web/features/store-warranties/warranty.logic.test.mjs:25` | **PASS** |
| `WEB-U-201` | -- | Web — Logic Phiếu Bảo hành & Đổi trả | explains API codes in Vietnamese | `web/features/store-warranties/warranty.logic.test.mjs:33` | **PASS** |
| `WEB-U-202` | -- | Web — Logic Phiếu Bảo hành & Đổi trả | an asset line claims one of its own delivered units | `web/features/store-warranties/warranty.logic.test.mjs:38` | **PASS** |
| `WEB-U-203` | `P1-10` | Web — Logic Phiếu Bảo hành & Đổi trả | the same request can be re-quoted or sent round again (P1-10) | `web/features/store-warranties/warranty.logic.test.mjs:52` | **PASS** |

#### `web/features/transfers/transfer-receive.logic.test.mjs` — Web — Logic Nhận/Ghi hỏng/Xử lý Chuyển kho (`PASS 5/5`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-204` | -- | Web — Logic Nhận/Ghi hỏng/Xử lý Chuyển kho | only warehouse managers receive, and only dispatched transfers | `web/features/transfers/transfer-receive.logic.test.mjs:15` | **PASS** |
| `WEB-U-205` | -- | Web — Logic Nhận/Ghi hỏng/Xử lý Chuyển kho | sends only short lines; empty or full lines arrived in full | `web/features/transfers/transfer-receive.logic.test.mjs:21` | **PASS** |
| `WEB-U-206` | -- | Web — Logic Nhận/Ghi hỏng/Xử lý Chuyển kho | refuses more than dispatched, bad numbers and a short line without reason | `web/features/transfers/transfer-receive.logic.test.mjs:37` | **PASS** |
| `WEB-U-207` | -- | Web — Logic Nhận/Ghi hỏng/Xử lý Chuyển kho | translates the API's receive errors | `web/features/transfers/transfer-receive.logic.test.mjs:52` | **PASS** |
| `WEB-U-208` | -- | Web — Logic Nhận/Ghi hỏng/Xử lý Chuyển kho | only the owner or admin settles a short receipt | `web/features/transfers/transfer-receive.logic.test.mjs:60` | **PASS** |

#### `web/features/warehouses/components/warehouse-form.logic.test.mjs` — Web — Logic Form Kho hàng (`PASS 1/1`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-209` | -- | Web — Logic Form Kho hàng | Script assert trực tiếp (node --test): required fields, độ dài biên (50/255/4000), chuẩn hóa code in hoa, PATCH null hóa field rỗng & loại bỏ status | `web/features/warehouses/components/warehouse-form.logic.test.mjs:8` | **PASS** |

#### `web/shared/config/api.test.mjs` — Web — Cấu hình API URL & Next Env (`PASS 2/2`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-210` | -- | Web — Cấu hình API URL & Next Env | public URL takes precedence | `web/shared/config/api.test.mjs:24` | **PASS** |
| `WEB-U-211` | -- | Web — Cấu hình API URL & Next Env | local fallback | `web/shared/config/api.test.mjs:24` | **PASS** |

#### `web/shared/config/history-access.test.mjs` — Web — Quyền truy cập Lịch sử Audit (`PASS 1/1`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-212` | -- | Web — Quyền truy cập Lịch sử Audit | history uses the protected dashboard routes and existing staff navigation gate | `web/shared/config/history-access.test.mjs:6` | **PASS** |

#### `web/shared/config/navigation.test.mjs` — Web — Cấu hình Menu Navigation theo Role (`PASS 6/6`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-213` | -- | Web — Cấu hình Menu Navigation theo Role | order screens are hidden on farms that do not sell online; products stay for setup | `web/shared/config/navigation.test.mjs:20` | **PASS** |
| `WEB-U-214` | -- | Web — Cấu hình Menu Navigation theo Role | store screens need a store role; farm-area screens hide from store-only managers | `web/shared/config/navigation.test.mjs:29` | **PASS** |
| `WEB-U-215` | -- | Web — Cấu hình Menu Navigation theo Role | direct routes resolve to their navigation item | `web/shared/config/navigation.test.mjs:38` | **PASS** |
| `WEB-U-216` | -- | Web — Cấu hình Menu Navigation theo Role | delivery staff see only the delivery screen of the store section | `web/shared/config/navigation.test.mjs:45` | **PASS** |
| `WEB-U-217` | -- | Web — Cấu hình Menu Navigation theo Role | the reports page is for farm admins and warehouse managers only | `web/shared/config/navigation.test.mjs:54` | **PASS** |
| `WEB-U-218` | -- | Web — Cấu hình Menu Navigation theo Role | maintenance staff keep farm-area screens but not materials, warehouses or catalog | `web/shared/config/navigation.test.mjs:61` | **PASS** |

#### `web/shared/config/protected-routes.test.mjs` — Web — Middleware Clerk Protected Routes (`PASS 1/1`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-219` | -- | Web — Middleware Clerk Protected Routes | warehouse pages require Clerk protection while storefront pages remain public | `web/shared/config/protected-routes.test.mjs:27` | **PASS** |

#### `web/shared/lib/date-input.test.mjs` — Web — Chuẩn hóa Input Ngày tháng (`PASS 4/4`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-220` | -- | Web — Chuẩn hóa Input Ngày tháng | types day-first digits into a fixed dd/mm/yyyy mask | `web/shared/lib/date-input.test.mjs:12` | **PASS** |
| `WEB-U-221` | -- | Web — Chuẩn hóa Input Ngày tháng | emits ISO only for complete real dates and times | `web/shared/lib/date-input.test.mjs:22` | **PASS** |
| `WEB-U-222` | -- | Web — Chuẩn hóa Input Ngày tháng | round-trips ISO values and pasted ISO text | `web/shared/lib/date-input.test.mjs:32` | **PASS** |
| `WEB-U-223` | -- | Web — Chuẩn hóa Input Ngày tháng | places the caret after the n-th digit | `web/shared/lib/date-input.test.mjs:40` | **PASS** |

#### `web/shared/lib/search.test.mjs` — Web — Tìm kiếm tiếng Việt không dấu (`PASS 1/1`)

| Mã BC | Tag gốc | Test phần nào | Chi tiết những gì đã test | Ở đâu | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `WEB-U-224` | -- | Web — Tìm kiếm tiếng Việt không dấu | matchesSearch ignores diacritics, case and word order | `web/shared/lib/search.test.mjs:5` | **PASS** |

## 9. Tài Liệu Nghiệm Thu Trình Duyệt & Công Cụ Kiểm Tra Ngoài

Các mục dưới đây **không nằm trong test runner tự động hiện hành**, gồm biên bản nghiệm thu browser trước đây và script kiểm tra bên ngoài:

| Mã BC | Phần kiểm tra | Chi tiết nội dung | Vị trí / Minh chứng | Trạng thái hiện tại |
| --- | --- | --- | --- | --- |
| `ACC-01` | Nghiệm thu browser Asset & Maintenance (Phase 6–7, ngày `2026-10-25`) | 22 ca E2E trên Chromium (`1440x1000` & `390x844`): UI -> API -> PostgreSQL, vòng đời tài sản, giữ số tiền thập phân lớn, mất mạng giữa chừng, trùng submit, QR SVG/print/camera ZXing, quyền GUEST 403, chuyển trại bỏ response trễ. Lượt đầu **21/22 PASS**, phát hiện **1 FAIL** lỗi `Escape` đóng dialog cha khi focus nút lookup -> đã sửa và chạy regression **Chromium 4/4 PASS, Firefox 4/4 PASS** (chưa chạy lại toàn bộ 22 ca sau sửa). | `ASSET_BROWSER_ACCEPTANCE.md` *(thư mục `web/test-artifacts/assets/` không có trên nhánh `dev` hiện tại)* | **LỊCH SỬ / BÁN PHẦN** (chưa chạy lại full 22 ca) |
| `ACC-02` | Nghiệm thu Clerk thật & thiết bị thật (`ASSET_BROWSER_ACCEPTANCE.md`) | Smoke không đăng nhập đạt (`health 200`, API không token `401`, CORS `204`, redirect Clerk sign-in). Tuy nhiên **đăng nhập Clerk JWT thật end-to-end, camera/in tem trên điện thoại thật, và iOS Safari/WebKit** (thiếu thư viện host) chưa hoàn thành. | `ASSET_BROWSER_ACCEPTANCE.md#L40-L116` | **BLOCKED / CHỜ THỦ CÔNG** |
| `ACC-03` | Nghiệm thu Phiếu xuất kho (Task 8, ngày `2026-10-05`) | Biên bản ghi nhận: `stock-issue-acceptance.e2e-spec.ts` (5/5 PASS), browser IssuesPage -> Nest API -> PG (18/18 PASS), harness (87/87 PASS), web logic/api/build đạt. File `stock-issue-acceptance.e2e-spec.ts` và `.browser.mjs` thuộc nhánh `feature/27-stock-issue-acceptance`, không còn trên nhánh `dev` hiện tại (chỉ còn báo cáo & ảnh chụp). | `api/test/STOCK_ISSUE_ACCEPTANCE_REPORT.md`, `api/test/artifacts/stock-issue-acceptance.png` | **LỊCH SỬ** (file acceptance riêng không nằm trên nhánh `dev`) |
| `ACC-04` | Nghiệm thu giao diện Warehouse CountsScreen & TransfersScreen | Mô tả các assertion trình duyệt: tạo nháp, xác nhận, làm mới danh sách, đổi trại, ẩn nút ghi với GUEST, relative API paths, không tràn ngang ở 390px/1440px (dùng fixture). | `web/test-artifacts/warehouse/README.md` | **LỊCH SỬ** (tài liệu ảnh/fixture) |
| `TOOL-01` | Script kiểm tra API ảnh Wikimedia Commons | Gửi HTTP GET tới `commons.wikimedia.org/w/api.php` (`Category:Beekeeping_equipment`), in 5 kết quả mẫu để phục vụ tìm nguồn ảnh thiết bị nuôi ong. | `tools/test_sources.py` | **BLOCKED** trong sandbox không Internet (công cụ ngoài luồng test dự án) |

## 10. Hướng Dẫn Khắc Phục `FAIL` & Mở Khóa (`Unblock`) Toàn Bộ Suite

1. **Sửa 3 test case `FAIL` trong API Unit Tests:**
   - Trong `api/src/modules/assets/assets.service.spec.ts`: bổ sung lần stub thứ 3 cho `select` trả về `[{ available: 1, inUse: 0, attention: 0 }]` và thêm trường `summary` vào object `.resolves.toEqual(...)`.
   - Trong `api/src/modules/materials/materials.service.spec.ts`: thêm trường `summary: { lotCount: ..., activeCount: ..., lowStockCount: ... }` vào expectation ở 2 test `returns a paginated material list and quantity` và `returns no materials when the filtered result is empty` (và stub `select` thứ 3 rõ ràng nếu cần).
2. **Chạy toàn bộ 41 suite Integration & E2E (đang `BLOCKED`):**
   - Khởi động PostgreSQL local (ví dụ Docker container `postgres:18` cổng riêng như `55439`), tạo database có hậu tố `_test` (ví dụ `nuoi_ong_test`) và chạy migration trên DB test đó (`DATABASE_URL=... pnpm --dir api db:migrate`).
   - Chạy bên ngoài sandbox (cho phép loopback TCP `127.0.0.1` và kết nối Postgres local):
     - Nhóm Assets/Kho: `$env:TEST_DATABASE_URL="postgresql://postgres:PASS@127.0.0.1:55439/nuoi_ong_test"; pnpm --dir api test:assets`
     - Nhóm Nhân sự/Kho: `$env:TEST_DATABASE_URL="postgresql://postgres:PASS@127.0.0.1:55439/nuoi_ong_test"; pnpm --dir api test:personnel`
     - Nhóm Bảo trì: `$env:DATABASE_URL="postgresql://postgres:PASS@127.0.0.1:55439/nuoi_ong_test"; pnpm --dir api test:maintenance`
     - Toàn bộ nhóm E2E/DB còn lại: `$env:DATABASE_URL="postgresql://postgres:PASS@127.0.0.1:55439/nuoi_ong_test"; pnpm --dir api test:e2e --runInBand`
