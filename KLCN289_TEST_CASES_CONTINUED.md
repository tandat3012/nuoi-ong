# KLCN289 — Test Case tiếp nối cho toàn hệ thống

## 1. Phiên bản, phạm vi và cách đọc

- Source được rà: nhánh `dev`, HEAD `f868ea0e4785af7ab9c2d6d1e044105a5bc85e98`; ref local `origin/dev` trùng SHA tại lúc kiểm tra.
- Đã thử xác minh `origin/dev` trên GitHub bằng `git ls-remote` chỉ đọc nhưng kết nối mạng bị từ chối; vì vậy không khẳng định HEAD là commit mới nhất trên remote. Không pull/fetch.
- Baseline: `KLCN289_QUY_TAC_VA_NGU_CANH_CHAT_MOI_2026-11-07.md`, Dev/UML v1.1, bản giao Đạt 08/11, `HinhVeNghiepVu copy.docx` SHA-256 `7236a3c02c5e3575ef27fa6f8f1a7d21a708638b01e7fbb41f0cfa9b86b65446`, source hiện tại và các Test Case cũ.
- Tài liệu scenario cũ còn dùng `NV11` cho danh mục kinh doanh. Theo quyết định mới trong yêu cầu hiện tại, tài liệu này dùng `NV10` cho cùng nghiệp vụ. `NV10` thanh lý độc lập không nằm trong phạm vi.
- Bộ Test Case cũ được giữ nguyên: NV01 48, NV02 58, NV05 12, tổng 118. Không có ID cũ nào được tái sử dụng.
- Fixture ký hiệu là dữ liệu giả lập cần QA chuẩn bị trong DB test riêng/Clerk test tenant, không phải dữ liệu đang tồn tại. Các ca `Integration`, `Concurrency` và `E2E` không chạy với database của nhóm.
- Tất cả ca mới có `Execution Status = Not Run`; không ghi kết quả Pass/Fail. `Implementation Status` phản ánh code đọc được tại HEAD, không phải runtime.

## 2. Chuẩn bị fixture

Tạo mới và ghi mapping bí danh→UUID/email trong hồ sơ test riêng. Không đưa mật khẩu, token, secret, email/ID người dùng thật vào báo cáo.

- Farm F-A và F-B; kho WH-A, WH-B thuộc F-A; WH-X thuộc F-B; LOC-A/B thuộc các kho tương ứng.
- Membership riêng cho ADMIN, FARM_OWNER, WAREHOUSE_MANAGER, STORE_MANAGER, DELIVERY_STAFF, MAINTENANCE_STAFF và EMPLOYEE theo từng Farm; cấp quyền đúng mục tiêu từng ca.
- MAT-Q theo dõi QUANTITY, MAT-L theo dõi LOT, EQ-A theo dõi ASSET; tạo lot LOT-A và cá thể ASSET-A chỉ qua đúng nghiệp vụ/fixture setup.
- Dùng các giá trị tồn nêu trong từng ca; đặt lại dữ liệu độc lập trước mỗi lần chạy. Snapshot baseline gồm chứng từ, balance, lot/asset, assignment, inventory_transactions/ledger, audit_logs, thanh toán và notification có liên quan.
- Với giao dịch lỗi/đồng thời, dùng DB test riêng có thể reset và harness kiểm soát điểm đồng bộ/fault. Không thực thi bằng tay trên Web và không chạy trên DB dùng chung.

## 3. AUTH — xác thực và phân quyền

**Căn cứ kỹ thuật:** `api/src/modules/auth/accounts/auth.controller.ts`, `clerk-auth.guard.ts`, `farm-access.guard.ts`; Web `web/features/auth/`; Mobile `mobile/src/features/auth/`. `AUTH-04` chỉ kiểm tra ma trận quyền chung; không kiểm trùng quy tắc OWNER cuối của NV08-03.

### TC-AUTH-001 — Đăng nhập và nạp membership hiện hành

- **Scenario ID:** AUTH-01
- **Priority / Test Level / Platform:** P1 / UI + API / Web
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** AUTH-U1 có membership active ở F-A; Web mở ở trạng thái signed-out; Clerk test tenant hoạt động.
- **Test Steps:** 1. Mở trang đăng nhập. 2. Đăng nhập bằng thông tin fixture. 3. Chờ chuyển về ứng dụng. 4. Mở thông tin tài khoản/Farm hiện hành và gọi một API đọc được trong F-A.
- **Test Data:** AUTH-U1, F-A, membership EMPLOYEE active.
- **Expected Result:** Clerk tạo phiên hợp lệ; ứng dụng nạp đúng user và membership F-A; API đọc được trong phạm vi được cấp; không lộ credential trong giao diện hoặc log ứng dụng.
- **Design Status:** Ready.
- **Implementation Status:** Có Clerk sign-in và auth context; phiên Clerk thật chưa được kiểm thử trong tenant của nhiệm vụ.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-AUTH-002 — Đăng xuất làm mất quyền truy cập route bảo vệ

- **Scenario ID:** AUTH-01
- **Priority / Test Level / Platform:** P1 / UI + API / Web, Mobile
- **Test Design Technique:** State Transition
- **Preconditions:** AUTH-U1 đang đăng nhập; đã mở một route dashboard bảo vệ.
- **Test Steps:** 1. Thực hiện Sign out trong giao diện. 2. Dùng nút Back mở lại route bảo vệ. 3. Gửi lại một request API bằng token phiên cũ nếu harness giữ được token test.
- **Test Data:** AUTH-U1; route dashboard; token đã hết hiệu lực sau sign-out.
- **Expected Result:** UI không tiếp tục hiển thị dữ liệu bảo vệ; người dùng được yêu cầu đăng nhập lại; request dùng phiên không còn hợp lệ bị từ chối; dữ liệu Farm không được cache hiển thị sau logout.
- **Design Status:** Ready.
- **Implementation Status:** Có sign-out/session handling Web và Mobile; runtime Clerk chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-AUTH-003 — Đổi mật khẩu ban đầu qua luồng ứng dụng được cấu hình

- **Scenario ID:** AUTH-02
- **Priority / Test Level / Platform:** P1 / UI + API / Web
- **Test Design Technique:** State Transition, Error Guessing
- **Preconditions:** AUTH-U2 là account test được Clerk yêu cầu đổi mật khẩu ban đầu; tenant chỉ dùng cho kiểm thử.
- **Test Steps:** 1. Đăng nhập AUTH-U2. 2. Theo điều hướng bắt buộc tới trang đổi mật khẩu. 3. Nhập mật khẩu mới hợp lệ theo Clerk test tenant và lưu. 4. Đăng xuất/đăng nhập lại bằng credential mới. 5. Gửi lại credential cũ.
- **Test Data:** AUTH-U2; mật khẩu chỉ nhập trong Clerk test tenant, không ghi vào báo cáo.
- **Expected Result:** Quy trình đổi ban đầu hoàn tất qua trang/API thực có trong ứng dụng; credential mới đăng nhập được, credential cũ không dùng được; lỗi của Clerk không làm lộ response body/secret.
- **Design Status:** Ready.
- **Implementation Status:** Có route Web `account/change-password`, component và API auth; cần Clerk test tenant để xác minh runtime.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-AUTH-004 — Chuyển giữa hai Farm mà không giữ dữ liệu Farm trước

- **Scenario ID:** AUTH-03
- **Priority / Test Level / Platform:** P0 / UI Integration / Web, Mobile
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** AUTH-U3 có membership active khác vai trò ở F-A và F-B; mỗi Farm có một kho và một chứng từ nhận diện riêng.
- **Test Steps:** 1. Chọn F-A và mở danh sách kho/chứng từ. 2. Chuyển sang F-B bằng Farm switcher. 3. Tải lại danh sách và mở một liên kết chi tiết cũ thuộc F-A.
- **Test Data:** F-A chứng từ A-1; F-B chứng từ B-1; AUTH-U3.
- **Expected Result:** Sau chuyển Farm, danh sách và request dùng Farm B; dữ liệu A không còn lẫn vào UI; truy cập trực tiếp ID A khi context là B bị từ chối hoặc không tìm thấy theo hợp đồng, không trả nội dung A.
- **Design Status:** Ready.
- **Implementation Status:** Có Farm switcher, xóa lựa chọn chứng từ cũ và Farm scope phía API; cần kiểm thử phiên thật.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-AUTH-005 — Người biết ID nhưng không có membership không đọc được Farm khác

- **Scenario ID:** AUTH-03
- **Priority / Test Level / Platform:** P0 / API Integration / API
- **Test Design Technique:** Role-based Access Testing, Error Guessing
- **Preconditions:** AUTH-U4 chỉ thuộc F-A; F-B có kho và chứng từ fixture; token AUTH-U4 hợp lệ.
- **Test Steps:** 1. Gọi API danh sách kho với farmId=F-B. 2. Gọi API chi tiết chứng từ F-B bằng ID biết trước. 3. Đọc lại log/audit để bảo đảm request bị từ chối không ghi thay đổi.
- **Test Data:** AUTH-U4; farmId=F-B; ID chứng từ B-1.
- **Expected Result:** Backend từ chối cả truy vấn trái membership; không trả dữ liệu F-B và không tạo audit nghiệp vụ thành công.
- **Design Status:** Ready.
- **Implementation Status:** FarmAccessGuard và service scope có trong source; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-AUTH-006 — Ma trận role không cho STORE_MANAGER sửa catalog chung

- **Scenario ID:** AUTH-04
- **Priority / Test Level / Platform:** P0 / API + UI Integration / Web, API
- **Test Design Technique:** Role-based Access Testing, Decision Table
- **Preconditions:** Farm test có ADMIN, FARM_OWNER và STORE_MANAGER active; có sản phẩm DRAFT và cấu hình bán; mỗi role có token riêng.
- **Test Steps:** 1. Với từng role, mở trang danh mục. 2. Gọi trực tiếp API sửa giá/metadata sản phẩm. 3. Gọi API chức năng vận hành đơn mà role được quyền. 4. Đối chiếu sản phẩm, audit và đơn trước/sau.
- **Test Data:** ADMIN/FARM_OWNER/STORE_MANAGER; product P-A; variant V-A.
- **Expected Result:** Chỉ role được đặc tả cho phép mới sửa danh mục/giá chung; STORE_MANAGER không vượt quyền qua API trực tiếp; quyền xử lý đơn theo role vẫn hoạt động; request bị từ chối không đổi sản phẩm/audit.
- **Design Status:** Ready; fixture role phải theo membership hiện hành.
- **Implementation Status:** Controller Store Admin có guard riêng cho catalog; chưa xác minh ADMIN không có membership Farm theo quyết định mở.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-AUTH-007 — Token thiếu, sai chữ ký hoặc hết hạn không đọc dữ liệu bảo vệ

- **Scenario ID:** AUTH-02, AUTH-04
- **Priority / Test Level / Platform:** P0 / API / API
- **Test Design Technique:** Equivalence Partitioning, Error Guessing
- **Preconditions:** Có API bảo vệ Farm; fixture tạo được request không token, token sai chữ ký và token test hết hạn.
- **Test Steps:** 1. Gọi cùng API bằng từng loại credential. 2. Kiểm tra response. 3. Đối chiếu dữ liệu không bị thay đổi.
- **Test Data:** Không Authorization header; token sai chữ ký; token hết hạn; endpoint GET kho F-A.
- **Expected Result:** Cả ba nhóm credential không hợp lệ bị từ chối; không trả payload Farm và không phát sinh thay đổi dữ liệu.
- **Design Status:** Ready.
- **Implementation Status:** ClerkAuthGuard có unit test; API runtime chưa xác minh.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 4. NV02-06 — Điều chuyển ASSET theo hai thời điểm

**Căn cứ kỹ thuật:** `api/src/modules/assets/asset-transfer-requests.controller.ts` và `asset-transfer-requests.service.ts`; Web `web/features/transfers/`; Mobile `AssetTransferRequestScreen`. Không dùng luồng chuyển QUANTITY/LOT để đại diện cho tài sản.

### TC-NV02-059 — Tạo yêu cầu chuyển ASSET chưa làm tài sản khả dụng ở kho đích

- **Scenario ID:** NV02-06
- **Priority / Test Level / Platform:** P1 / API Integration / API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** ASSET-A đang khả dụng ở WH-A thuộc F-A; WH-B cũng thuộc F-A; chưa có yêu cầu chuyển mở; EMPLOYEE có quyền tạo yêu cầu.
- **Test Steps:** 1. Ghi baseline asset, location, balance và ledger. 2. Tạo yêu cầu chuyển ASSET-A từ WH-A tới WH-B. 3. Mở chi tiết yêu cầu và tra cứu asset/tồn ở cả hai kho.
- **Test Data:** ASSET-A; WH-A → WH-B; F-A.
- **Expected Result:** Yêu cầu được ghi nhận đúng cá thể và hai kho cùng Farm; trước khi các bước xác nhận thực tế hoàn tất, WH-B không được có asset khả dụng; không có giao dịch tồn ghi trùng.
- **Design Status:** Ready.
- **Implementation Status:** Có create/approve/receive lifecycle; E2E chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV02-060 — Kho nguồn xác nhận gửi ghi đúng cá thể và thời điểm

- **Scenario ID:** NV02-06
- **Priority / Test Level / Platform:** P1 / API Integration / API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** Yêu cầu chuyển ASSET-A đang ở trạng thái chờ kho nguồn; actor WAREHOUSE_MANAGER có quyền ở WH-A; ASSET-A ở WH-A.
- **Test Steps:** 1. Ghi snapshot. 2. Kho nguồn thực hiện bước duyệt/xác nhận gửi qua Web hoặc API hiện có. 3. Đọc lại yêu cầu, asset, source/destination balance và ledger.
- **Test Data:** Yêu cầu R-A; ASSET-A, assetCode AC-A, serial SN-A.
- **Expected Result:** Bản ghi yêu cầu ghi đúng actor/thời điểm theo source; giảm/di chuyển khỏi khả dụng nguồn đúng một lần; đích chưa được ghi nhận như đã nhận; ASSET ID/code/serial không đổi.
- **Design Status:** Ready.
- **Implementation Status:** Có API/service dispatch; cần DB integration xác nhận transaction.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV02-061 — Kho đích xác nhận nhận đúng ASSET đã gửi

- **Scenario ID:** NV02-06
- **Priority / Test Level / Platform:** P1 / API Integration / API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** R-A đã được kho nguồn xác nhận gửi; ASSET-A đang được giao tới WH-B; actor WAREHOUSE_MANAGER có quyền tại WH-B.
- **Test Steps:** 1. Ghi snapshot. 2. Kho đích xác nhận nhận theo action hiện có. 3. Tra cứu hồ sơ ASSET-A và ledger/assignment/location.
- **Test Data:** R-A; ASSET-A; WH-B/LOC-B.
- **Expected Result:** Kho đích nhận đúng ASSET-A, không tạo cá thể mới; location/scope chuyển theo kết quả nhận; lịch sử ghi actor/thời điểm và một biến động phù hợp; trạng thái chưa bị đặt thành sẵn sàng trước khi nhận.
- **Design Status:** Ready.
- **Implementation Status:** Source có bước receive; cần kiểm tra trạng thái UI và transaction qua integration.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV02-062 — FARM khác hoặc actor sai scope không thể dispatch/receive

