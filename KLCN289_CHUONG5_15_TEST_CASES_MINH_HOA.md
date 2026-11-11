# KLCN289 – 15 Test Case minh họa cho Chương 5

## Quy tắc sử dụng

- Đây là 15 ID được chọn trong file 40 ca ưu tiên. Nội dung gốc của từng Test Case được chép nguyên văn từ file nguồn để không làm lệch Preconditions, Steps hoặc Expected Result.
- Chưa có ca nào được thực thi trong tài liệu này. Actual Result, Status, Bug ID và Evidence bên dưới vẫn để trống/Not Run.
- Ghi kết quả chính thức trong [Mẫu ghi nhận thực thi](KLCN289_CHUONG5_TEST_EXECUTION_TEMPLATE.md#execution-log), cùng hàng Test Case ID. Ảnh/log lưu theo hướng dẫn môi trường.
- Nếu nguồn có Design Status pending hoặc ghi chú Implementation Status cũ, giữ nguyên làm dấu vết thiết kế; không hiểu đó là kết quả chạy trên HEAD hiện tại.

## 1. TC-AUTH-001

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:27](KLCN289_TEST_CASES_CONTINUED.md#L27).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Đăng nhập thành công là điểm vào các bước kiểm thử yêu cầu phiên hợp lệ.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 2. TC-NV01-031

Nguồn: [KLCN289_TEST_CASES_NV01_REMAINING.md:332](KLCN289_TEST_CASES_NV01_REMAINING.md#L332).

Platform bổ sung để trình bày: **Web + database test** (diễn ra theo steps gốc; không đổi hợp đồng hay thao tác).

#### TC-NV01-031 — Xác nhận QUANTITY cập nhật đúng một giao dịch

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV01-031 |
| Scenario ID | NV01-04 |
| Test Case Name | Xác nhận nhập QUANTITY tăng số dư và ghi transaction/audit |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | State Transition, Integration |
| Preconditions | R-L ở PENDING_APPROVAL tại WH-A; M-A là WAREHOUSE_MANAGER có quyền xác nhận; MAT-Q baseline on-hand=10.000; receipt line hợp lệ quantity=5.000. |
| Test Steps | 1. Ghi nhận balance và số transaction/audit hiện có của R-L. 2. M-A mở R-L trên Web và xác nhận thực nhập. 3. Đọc lại receipt, balance, transaction theo source và audit log. |
| Test Data | MAT-Q; WH-A; R-L quantity=5.000; on-hand trước=10.000. |
| Expected Result | Phiếu ở trạng thái đã xác nhận; on-hand thành 15.000; có đúng một transaction RECEIPT quantityChange=+5.000, sourceType trỏ phiếu R-L; audit CONFIRM ghi đúng người thao tác; không tạo LOT/ASSET cho dòng QUANTITY. Mã receipt chính thức được cấp theo quy tắc code hiện tại khi confirm. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Có kết quả tồn, giao dịch và audit định lượng, phù hợp trình bày bảng/ảnh.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 3. TC-NV01-049

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:1664](KLCN289_TEST_CASES_CONTINUED.md#L1664).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Phân biệt kiểm nhận hàng lỗi ngoài hệ thống với cập nhật tồn do phần mềm thực hiện sau khi phiếu hợp lệ được xác nhận.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** lưu ảnh/log/API response đã khử dữ liệu nhạy cảm và DB test read-only nếu có; không dùng minh chứng giả.

---

## 4. TC-NV02-004

Nguồn: [KLCN289_SAMPLE_TEST_CASES_NV01_NV02_NV05.md:309](KLCN289_SAMPLE_TEST_CASES_NV01_NV02_NV05.md#L309).

Platform bổ sung để trình bày: **API + database test harness** (diễn ra theo steps gốc; không đổi hợp đồng hay thao tác).

### TC-NV02-004 — Nhận thiếu có lý do, chưa hoàn tất theo UML

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-004 / NV02-04 |
| Test Case Name | Giữ điều chuyển chờ xử lý khi thực nhận ít hơn lượng xuất |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | State Transition, Decision Table |
| Preconditions | T-C IN_TRANSIT; nguồn đã giảm 10; đích chưa tăng; user kho đích có quyền nhận |
| Test Steps | 1. Nhập receivedQuantity=7, discrepancyReason=“Thiếu 3 kiện khi bàn giao”. 2. Gửi xác nhận nhận. 3. Đọc phiếu và balance đích. |
| Test Data | sent=10; received=7; reason nêu trên |
| Expected Result | Đích chỉ ghi nhận thực nhận 7 một lần; nguồn đã giảm 10; phần thiếu 3 và lý do vẫn được lưu mở; chứng từ phải thể hiện rõ còn sai lệch và không được coi là hoàn tất. UML chưa đặt tên enum cho trạng thái sai lệch nên xác minh nhãn trạng thái sau khi Dev chốt triển khai; không chấp nhận status biểu thị đã hoàn tất. Audit 06/11 ghi code đóng CONFIRMED khi nhận thiếu — đây là implementation gap, không phải expected. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### Cập nhật khả năng thực thi tại HEAD

**Đối chiếu source hiện tại:** API điều chuyển ghi `DISCREPANCY` khi nhận thiếu và có bước resolve trong `api/src/modules/warehouses/stock-transfers.service.ts` (receive/resolve). Ghi chú “audit 06/11” trong bản gốc là lịch sử; Expected Result vẫn giữ bất biến chưa hoàn tất, chưa có runtime result.

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Minh họa dispatch/receive hai đầu và xử lý sai lệch có số liệu cụ thể.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 5. TC-NV02-045

Nguồn: [KLCN289_TEST_CASES_NV02_03_NV02_05.md:87](KLCN289_TEST_CASES_NV02_03_NV02_05.md#L87).

Platform bổ sung để trình bày: **API + database test** (diễn ra theo steps gốc; không đổi hợp đồng hay thao tác).

### TC-NV02-045 — ASSET không đạt không được đưa vào tồn khả dụng

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-045 |
| Scenario ID | NV02-03 |
| Test Case Name | Giữ ASSET không đạt ngoài tồn khả dụng khi kho tiếp nhận |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Decision Table, State Transition, Integration |
| Preconditions | ASSET-E đang được giao, bàn giao vật lý về kho; kiểm tra xác định không đạt. Actor là nhân viên kho nhận. Cần hợp đồng được nhóm chốt để biểu diễn tình trạng trước khi chạy. |
| Test Steps | 1. Sau khi có hợp đồng tình trạng, chuẩn bị ASSET-E trong DB test. 2. Thực hiện tiếp nhận bằng thao tác triển khai và chọn không đạt. 3. Đọc asset, assignment, balance khả dụng, ledger, audit. Nếu không có cách ghi nhận không đạt, dừng; không gửi payload tự nghĩ. |
| Test Data | ASSET-E; tình trạng không đạt theo hợp đồng được chốt; tồn khả dụng ban đầu=0.000. |
| Expected Result | Kho ghi nhận thực nhận và tình trạng; ASSET không khả dụng, không được cộng vào tồn khả dụng. Lưu đúng cá thể, actor, thời điểm và vị trí. Tồn vật lý/ledger cho phần không đạt phải theo quy tắc nhóm chốt; không tự chọn cách hạch toán. Không tạo phiếu sửa chữa tại NV02-03. |
| Design Status | IMPLEMENTATION_GAP: `ReturnAssetDto` không có tình trạng; service snapshot luôn đặt `AVAILABLE` và tăng balance 1. Cần chốt xử lý không đạt. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### Cập nhật khả năng thực thi tại HEAD

**Đối chiếu source hiện tại:** ReturnAssetDto hỗ trợ condition GOOD/DAMAGED; AssetsService.returnAsset yêu cầu note cho DAMAGED, đặt lifecycle DAMAGED, tăng tồn vật lý thêm một đơn vị và ghi RETURN_IN/audit (api/src/modules/assets/assets.service.ts:73,235,244,253). Khi chạy phải kiểm tra riêng tài sản không thể cấp phát/bán; không nhầm tồn vật lý +1 với tồn khả dụng. Ghi chú IMPLEMENTATION_GAP trong Test Case gốc phản ánh snapshot cũ. Đường xử lý này đã được xác minh tĩnh tại HEAD nhưng chưa chạy DB Integration; dùng hợp đồng DTO hiện tại, không gửi payload tự nghĩ.

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Kiểm tra ASSET trả DAMAGED được ghi nhận nhưng không chuyển sang khả dụng/cấp phát.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 6. TC-NV03-002

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:259](KLCN289_TEST_CASES_CONTINUED.md#L259).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Minh họa kiểm soát snapshot khi tồn đổi sau lúc lập kiểm kê.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 7. TC-NV04-006

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:487](KLCN289_TEST_CASES_CONTINUED.md#L487).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Bao quát nhận lại đúng ASSET và quyết định cuối; không diễn giải điều phối phải chờ phê duyệt để lên lịch.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 8. TC-NV04-011

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:1680](KLCN289_TEST_CASES_CONTINUED.md#L1680).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Thể hiện quyết định không yêu cầu duyệt lịch trước và ranh giới giữa điều phối với quyền xuất/nhận, quyết định cuối.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** lưu ảnh/log/API response đã khử dữ liệu nhạy cảm và DB test read-only nếu có; không dùng minh chứng giả.

## 9. TC-XFLOW-007

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:1571](KLCN289_TEST_CASES_CONTINUED.md#L1571).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Là ví dụ luồng liên nghiệp vụ lớn nhất: tạo đơn, giữ, thanh toán, xuất và giao.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 10. TC-NV06-004

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:863](KLCN289_TEST_CASES_CONTINUED.md#L863).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Minh họa truy xuất bảo hành theo đúng ASSET/serial đã bán.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 11. TC-NV08-008

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:1175](KLCN289_TEST_CASES_CONTINUED.md#L1175).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Minh họa bảo vệ quyền quản trị Farm cuối cùng.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 12. TC-NV09-004

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:1243](KLCN289_TEST_CASES_CONTINUED.md#L1243).

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

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Thể hiện rõ hàng chưa có giá không bị hiểu là trị giá 0 hoặc tổng đầy đủ.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 13. TC-NV10-007

Nguồn: [KLCN289_TEST_CASES_CONTINUED.md:1439](KLCN289_TEST_CASES_CONTINUED.md#L1439).

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

### Cập nhật khả năng thực thi tại HEAD

**Phạm vi quyền:** ca gốc dùng ADMIN có membership phù hợp để thử cập nhật phí. Không suy rộng kết quả sang ADMIN không có membership Farm; nhánh đó còn pending quyết định và không thuộc Expected Result của lần chạy này.

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Minh họa quyền ADMIN, audit biểu phí và bất biến phí snapshot đơn hàng.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 14. UIUX-WEB-023

Nguồn: [KLCN289_UI_UX_TEST_CASES.md:219](KLCN289_UI_UX_TEST_CASES.md#L219).

### UIUX-WEB-023 — Màn hình bảo trì phân tách điều phối, kho và quyết định cuối

- **Màn hình / Platform:** `/maintenance`, maintenance record cards/actions.
- **Priority:** P0
- **Preconditions:** Record đã schedule, đang sửa, returned PASSED/FAILED và chờ final decision.
- **Các bước:** 1. Mở record theo từng role. 2. Kiểm tra timeline, đối tác, chi phí, ngày, return receipt. 3. Thử action theo role. 4. Hủy dialog.
- **Expected Result:** Người thực hiện từng bước được thể hiện; hoàn thành sửa không bị nhầm với kho đã nhận; FAILED không hiển thị như khả dụng; giá trị chi phí/nhãn không bị cắt.
- **Execution Status:** Not Run

- **Actual Result:**
- **Bug ID:**
- **Evidence:**

### Trường bổ sung cho bản trình bày Chương 5

- **Test Case ID / Scenario:** UIUX-WEB-023 / UI-UX (file nguồn không gán Scenario nghiệp vụ).
- **Test Level / Platform:** UI/UX thủ công / Web.
- **Test Design Technique:** File nguồn không chỉ định kỹ thuật riêng; quan sát trạng thái/action theo đúng các bước ghi trên.
- **Test Data:** Các record giả lập ở trạng thái đã lên lịch, đang sửa và đã trả PASSED hoặc FAILED nhưng đang chờ quyết định cuối.
### Cập nhật khả năng thực thi tại HEAD

**Lưu ý nghiệp vụ:** người điều phối được chủ động tạo lịch bảo trì theo quyết định mới của nhóm; ca UI này chỉ xem cách thể hiện actor/timeline/trạng thái, không dùng để áp đặt bước phê duyệt trước khi lập lịch.

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Cho thấy cách kiểm tra trực quan các vai trò, timeline và quyết định bảo trì trên Web.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

---

## 15. UIUX-MOB-009

Nguồn: [KLCN289_UI_UX_TEST_CASES.md:411](KLCN289_UI_UX_TEST_CASES.md#L411).

### UIUX-MOB-009 — Phiếu chuyển báo đúng DISCREPANCY, không báo đã kết thúc

- **Màn hình / Platform:** `/transfers/[id]`, `TransferNotificationDetailScreen`.
- **Priority:** P0
- **Preconditions:** Phiếu đã dispatch 10, nhận 8, status đang chờ xử lý chênh lệch.
- **Các bước:** 1. Mở thông báo/phiếu. 2. Kiểm badge, lượng dispatch/receive, discrepancy, reason và source/destination. 3. Mở phiếu sau resolve.
- **Expected Result:** DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.
- **Execution Status:** Not Run
- **Implementation Status:** Gap đã biết tại source HEAD: nhãn/badge/default message chưa xử lý DISCREPANCY đúng.

- **Actual Result:**
- **Bug ID:**
- **Evidence:**

### Trường bổ sung cho bản trình bày Chương 5

- **Test Case ID / Scenario:** UIUX-MOB-009 / UI-UX (file nguồn không gán Scenario nghiệp vụ).
- **Test Level / Platform:** UI/UX thủ công / Mobile.
- **Test Design Technique:** File nguồn không chỉ định kỹ thuật riêng; quan sát nhãn, thông điệp và số lượng theo các bước.
- **Test Data:** Phiếu điều chuyển đã dispatch 10, kho đích nhận 8, trạng thái DISCREPANCY và lý do chênh lệch có sẵn trong fixture.
### Cập nhật khả năng thực thi tại HEAD

**Đối chiếu source hiện tại:** `mobile/src/features/inventory/api.ts` chưa ánh xạ nhãn DISCREPANCY; `TransferNotificationDetailScreen.tsx` có thông báo fallback “Phiếu đã kết thúc; tồn kho không thay đổi.” Ca này có thể thực thi để ghi nhận giao diện, nhưng vẫn Not Run cho tới khi Tester quan sát thực tế.

### Ghi nhận khi thực thi

- **Mục đích minh họa:** Minh họa trạng thái DISCREPANCY trên Mobile, một trường hợp cần ảnh màn hình rõ ràng.
- **Actual Result:** ghi ở cột Actual Result của dòng ID này trong file mẫu thực thi.
- **Pass/Fail/Blocked/Not Run:** ghi ở cột Status; giữ lịch sử mỗi lần chạy.
- **Evidence:** ghi đường dẫn ảnh/log/API response đã khử dữ liệu nhạy cảm trong cột Evidence.

---

## Lưu ý khi chèn vào khóa luận

Chỉ đưa bảng/ảnh kết quả sau khi có lần chạy thực tế. Không dùng Expected Result làm Actual Result; không đưa trạng thái Not Run thành Pass. Với các ca cần PostgreSQL/concurrency, lưu kèm SHA, cấu hình DB test cô lập và log truy vấn đã loại bỏ dữ liệu nhạy cảm.