- **Scenario ID:** NV02-06
- **Priority / Test Level / Platform:** P0 / API Integration / API
- **Test Design Technique:** Role-based Access Testing, Error Guessing
- **Preconditions:** R-A liên quan F-A; AUTH-X chỉ có membership F-B; ASSET-X thuộc F-B.
- **Test Steps:** 1. AUTH-X gọi API đọc/duyệt/nhận R-A. 2. Actor chỉ thuộc kho đích thử dispatch thay kho nguồn. 3. Đối chiếu asset, assignment, balance, ledger.
- **Test Data:** R-A thuộc F-A; AUTH-X thuộc F-B; WH-A/WH-B.
- **Expected Result:** Mọi thao tác ngoài Farm/vai trò được cấp bị từ chối ở Backend; dữ liệu và ledger giữ nguyên.
- **Design Status:** Ready.
- **Implementation Status:** Controller có FarmAccessGuard; chưa có kết quả E2E chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV02-063 — Retry xác nhận nhận ASSET không tạo ledger kép

- **Scenario ID:** NV02-06
- **Priority / Test Level / Platform:** P0 / Integration / DB test harness
- **Test Design Technique:** Error Guessing, Idempotency, Integration
- **Preconditions:** R-A đã ở trạng thái nhận thành công; DB test reset được; harness có thể gửi lại cùng request.
- **Test Steps:** 1. Gửi xác nhận nhận lần đầu. 2. Gửi lại cùng hành động với cùng R-A/asset. 3. Đọc yêu cầu, asset, balance, ledger, audit.
- **Test Data:** R-A; ASSET-A; một lần dispatch/receive hợp lệ.
- **Expected Result:** Chỉ một lần nhận có hiệu lực; lần retry trả trạng thái hiện tại hoặc conflict hợp đồng, không chuyển tài sản/tăng tồn/ghi ledger lần hai.
- **Design Status:** Ready.
- **Implementation Status:** Cần xác nhận tính idempotent bằng integration; chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV02-064 — Hai người đồng thời nhận cùng yêu cầu ASSET

- **Scenario ID:** NV02-06
- **Priority / Test Level / Platform:** P0 / Integration / DB test harness
- **Test Design Technique:** Concurrency, Integration
- **Preconditions:** R-A đang chờ nhận; hai actor cùng có quyền nhận tại WH-B; test DB độc lập và barrier đồng bộ request.
- **Test Steps:** 1. Khởi chạy đồng thời hai lệnh receive cho R-A. 2. Chờ cả hai kết thúc. 3. Đối chiếu yêu cầu, ASSET, location, balance, ledger, audit.
- **Test Data:** Một R-A; một ASSET-A; hai actor hợp lệ; hai request song song.
- **Expected Result:** Chỉ một thao tác thành công làm đổi trạng thái/tồn; kết quả cuối cùng có một lịch sử nhận và không có biến động kép.
- **Design Status:** Ready.
- **Implementation Status:** Chỉ có thể xác minh qua DB concurrency test.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 5. NV03 — Kiểm kê và điều chỉnh

**Căn cứ kỹ thuật:** `api/src/modules/warehouses/stock-counts.controller.ts`, `stock-counts.service.ts`, DTO `stock-count.dto.ts`; Web `web/features/counts/`; Mobile `mobile/src/features/inventory/presentation/StockCountScreen.tsx`. Quyền role duyệt chênh lệch cần xác nhận với nhóm theo quyết định B1; các ca khác vẫn giữ requirement đã chốt.

### TC-NV03-001 — Tạo đợt kiểm kê lưu snapshot tồn ban đầu

- **Scenario ID:** NV03-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** WAREHOUSE_MANAGER có quyền WH-A; MAT-Q balance WH-A=10.000; không có giao dịch đồng thời trong ca.
- **Test Steps:** 1. Tạo stock count cho WH-A có MAT-Q. 2. Mở chi tiết đợt. 3. Đối chiếu systemQuantity/snapshot được lưu với balance trước thao tác.
- **Test Data:** WH-A; MAT-Q; tồn đầu 10.000.
- **Expected Result:** Đợt kiểm kê ở trạng thái ban đầu hợp lệ; snapshot ghi 10.000; chưa ghi ledger điều chỉnh và balance vẫn 10.000.
- **Design Status:** Ready.
- **Implementation Status:** Có API/service count và snapshot; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-002 — Thay đổi tồn sau snapshot không bị ghi đè bằng số cũ

- **Scenario ID:** NV03-01, NV03-03
- **Priority / Test Level / Platform:** P0 / Integration / DB test harness
- **Test Design Technique:** State Transition, Concurrency, Error Guessing
- **Preconditions:** Count C-A snapshot MAT-Q=10.000; sau đó phiếu xuất hợp lệ làm tồn thành 8.000; C-A chưa xác nhận.
- **Test Steps:** 1. Tạo C-A và lưu snapshot. 2. Xác nhận phiếu xuất 2.000. 3. Thử xác nhận/submit C-A theo luồng hiện có. 4. Đọc balance và ledger.
- **Test Data:** Snapshot=10.000; issue=-2.000; balance hiện tại=8.000; actualQuantity fixture=9.000.
- **Expected Result:** Count cũ bị từ chối hoặc yêu cầu đo lại theo quy tắc stale; balance không bị ghi đè bằng số tuyệt đối 9.000; không phát sinh adjustment sai.
- **Design Status:** Ready.
- **Implementation Status:** Service có stale/locking path; chỉ DB integration mới xác minh an toàn cạnh tranh.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-003 — Kiểm kê không chênh lệch không sinh điều chỉnh tồn

- **Scenario ID:** NV03-02
- **Priority / Test Level / Platform:** P1 / API Integration / API, DB test
- **Test Design Technique:** Decision Table, Integration
- **Preconditions:** C-A snapshot MAT-Q=10.000; actualQuantity=10.000; người lập được quyền gửi/hoàn tất khi không chênh lệch.
- **Test Steps:** 1. Lưu số đếm bằng snapshot. 2. Gửi/confirm theo action hỗ trợ. 3. Đọc count, balance, inventory transaction và audit.
- **Test Data:** system=10.000; actual=10.000; difference=0.
- **Expected Result:** Đợt được hoàn tất theo quyền không chênh lệch; balance vẫn 10.000; không ghi adjustment ledger; audit ghi thao tác chứng từ, không giả tạo biến động tồn.
- **Design Status:** Ready.
- **Implementation Status:** Có nhánh zero-difference trong source/test; E2E chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-004 — Chênh lệch chỉ được áp dụng sau khi người duyệt đúng thẩm quyền phê duyệt

- **Scenario ID:** NV03-02
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** State Transition, Decision Table, Role-based Access Testing
- **Preconditions:** C-A có difference -2.000 và đã submit; người lập là WAREHOUSE_MANAGER; role duyệt được nhóm chốt cho fixture.
- **Test Steps:** 1. Thử confirm bằng actor thiếu quyền. 2. Kiểm tra count/balance/ledger. 3. Đăng nhập actor có role duyệt đã được nhóm xác nhận và approve. 4. Đọc lại count/balance/ledger/audit.
- **Test Data:** system=10.000; actual=8.000; difference=-2.000; actor approver theo quyết định được ký nhận.
- **Expected Result:** Trước approve không thay đổi balance/ledger. Sau approve hợp lệ, trạng thái chứng từ và tồn thay đổi đúng chênh lệch một lần, ghi đúng người duyệt và audit.
- **Design Status:** Pending Requirement Clarification — role approver cụ thể (ADMIN/FARM_OWNER hay role quản lý khác) chưa có xác nhận cuối trong hồ sơ đã đọc.
- **Implementation Status:** Code có kiểm soát quyền nhưng không coi role source là quyết định thay nhóm.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-005 — Người cùng Farm nhưng không thuộc ma trận duyệt không thể áp dụng chênh lệch

- **Scenario ID:** NV03-02, AUTH-04
- **Priority / Test Level / Platform:** P0 / API Integration / API
- **Test Design Technique:** Role-based Access Testing
- **Preconditions:** C-A discrepancy đã submit; fixture role actor không thuộc nhóm approver theo ma trận cuối được nhóm ký nhận.
- **Test Steps:** 1. Gọi API confirm trực tiếp bằng actor không có quyền duyệt. 2. Đọc count, balance, ledger và audit.
- **Test Data:** C-A; actor unauthorized trong fixture; difference -2.000.
- **Expected Result:** API từ chối; count còn chờ; balance và ledger không đổi; không tạo audit phê duyệt thành công.
- **Design Status:** Pending Requirement Clarification — cần role matrix cuối để dựng actor âm chính xác.
- **Implementation Status:** Chưa kết luận theo hành vi source cho tới khi nhóm chốt role.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-006 — Gửi lại xác nhận count không tạo điều chỉnh kép

- **Scenario ID:** NV03-03
- **Priority / Test Level / Platform:** P0 / API Integration / DB test
- **Test Design Technique:** Error Guessing, Idempotency, Integration
- **Preconditions:** C-A có difference đã được duyệt; balance trước khi áp dụng là 10.000; DB test reset được.
- **Test Steps:** 1. Confirm C-A một lần. 2. Gửi lại confirm cùng ID. 3. Đọc trạng thái, balance, ledger, audit.
- **Test Data:** system=10.000; actual=8.000; adjustment=-2.000.
- **Expected Result:** Chỉ một điều chỉnh -2.000 được áp dụng; balance cuối=8.000; retry không ghi adjustment/ledger lần hai.
- **Design Status:** Ready.
- **Implementation Status:** Source có transition/idempotency guard; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-007 — Xác nhận kiểm kê và xuất đồng thời không làm mất một giao dịch

- **Scenario ID:** NV03-03
- **Priority / Test Level / Platform:** P0 / Integration / DB test harness
- **Test Design Technique:** Concurrency, Integration
- **Preconditions:** Balance MAT-Q=10.000; C-A snapshot hiện tại; issue S-A=2.000; hai giao dịch được đồng bộ tại barrier.
- **Test Steps:** 1. Bắt đầu confirm C-A và issue S-A đồng thời. 2. Chờ hai transaction hoàn tất. 3. Đọc balance, count, issue, ledger.
- **Test Data:** Snapshot 10.000; counted quantity 10.000; issue 2.000.
- **Expected Result:** Một giao dịch có thể bị stale/được tuần tự hóa theo quy tắc; không ghi đè mất issue và không tạo số dư trái với các ledger thành công. Không yêu cầu một thứ tự chạy cụ thể.
- **Design Status:** Ready.
- **Implementation Status:** Chỉ có thể xác minh bằng PostgreSQL integration/harness; chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-008 — Đếm ASSET hiện diện đúng cá thể và vị trí thực thấy

- **Scenario ID:** NV03-04
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** EP, Integration
- **Preconditions:** ASSET-A thuộc F-A đang ghi LOC-A; count C-A tại WH-A; LOC-B cùng kho WH-A nhưng khác vị trí; assetCondition GOOD.
- **Test Steps:** 1. Mở C-A trên Web. 2. Ghi nhận ASSET-A có mặt tại LOC-B và tình trạng GOOD. 3. Lưu count. 4. Đọc lại dòng count và asset gốc.
- **Test Data:** assetId=ASSET-A; actualQuantity=1; foundLocationId=LOC-B; assetCondition=GOOD.
- **Expected Result:** Dòng gắn đúng assetId; ghi vị trí/tình trạng đã đếm; không tạo asset mới, không tự đổi location/lifecycle asset trước khi count được xử lý.
- **Design Status:** Ready.
- **Implementation Status:** DTO/backend/Web có asset fields; cần integration xác nhận.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-009 — Mobile kiểm kê ASSET theo cá thể, tình trạng và vị trí

- **Scenario ID:** NV03-04
- **Priority / Test Level / Platform:** P1 / UI Integration / Mobile, API, Web
- **Test Design Technique:** Integration, Regression
- **Preconditions:** C-A có ASSET-A trong WH-A; Mobile user EMPLOYEE được quyền tạo count; cùng tài khoản đọc được Web.
- **Test Steps:** 1. Mở C-A hoặc tạo đợt mới trên Mobile. 2. Tìm/chọn ASSET-A. 3. Ghi nhận vị trí và tình trạng theo fixture. 4. Lưu/gửi. 5. Mở cùng đợt trên Web và đối chiếu.
- **Test Data:** ASSET-A; actualQuantity=1 hoặc 0 theo fixture của từng ca; foundLocationId/assetCondition theo dữ liệu test.
- **Expected Result:** Mobile gửi đúng mỗi cá thể bằng assetId cùng vị trí/tình trạng; Web đọc lại đúng; không gộp ASSET thành lượng QUANTITY và không tự tạo/cộng asset.
- **Design Status:** Ready.
- **Implementation Status:** IMPLEMENTATION GAP tại `StockCountScreen.tsx`: source hiện lọc dòng ASSET và payload không thu thập assetCondition/foundLocationId.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV03-010 — ASSET thiếu được ghi nhận nhưng không tự tạo hoặc tăng tồn

- **Scenario ID:** NV03-04
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** Decision Table, Integration
- **Preconditions:** C-A snapshot có ASSET-A; kiểm đếm thực tế không tìm thấy asset; actor chỉ được ghi count, chưa có quyền approve difference.
- **Test Steps:** 1. Ghi actualQuantity=0 cho dòng ASSET-A theo DTO hiện có. 2. Gửi count. 3. Đọc asset, balance, ledger và trạng thái duyệt.
- **Test Data:** ASSET-A; system count 1; actualQuantity=0; không gửi assetCondition/foundLocationId khi thiếu.
- **Expected Result:** Ghi nhận chênh lệch cá thể; không tạo asset mới, không cộng tồn; chỉ người có thẩm quyền xử lý chênh lệch mới áp dụng thay đổi theo quyết định NV03.
- **Design Status:** Ready cho invariant; role approve được liên kết TC-NV03-004/005.
- **Implementation Status:** Backend DTO hỗ trợ count ASSET; Mobile hiện là gap.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 6. NV04 — Bảo trì và sửa chữa thiết bị nội bộ

**Căn cứ kỹ thuật:** `maintenance-requests.controller.ts`, `maintenance.controller.ts`, `maintenance.service.ts`; Web `web/features/maintenance/`; Mobile `mobile/src/features/assets/presentation/MaintenanceRequestDetailScreen.tsx`. Đối tác sửa chữa là bên ngoài, không cần tài khoản.

### TC-NV04-001 — Nhân viên báo hỏng không làm thay đổi tồn/tình trạng tài sản

- **Scenario ID:** NV04-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, Mobile, API
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** ASSET-A khả dụng tại WH-A/LOC-A; EMPLOYEE có quyền gửi yêu cầu bảo trì; không có yêu cầu đang mở.
- **Test Steps:** 1. Tạo maintenance request CORRECTIVE mô tả lỗi. 2. Mở chi tiết yêu cầu. 3. Đọc asset, balance, ledger.
- **Test Data:** ASSET-A; type CORRECTIVE; description “Máy không khởi động”.
- **Expected Result:** Yêu cầu được ghi nhận và ở trạng thái chờ xem xét; chưa xuất tài sản, chưa giảm tồn và chưa tạo maintenance completion/chi phí.
- **Design Status:** Ready.
- **Implementation Status:** Có request API, Web/Mobile flow; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-002 — Người có quyền từ chối yêu cầu và lưu lý do

- **Scenario ID:** NV04-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** State Transition, Error Guessing
- **Preconditions:** Request R-A đang chờ xem xét; actor có quyền approve/reject Farm F-A.
- **Test Steps:** 1. Từ chối R-A với lý do cụ thể. 2. Tải lại chi tiết. 3. Thử gửi lại yêu cầu bằng thao tác cũ.
- **Test Data:** R-A; rejectionReason “Chưa cần sửa, theo dõi thêm”.
- **Expected Result:** R-A ghi trạng thái bị từ chối, lý do và actor; không tạo lịch bảo trì/phiếu xuất; thao tác lặp không mở lại chứng từ cũ.
- **Design Status:** Ready.
- **Implementation Status:** API approve/reject và DTO reason tồn tại; chưa kiểm thử DB.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-003 — Duyệt yêu cầu rồi lập lịch/điều phối đúng vai

- **Scenario ID:** NV04-01, NV04-02
- **Priority / Test Level / Platform:** P1 / UI Integration / Web, API
- **Test Design Technique:** State Transition, Role-based Access Testing
- **Preconditions:** R-A đã được actor có quyền duyệt; MAINTENANCE_STAFF và WAREHOUSE_MANAGER cùng Farm; ASSET-A chưa xuất đi bảo trì.
- **Test Steps:** 1. MAINTENANCE_STAFF mở R-A và hoàn thiện hồ sơ/lịch theo UI hiện có. 2. Lưu scheduledAt, đối tác nếu có. 3. Mở lại hồ sơ bằng Web và đối chiếu lịch/actor.
- **Test Data:** R-A; ASSET-A; scheduledAt trong tương lai; supplier/partner fixture nếu cấu hình.
- **Expected Result:** Lịch/hồ sơ gắn đúng yêu cầu và tài sản; bước điều phối chưa trừ tồn hoặc chuyển asset ra khỏi kho; lưu đúng actor và dữ liệu.
- **Design Status:** Ready.
- **Implementation Status:** Có create/update record; cần kiểm tra giới hạn role của create theo policy đã chốt.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-004 — Chỉ vai trò kho xác nhận xuất thiết bị đi sửa

- **Scenario ID:** NV04-02
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** Role-based Access Testing, Integration
- **Preconditions:** Maintenance record R-A đã được lên lịch; ASSET-A đang ở WH-A; MAINTENANCE_STAFF và WAREHOUSE_MANAGER có token riêng.
- **Test Steps:** 1. MAINTENANCE_STAFF gọi trực tiếp action bắt đầu/xuất đang được UI dùng. 2. Kiểm tra tồn/asset/ledger. 3. WAREHOUSE_MANAGER thực hiện thao tác bàn giao thực tế theo chức năng hiện có. 4. Đọc lại dữ liệu.
- **Test Data:** ASSET-A; WH-A; một cá thể; balance trước theo fixture.
- **Expected Result:** Điều phối không thể tự giảm tồn thay kho; chỉ kho xác nhận giao thiết bị mới tạo đúng một biến động xuất và đặt lifecycle theo nghiệp vụ.
- **Design Status:** Ready.
- **Implementation Status:** PARTIAL/GAP cần xác minh: source controller cho phép nhóm FARM_AREA_ROLES; service có create/start path riêng. Backend authorization phải được kiểm bằng gọi trực tiếp API.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-005 — Ghi kết quả đối tác và chi phí thực tế không tạo tài khoản đối tác

- **Scenario ID:** NV04-03
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** EP, Integration
- **Preconditions:** R-A đã xuất đi bảo trì; MAINTENANCE_STAFF được phân công hồ sơ; đối tác fixture chỉ là thông tin văn bản/liên hệ ngoài hệ thống.
- **Test Steps:** 1. Ghi đối tác đã trả thiết bị. 2. Ghi kết quả PASSED và resultNote. 3. Nhập laborCost=500000.00, materialCost=125000.00, otherCost=0.00. 4. Đọc hồ sơ và audit/history.
- **Test Data:** PASSED; labor=500000.00; material=125000.00; other=0.00; partner “Đối tác A”.
- **Expected Result:** Kết quả/chi phí lưu đúng hồ sơ; không yêu cầu account đối tác; chi phí thực tế không bị hiểu là khoản đã thu của khách; chưa tự xác nhận asset đã nhập lại.
- **Design Status:** Ready.
- **Implementation Status:** DTO/service có các trường chi phí và result; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-006 — Nhận lại đúng ASSET cũ và chưa tự cho dùng trước quyết định cuối

- **Scenario ID:** NV04-04
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** R-A đã được đối tác trả PASSED; asset cũ ASSET-A được kho xác nhận nhận lại tại WH-A/LOC-A; chưa có final decision.
- **Test Steps:** 1. Kho gửi/duyệt return receipt theo UI/API. 2. Đọc record, ASSET-A, balance, ledger. 3. Thử cấp phát ASSET-A trước khi FARM_OWNER/role được chốt ra quyết định.
- **Test Data:** ASSET-A; WH-A/LOC-A; balance trước theo fixture.
- **Expected Result:** Nhận kho gắn lại đúng ID/code/serial; tồn vật lý phản ánh một lần nhận; trước final decision, asset không được xem là đã sẵn sàng sử dụng trái quy tắc mới; không tạo ASSET mới.
- **Design Status:** Ready.
- **Implementation Status:** Có return-receipt và final-decision endpoints; cần xác minh điều kiện available thực tế qua DB test.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-007 — FARM_OWNER quyết định REUSE sau khi nhận lại PASSED

- **Scenario ID:** NV04-04
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API
- **Test Design Technique:** State Transition, Role-based Access Testing
- **Preconditions:** Asset PASSED đã được kho xác nhận nhận lại; record chưa có final decision; FARM_OWNER thuộc F-A.
- **Test Steps:** 1. FARM_OWNER gọi action reuse. 2. Đọc asset status/location, balance, ledger, audit. 3. WAREHOUSE_MANAGER thử gọi lại action.
- **Test Data:** R-A; ASSET-A; outcome PASSED.
- **Expected Result:** Actor có quyền quyết định REUSE một lần sau khi đủ điều kiện; asset mới khả dụng theo quyết định; không ghi thêm biến động tồn; actor không đúng quyền không đổi được kết quả.
- **Design Status:** Ready.
- **Implementation Status:** Controller expose final-decision/reuse; cần integration xác minh role scope và idempotency.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-008 — FAILED không khả dụng và quyết định HOLD lưu lý do

- **Scenario ID:** NV04-04
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API
- **Test Design Technique:** Decision Table, State Transition
- **Preconditions:** ASSET-A được đối tác trả FAILED và kho đã xác nhận nhận lại; FARM_OWNER có quyền final decision.
- **Test Steps:** 1. FARM_OWNER chọn HOLD với lý do. 2. Thử cấp phát/bán ASSET-A. 3. Đọc hồ sơ và ledger.
- **Test Data:** ASSET-A; result FAILED; note “Không an toàn để sử dụng”.
- **Expected Result:** Asset vẫn không khả dụng; không cấp/bán được; quyết định/lý do/actor lưu lại; HOLD không tạo ASSET mới hay cộng tồn lần hai.
- **Design Status:** Ready.
- **Implementation Status:** Có action hold; cần kiểm tra quyền API và ngăn phát hành asset thực tế.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-009 — Retry xác nhận xuất/nhận bảo trì không ghi ledger kép

- **Scenario ID:** NV04-02, NV04-04
- **Priority / Test Level / Platform:** P0 / Integration / DB test harness
- **Test Design Technique:** Idempotency, Concurrency, Integration
- **Preconditions:** R-A sẵn sàng thực hiện xuất hoặc nhận; harness có thể gửi cùng request hai lần/đồng thời; DB test độc lập.
- **Test Steps:** 1. Gửi cùng action xác nhận hai lần hoặc từ hai client đồng thời. 2. Đọc maintenance record, asset, balance, ledger, audit.
- **Test Data:** Một record R-A và một asset ASSET-A; cùng action key/ID.
- **Expected Result:** Chỉ một biến động xuất/nhập theo từng điểm nghiệp vụ; retry không cộng/trừ lần hai; lỗi transaction không để record và ledger lệch nhau.
- **Design Status:** Ready.
- **Implementation Status:** Chưa có runtime concurrency evidence tại HEAD.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-010 — Nhắc hạn bảo trì đúng người nhận và không tạo thông báo trùng

- **Scenario ID:** NV04-05
- **Priority / Test Level / Platform:** P2 / Integration / API, DB test harness
- **Test Design Technique:** State Transition, Integration, Idempotency
- **Preconditions:** DB test riêng có thể reset; có Farm ACTIVE, asset chưa LOST/RETIRED và một maintenance record ở SCHEDULED với scheduledAt trong 7 ngày tới theo ngày Việt Nam; có ít nhất một thành viên ACTIVE thuộc Farm với role nhận thông báo; chưa có notification cho đúng entity và milestone.
- **Test Steps:** 1. Tạo fixture và ghi nhận danh sách thành viên ACTIVE cùng role. 2. Gọi `MaintenanceReminderWorker.run()` qua integration harness. 3. Gọi lại `run()` cho cùng milestone. 4. Đọc notifications và notification push outbox theo entity, milestone và người nhận.
- **Test Data:** Farm F-A; ASSET-A; record M-A; scheduledAt = ngày hiện tại theo múi giờ Asia/Ho_Chi_Minh + 3 ngày; người nhận có một trong các role được worker hỗ trợ.
- **Expected Result:** Lần chạy đầu tạo tối đa một notification cho mỗi user đủ điều kiện trong Farm; lần chạy lặp không tạo notification trùng cho cùng event/milestone; push outbox chỉ nhận các notification còn hợp lệ. Không tạo notification cho user không thuộc Farm, membership không ACTIVE hoặc không có role trong hợp đồng worker.
- **Design Status:** Ready; đây là kiểm thử tích hợp cần DB test riêng, không phải thao tác thủ công trên Web.
- **Implementation Status:** Có `MaintenanceReminderWorker.run()` với advisory transaction lock, lọc role Farm và `ON CONFLICT DO NOTHING`; integration test hiện có trong `api/test/maintenance-workflow.integration.e2e-spec.ts`, nhưng chưa chạy ở phiên này.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 7. NV05 — Bán hàng, thanh toán và giao nhận còn thiếu

**Căn cứ kỹ thuật:** `commerce.controller.ts`, `customer-orders.controller.ts`, `store-orders.controller.ts`, `store-payments.controller.ts`, `payment-webhooks.controller.ts`; Web storefront/checkout/store-orders/deliveries. Không gọi dịch vụ thanh toán thật; webhook dùng fixture/sandbox trong test.

### TC-NV05-013 — Giỏ hàng chỉ chọn một Farm/kho bán đủ toàn bộ giỏ

- **Scenario ID:** NV05-01
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API
- **Test Design Technique:** Decision Table, Integration
- **Preconditions:** F-A có kho bán WH-A; MAT-Q đủ 2; MAT-L chỉ có ở kho nội bộ WH-B; F-B có một kho bán; không kho đơn lẻ nào đủ toàn giỏ trong case âm.
- **Test Steps:** 1. Thêm variant V-Q và V-L vào giỏ. 2. Chọn region được F-A/F-B phục vụ. 3. Gọi cart availability. 4. Lặp với giỏ mà WH-A đủ cả hai dòng.
- **Test Data:** Giỏ V-Q×1, V-L×1; tồn WH-A: Q=2/L=0; tồn WH-B L=9; F-B không ánh xạ V-L.
- **Expected Result:** Case đầu không chọn tồn kho nội bộ để bù và không chia thành nhiều đơn; nếu có một kho bán duy nhất đủ giỏ thì kết quả availability chỉ về Farm/kho đó.
- **Design Status:** Ready.
- **Implementation Status:** Có API cart availability và cấu hình kho bán; cần kiểm tra hành vi thực tế.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-014 — Sản phẩm chưa có mapping/bật bán không thể đặt mua

- **Scenario ID:** NV05-01
- **Priority / Test Level / Platform:** P1 / UI Integration / Web, API
- **Test Design Technique:** Decision Table
- **Preconditions:** Product P-A PUBLISHED nhưng variant V-A chưa được ánh xạ hoặc Farm salesEnabled=false; tồn nội bộ có số lượng.
- **Test Steps:** 1. Mở storefront và tìm P-A. 2. Thử thêm V-A vào giỏ/gọi availability. 3. Đọc cấu hình và tồn trước/sau.
- **Test Data:** P-A; V-A; Farm F-A salesEnabled=false hoặc mapping thiếu.
- **Expected Result:** Không tạo order/không thể checkout V-A trong cấu hình hiện tại; PUBLISHED không bị coi là đồng nghĩa có thể mua; tồn không thay đổi.
- **Design Status:** Ready.
- **Implementation Status:** Có public catalog và farm settings; E2E chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-015 — Checkout tạo PENDING với snapshot và chưa giữ hàng

- **Scenario ID:** NV05-02
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** Customer U-C đăng nhập; WH-A bán đủ giỏ; sales setting và region hợp lệ; không có request trước đó với idempotencyKey.
- **Test Steps:** 1. Checkout giỏ một variant. 2. Đọc order, order item, phí, balance, stock holds, issue. 3. Kiểm tra nội dung trang order.
- **Test Data:** idempotencyKey K-A; recipient/customer fixture; variant V-A qty=1; expectedUnitPrice lấy từ catalog; region NORTH.
- **Expected Result:** Tạo một đơn PENDING với snapshot giá/phí/Farm/kho; UI nói hàng chưa được giữ; balance vật lý, available hold và phiếu xuất chưa thay đổi ở bước tạo đơn.
- **Design Status:** Ready.
- **Implementation Status:** Create order/idempotency tồn tại; cần DB integration xác minh.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-016 — Giá thay đổi giữa lúc xem và checkout yêu cầu xác nhận lại

- **Scenario ID:** NV05-02
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** Error Guessing, Decision Table
- **Preconditions:** Variant V-A được khách xem ở giá cũ; trước checkout, ADMIN test đổi giá; tồn đủ.
- **Test Steps:** 1. Gửi checkout với expectedUnitPrice cũ. 2. Đọc response/order/balance. 3. Hiển thị giá mới và gửi lại theo luồng xác nhận lại.
- **Test Data:** Giá đã xem 100000; giá hiện tại 120000; quantity 1.
- **Expected Result:** Lần gửi giá cũ không tạo đơn với snapshot sai; ứng dụng yêu cầu làm mới/xác nhận giá hiện tại; lần gửi lại hợp lệ lưu giá đúng; không giữ/trừ tồn khi chưa nhân viên xác nhận.
- **Design Status:** Ready.
- **Implementation Status:** DTO/service có expectedUnitPrice; cần kiểm tra UI xử lý 409/price change.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-017 — Cùng idempotency key không tạo hai đơn

- **Scenario ID:** NV05-02
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** Idempotency, Error Guessing
- **Preconditions:** Payload checkout hợp lệ; DB test; client mô phỏng timeout sau khi server đã nhận request.
- **Test Steps:** 1. POST checkout với K-A/payload P. 2. Gửi lại cùng K-A/payload P. 3. Gửi lại K-A với payload khác. 4. Đối chiếu order/hold/issue.
- **Test Data:** K-A UUID; payload P=V-A qty1; payload Q=V-A qty2.
- **Expected Result:** Retry cùng key/payload trả lại cùng order hoặc kết quả tương đương, không sinh order thứ hai; cùng key nhưng payload khác bị conflict; chưa giữ tồn tại create order.
- **Design Status:** Ready.
- **Implementation Status:** Source DTO/service có idempotency handling; test API integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-018 — Webhook chuyển khoản hợp lệ ghi PAID một lần

- **Scenario ID:** NV05-04
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** Decision Table, Idempotency, Integration
- **Preconditions:** Order BANK_TRANSFER còn unpaid; test webhook secret/simulator riêng; amount/reference khớp order; không gọi SePay thật.
- **Test Steps:** 1. Gửi payload webhook hợp lệ qua test harness. 2. Đọc payment, order, audit. 3. Gửi lại payload y hệt.
- **Test Data:** Order O-A; reference khớp mã order; amount bằng tổng order.
- **Expected Result:** Webhook hợp lệ xác nhận payment/order theo quy tắc; có tối đa một payment confirmation/audit hiệu lực; callback lặp không ghi PAID hoặc tiền lần hai.
- **Design Status:** Ready.
- **Implementation Status:** Có webhook controller/service; chỉ sandbox/test harness, không có giao dịch thật.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-019 — Webhook sai chữ ký hoặc sai số tiền không xác nhận PAID

- **Scenario ID:** NV05-04
- **Priority / Test Level / Platform:** P0 / API Integration / API
- **Test Design Technique:** Equivalence Partitioning, Error Guessing
- **Preconditions:** Order BANK_TRANSFER unpaid; test harness có thể gửi webhook sai API key, reference không khớp hoặc amount thiếu.
- **Test Steps:** 1. Gửi từng biến thể sai trên các order fixture độc lập. 2. Đọc payment/order/audit/stock.
- **Test Data:** O-A; sai header; sai reference; amount thấp hơn total.
- **Expected Result:** Không biến thể nào đặt order thành PAID; không tạo payment thành công/audit xác nhận sai; không xuất kho.
- **Design Status:** Ready.
- **Implementation Status:** Có xác thực webhook; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-020 — Đối soát chuyển khoản thủ công lưu reference và actor

- **Scenario ID:** NV05-04
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** Role-based Access Testing, Integration
- **Preconditions:** O-A BANK_TRANSFER unpaid; STORE_MANAGER được quyền đối soát trong F-A; có chứng từ sao kê giả lập được kiểm tra ngoài hệ thống.
- **Test Steps:** 1. Thực hiện mark-paid với reference và note. 2. Đọc payment/order/audit. 3. Thử lặp mark-paid và thử actor khác Farm.
- **Test Data:** O-A; reference BANK-TEST-001; actor SM-A.
- **Expected Result:** Chỉ nhân viên có quyền và order cùng Farm mới xác nhận; lưu reference, người và thời điểm; retry không xác nhận lần hai; không dùng ảnh khách gửi làm chứng cứ tự động.
- **Design Status:** Ready; quy trình evidence phải theo quyết định nhóm.
- **Implementation Status:** DTO có reference; audit/authorization cần runtime kiểm tra.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-021 — Đơn chuyển khoản chưa PAID không được thực xuất

- **Scenario ID:** NV05-04, NV05-05
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** State Transition, Role-based Access Testing
- **Preconditions:** O-A BANK_TRANSFER đã xác nhận/giữ hàng và có phiếu SALE nhưng payment chưa PAID; WH-A còn hàng đã giữ.
- **Test Steps:** 1. WAREHOUSE_MANAGER gọi trực tiếp confirm phiếu xuất liên kết O-A. 2. Đọc order, issue, on-hand, available, hold, ledger.
- **Test Data:** O-A; BANK_TRANSFER; payment status chưa PAID; quantity=1.
- **Expected Result:** Backend từ chối xác nhận xuất; on-hand và ledger không đổi; giữ hàng và trạng thái order theo quy tắc hợp lệ, không tự chuyển SHIPPING.
- **Design Status:** Ready.
- **Implementation Status:** Được giao sửa guard thực xuất; phải xác nhận bằng API integration, không chỉ Web.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-022 — COD giao thành công ghi thu từ khách đúng một lần

- **Scenario ID:** NV05-05
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** State Transition, Idempotency
- **Preconditions:** O-C COD đã xuất và giao cho DELIVERY_STAFF được phân công; chưa có cash collection.
- **Test Steps:** 1. DELIVERY_STAFF ghi hoàn tất giao hàng. 2. Đọc order/delivery/payment/actor/time. 3. Gửi lại complete.
- **Test Data:** O-C; COD total 250000; delivery D-C.
- **Expected Result:** Đơn ghi giao thành công; khoản thu COD ghi nhận một lần với người/thời điểm; thao tác hoàn tất lặp không tạo khoản thu thứ hai; chưa đồng nhất sự kiện thu với nộp tiền về Farm.
- **Design Status:** Ready.
- **Implementation Status:** Có complete/COD flow; không dùng thanh toán thật.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-023 — Bàn giao tiền COD là sự kiện riêng

- **Scenario ID:** NV05-05
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** O-C đã giao và có COD collected; chưa remit; actor có quyền quản lý đơn.
- **Test Steps:** 1. Ghi nhận bàn giao tiền theo action hiện có. 2. Đọc collection/remittance history và order total. 3. Thử ghi lại cùng reference.
- **Test Data:** O-C; amount=250000; reference CASH-TEST-01.
- **Expected Result:** Thu từ khách và bàn giao tiền được lưu thành hai sự kiện phân biệt; amount khớp; retry không nhân đôi; không làm tăng/giảm tồn.
- **Design Status:** Ready.
- **Implementation Status:** Có endpoint cod-remit theo source; cần kiểm tra audit/idempotency.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-024 — Người giao không được xử lý đơn ngoài phạm vi được giao

- **Scenario ID:** NV05-05
- **Priority / Test Level / Platform:** P0 / API Integration / API
- **Test Design Technique:** Role-based Access Testing
- **Preconditions:** O-C giao cho DELIVERY_STAFF D-A; D-B là DELIVERY_STAFF khác cùng Farm; có order D-C được phân công cho D-A.
- **Test Steps:** 1. D-B gọi trực tiếp ship/complete trên D-C. 2. D-A thực hiện action được phân công. 3. Đọc giao hàng/audit.
- **Test Data:** D-C assigned D-A; actor D-B unauthorized.
- **Expected Result:** D-B bị từ chối ở API; không thay người giao/đơn/trạng thái; D-A thực hiện đúng action hợp lệ.
- **Design Status:** Ready.
- **Implementation Status:** Controller có STORE_DELIVERY_ROLES; giới hạn assignment phải được xác minh ở service.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-025 — Hủy trước thực xuất giải phóng lượng giữ nhưng không cộng on-hand

- **Scenario ID:** NV05-06
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** O-A đã được nhân viên xác nhận, có hold 2 units và phiếu SALE draft; chưa confirm xuất.
- **Test Steps:** 1. Hủy đơn theo role/action hợp lệ. 2. Đọc order/hold/issue/balance/ledger. 3. Thử gửi lại yêu cầu hủy.
- **Test Data:** On-hand=10; hold O-A=2; available trước hủy=8.
- **Expected Result:** Hold của O-A được giải phóng đúng một lần; on-hand vẫn 10 vì chưa xuất; không ghi OUT ledger; retry không làm available vượt 10.
- **Design Status:** Ready.
- **Implementation Status:** Có hủy/hold logic trong source; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-026 — Khách không thể hủy sau thực xuất để làm tồn tăng

- **Scenario ID:** NV05-06
- **Priority / Test Level / Platform:** P0 / API Integration / Customer API, DB test
- **Test Design Technique:** State Transition, Role-based Access Testing
- **Preconditions:** O-A đã thực xuất 2 units, balance giảm 10→8 và đơn đang giao.
- **Test Steps:** 1. Customer U-C gọi POST cancel. 2. Đọc order, delivery, balance, ledger, return request.
- **Test Data:** O-A; on-hand=8 sau xuất; customer actor U-C.
- **Expected Result:** Khách không tự chuyển đơn sau xuất thành CANCELLED và không làm tăng tồn; nếu endpoint cho phép tạo yêu cầu thì chỉ ghi yêu cầu, chờ nhân viên/kho xử lý; không có RETURN_IN.
- **Design Status:** Ready.
- **Implementation Status:** Có customer cancel và staff cancel paths; cần xác minh trạng thái hậu xuất.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV05-027 — Kho nhận hàng trả về chỉ cộng lượng đạt thực nhận

- **Scenario ID:** NV05-06
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** Decision Table, Integration
- **Preconditions:** O-A đã xuất 5 units; delivery staff bàn giao lại 5; kho kiểm 4 đạt, 1 không đạt; endpoint return-to-warehouse khả dụng.
- **Test Steps:** 1. Gửi hàng trả về bằng flow có sẵn. 2. Kho xác nhận kiểm nhận theo form/API hiện tại. 3. Đọc order return, receipt, balance, ledger.
- **Test Data:** Issued=5; accepted=4; rejected=1; on-hand trước=20.
- **Expected Result:** Chỉ 4 đơn vị đạt tăng tồn khả dụng, balance 20→24; 1 không đạt không vào available; hồ sơ lưu đúng lý do/chênh lệch. Nếu source chưa có field nhận riêng, ghi implementation gap, không thay expected.
- **Design Status:** Ready cho invariant; payload nhận hàng phải đối chiếu hợp đồng API hiện có trước khi thực thi.
- **Implementation Status:** Có return-to-warehouse flow; cần đối chiếu contract/condition và 0 accepted.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 8. NV06 — Bảo hành/sửa chữa sau bán

**Căn cứ kỹ thuật:** `store-warranties.controller.ts`, `store-warranties.service.ts`, DTO `store-warranty.dto.ts`; Web `web/features/store-warranties/`. Claim là hàng khách đã mua, không dùng asset nội bộ NV04.

### TC-NV06-001 — Tạo yêu cầu gắn đúng đơn đã hoàn tất và dòng đã mua

- **Scenario ID:** NV06-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** EP, Integration
- **Preconditions:** O-A COMPLETED thuộc F-A; order item I-A có variant V-A, quantity đã giao; STORE_MANAGER có quyền F-A.
- **Test Steps:** 1. Tạo warranty request cho O-A/I-A. 2. Mở chi tiết yêu cầu. 3. Đối chiếu order/customer/variant/quantity.
- **Test Data:** orderId=O-A; orderItemId=I-A; quantity=1; kind theo enum; intakeNote ghi cách nhận thực tế.
- **Expected Result:** Claim gắn đúng đơn/dòng/khách/variant; ghi mô tả lỗi và bằng chứng nhận; không tạo claim của đơn khác hoặc asset nội bộ.
- **Design Status:** Ready.
- **Implementation Status:** Có API/UI và schema warranty; chưa integration runtime.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV06-002 — Không tạo claim cho đơn chưa giao thành công

- **Scenario ID:** NV06-01
- **Priority / Test Level / Platform:** P1 / API Integration / API
- **Test Design Technique:** State Transition, EP
- **Preconditions:** O-PENDING chưa COMPLETED; có dòng hàng nhưng chưa giao; actor STORE_MANAGER cùng Farm.
- **Test Steps:** 1. Gửi create claim với O-PENDING/orderItemId hợp lệ. 2. Đọc warranties/order/audit.
- **Test Data:** O-PENDING; I-PENDING; quantity=1.
- **Expected Result:** Claim không được tạo cho hàng chưa giao; order/warranty/audit không có bản ghi thành công.
- **Design Status:** Ready.
- **Implementation Status:** Service kiểm order-line ownership/status; chưa chạy integration.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV06-003 — Số lượng claim không vượt lượng đã mua còn có thể claim

- **Scenario ID:** NV06-01
- **Priority / Test Level / Platform:** P1 / API Integration / API
- **Test Design Technique:** BVA, EP
- **Preconditions:** I-A đã giao quantity=2; đã có một claim đang mở quantity=1; user tạo claim mới.
- **Test Steps:** 1. Gửi claim quantity=1. 2. Trên fixture độc lập gửi claim quantity=2. 3. Đọc các claim và quantity còn lại.
- **Test Data:** Purchased=2; open claim=1; new request 1 hoặc 2.
- **Expected Result:** Claim mới không vượt lượng đã mua trừ claim đang mở; request hợp lệ theo phép tính được nhận, request vượt quota bị từ chối; không trừ tồn tại lúc tạo claim.
- **Design Status:** Ready.
- **Implementation Status:** DTO/service có quantity cap theo mô tả; test integration cần chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV06-004 — ASSET claim trỏ đúng cá thể/serial đã bán

- **Scenario ID:** NV06-01, NV06-03
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** Decision Table, Integration
- **Preconditions:** Order O-A COMPLETED có dòng bán ASSET; unit được giao là ASSET-S1; không có claim mở cho serial này.
- **Test Steps:** 1. Tạo claim dùng assetId ASSET-S1. 2. Thử tạo claim bằng assetId khác của cùng item. 3. Đọc claim, order item, asset, serial.
- **Test Data:** O-A/I-A; ASSET-S1 serial SN-1; ASSET-S2 serial SN-2 không thuộc dòng đã giao.
- **Expected Result:** Claim chỉ nhận đúng cá thể đã bán và giao; assetId/serial được giữ; claim sai cá thể bị từ chối; không tạo asset Farm mới.
- **Design Status:** Ready.
- **Implementation Status:** DTO/service có ràng buộc asset cho hàng định danh; cần integration fixture ASSET thật.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV06-005 — Không bắt đầu sửa có phí trước khi khách đồng ý báo giá

- **Scenario ID:** NV06-02
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API
- **Test Design Technique:** State Transition, Decision Table
- **Preconditions:** Claim W-A đang xử lý; báo giá chưa được khách đồng ý.
- **Test Steps:** 1. Gửi action quote với quoteAmount=350000. 2. Trước quyết định khách, thử start-repair. 3. Ghi approved=true và thử start-repair lại.
- **Test Data:** W-A; quoteAmount=350000; decision approved=true.
- **Expected Result:** Bắt đầu sửa có phí chỉ sau quyết định đồng ý được lưu; báo giá không tự ghi payment/đã thu tiền; từ chối hoặc chưa trả lời thì không phát sinh sửa có phí.
- **Design Status:** Ready.
- **Implementation Status:** Web logic test có assertion consent trước start; API lifecycle cần integration.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV06-006 — Khách từ chối báo giá thì không ghi kết quả sửa có phí

- **Scenario ID:** NV06-02
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** State Transition, Error Guessing
- **Preconditions:** W-A đã có quote; chưa start repair; actor STORE_MANAGER xử lý.
- **Test Steps:** 1. Lưu quyết định approved=false kèm note. 2. Thử start-repair. 3. Đọc event/status/actualCost.
- **Test Data:** W-A; approved=false; note “Khách không đồng ý”.
- **Expected Result:** Không bắt đầu sửa có phí; lưu quyết định từ chối; không ghi actualCost như tiền khách đã trả; yêu cầu còn ở bước trả/đóng hợp lệ sau bàn giao.
- **Design Status:** Ready.
- **Implementation Status:** API supports decide/return actions; cần test tích hợp.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV06-007 — Đổi sản phẩm tạo phiếu xuất đúng item/quantity và không làm hỏng dòng gốc

- **Scenario ID:** NV06-03
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** Integration, Transaction, Error Guessing
- **Preconditions:** W-A đủ điều kiện exchange; order item OI-A đã giao; variant thay thế V-B còn hàng tại kho bán WH-S; chưa có phiếu đổi.
- **Test Steps:** 1. Yêu cầu exchange theo UI/API. 2. Đọc linked stock issue và dòng order gốc. 3. Thử thay order/item/warehouse/quantity trái yêu cầu bằng PATCH trực tiếp nếu API hỗ trợ.
- **Test Data:** W-A; OI-A; V-B; quantity theo đơn vị đổi đã mua.
- **Expected Result:** Phiếu xuất thay thế tham chiếu đúng claim và quantity hợp lệ; không thể sửa link để xuất mặt hàng/kho khác; order line gốc không bị ghi đè; balance/ledger giảm đúng một lần.
- **Design Status:** Ready.
- **Implementation Status:** Được giao integrity guard; code có linked exchange issue paths; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV06-008 — Chỉ đóng yêu cầu sau khi sản phẩm được bàn giao lại thực tế

- **Scenario ID:** NV06-03
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** State Transition
- **Preconditions:** W-A đã có kết quả sửa/đổi nhưng chưa đánh dấu giao trả thực tế cho khách.
- **Test Steps:** 1. Gọi action close. 2. Đọc trạng thái/history. 3. Ghi nhận bàn giao theo luồng hiện có rồi close.
- **Test Data:** W-A; repair/exchange result đã có; delivery-to-customer chưa xác nhận ở bước 1.
- **Expected Result:** Không cho đóng trước điều kiện bàn giao; sau khi ghi nhận bàn giao thật, đóng một lần và lưu actor/time; không thay đổi tồn ngoài chứng từ đổi hàng liên kết.
- **Design Status:** Ready.
- **Implementation Status:** Service có actions close/return; điều kiện bàn giao cần xác minh theo thực tế API.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 9. NV07 — Mẫu mặt hàng, ASSET và QR

**Căn cứ kỹ thuật:** `materials.controller.ts`, `catalog.controller.ts`, `assets.controller.ts`, schema items/assets/inventory; Web Materials/Assets/QR; Mobile QR scanner/lookup.

### TC-NV07-001 — Tạo mẫu QUANTITY không phát sinh tồn

- **Scenario ID:** NV07-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API, DB test
- **Test Design Technique:** Integration
- **Preconditions:** ADMIN hoặc actor được quyền quản lý mẫu theo Farm F-A; item code MAT-NEW chưa tồn tại; chưa có balance.
- **Test Steps:** 1. Tạo mẫu MAT-NEW theo chức năng quản lý mặt hàng. 2. Đọc item/profile, balances, inventory ledger.
- **Test Data:** itemType MATERIAL; trackingMode QUANTITY; đơn vị hợp lệ; itemCode MAT-NEW.
- **Expected Result:** Tạo item/profile thành công; không tạo balance hoặc ledger nhập kho; tồn chỉ phát sinh qua NV01/đầu kỳ hợp lệ.
- **Design Status:** Ready.
- **Implementation Status:** Materials API tạo MATERIAL; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV07-002 — Tracking mode và item type không tương thích bị từ chối

- **Scenario ID:** NV07-01
- **Priority / Test Level / Platform:** P1 / API / API
- **Test Design Technique:** EP, Error Guessing
- **Preconditions:** Actor có quyền tạo mẫu; kiểm tra DTO/schema quy định các cặp itemType/trackingMode.
- **Test Steps:** 1. Gửi một payload hợp lệ. 2. Gửi một payload có cặp tracking/item type không được hỗ trợ. 3. Đọc item/profile/balance.
- **Test Data:** Cặp hợp lệ theo schema; cặp sai: MATERIAL + ASSET nếu schema không cho phép.
- **Expected Result:** Payload không hợp lệ bị từ chối; không tạo mẫu/balance/ledger; không đặt ra tracking mode ngoài enum schema.
- **Design Status:** Ready sau khi chọn cặp âm từ enum/constraint tại build test.
- **Implementation Status:** DTO/schema có enum và constraints; test source/service.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV07-003 — Không đổi tracking mode gây mất ý nghĩa dữ liệu đã phát sinh

- **Scenario ID:** NV07-01
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** State Transition, Error Guessing
- **Preconditions:** MAT-Q có balance 5 hoặc MAT-L có lot/transaction; actor có quyền sửa mẫu.
- **Test Steps:** 1. PATCH trackingMode sang loại khác. 2. Đọc item, lots/assets/balance/ledger.
- **Test Data:** MAT-Q tracking QUANTITY; balance=5; request đổi sang ASSET.
- **Expected Result:** Nếu đã phát sinh dữ liệu phụ thuộc tracking, API từ chối thay đổi theo ràng buộc hiện hành; không để schema item và dữ liệu tồn mâu thuẫn.
- **Design Status:** Ready; điều kiện chính xác phải lấy từ DTO/service/schema build hiện tại.
- **Implementation Status:** Có update material validation; cần integration xác nhận các nhánh đã có dữ liệu.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV07-004 — Tạo ASSET đầu kỳ ghi đúng một cá thể và không nhầm receipt

- **Scenario ID:** NV07-02
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** Integration, State Transition
- **Preconditions:** EQ-A tracking ASSET; WH-A/LOC-A active; vật thể có thật thuộc tồn đầu kỳ trước khi hệ thống dùng; assetCode/serial chưa tồn tại.
- **Test Steps:** 1. Tạo asset đầu kỳ qua chức năng quản lý asset. 2. Đọc asset, balance, ledger. 3. Kiểm tra không có receipt supplier gắn cùng cá thể.
- **Test Data:** assetCode EQ-OPEN-01; serial SN-OPEN-01; WH-A/LOC-A.
- **Expected Result:** Tạo một asset ID; định danh và vị trí đúng; tồn/ledger phản ánh một lần đầu kỳ theo service hiện có; không tạo receipt giả và không tạo asset thứ hai.
- **Design Status:** Ready.
- **Implementation Status:** Có direct asset create; không thay thế quy trình hàng mới qua NV01.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV07-005 — Trùng assetCode hoặc serial bị từ chối

- **Scenario ID:** NV07-02
- **Priority / Test Level / Platform:** P0 / API Integration / API, DB test
- **Test Design Technique:** EP, Error Guessing
- **Preconditions:** EQ-A; đã có ASSET-1 assetCode EQ-001 serial SN-001; actor tạo asset có quyền.
- **Test Steps:** 1. Thử tạo cá thể mới trùng assetCode. 2. Trên fixture độc lập, thử trùng serial. 3. Đọc asset count/ledger.
- **Test Data:** Existing EQ-001/SN-001; thử EQ-001/SN-002 và EQ-002/SN-001.
- **Expected Result:** Mã asset trùng và serial trùng bị chặn theo constraint hiện có; không tạo asset/balance/ledger mới. Không khẳng định phát hiện hai vật thể giống nhau nếu người dùng cố tình nhập mã khác và không có serial.
- **Design Status:** Ready.
- **Implementation Status:** Schema/service có unique; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV07-006 — QR tra cứu đúng đối tượng nhưng không ghi nghiệp vụ

- **Scenario ID:** NV07-03
- **Priority / Test Level / Platform:** P1 / UI Integration / Web, Mobile, API
- **Test Design Technique:** Integration, Regression
- **Preconditions:** Có QR/label hợp lệ cho MAT-Q hoặc ASSET-A thuộc F-A; actor có quyền đọc, không có quyền ghi.
- **Test Steps:** 1. Quét QR bằng Web hoặc Mobile. 2. Mở kết quả item/asset/balance. 3. Đọc balance, ledger, asset history trước/sau.
- **Test Data:** QR của item MAT-Q; QR của asset ASSET-A; user read-only.
- **Expected Result:** Kết quả hiển thị đúng loại đối tượng và phạm vi; QR chỉ tra cứu, không tạo issue/receipt/assignment, không đổi tồn/status.
- **Design Status:** Ready.
- **Implementation Status:** Có Web/Mobile scanner và read APIs; camera thực chưa được xác minh.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV07-007 — QR của Farm khác không mở hồ sơ trái quyền

- **Scenario ID:** NV07-03, AUTH-04
- **Priority / Test Level / Platform:** P0 / API + UI Integration / Web, Mobile, API
- **Test Design Technique:** Role-based Access Testing, Error Guessing
- **Preconditions:** AUTH-U1 chỉ thuộc F-A; QR-B thuộc ASSET-X ở F-B.
- **Test Steps:** 1. Quét QR-B bằng session AUTH-U1. 2. Gọi lookup trực tiếp bằng code/ID. 3. Đối chiếu response/audit.
- **Test Data:** QR-B; AUTH-U1; farmId=F-A.
- **Expected Result:** Không lộ thông tin asset/item F-B; lookup bị từ chối hoặc không tìm thấy theo hợp đồng; không phát sinh thao tác ghi.
- **Design Status:** Ready.
- **Implementation Status:** Các endpoint lookup được scope theo Farm; runtime chưa kiểm tra.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 10. NV08 — Kho và nhân sự trong Farm hiện có

**Căn cứ kỹ thuật:** `warehouses.controller.ts`, `warehouses.service.ts`, `personnel.controller.ts`, `personnel.service.ts`, `account-provisioning.service.ts`, `farm-access.guard.ts`; Web Warehouses/Personnel. CRUD/bootstrap Farm không thuộc phạm vi.

### TC-NV08-001 — Tạo và sửa kho ghi audit cùng giao dịch, không đổi tồn

- **Scenario ID:** NV08-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API, DB test
- **Test Design Technique:** Integration, Transaction
- **Preconditions:** FARM_OWNER có quyền F-A; code WH-NEW chưa tồn tại; WH-A có balance 5.000.
- **Test Steps:** 1. Tạo WH-NEW. 2. Sửa tên/mô tả WH-NEW. 3. Đọc kho, audit_logs, balance/ledger.
- **Test Data:** F-A; code WH-NEW; đổi tên “Kho kiểm thử A”.
- **Expected Result:** Mỗi thao tác thành công ghi actor, thời điểm, phạm vi và old/new phù hợp; không thay đổi balance/ledger.
- **Design Status:** Ready.
- **Implementation Status:** WarehousesService ghi audit trong transaction; unit test có, integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV08-002 — Ngừng kho rỗng được audit, kho còn tồn bị chặn

- **Scenario ID:** NV08-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API, DB test
- **Test Design Technique:** Decision Table, Transaction
- **Preconditions:** WH-EMPTY không có tồn/asset; WH-A có balance=1; actor FARM_OWNER F-A.
- **Test Steps:** 1. Ngừng WH-EMPTY. 2. Thử ngừng WH-A. 3. Đọc status/audit/balance.
- **Test Data:** WH-EMPTY balance 0; WH-A balance 1.
- **Expected Result:** Kho rỗng được inactive và có một audit; kho còn tồn bị từ chối và không ghi audit thành công. Điều kiện chứng từ mở/kho bán thuộc TC-NV08-003 vì chưa chốt.
- **Design Status:** Ready cho tồn/asset; policy open documents pending.
- **Implementation Status:** Code kiểm balance và asset custody; chưa thấy guard cho mọi chứng từ đang mở/kho bán.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV08-003 — Lỗi cập nhật kho không để audit lệch dữ liệu

- **Scenario ID:** NV08-01
- **Priority / Test Level / Platform:** P0 / Integration / DB test harness
- **Test Design Technique:** Transaction, Error Guessing
- **Preconditions:** DB test; harness có thể gây lỗi transaction sau bước update kho trước khi ghi audit hoặc ngược lại.
- **Test Steps:** 1. Gọi update kho và inject lỗi ở bước transaction. 2. Đọc kho/audit. 3. Lặp với update thành công.
- **Test Data:** WH-A; đổi name; injected DB error.
- **Expected Result:** Khi transaction thất bại thì cả cập nhật và audit thành công đều không tồn tại; khi thành công có cả thay đổi kho và audit tương ứng, không có một phía đơn lẻ.
- **Design Status:** Ready.
- **Implementation Status:** Source gom cập nhật/audit trong transaction; chưa chạy fault-injection DB.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV08-004 — Thêm tài khoản Clerk đã có vào Farm thứ hai với role riêng

- **Scenario ID:** NV08-02, NV08-03
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** Integration, Role-based Access Testing
- **Preconditions:** AUTH-U5 đã tồn tại trong Clerk và là member F-A với EMPLOYEE; FARM_OWNER có quyền F-B.
- **Test Steps:** 1. Tìm/add existing account bằng email fixture trong F-B. 2. Gán role STORE_MANAGER theo quyền được cấp. 3. Đọc memberships hai Farm và kiểm tra access token context.
- **Test Data:** AUTH-U5; email fixture; F-A EMPLOYEE; F-B STORE_MANAGER.
- **Expected Result:** Tạo membership riêng F-B, không ghi đè role F-A; cùng tài khoản có quyền khác nhau theo Farm; không thay đổi tồn kho.
- **Design Status:** Ready.
- **Implementation Status:** Existing-account endpoint và membership code có; Clerk/database integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV08-005 — Email chưa có tài khoản được provision có trạng thái xử lý rõ

- **Scenario ID:** NV08-02
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API, Clerk test tenant
- **Test Design Technique:** State Transition, Error Guessing
- **Preconditions:** Email fixture chưa có trong Clerk; ADMIN/FARM_OWNER có quyền tạo account; requestId mới.
- **Test Steps:** 1. Tạo account/membership qua form. 2. Đọc phản hồi provisioning và danh sách nhân sự. 3. Retry cùng requestId/payload. 4. Kiểm tra không tạo account/membership thứ hai.
- **Test Data:** new.qa@example.test; requestId UUID fixture; role EMPLOYEE.
- **Expected Result:** Provisioning thành công hoặc trạng thái chờ xử lý được hiển thị rõ; retry cùng request không nhân đôi account/membership; trạng thái Clerk và DB có thể đối chiếu.
- **Design Status:** Ready.
- **Implementation Status:** Có idempotency/request tracking và provisioning service; cần Clerk test tenant, chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV08-006 — Lỗi Clerk/DB giữa chừng để lại trạng thái provisioning có thể xử lý

- **Scenario ID:** NV08-02
- **Priority / Test Level / Platform:** P0 / Integration / DB test harness + Clerk test tenant
- **Test Design Technique:** Error Guessing, Transaction, Integration
- **Preconditions:** Test tenant có thể tạo Clerk identity nhưng harness làm thất bại insert membership; test DB riêng.
- **Test Steps:** 1. Tạo account với requestId mới. 2. Inject lỗi DB sau tạo identity. 3. Đọc provisioning status. 4. Retry theo cơ chế recovery hiện có.
- **Test Data:** Email fixture; requestId R-PROV; Clerk identity test.
- **Expected Result:** Không báo hoàn tất khi membership chưa lưu; trạng thái lỗi/chờ xử lý có thể nhận diện; retry không tạo identity trùng và hoàn tất membership đúng một lần.
- **Design Status:** Ready.
- **Implementation Status:** Có account_provisioning status/retry logic; cần external sandbox và DB fault injection.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV08-007 — Không tự nâng quyền hoặc cấp role vượt quyền người thao tác

- **Scenario ID:** NV08-02, AUTH-04
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API
- **Test Design Technique:** Role-based Access Testing, Decision Table
- **Preconditions:** FARM_OWNER F-A và EMPLOYEE F-A; fixture role matrix chính thức được chuẩn bị; actor không được tự gán role cao hơn quyền mình.
- **Test Steps:** 1. EMPLOYEE gọi API thay role membership của mình thành FARM_OWNER. 2. FARM_OWNER thử cấp một role ngoài quyền theo ma trận nhóm. 3. Đọc membership/audit.
- **Test Data:** Member M-A; role request FARM_OWNER/ADMIN theo matrix.
- **Expected Result:** API từ chối nâng quyền/vượt thẩm quyền; membership giữ nguyên; không tạo audit cập nhật role thành công.
- **Design Status:** Ready sau khi role matrix cấp role được ghi thành fixture.
- **Implementation Status:** Controller role-protected; integration test personnel có sẵn nhưng chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV08-008 — Không vô hiệu hóa OWNER đang hoạt động cuối cùng

- **Scenario ID:** NV08-03
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** State Transition, Concurrency, Role-based Access Testing
- **Preconditions:** F-A chỉ có một FARM_OWNER active; actor có quyền quản lý nhân sự; member còn lại không phải OWNER.
- **Test Steps:** 1. Thử vô hiệu hóa/loại bỏ OWNER duy nhất. 2. Thử cùng thao tác đồng thời từ hai actor hợp lệ trên fixture có hai OWNER. 3. Đọc memberships/roles/audit.
- **Test Data:** F-A có 1 OWNER active (case đơn); F-B có 2 OWNER active (case concurrency setup).
- **Expected Result:** Không để Farm mất OWNER active cuối; không thể đồng thời deactivate cả hai OWNER; mọi membership/audit giữ nhất quán.
- **Design Status:** Ready.
- **Implementation Status:** Có guard bảo vệ OWNER cuối; cần chạy API/database concurrency.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 11. NV09 — Báo cáo, thống kê và giám sát

**Căn cứ kỹ thuật:** `dashboard.controller.ts`, `dashboard.service.ts`, `stock-valuation.ts`, `store-orders.controller.ts` (`stats`), Web `reports`/`dashboard`/`store-reports`, Mobile `DashboardScreen`. Không thêm duyệt báo cáo hoặc AI.

### TC-NV09-001 — Dashboard chỉ trả dữ liệu Farm và role được phép

- **Scenario ID:** NV09-01
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API
- **Test Design Technique:** Role-based Access Testing, Integration
- **Preconditions:** F-A/F-B có fixture inventory khác nhau; user F-A có WAREHOUSE_MANAGER; OWNER F-A; user F-B.
- **Test Steps:** 1. Gọi summary/timeseries bằng từng role và Farm ID. 2. So sánh số liệu với fixture. 3. Thử cross-Farm ID.
- **Test Data:** F-A có 5 units; F-B có 9 units; date range fixture.
- **Expected Result:** Chỉ số khớp dữ liệu Farm được phép; cross-Farm request không trả tổng Farm khác; loại báo cáo không dành cho role bị từ chối.
- **Design Status:** Ready.
- **Implementation Status:** Dashboard endpoints có FarmAccessGuard/role metadata; DB E2E chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV09-002 — Bộ lọc ngày/kho không làm lẫn giao dịch ngoài phạm vi

- **Scenario ID:** NV09-01, NV09-02
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** EP, BVA
- **Preconditions:** Hai giao dịch nằm ở hai ngày biên và hai kho cùng Farm; actor đọc được cả hai; dateFrom/dateTo được API hỗ trợ.
- **Test Steps:** 1. Mở báo cáo với khoảng ngày chứa giao dịch thứ nhất. 2. Thêm bộ lọc WH-A. 3. Đổi ngày/kho và so sánh kết quả với ledger fixture.
- **Test Data:** DateFrom=2026-11-01; dateTo=2026-11-02; WH-A/WH-B.
- **Expected Result:** Chỉ giao dịch thỏa các điều kiện ngày/kho được tổng hợp; thay filter chỉ đổi kết quả đọc, không ghi nghiệp vụ.
- **Design Status:** Ready.
- **Implementation Status:** Report endpoints có date range/warehouse filtering; cần chạy DB.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV09-003 — Giá trị tồn tính bình quân gia quyền di động theo ledger

- **Scenario ID:** NV09-02
- **Priority / Test Level / Platform:** P1 / API Integration / API, DB test
- **Test Design Technique:** Integration, Calculation
- **Preconditions:** Item MAT-Q: nhập 10 units giá 100; nhập thêm 10 units giá 200; xuất 5 units sau đó; cùng Farm/kho, dữ liệu giá hợp lệ.
- **Test Steps:** 1. Tạo fixture ledger theo thứ tự. 2. Gọi stock report và dashboard indicator cùng điều kiện. 3. Đối chiếu công thức và lượng tồn.
- **Test Data:** Q1=10 @100; Q2=10 @200; out=5; on-hand=15; average weighted unit cost after second receipt=150.
- **Expected Result:** Giá trị phản ánh phương pháp bình quân gia quyền di động theo transaction chronology; số liệu dashboard và report cùng chỉ tiêu nhất quán; không gọi là FIFO/lợi nhuận.
- **Design Status:** Ready.
- **Implementation Status:** Có valuation engine/report; API DB E2E chưa chạy trên fixture mới.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV09-004 — Hàng thiếu giá được tách khỏi giá trị đã định giá

- **Scenario ID:** NV09-02
- **Priority / Test Level / Platform:** P0 / API + UI Integration / API, Web, DB test
- **Test Design Technique:** Decision Table, Integration, Regression
- **Preconditions:** MAT-A có 2 units đã định giá tổng 300000; MAT-B có 3 units nhập không biết giá; có item khác được nhập với giá hợp lệ 0 nếu schema cho phép phân biệt.
- **Test Steps:** 1. Gọi dashboard và stock report cùng Farm/kho. 2. Quan sát value, unpriced quantity/flag, tổng và cảnh báo. 3. So sánh API với số liệu đã biết.
- **Test Data:** Priced value=300000; unpriced quantity=3; zero-priced fixture phân biệt nếu DB contract cho phép.
- **Expected Result:** Giá trị 300000 chỉ được ghi là phần đã định giá; lượng 3 chưa định giá được chỉ rõ; tổng không trình bày như đã đầy đủ; giá chưa biết không bị gán nghĩa 0 đồng.
- **Design Status:** Ready.
- **Implementation Status:** PARTIAL/GAP: valuation output có unpriced flag nhưng SQL dashboard lọc unit_price>0, có thể làm 0 hợp lệ/thiếu giá không phân biệt; Web/API phải đối chiếu.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV09-005 — Chi phí bảo trì ghi rõ đúng phạm vi Farm/kho

- **Scenario ID:** NV09-02
- **Priority / Test Level / Platform:** P1 / UI + API Integration / Web, API
- **Test Design Technique:** Decision Table, Integration
- **Preconditions:** F-A có chi phí bảo trì hai asset ở hai kho; actor OWNER đọc toàn Farm; actor WAREHOUSE_MANAGER chỉ có scope kho được phân công.
- **Test Steps:** 1. Mở báo cáo không lọc kho. 2. Lọc WH-A. 3. Đăng nhập quản lý kho scope hẹp và mở cùng báo cáo. 4. Đọc maintenanceScope và nhãn UI.
- **Test Data:** WH-A cost 100; WH-B cost 200; Farm total 300.
- **Expected Result:** Số liệu và nhãn nêu đúng phạm vi thực tế; không gọi 300 là chi phí riêng WH-A; role scope hẹp không lộ chi phí/kho ngoài quyền.
- **Design Status:** Ready.
- **Implementation Status:** Web logic test kiểm maintenanceScope note; source summary có scope metadata; cần integration xác minh.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV09-006 — Thống kê bán hàng chỉ thuộc Farm/role được cấp

- **Scenario ID:** NV09-03
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** Role-based Access Testing, Integration
- **Preconditions:** F-A/F-B có order khác nhau; STORE_MANAGER F-A và EMPLOYEE F-A có token riêng.
- **Test Steps:** 1. Mở store reports và gọi `/store-orders/stats` cho F-A. 2. Gọi cùng endpoint với F-B bằng token F-A. 3. Gọi bằng role không có quyền.
- **Test Data:** F-A completed order 1; F-B completed order 2; role fixtures.
- **Expected Result:** Thống kê dùng đúng phạm vi Farm và role; request trái quyền không nhận dữ liệu; báo cáo bán hàng được ghi nhận là module hiện có, không tạo workflow duyệt mới.
- **Design Status:** Ready.
- **Implementation Status:** Endpoint stats/controller và Web Store Reports có trong source; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV09-007 — Notification tồn thấp/lô/bảo trì đúng đối tượng và không gửi trùng

- **Scenario ID:** NV09-04
- **Priority / Test Level / Platform:** P1 / API Integration / API, Web, Mobile
- **Test Design Technique:** Decision Table, Idempotency
- **Preconditions:** F-A có item dưới ngưỡng cấu hình, lot có expiry date trong vùng cảnh báo hiện hữu, maintenance record tới hạn; F-B không có các điều kiện này.
- **Test Steps:** 1. Chạy worker/generation theo cơ chế test hiện có. 2. Đọc notifications/outbox của người nhận. 3. Chạy lại cùng khoảng thời gian. 4. Mở notification qua Web/Mobile.
- **Test Data:** MAT-Q low stock; LOT-A expiry; record M-A due; F-B control fixture.
- **Expected Result:** Chỉ người/Farm phù hợp nhận cảnh báo; nội dung liên kết đúng bản ghi; lần chạy lại không tạo notification trùng theo khóa nghiệp vụ.
- **Design Status:** Ready.
- **Implementation Status:** Notification/outbox/worker code và tests hiện có; DB/push runtime chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV09-008 — Đọc báo cáo không thay đổi tồn/chứng từ

- **Scenario ID:** NV09-01, NV09-02, NV09-03
- **Priority / Test Level / Platform:** P1 / API Integration / API, DB test
- **Test Design Technique:** Regression, Integration
- **Preconditions:** Fixture có receipt/issue/maintenance/order; chụp snapshot balance, ledger, chứng từ và audit.
- **Test Steps:** 1. Đọc summary, stock report và sales stats. 2. Lặp với filter khác. 3. Đối chiếu snapshot sau đọc.
- **Test Data:** F-A; WH-A; date range; các chứng từ đã seed bằng fixture test.
- **Expected Result:** Các truy vấn chỉ đọc không thay đổi balance, trạng thái chứng từ, ledger hoặc audit nghiệp vụ.
- **Design Status:** Ready.
- **Implementation Status:** Report service chủ yếu SELECT; xác minh DB integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV09-009 — Dashboard Mobile không trình bày dữ liệu trang đầu như tổng toàn Farm

- **Scenario ID:** NV09-05
- **Priority / Test Level / Platform:** P2 / UI + API Integration / Mobile
- **Test Design Technique:** Equivalence Partitioning, Integration
- **Preconditions:** Thiết bị/emulator Mobile và tài khoản test có quyền vận hành tại F-A; fixture có hơn 5 phiếu ít nhất ở một loại receipt/issue/transfer, trong đó có phiếu chờ ngoài trang đầu; API trả dữ liệu phân trang theo hợp đồng hiện tại.
- **Test Steps:** 1. Đăng nhập và chọn F-A. 2. Mở Dashboard Mobile, chờ các yêu cầu kho và chứng từ gần đây tải xong. 3. Ghi lại các chỉ số và nhãn; đối chiếu với ba response trang đầu mà Dashboard yêu cầu cho receipts, issues và transfers. 4. So sánh với số chứng từ chờ thực tế toàn Farm trong fixture để xác nhận phạm vi nhãn/chỉ số.
- **Test Data:** F-A; hơn 5 receipt, hơn 5 issue hoặc hơn 5 transfer; có chứng từ chờ ở trang đầu và ngoài trang đầu; response mỗi danh sách dùng page=1, pageSize=5.
- **Expected Result:** Dashboard chỉ mô tả số chờ là dữ liệu gần đây/trong tập đã tải, không gắn nhãn đây là tổng số chứng từ chờ toàn Farm; danh sách phiếu gần đây không vượt quá 3 mục theo cách trình bày hiện tại. Các số kho và tồn hiển thị phải đối chiếu được với response tương ứng, không lấy danh sách 5 chứng từ làm nguồn tính tổng giao dịch Farm.
- **Design Status:** Ready.
- **Implementation Status:** Dashboard Mobile hiện gọi ba danh sách chứng từ với pageSize=5 và đặt nhãn “Nháp/chờ duyệt gần đây”; UI/device chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 12. NV10 — Danh mục kinh doanh và cấu hình bán hàng

**Căn cứ kỹ thuật:** `store-admin.controller.ts`, `store-admin.service.ts`, DTO product/variant/settings/shipping fees; Web `store-admin` và storefront; public API `commerce.controller.ts`. Không bổ sung duyệt niêm yết hay giá riêng theo Farm.

### TC-NV10-001 — ADMIN tạo DRAFT không làm thay đổi tồn

- **Scenario ID:** NV10-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API, DB test
- **Test Design Technique:** EP, Integration
- **Preconditions:** ADMIN có membership/scope hợp lệ theo cấu hình hiện tại; category fixture; product slug chưa tồn tại.
- **Test Steps:** 1. Tạo product với name/category/slug. 2. Đọc sản phẩm/biến thể/public catalog. 3. Đọc inventory balance/ledger.
- **Test Data:** P-A name “Mật ong test”; slug mat-ong-test; status DRAFT.
- **Expected Result:** Sản phẩm DRAFT lưu; chưa hiện trong catalog công khai/orderable; không tạo inventory/asset/ledger.
- **Design Status:** Ready.
- **Implementation Status:** Có createProduct và audit transaction; quyền ADMIN không membership cần quyết định riêng.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV10-002 — DRAFT chưa đủ dữ liệu công bố vẫn lưu được

- **Scenario ID:** NV10-01
- **Priority / Test Level / Platform:** P1 / API + UI Integration / Web, API
- **Test Design Technique:** EP, State Transition
- **Preconditions:** ADMIN có quyền catalog; tạo DRAFT chưa có variant/ảnh hoàn chỉnh.
- **Test Steps:** 1. Lưu DRAFT thiếu dữ liệu chỉ cần cho công bố. 2. Mở lại màn chi tiết. 3. Thử chuyển PUBLISHED trước khi đủ điều kiện.
- **Test Data:** P-A; chưa có active variant hoặc ảnh.
- **Expected Result:** DRAFT được lưu không bị áp validation công bố quá sớm; thao tác PUBLISHED chỉ thành công khi các điều kiện publish thực tế trong đặc tả/DTO/service được đáp ứng; không tự tạo sản phẩm bán được.
- **Design Status:** Ready; checklist publish fields cần chốt theo source/spec trước khi fixture.
- **Implementation Status:** Có status update path; điều kiện publish cần được xác minh qua service.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV10-003 — PUBLISHED nhưng chưa có cấu hình Farm không được đặt mua

- **Scenario ID:** NV10-01, NV10-02
- **Priority / Test Level / Platform:** P1 / UI Integration / Web, API
- **Test Design Technique:** Decision Table, Integration
- **Preconditions:** P-A PUBLISHED và có variant active; F-A chưa map variant vào item hoặc chưa bật bán.
- **Test Steps:** 1. Mở public storefront. 2. Tìm product và thử add/availability. 3. Kiểm tra settings/mapping/tồn.
- **Test Data:** P-A/V-A; mapping thiếu hoặc salesEnabled=false.
- **Expected Result:** PUBLISHED không đồng nghĩa orderable; khách không checkout được sản phẩm chưa được Farm cấu hình bán; tồn không thay đổi.
- **Design Status:** Ready.
- **Implementation Status:** Public catalog/availability đọc settings/mapping; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV10-004 — Giá variant hợp lệ lưu chính xác và giá không hợp lệ bị từ chối

- **Scenario ID:** NV10-01
- **Priority / Test Level / Platform:** P1 / API Integration / Web, API
- **Test Design Technique:** EP, BVA
- **Preconditions:** ADMIN có quyền product catalog; P-A tồn tại; variant chưa có.
- **Test Steps:** 1. Tạo variant giá 150000 VND, quantityStep=1. 2. Trên fixture riêng gửi giá phân số/âm hoặc vượt precision theo DTO. 3. Đọc variant và audit.
- **Test Data:** valid price=150000; invalid price=150000.5 hoặc -1; quantityStep=1.
- **Expected Result:** Giá VND hợp lệ giữ nguyên chính xác; payload ngoài pattern/custom money validation bị từ chối, không làm tròn âm thầm; không thay đổi tồn.
- **Design Status:** Ready.
- **Implementation Status:** DTO price pattern và money validator hiện có; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV10-005 — FARM_OWNER map variant vào item thuộc Farm mình

- **Scenario ID:** NV10-02
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** Role-based Access Testing, Integration
- **Preconditions:** F-A có item MAT-Q; P-A/V-A dùng chung catalog; FARM_OWNER F-A có quyền cấu hình bán.
- **Test Steps:** 1. Map V-A → MAT-Q qua UI/API hiện có. 2. Đọc store settings/mapping. 3. Kiểm tra tồn và item khác Farm.
- **Test Data:** F-A; V-A; MAT-Q; MAT-X thuộc F-B.
- **Expected Result:** Mapping thuộc đúng Farm và variant; không biến động tồn; không map item F-B vào F-A.
- **Design Status:** Ready.
- **Implementation Status:** Có set/remove variant item endpoints/service; integration chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV10-006 — Farm chỉ cấu hình một kho bán thuộc Farm và vùng hợp lệ

- **Scenario ID:** NV10-02
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API
- **Test Design Technique:** Decision Table, Error Guessing
- **Preconditions:** F-A có WH-A active và WH-B internal; F-B có WH-X; FARM_OWNER F-A.
- **Test Steps:** 1. Bật sales với WH-A và vùng NORTH. 2. Gửi settings chọn kho F-B hoặc kho inactive. 3. Thử bật sales khi thiếu kho/vùng.
- **Test Data:** salesWarehouseId WH-A/WH-X; regions NORTH; salesEnabled true/false.
- **Expected Result:** Cấu hình chỉ dùng kho thuộc F-A và điều kiện cần khi bật bán; request cross-Farm/inactive/thiếu điều kiện bị từ chối; không đổi settings Farm khác và không đổi tồn.
- **Design Status:** Ready.
- **Implementation Status:** DTO/service validate warehouse/Farm/regions; cần integration kiểm tra.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV10-007 — Chỉ ADMIN quản lý phí giao chung; phí mới không đổi order snapshot

- **Scenario ID:** NV10-03
- **Priority / Test Level / Platform:** P0 / API Integration / Web, API, DB test
- **Test Design Technique:** Role-based Access Testing, State Transition, Integration
- **Preconditions:** O-A đã tạo với shipping fee snapshot; FARM_OWNER và ADMIN có membership phù hợp; STORE_MANAGER không có catalog role.
- **Test Steps:** 1. ADMIN đổi ba mức phí NORTH/CENTRAL/SOUTH. 2. FARM_OWNER thử đổi phí chung. 3. STORE_MANAGER thử đổi phí. 4. Đọc O-A, settings, audit.
- **Test Data:** old fees 40000/20000/30000; new fees 45000/25000/35000; O-A snapshot ban đầu 20000.
- **Expected Result:** ADMIN có quyền được phép cập nhật biểu phí chung và có audit actor/time/before-after; role không phù hợp bị từ chối; O-A giữ nguyên snapshot phí cũ; tồn không đổi.
- **Design Status:** Ready; xử lý ADMIN không membership Farm theo quyết định nhóm còn pending.
- **Implementation Status:** Controller/service giới hạn catalog fee role và transaction audit; guard membership behavior cần xác nhận.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV10-008 — Cập nhật catalog/settings audit đúng old-new và rollback cùng transaction

- **Scenario ID:** NV10-01, NV10-02
- **Priority / Test Level / Platform:** P1 / Integration / DB test harness
- **Test Design Technique:** Transaction, Integration, Error Guessing
- **Preconditions:** Product P-A/variant V-A, mapping V-A→MAT-Q và settings F-A đã tồn tại; harness inject lỗi DB trong thao tác cập nhật.
- **Test Steps:** 1. Sửa giá hoặc status product và inject lỗi sau update trước audit. 2. Đọc product/audit. 3. Lặp thao tác thành công và so sánh old/new.
- **Test Data:** Giá 150000→160000; status theo enum thực tế; không ghi image URL credential/token.
- **Expected Result:** Lỗi rollback cả dữ liệu và audit; thành công có một audit đúng actor/phạm vi/old-new; audit không chứa secret/token/URL credential; không tạo tồn hoặc thay giá snapshot các order cũ.
- **Design Status:** Ready.
- **Implementation Status:** StoreAdminService đã audit qua transaction và lọc dữ liệu ảnh nhạy cảm; cần DB integration.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 13. Kiểm thử liên nghiệp vụ (không tạo Scenario mới)

Các ca dưới đây có ID riêng để quản lý nhưng Scenario ID trỏ về các Scenario hiện có. Mỗi ca chỉ được tính một lần trong tổng Test Case; không cộng vào tổng từng Scenario hai lần.

### TC-XFLOW-001 — Mobile lưu phiếu nhập, Web đọc cùng dữ liệu trước và sau xác nhận

- **Scenario ID:** NV01-02, NV01-04
- **Priority / Test Level / Platform:** P1 / End-to-end Integration / Mobile, API, Web, DB test
- **Test Design Technique:** Integration, Regression
- **Preconditions:** Mobile EMPLOYEE F-A; Web WAREHOUSE_MANAGER F-A; receipt draft LOT hợp lệ; DB test.
- **Test Steps:** 1. Mobile tạo/sửa draft theo flow thực có và lưu. 2. Web mở cùng receipt. 3. Web thực hiện confirm hợp lệ. 4. Mobile tải lại receipt; đọc lot/balance/ledger.
- **Test Data:** R-A; MAT-L; LOT-A; quantity=3; tồn đầu=5.
- **Expected Result:** Nội dung draft đồng nhất hai client; trước confirm tồn không đổi; sau confirm tăng đúng 3 một lần và cùng lot; cả hai client đọc cùng trạng thái.
- **Design Status:** Ready.
- **Implementation Status:** Web/API có; Mobile receipt path hiện có, cần UI runtime đối chiếu.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-XFLOW-002 — Receipt đã xác nhận xuất hiện đúng trong stock report

- **Scenario ID:** NV01-04, NV09-02
- **Priority / Test Level / Platform:** P1 / E2E Integration / Web, API, DB test
- **Test Design Technique:** Integration, Regression
- **Preconditions:** F-A/WH-A có tồn MAT-Q=5; receipt nhập 4 đã xác nhận trong fixture.
- **Test Steps:** 1. Đọc receipt và ledger. 2. Mở dashboard/report cùng Farm, kho và date range. 3. So sánh tồn/biến động.
- **Test Data:** On-hand 5→9; receipt quantity 4; same date range.
- **Expected Result:** Balance=9; ledger có một receipt +4; report khớp cùng phạm vi; báo cáo chỉ đọc.
- **Design Status:** Ready.
- **Implementation Status:** Receipt/report APIs tồn tại; DB E2E chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-XFLOW-003 — Hoàn trả đạt một phần phản ánh thống nhất ở tồn và báo cáo

- **Scenario ID:** NV02-03, NV09-02
- **Priority / Test Level / Platform:** P0 / E2E Integration / Web, API, DB test
- **Test Design Technique:** Integration, Calculation
- **Preconditions:** Issue đã xuất 5 MAT-Q; on-hand=10 sau các giao dịch khác; kho nhận lại 4 đạt/1 không đạt.
- **Test Steps:** 1. Tạo/confirm receipt trả theo flow hiện có. 2. Mở inventory/ledger. 3. Mở stock report cùng filter.
- **Test Data:** accepted=4; rejected=1; on-hand trước return=10.
- **Expected Result:** On-hand/available tăng đúng 4→14; phần không đạt không vào available; ledger và report chỉ phản ánh lượng đạt theo rule; cùng một transaction không ghi hai lần.
- **Design Status:** Ready.
- **Implementation Status:** Backend có internal return flow; field phản ánh rejected/0 accepted cần đối chiếu implementation.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-XFLOW-004 — Điều chuyển QUANTITY/LOT giữ thống nhất giữa hai kho và báo cáo

- **Scenario ID:** NV02-04, NV02-05, NV09-02
- **Priority / Test Level / Platform:** P0 / E2E Integration / Web, API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** WH-A/WH-B cùng F-A; LOT-A balance nguồn=10; kho đích có người nhận riêng.
- **Test Steps:** 1. WH-B lập đề nghị 10. 2. WH-A dispatch 10. 3. Đọc source/destination/report khi đang transit. 4. WH-B nhận 8 và ghi discrepancy. 5. Mở transfer/report.
- **Test Data:** Source 10; dispatch 10; accepted receive 8; discrepancy 2.
- **Expected Result:** Sau dispatch source giảm 10, destination chưa tăng; sau nhận chỉ 8 tăng ở đích; 2 còn chờ xử lý, không tự hoàn tất; ledger/report khớp từng kho.
- **Design Status:** Ready.
- **Implementation Status:** Two-step/resolve APIs có; DB E2E chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-XFLOW-005 — Maintenance xuất/nhận và quyết định cuối đọc nhất quán qua Web/Mobile

- **Scenario ID:** NV04-02, NV04-04
- **Priority / Test Level / Platform:** P0 / E2E Integration / Web, Mobile, API, DB test
- **Test Design Technique:** Integration, Regression
- **Preconditions:** R-A có ASSET-A; Web điều phối và kho; Mobile nhân viên đọc asset; test Farm F-A.
- **Test Steps:** 1. Điều phối lập lịch, chưa làm giảm tồn. 2. Kho xác nhận xuất. 3. Ghi kết quả đối tác PASSED/FAILED. 4. Kho nhận đúng asset. 5. FARM_OWNER quyết định cuối. 6. Đọc asset history trên Web/Mobile.
- **Test Data:** ASSET-A; WH-A/LOC-A; outcome PASSED, sau đó test độc lập FAILED.
- **Expected Result:** Cùng assetId suốt lifecycle; chỉ kho xác nhận xuất/nhập mới đổi tồn; FAILED không thành AVAILABLE; Web/Mobile đọc cùng kết quả và decision.
- **Design Status:** Ready.
- **Implementation Status:** API/Web có; direct create role và Mobile details cần xác minh runtime.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-XFLOW-006 — Count có chênh lệch chỉ cập nhật report sau approve

- **Scenario ID:** NV03-02, NV09-01, NV09-02
- **Priority / Test Level / Platform:** P0 / E2E Integration / Web, API, DB test
- **Test Design Technique:** State Transition, Integration
- **Preconditions:** MAT-Q WH-A=10; count thực tế 8 đã submit; role duyệt được nhóm xác nhận.
- **Test Steps:** 1. Mở dashboard/report trước approval. 2. Thử confirm bằng actor không có quyền. 3. Approver hợp lệ duyệt. 4. Reload inventory/report.
- **Test Data:** 10→8; difference=-2.
- **Expected Result:** Trước approve không đổi tồn/report ledger; sau approve balance=8 và report phản ánh đúng một điều chỉnh; không tạo workflow phê duyệt giả ngoài role đã xác nhận.
- **Design Status:** Pending Requirement Clarification về role approver cụ thể.
- **Implementation Status:** Count/report có; role test đang chờ quyết định.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-XFLOW-007 — Order đi từ xác nhận giữ hàng đến thanh toán, thực xuất và giao

- **Scenario ID:** NV05-02, NV05-03, NV05-04, NV05-05
- **Priority / Test Level / Platform:** P0 / E2E Integration / Web, API, DB test
- **Test Design Technique:** State Transition, Integration, Concurrency
- **Preconditions:** One Farm/one sales warehouse đủ giỏ; STORE_MANAGER, WAREHOUSE_MANAGER, DELIVERY_STAFF và customer fixture; DB test.
- **Test Steps:** 1. Customer tạo PENDING order. 2. STORE_MANAGER confirm để giữ đủ. 3. Thử issue khác lấy lượng giữ. 4. Xác minh payment đúng phương thức. 5. Kho thực xuất. 6. Shipper giao/thu COD hoặc hoàn tất bank transfer.
- **Test Data:** On-hand=5; order quantity=2; COD hoặc BANK_TRANSFER test riêng; other issue quantity=4.
- **Expected Result:** PENDING chưa hold; confirm giữ 2 nguyên tử; other issue không lấy phần giữ; chỉ xuất hợp lệ mới giảm on-hand 5→3; payment/delivery không trừ thêm tồn; trạng thái/ledger đúng một lần.
- **Design Status:** Ready.
- **Implementation Status:** Các module/API tồn tại; chưa chạy PostgreSQL end-to-end.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-XFLOW-008 — Exchange NV06 dùng kho bán và ghi lại quan hệ đơn/claim/phiếu xuất

- **Scenario ID:** NV06-03, NV05-05, NV07-02
- **Priority / Test Level / Platform:** P0 / E2E Integration / Web, API, DB test
- **Test Design Technique:** Integration, Transaction
- **Preconditions:** Warranty W-A cho ASSET-S1 đã đủ điều kiện exchange; variant replacement V-B có tồn WH-S; order gốc O-A COMPLETED.
- **Test Steps:** 1. Approve exchange theo flow. 2. Thực xuất replacement qua stock issue liên kết. 3. Đọc claim, order, issue, asset identity, balance/ledger.
- **Test Data:** O-A/I-A; ASSET-S1; replacement V-B quantity=1.
- **Expected Result:** Chứng từ xuất liên kết đúng claim/order; giảm tồn replacement một lần; không biến replacement thành asset nội bộ đang IN_USE; giữ traceability serial gốc và hàng thay thế.
- **Design Status:** Ready.
- **Implementation Status:** Source đã có exchange issue guard; E2E chưa chạy.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-XFLOW-009 — Mapping catalog và setting Farm quyết định khả năng mua, không tự đổi tồn

- **Scenario ID:** NV10-02, NV05-01, NV05-02
- **Priority / Test Level / Platform:** P1 / E2E Integration / Web, API, DB test
- **Test Design Technique:** Integration, Decision Table
- **Preconditions:** P-A/V-A PUBLISHED; F-A có MAT-Q và kho WH-A; trước đầu test chưa map/bật bán.
- **Test Steps:** 1. Xác nhận storefront chưa cho đặt. 2. FARM_OWNER map V-A→MAT-Q, chọn WH-A, bật bán và chọn region. 3. Tải storefront/availability lại. 4. Tạo test order. 5. Đọc balance.
- **Test Data:** P-A/V-A; MAT-Q; WH-A; region NORTH; on-hand=5.
- **Expected Result:** Trước config không orderable; sau config availability chỉ dựa kho bán được chọn; order snapshot giữ giá/phí; chỉ create order chưa làm đổi on-hand/ledger.
- **Design Status:** Ready.
- **Implementation Status:** Mapping/settings/commerce endpoints có; cần DB E2E.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

## 14. Tóm tắt số lượng và vấn đề cần xác nhận

| Nhóm | Test Case cũ được giữ | Test Case mới | Tổng thiết kế sau tài liệu này |
|---|---:|---:|---:|
| AUTH | 0 | 7 | 7 |
| NV01 | 48 | 1 | 49 |
| NV02 | 58 | 6 | 64 |
| NV03 | 0 | 10 | 10 |
| NV04 | 0 | 11 | 11 |
| NV05 | 12 | 15 | 27 |
| NV06 | 0 | 8 | 8 |
| NV07 | 0 | 7 | 7 |
| NV08 | 0 | 8 | 8 |
| NV09 | 0 | 9 | 9 |
| NV10 | 0 | 8 | 8 |
| XFLOW | 0 | 9 | 9 |
| **Tổng** | **118** | **99** | **217** |

**Điểm chưa đủ căn cứ để chốt Expected Result/fixture:**

1. NV03: nhóm phải ký nhận role được duyệt chênh lệch và ma trận người không được duyệt. TC-NV03-004/005 và TC-XFLOW-006 giữ `Design Status = Pending Requirement Clarification`; không tính là sẵn sàng thực thi cho đến khi có quyết định.
2. NV04: quyết định nghiệp vụ đã chốt cho phép điều phối viên tạo lịch trực tiếp, không cần duyệt trước. Source cho phép nhóm MAINTENANCE_SCHEDULE_ROLES (có MAINTENANCE_STAFF) tạo qua API; chưa thấy cách phân biệt điều phối viên riêng và Web chưa có form tạo. TC-NV04-011 kiểm tra API + Web readback; xác nhận role mapping với nhóm trước khi chạy, không đặt lại câu hỏi về bước duyệt.
3. NV05 return-to-warehouse: cần xác minh payload/field hiện có cho số lượng đạt/không đạt, trường hợp 0 đạt và return ASSET; Expected Result vẫn theo quy tắc nghiệp vụ.
4. NV06: chính sách thời hạn/điều kiện bảo hành được áp dụng tại thời điểm bán và khoản khách đã thanh toán ngoài hệ thống chưa có hợp đồng dữ liệu đầy đủ; không coi quote/consent/actualCost là tiền đã thu.
5. NV08: điều kiện ngừng kho khi có chứng từ mở hoặc kho đang được cấu hình bán; code hiện kiểm balance/asset. Chờ quyết định policy trước khi mở rộng Expected Result.
6. NV09: tách rõ giá trị đã định giá, giá hợp lệ bằng 0 và giá không xác định; kiểm tra SQL/API/UI trên fixture mới.
7. NV10: role ADMIN không có membership Farm có được sửa catalog/phí chung hay không vẫn cần nhóm xác nhận; không tự tháo FarmAccessGuard.
8. Những case DB concurrency/fault injection cần test DB độc lập; test UI cần tài khoản Web/Mobile fixture. Tất cả vẫn `Not Run`.

## 15. Đối chiếu lại một số Implementation Gap trong Test Case cũ

Đây là ghi nhận đối chiếu source tại HEAD `f868ea0e4785af7ab9c2d6d1e044105a5bc85e98`; không sửa 118 Test Case gốc và không thay kết quả thực thi. Các dòng code chỉ chứng minh hợp đồng hiện có, không chứng minh runtime PASS.

| Test Case / gap cũ | Bằng chứng hiện tại | Kết luận theo source | Test còn cần |
|---|---|---|---|
| NV02-03-G1/G2: hoàn trả QUANTITY/LOT và ASSET, lượng không đạt | `api/src/modules/warehouses/stock-receipts.controller.ts:272-296` có `POST /stock-receipts/from-issue/:issueId`; `StockReceiptsService.createIssueReturn` tại `api/src/modules/warehouses/stock-receipts.service.ts:229-302` chỉ nhận dòng QUANTITY/LOT của phiếu xuất đã xác nhận, giữ `sourceIssueItemId`/lot gốc, ghi riêng `acceptedQuantity` và `rejectedQuantity`; confirm bỏ qua dòng accepted=0 và chỉ hạch toán `line.quantity` accepted. ASSET trả riêng qua `POST /assets/:id/return`, DTO có condition GOOD/DAMAGED và DAMAGED bắt buộc lý do: `api/src/modules/assets/dto/return-asset.dto.ts`, `api/src/modules/assets/assets.service.ts:60+`. | Gap “không có internal return QUANTITY/LOT” đã được giải quyết ở mức code. Hàng lỗi không cộng vào balance khả dụng; trả ASSET không đạt chuyển DAMAGED. Việc này chưa chứng minh chấp nhận từng mặt hàng trên DB thật. | TC-NV02-046/047, NV02-045/048..050; API integration return/asset trên DB test riêng. |
| NV02-02-G1; TC-NV02-036..040: người nhận, acknowledgment và start-use | Migration `api/drizzle/0045_issue-receipt-ack.sql` thêm recipient/received fields. `StockIssuesController.acknowledge` tại `api/src/modules/warehouses/stock-issues.controller.ts:419-454`; `StockIssuesService.acknowledge` tại `api/src/modules/warehouses/stock-issues.service.ts:771-836` cho người nhận xác nhận, hoặc quản lý kho cùng scope ghi thay kèm ghi chú; retry không ghi lại; không đụng tồn. Web có `web/features/issues/components/issue-receipt.tsx` và API client; API-IT có `api/test/stock-document-approval.integration.e2e-spec.ts:615-762`. Tuy nhiên `StockIssuesService.confirm` tại khoảng dòng 671-682 đặt ASSET thành `IN_USE` ở bước xác nhận xuất và không có ghi `assetAssignments`; `AssetLifecycleService.startUse` tại khoảng dòng 407-478 lại yêu cầu status `ASSIGNED` cùng assignment ACTIVE. | API/Web acknowledgment đã được bổ sung, nên phần thiếu thao tác xác nhận nhận cũ được giải quyết một phần. Luồng chưa đồng bộ với lifecycle assignment/start-use: phiếu xuất xác nhận đã đánh dấu IN_USE nhưng chưa tạo assignment; không thể coi các bước xuất, nhận và bắt đầu dùng đã hoàn chỉnh. Không thấy UI acknowledgment chuyên biệt trong Mobile. | TC-NV02-036..040 trên PostgreSQL test; kiểm tra Web actor/role, tồn không đổi tại acknowledgment, assignment/holder và state transition. Chốt có cần Mobile acknowledgment không. |
| NV03-04: kiểm kê ASSET trên Mobile | `mobile/src/features/inventory/presentation/StockCountScreen.tsx` vẫn loại ASSET khỏi lựa chọn/tạo dòng; DTO/API backend có assetCondition/foundLocationId. | Backend đã hỗ trợ nhưng Mobile còn Implementation Gap. Không đổi Expected Result theo source thiếu. | TC-NV03-008..010 và UIUX-MOB-008 sau khi có bản Mobile hỗ trợ; hiện giữ Not Run. |
| NV09-02: phân biệt giá trị tồn bằng 0 với giá chưa biết | API test unit có `stock-valuation.spec.ts`; Dashboard SQL ở `api/src/modules/dashboard/dashboard.service.ts` có nhánh loại `unit_price > 0` khỏi định giá. | Valuation helper có phân loại unpriced, nhưng mọi đường đọc Dashboard/report chưa được chứng minh nhất quán cho giá 0 hợp lệ và giá không xác định. | TC-NV09-003/004, XFLOW-002; chạy API integration với fixture có giá 0, giá dương và giá thiếu. |

Điểm khác biệt quan trọng so với audit cũ: có thể đóng gap khi code hiện tại đã thêm hợp đồng thực (như phiếu trả QUANTITY/LOT và API acknowledgment), nhưng vẫn giữ Test Case `Not Run`. Gaps về phân quyền NV03, chuyển trạng thái NV01-028/NV01-039, chính sách ngừng kho và một số quy tắc NV06/NV10 vẫn là Pending Requirement, không tự gán lỗi cho Đạt.


## Bổ sung Test Case được chọn cho Chương 5

### TC-NV01-049 — Kiểm nhận hàng không đạt ngoài hệ thống và chỉ nhập kho khi hàng đã được chấp nhận

- **Scenario ID:** NV01-04, NV01-05
- **Priority / Test Level / Platform:** P0 / Integration / Web hoặc API theo luồng tạo-xác nhận hiện có, kèm PostgreSQL test riêng để đối chiếu tồn, ledger và audit
- **Test Design Technique:** State Transition, Integration, Error Guessing
- **Preconditions:** Người lập phiếu và người xác nhận có tài khoản, membership Farm và quyền kho phù hợp theo luồng hiện hành; F-A/WH-A đang hoạt động; MAT-Q là mặt hàng QUANTITY; supplier S-A hợp lệ nếu được dùng trong fixture. Tồn ban đầu on-hand=20.000, held=0.000, available=20.000. DB là PostgreSQL test độc lập; chưa có phiếu hoặc giao dịch nhập do kịch bản QA này tạo. `QC-SUP-01` chỉ là mã kịch bản trong ghi chú kiểm thử, không phải mã/field của phiếu trên phần mềm.
- **Test Steps:** 1. Ghi nhận balance, ledger và danh sách phiếu nhập liên quan trước khi bắt đầu. 2. Mô phỏng trong dữ liệu kịch bản QA việc nhà cung cấp giao 10 đơn vị, gồm 8 đạt và 2 không đạt; không nhập dữ liệu này vào ứng dụng. 3. Trong giai đoạn hàng chưa được chấp nhận, không tạo hoặc xác nhận phiếu nhập; đọc lại tồn và ledger để đối chiếu với baseline. 4. Mô phỏng việc nhà cung cấp xử lý/đổi 2 đơn vị ngoài hệ thống; nhân viên kho kiểm nhận lại đủ 10 đơn vị và ghi nhận kết quả đạt trong worksheet kiểm thử. 5. Chỉ sau khi hàng được chấp nhận, dùng giao diện/API tạo phiếu nhập hợp lệ cho MAT-Q, số lượng 10.000, đúng F-A/WH-A và supplier S-A nếu có; ghi lại ID/mã thực tế do hệ thống trả về. 6. Dùng tài khoản có quyền hiện hành kiểm tra và xác nhận phiếu. 7. Đọc lại trạng thái phiếu, on-hand/available, ledger và audit; xác minh người xác nhận và thời điểm theo các trường hệ thống hiện có. 8. Nếu endpoint/luồng hiện hành cho phép gọi lại thao tác xác nhận, gửi lại một lần cho cùng phiếu đã xác nhận rồi đối chiếu tồn, ledger và audit.
- **Test Data:** Mã kịch bản ngoài hệ thống `QC-SUP-01`; F-A; WH-A; MAT-Q; supplier S-A nếu có; baseline on-hand=20.000, held=0.000, available=20.000; kịch bản QA ban đầu 10 đơn vị gồm 8 đạt/2 lỗi; sau xử lý ngoài hệ thống, 10 đơn vị được kiểm nhận đạt; phiếu phần mềm chỉ được lập sau đó với quantity=10.000. Không gửi mã phiếu, field hoặc trạng thái tự tạo.
- **Expected Result:** Trong giai đoạn hàng chưa được chấp nhận, do quy trình QA không lập/gửi phiếu trên phần mềm nên không có phiếu nhập hoặc giao dịch ledger từ giai đoạn đó; tồn giữ nguyên 20.000. Đây là thao tác nghiệp vụ ngoài hệ thống, không phải yêu cầu phần mềm tự phát hiện lỗi hay chặn một trạng thái quality hold. Sau khi 10 đơn vị đã được kiểm nhận đạt, phiếu hợp lệ được tạo và xác nhận bằng tài khoản có quyền; phiếu ở trạng thái xác nhận theo hệ thống, on-hand/available tăng từ 20.000 lên 30.000 và có đúng một giao dịch RECEIPT +10.000 gắn ID phiếu thực tế. Audit xác nhận ghi nhận actor và thời điểm theo cấu trúc hiện có. Nếu thao tác xác nhận được gửi lặp cho phiếu đã xác nhận, tồn, giao dịch nhập và audit xác nhận không bị ghi trùng.
- **Design Status:** Ready theo quy tắc NV01 đã chốt; phần đánh giá hàng lỗi, yêu cầu đổi/giao lại và kiểm nhận lại là sự kiện nghiệp vụ ngoài hệ thống. Phần mềm được kiểm tra từ lúc lập phiếu cho hàng đã được chấp nhận.
- **Implementation Status:** Không có Implementation Gap về quality hold/resolve trong phạm vi đã chốt. Source hỗ trợ tạo phiếu nháp và xác nhận phiếu; xác nhận chạy trong transaction, khóa phiếu, cập nhật giao dịch RECEIPT, ghi `confirmedByMemberId`/`confirmedAt` và audit. Phiếu đã CONFIRMED được trả về mà không xử lý tồn/ledger lần nữa. Bằng chứng tĩnh tại HEAD: `stock-receipts.controller.ts:258-269,446-457`; `stock-receipts.service.ts:601-617,833-879`; DTO hiện hành `create-stock-receipt.dto.ts:20-63,126-155`. Đây chưa phải kết quả runtime.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**

### TC-NV04-011 — Điều phối viên được phân quyền tạo lịch trực tiếp

- **Scenario ID:** NV04-01
- **Priority / Test Level / Platform:** P1 / API Integration + Web readback / API, Web, PostgreSQL test riêng
- **Test Design Technique:** Role-based Access Testing, State Transition, Integration
- **Preconditions:** F-A và WH-A hoạt động; ASSET-M1 và ASSET-M2 là hai asset định danh đang thuộc WH-A, có item tracking ASSET hoạt động, không LOST/RETIRED/TRANSFER_PENDING và chưa có hồ sơ bảo trì đang hoạt động. qa-maintenance-coordinator là thành viên ACTIVE của F-A với role MAINTENANCE_STAFF và được nhóm xác nhận là tài khoản điều phối được phân quyền; qa-employee là EMPLOYEE ACTIVE trong cùng Farm nhưng không có role lập lịch. Có token test riêng; balance, lifecycle, ledger và audit baseline đã được đọc từ DB test độc lập. Không có yêu cầu/hồ sơ chờ duyệt cho ASSET-M1.
- **Test Steps:** 1. Dùng token qa-maintenance-coordinator gọi POST /maintenance-records?farmId={F-A} với body chỉ gồm các trường DTO hiện có: assetId=ASSET-M1, maintenanceType=PREVENTIVE, scheduledAt=2026-11-15T09:00:00.000Z, description=Kiểm tra định kỳ máy bơm. Không gửi approval/request/status field. 2. Đọc response và hồ sơ đã lưu; xác nhận lịch được tạo trực tiếp, không cần hồ sơ yêu cầu đã duyệt trước. 3. Mở màn hình bảo trì Web của F-A và tải lại danh sách/chi tiết để đối chiếu asset, lịch, mô tả và trạng thái. 4. Đọc asset lifecycle, balance, inventory ledger và audit trước/sau. 5. Dùng token qa-employee gọi trực tiếp cùng API cho ASSET-M2 với dữ liệu hợp lệ. 6. Đọc lại hồ sơ, audit, lifecycle, balance và ledger.
- **Test Data:** F-A; WH-A; ASSET-M1 và ASSET-M2; qa-maintenance-coordinator: MAINTENANCE_STAFF, nhóm xác nhận là điều phối viên; qa-employee: EMPLOYEE; maintenanceType=PREVENTIVE; scheduledAt=2026-11-15T09:00:00.000Z; description=Kiểm tra định kỳ máy bơm. UUID thực tế được cấp trong DB test và ánh xạ vào các alias trên; không giả định fixture đã tồn tại.
- **Expected Result:** Coordinator được phân quyền tạo trực tiếp một hồ sơ SCHEDULED không cần bước phê duyệt trước; hồ sơ được lưu và Web đọc lại đúng asset/lịch/mô tả. Chỉ tạo lịch không đổi asset lifecycle, balance hoặc inventory ledger và không tạo phiếu xuất kho. Request trực tiếp của EMPLOYEE không có quyền lập lịch bị từ chối; không tạo hồ sơ/audit schedule cho ASSET-M2 và không làm đổi dữ liệu kho. Tạo lịch không trao quyền xác nhận xuất/nhận tài sản hoặc quyết định REUSE/HOLD sau bảo trì.
- **Design Status:** Ready theo quyết định mới nhất: điều phối viên được lập lịch trực tiếp. Trước khi chạy, nhóm cần xác nhận role MAINTENANCE_STAFF chính là cách cấp quyền cho điều phối viên trong fixture.
- **Implementation Status:** Source có POST /maintenance-records; MaintenanceService.create gọi actor với MAINTENANCE_SCHEDULE_ROLES, nhóm này gồm MAINTENANCE_STAFF, và schedule tạo hồ sơ trong transaction. Không tìm thấy thuộc tính phân công điều phối riêng; API áp dụng quyền cho thành viên có role phù hợp. Web hiện có màn hình đọc danh sách/chi tiết, không thấy form tạo; ca này tạo qua API và chụp Web readback. Bằng chứng: api/src/modules/auth/farm-access/farm-role-groups.ts:20-25; api/src/modules/maintenance/maintenance.controller.ts:166-213; api/src/modules/maintenance/maintenance.service.ts:271-290,293-378,1225-1235; web/features/maintenance/maintenance-screen.tsx:60.
- **Actual Result:**
- **Execution Status:** Not Run
- **Bug ID:**
- **Evidence:**
