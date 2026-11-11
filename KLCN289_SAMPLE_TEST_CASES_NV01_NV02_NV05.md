# Test Case mẫu KLCN289 cho NV01, NV02 và NV05

**Baseline source:** dev @ c9dda5d6d6dea2e8733402997d4593e6a07dad18.  
**Đây là thiết kế, chưa thực thi.** Tất cả Actual Result, Bug ID và Evidence để trống; Execution Status = Not Run.

## Quy ước fixture

Dữ liệu dưới đây là fixture tổng hợp đề xuất cho DB test riêng, chưa được tạo. UUID ký hiệu như F-A/F-B là tên fixture để người chuẩn bị test map thành UUID hợp lệ, không phải giá trị DB đang tồn tại. Mỗi test được reset độc lập. Role phải đăng nhập tài khoản riêng được cấp role nêu trong precondition. Không dùng production/demo DB.

## NV01-02 — Lập và sửa phiếu nhập

**Căn cứ:** UML NV01; create/update receipt DTO, controller/service; Web receipt draft validation; Mobile ReceiptDetailScreen và receipt payload. DTO giới hạn quantity dương ở tối đa 15 chữ số nguyên/3 thập phân; ràng buộc ASSET như location/quantity được kiểm tại CONFIRM, không mặc định là điều kiện API tạo DRAFT. Web kiểm location và quantity ASSET sớm trên form. LOT nhận lotId có sẵn hoặc supplierLotNumber cho lô mới. Mã lô nội bộ do server cấp lúc confirm. Scenario này chỉ kiểm lập/sửa draft và hợp đồng client/API; không kiểm hiệu lực cập nhật tồn khi xác nhận (NV01-04), race/idempotency (NV01-05).

### TC-NV01-001 — Tạo nháp QUANTITY hợp lệ

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-001 / NV01-02 |
| Test Case Name | Lưu nháp nhập vật tư theo dõi số lượng |
| Priority / Test Level | P1 / Integration |
| Test Design Technique | EP, State Transition |
| Preconditions | Nhân viên EMPLOYEE có quyền lập receipt trong Farm F-A; kho WH-A active; item MAT-Q thuộc F-A, tracking QUANTITY; chưa có receipt tương ứng |
| Test Steps | 1. Mở tạo phiếu nhập trên Web. 2. Chọn WH-A, ngày 2026-11-07. 3. Thêm MAT-Q quantity 12.500, unitPrice 25000.00, note “kiểm thử”. 4. Lưu nháp. 5. Mở lại chi tiết phiếu. |
| Test Data | F-A; WH-A; MAT-Q; quantity=12.500; unitPrice=25000.00; supplier=S-A; receiptDate=2026-11-07 |
| Expected Result | Phiếu ở DRAFT; có đúng một dòng với quantity/giá/ghi chú đã nhập; mã chính thức chưa được coi là mã xác nhận; balance và inventory ledger không đổi. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-002 — Tạo nháp LOT mới với số lô nhà cung cấp

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-002 / NV01-02 |
| Test Case Name | Lưu dòng LOT mới với ngày sản xuất và hạn dùng hợp lệ |
| Priority / Test Level | P1 / Integration |
| Test Design Technique | EP, State Transition |
| Preconditions | EMPLOYEE có quyền lập phiếu; WH-A active; MAT-L thuộc F-A, tracking LOT; không chọn lô có sẵn |
| Test Steps | 1. Tạo receipt draft. 2. Thêm MAT-L quantity 20, supplierLotNumber BATCH-0425, manufacturedDate 2026-01-15, expiryDate 2027-01-15. 3. Lưu và mở lại. |
| Test Data | MAT-L; quantity=20; supplierLotNumber=BATCH-0425; manufacturedDate=2026-01-15; expiryDate=2027-01-15 |
| Expected Result | Draft lưu đúng supplier lot/date; không yêu cầu mã lô nội bộ ở bước draft; tồn và ledger không đổi. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-003 — Tạo nháp LOT bổ sung vào lô hiện có

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-003 / NV01-02 |
| Test Case Name | Lưu dòng nhập bổ sung bằng lotId cùng Farm và item |
| Priority / Test Level | P1 / Integration |
| Test Design Technique | EP |
| Preconditions | WH-A và item MAT-L active; lot LOT-A thuộc cùng F-A và MAT-L; người dùng được lập receipt |
| Test Steps | 1. Tạo draft. 2. Thêm dòng MAT-L quantity 3.250, lotId=LOT-A. 3. Lưu và mở lại. |
| Test Data | lotId=LOT-A; itemId=MAT-L; quantity=3.250; không gửi supplierLotNumber/manufacturedDate/expiryDate |
| Expected Result | Dòng draft tham chiếu LOT-A; không tạo mã lô mới ở giai đoạn lưu draft; không đổi số tồn/ledger. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-004 — Tạo nháp ASSET đủ mã, serial và vị trí

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-004 / NV01-02 |
| Test Case Name | Lưu dòng tài sản định danh có location trong kho đã chọn |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | EP, Integration |
| Preconditions | EMPLOYEE có quyền; WH-A thuộc F-A active; LOC-A nằm trong WH-A active; item EQ-A tracking ASSET |
| Test Steps | 1. Tạo receipt draft cho WH-A. 2. Thêm EQ-A quantity=1, assetCode=SMK-1001, serialNumber=SN-1001, locationId=LOC-A. 3. Lưu draft. 4. Mở lại dòng. |
| Test Data | EQ-A; quantity=1; assetCode=SMK-1001; serialNumber=SN-1001; locationId=LOC-A |
| Expected Result | Draft giữ nguyên mã/serial/location; trước confirm chưa tạo asset cá thể và chưa tăng tồn; dữ liệu tham chiếu thuộc đúng Farm/kho. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-005 — Từ chối quantity bằng 0

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-005 / NV01-02 |
| Test Case Name | API không lưu draft khi quantity bằng 0 |
| Priority / Test Level | P1 / API |
| Test Design Technique | EP |
| Preconditions | EMPLOYEE có quyền lập receipt; MAT-Q và WH-A hợp lệ |
| Test Steps | 1. Gửi API tạo receipt DRAFT có một dòng MAT-Q quantity=0. 2. Đọc phản hồi và truy vấn fixture DB test để xác nhận request không tạo receipt/dòng. |
| Test Data | F-A; WH-A; MAT-Q/QUANTITY; quantity=0 |
| Expected Result | DTO/API từ chối quantity không dương; không tạo receipt/dòng từ request; balance và ledger không đổi. Đây là kiểm tra API tạo DRAFT, không phải kiểm tra điều kiện CONFIRM. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-006 — Từ chối quantity vượt precision

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-006 / NV01-02 |
| Test Case Name | API không lưu draft khi quantity có hơn ba chữ số thập phân |
| Priority / Test Level | P1 / API |
| Test Design Technique | BVA |
| Preconditions | EMPLOYEE có quyền lập receipt; MAT-Q và WH-A hợp lệ; DB test chưa có receipt của request này |
| Test Steps | 1. Gửi API tạo receipt DRAFT với MAT-Q quantity=1.2345. 2. Đọc phản hồi và truy vấn fixture DB test để xác nhận không tạo receipt/dòng. |
| Test Data | F-A; WH-A; MAT-Q/QUANTITY; quantity=1.2345 (ngay trên giới hạn scale 3 của DTO) |
| Expected Result | API từ chối dữ liệu vượt scale được DTO khai báo; không tạo receipt/dòng; balance và ledger không đổi. Quantity 12.500 ở TC-NV01-001 kiểm tra đầu vào hợp lệ ngay tại precision ba chữ số thập phân. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-007 — Không chấp nhận thuộc tính LOT không tương thích với lotId

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-007 / NV01-02 |
| Test Case Name | Từ chối đồng thời lotId có sẵn và số lô mới |
| Priority / Test Level | P1 / API |
| Test Design Technique | Decision Table, Error Guessing |
| Preconditions | EMPLOYEE có quyền; LOT-A thuộc MAT-L và F-A; fixture chưa có receipt tương ứng |
| Test Steps | 1. Gửi API tạo receipt DRAFT với dòng MAT-L có lotId=LOT-A đồng thời supplierLotNumber=BATCH-NEW và expiryDate=2027-01-15. 2. Đọc response và kiểm tra không tạo phiếu/dòng lỗi trong DB test. |
| Test Data | MAT-L/LOT; lotId=LOT-A; supplierLotNumber=BATCH-NEW; expiryDate=2027-01-15 |
| Expected Result | DTO/service từ chối lotId đi cùng metadata lô mới; không tạo receipt/dòng và không thay đổi tồn. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-008 — Web chặn ASSET thiếu location

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-008 / NV01-02 |
| Test Case Name | Web không gửi lưu draft ASSET khi thiếu location |
| Priority / Test Level | P0 / UI |
| Test Design Technique | EP, Error Guessing |
| Preconditions | EMPLOYEE có quyền lập receipt; EQ-A tracking ASSET; WH-A active; Web form có thể chọn item EQ-A; chưa có draft tương ứng |
| Test Steps | 1. Trên Web, tạo receipt DRAFT cho WH-A. 2. Thêm EQ-A quantity=1 và assetCode=SMK-1002 nhưng để trống location. 3. Bấm lưu và quan sát validation, network request và danh sách draft. |
| Test Data | EQ-A; quantity=1; assetCode=SMK-1002; locationId omitted |
| Expected Result | Web validation hiển thị lỗi location và không gửi request tạo/sửa draft; không phát sinh draft từ lần lưu bị chặn. Đây chỉ kiểm UI sớm: API tạo DRAFT hiện không bắt buộc location; việc bắt buộc ở CONFIRM thuộc NV01-04. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-009 — Web validation từ chối quantity ASSET khác 1

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-009 / NV01-02 |
| Test Case Name | Web validation chặn lưu dòng ASSET có quantity khác 1 |
| Priority / Test Level | P0 / Component validation |
| Test Design Technique | EP, Error Guessing |
| Preconditions | EQ-A tracking ASSET; WH-A/LOC-A hợp lệ; component validation harness có thể cấp form model; không dùng API/DB thật |
| Test Steps | 1. Tạo model hợp lệ cho một dòng ASSET với quantity=1, assetCode=SMK-1002, location=LOC-A. 2. Trong component validation harness, thay quantity thành 2 như một giá trị model bất thường (form giao diện thường cố định quantity=1). 3. Gọi đúng validator được form dùng và theo dõi việc submit. |
| Test Data | EQ-A; quantity=2; assetCode=SMK-1002; LOC-A thuộc WH-A |
| Expected Result | Validator của Web trả lỗi quantity ASSET phải bằng 1 và chặn submit; không phát sinh request. Đây kiểm tra validation ở client model; API DRAFT không được kết luận từ kết quả này; bắt buộc xác thực server khi CONFIRM thuộc NV01-04. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-010 — API từ chối location ngoài kho/Farm

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-010 / NV01-02 |
| Test Case Name | Không lưu tham chiếu location khác Farm/kho của receipt |
| Priority / Test Level | P0 / API |
| Test Design Technique | EP, Integration |
| Preconditions | EMPLOYEE có quyền trong F-A; WH-A thuộc F-A; EQ-A thuộc F-A tracking ASSET; LOC-B thuộc WH-B/F-B; fixture không có receipt tương ứng |
| Test Steps | 1. Gửi API tạo receipt warehouseId=WH-A với EQ-A quantity=1, assetCode=SMK-1010 và locationId=LOC-B. 2. Đọc phản hồi và kiểm tra fixture DB test. |
| Test Data | F-A; WH-A; EQ-A; LOC-B thuộc WH-B/F-B |
| Expected Result | Service từ chối tham chiếu location không hoạt động/không thuộc Farm và kho đã chọn; không tạo receipt/dòng có tham chiếu chéo. Kiểm tra xác minh tham chiếu API DRAFT, không phải validation CONFIRM. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-011 — Web chặn assetCode trùng trong cùng draft

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-011 / NV01-02 |
| Test Case Name | Web không gửi draft có assetCode trùng giữa hai dòng ASSET |
| Priority / Test Level | P1 / UI |
| Test Design Technique | Error Guessing |
| Preconditions | EMPLOYEE có quyền lập receipt; EQ-A tracking ASSET; WH-A và LOC-A active; Web form hỗ trợ hai dòng ASSET trong cùng draft |
| Test Steps | 1. Trên Web, thêm hai dòng EQ-A quantity=1, location=LOC-A. 2. Nhập assetCode=SMK-1003 cho cả hai dòng, mỗi serial khác nhau. 3. Bấm lưu; quan sát validation và request. |
| Test Data | Hai dòng ASSET; assetCode=SMK-1003 lặp; serial=SN-1003A/SN-1003B |
| Expected Result | Web validation báo assetCode bị lặp trong draft và không gửi request. Case này kiểm tra kiểm tra trùng trên UI; không kết luận API draft từ chối assetCode trùng. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-012 — Web chặn serial trùng trong cùng draft

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-012 / NV01-02 |
| Test Case Name | Web không gửi draft có serial trùng giữa hai dòng ASSET |
| Priority / Test Level | P1 / UI |
| Test Design Technique | Error Guessing |
| Preconditions | EMPLOYEE có quyền lập receipt; EQ-A tracking ASSET; WH-A và LOC-A active; Web form hỗ trợ hai dòng ASSET trong cùng draft |
| Test Steps | 1. Trên Web, thêm hai dòng EQ-A quantity=1, location=LOC-A. 2. Dùng assetCode khác nhau SMK-1004/SMK-1005 nhưng cùng serial SN-DUP-01. 3. Bấm lưu; quan sát validation và request. |
| Test Data | assetCode=SMK-1004/SMK-1005; serialNumber=SN-DUP-01 cho cả hai dòng |
| Expected Result | Web validation báo serial bị lặp trong draft và không gửi request. Serial vẫn là field optional theo DTO; test này chỉ kiểm tra khi người lập đã nhập serial. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-013 — Sửa draft trên Web

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-013 / NV01-02 |
| Test Case Name | Web lưu lại nội dung sửa receipt DRAFT qua API update |
| Priority / Test Level | P0 / End-to-end integration |
| Test Design Technique | State Transition, Integration |
| Preconditions | Phiếu R-A thuộc F-A ở DRAFT, có dòng MAT-Q quantity=2; EMPLOYEE có quyền sửa phiếu; không có thao tác đồng thời trên R-A |
| Test Steps | 1. Mở R-A trên Web. 2. Đổi note thành “đã kiểm” và quantity MAT-Q thành 2.500. 3. Lưu, tải lại chi tiết và so sánh payload request cùng dữ liệu đọc lại. 4. Đọc balance/ledger liên quan. |
| Test Data | R-A; MAT-Q quantity 2→2.500; note “đã kiểm” |
| Expected Result | Web gọi luồng update DRAFT hiện hành; lần đọc lại thấy đúng note/quantity; không tạo receipt thứ hai; balance và ledger không đổi. Không kết luận thay đổi trạng thái ngoài DRAFT. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV01-014 — Sửa draft trên Mobile

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV01-014 / NV01-02 |
| Test Case Name | Mobile gửi update và giữ nội dung sửa receipt DRAFT |
| Priority / Test Level | P0 / End-to-end integration |
| Test Design Technique | State Transition, Integration |
| Preconditions | Phiếu R-B thuộc F-A ở DRAFT, có dòng LOT MAT-L; user Mobile có quyền sửa và đã chọn F-A; fixture cho phép sửa note LOT; không có thao tác đồng thời |
| Test Steps | 1. Mở R-B đang DRAFT trên Mobile. 2. Sửa note dòng LOT thành “đã kiểm trên mobile”. 3. Tìm thao tác lưu DRAFT và lưu mà không gửi duyệt. 4. Nếu không có thao tác lưu riêng, ghi Implementation Gap và dừng, không bấm gửi duyệt thay thế. 5. Khi thao tác lưu đã tồn tại, mở lại R-B, so sánh request PATCH với dữ liệu đọc lại; đối chiếu balance/ledger. |
| Test Data | R-B; MAT-L/LOT-A; note mới “đã kiểm trên mobile” |
| Expected Result | Mục tiêu tuân thủ là Mobile gửi PATCH cho R-B DRAFT; lần đọc lại thấy note đã lưu, trạng thái vẫn DRAFT, không tạo receipt thứ hai, balance/ledger không đổi. Trong source hiện tại, màn chi tiết cho sửa DRAFT nhưng không có đường lưu riêng rõ ràng; nhánh submit với params.id bỏ qua PATCH rồi gọi submit. Nếu không tìm thấy thao tác lưu riêng trong UI build đang kiểm thử, ghi Implementation Gap và dừng ca trước khi submit; đây không phải Pass/Fail thực thi. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

**Điểm triển khai/căn cứ NV01-02:** DTO/service cho phép phân biệt validation API tạo/sửa DRAFT với điều kiện bắt buộc khi CONFIRM; không dùng TC-NV01-008/009 để khẳng định API draft từ chối thiếu location hoặc quantity sai. Web form có kiểm tra sớm location, quantity=1, assetCode/serial trùng. Serial optional theo DTO. Role cụ thể map từ guard ở build chạy test. Source Mobile cho sửa chi tiết DRAFT và có lệnh PATCH trong hàm lưu nháp, nhưng đường lưu hàm này không khả dụng rõ ràng với params.id; luồng gửi phiếu hiện tại bỏ qua PATCH trước khi submit. Đây là Implementation Gap cần giữ làm expected target, không phải kết quả Fail đã xác lập. |

## NV02-04 — Điều chuyển QUANTITY/LOT hai đầu

**Căn cứ:** baseline D01 và UML NV02: cùng Farm; nguồn xác nhận xuất giảm tồn và đặt IN_TRANSIT; đích xác nhận thực nhận mới tăng tồn; sai lệch còn chờ xử lý. API DTO nhận receivedQuantity từ 0 tới quantity đã xuất, reason tối đa 1000 ký tự và bắt buộc nếu nhận thiếu. Scenario này không kiểm ASSET (NV02-06).

### TC-NV02-001 — Kho đích đề nghị điều chuyển

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-001 / NV02-04 |
| Test Case Name | Kho đích lập và gửi yêu cầu điều chuyển LOT |
| Priority / Test Level | P1 / Integration |
| Test Design Technique | EP, State Transition |
| Preconditions | Nhân viên kho đích DEST-EMP có quyền lập yêu cầu tại WH-B; WH-A nguồn và WH-B đích active cùng F-A; MAT-L tracking LOT; LOT-A ở WH-A, tồn nguồn 10, tồn đích 2 |
| Test Steps | 1. DEST-EMP tạo yêu cầu WH-A→WH-B, MAT-L/LOT-A quantity 4. 2. Lưu DRAFT rồi gửi yêu cầu duyệt. 3. Đọc chứng từ và tồn của hai kho. |
| Test Data | quantity=4; source on-hand=10; destination on-hand=2 |
| Expected Result | Yêu cầu do vai trò kho đích lập; trạng thái sau submit là PENDING_APPROVAL; trước khi kho nguồn duyệt/xác nhận xuất, tồn nguồn vẫn 10 và đích vẫn 2. Tham chiếu LOT/kho/Farm hợp lệ. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-002 — Dispatch giảm nguồn, chưa tăng đích

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-002 / NV02-04 |
| Test Case Name | Xác nhận xuất chuyển đưa phiếu vào IN_TRANSIT |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | State Transition, Integration |
| Preconditions | T-A đã được DEST-EMP ở WH-B lập và gửi; người SOURCE-MGR có quyền quản lý WH-A nguồn; WH-A có MAT-L/LOT-A=10, WH-B có=2; chưa dispatch |
| Test Steps | 1. SOURCE-MGR mở T-A đang chờ duyệt, xem nguồn/đích, mặt hàng, lô và số lượng. 2. SOURCE-MGR duyệt và xác nhận thực xuất bằng thao tác nguồn hiện có. 3. Đọc chứng từ, balance hai kho và inventory transaction theo transferId. |
| Test Data | transfer quantity=4 |
| Expected Result | Chỉ SOURCE-MGR có thẩm quyền kho nguồn thực hiện quyết định duyệt/xác nhận xuất; sau xác nhận T-A ở IN_TRANSIT, nguồn còn 6, đích vẫn 2, ledger có đúng một xuất nguồn 4 và chưa có nhập đích. Code hiện ánh xạ duyệt cùng xác nhận xuất vào action confirm; nếu UML cần hai hành động tách biệt trên UI thì ghi Implementation Gap, không thêm endpoint giả định. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-003 — Nhận đủ lượng QUANTITY

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-003 / NV02-04 |
| Test Case Name | Kho đích nhận đủ lượng đã xuất |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | State Transition, Integration |
| Preconditions | T-B IN_TRANSIT; MAT-Q/QUANTITY source ban đầu 10, đã giảm 5 khi dispatch nên hiện còn 5; đích tồn 3 |
| Test Steps | 1. Kho đích mở nhận T-B. 2. Nhập receivedQuantity=5 cho dòng. 3. Gửi xác nhận nhận. 4. Đọc trạng thái, hai balance và ledger. |
| Test Data | sent=5; received=5; source before dispatch=10/current=5; destination before=3 |
| Expected Result | Phiếu CONFIRMED; đích tăng đúng 5 thành 8; nguồn không thay đổi thêm; có ledger nhập đích đúng một lần. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

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

### TC-NV02-005 — Bắt buộc lý do nếu nhận thiếu

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-005 / NV02-04 |
| Test Case Name | Từ chối xác nhận nhận thiếu không có discrepancyReason |
| Priority / Test Level | P1 / API |
| Test Design Technique | Decision Table, Error Guessing |
| Preconditions | T-D IN_TRANSIT; line quantity=6; người nhận có quyền |
| Test Steps | 1. Gửi nhận với receivedQuantity=5, bỏ discrepancyReason. 2. Đọc phản hồi, phiếu và balance đích. |
| Test Data | sent=6; received=5; reason omitted |
| Expected Result | DTO/API từ chối nhận thiếu không có reason; T-D vẫn IN_TRANSIT; không phát sinh nhập đích và ledger nhận. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-006 — Nhận 0 và sai lệch toàn bộ

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-006 / NV02-04 |
| Test Case Name | Ghi nhận thất lạc toàn bộ nhưng không đóng phiếu sạch |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | BVA, State Transition |
| Preconditions | T-E IN_TRANSIT, sent=2 LOT; đích tồn ban đầu 1 |
| Test Steps | 1. Nhập receivedQuantity=0 và lý do “Thất lạc toàn bộ”. 2. Gửi nhận. 3. Đọc trạng thái, balance, discrepancy. |
| Test Data | sent=2; received=0; reason non-empty |
| Expected Result | Tồn đích và ledger nhập không tăng; toàn bộ lượng 2/lý do được ghi nhận là sai lệch chưa xử lý; phiếu không được biểu thị hoàn tất. Tên enum trạng thái sai lệch chưa được UML xác định và cần Dev xác định; không tạo giao dịch nhập quantity=0. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-007 — Không cho nhận vượt lượng đã xuất

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-007 / NV02-04 |
| Test Case Name | Chặn receivedQuantity lớn hơn dispatched quantity |
| Priority / Test Level | P0 / API |
| Test Design Technique | BVA |
| Preconditions | T-F IN_TRANSIT; sent=4; kho đích có quyền nhận |
| Test Steps | 1. Gửi receivedQuantity=4.001. 2. Đọc response và xác minh phiếu/tồn không đổi. |
| Test Data | sent=4; received=4.001 |
| Expected Result | API từ chối receivedQuantity=4.001 vì vượt sent=4; không cộng tồn đích và không ghi ledger. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-008 — Hợp đồng chưa phân biệt hàng đạt và hàng không đạt

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-008 / NV02-04 |
| Test Case Name | Lưu sai lệch hàng hỏng và loại khỏi tồn khả dụng |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Decision Table, Integration |
| Preconditions | T-G IN_TRANSIT, sent=5 QUANTITY; policy UML yêu cầu hàng không đạt phải chờ xử lý, không nhập tồn khả dụng |
| Test Steps | 1. Đọc receive DTO/controller và giao diện nhận để xác định có cách ghi riêng số đạt/số hỏng không. 2. Nếu không có trường/lựa chọn phân loại, ghi nhận implementation gap và dừng trước khi gửi payload không được hỗ trợ. 3. Sau khi có hợp đồng được chốt, dựng sent=5 với 4 đạt/1 không đạt bằng field thực tế; đối chiếu tồn và trạng thái sai lệch. |
| Test Data | sent=5; thực nhận vật lý=5, trong đó 4 đạt và 1 không đạt; reason “1 hỏng bao bì”; chỉ dùng trường đã được định nghĩa trong hợp đồng |
| Expected Result | Nếu hợp đồng hiện tại không có cách biểu diễn disposition, ca này chưa thể thực thi và ghi Implementation Gap; không gửi field/API tự đặt. Sau khi có hợp đồng, chỉ 4 hàng đạt được cộng vào tồn khả dụng; 1 hàng hỏng phải được ghi nhận chờ xử lý; chứng từ không biểu thị hoàn tất khi sai lệch còn mở. UML chưa đặt tên enum trạng thái sai lệch; Dev cần chốt tên enum. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-009 — Retry nhận không cộng tồn hai lần

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-009 / NV02-04 |
| Test Case Name | Lặp thao tác receive sau khi xác nhận thành công |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Error Guessing, Idempotency |
| Preconditions | T-H IN_TRANSIT, sent=3; destination balance=0 |
| Test Steps | 1. Xác nhận nhận đủ 3 và ghi response. 2. Gửi lại đúng request receive với cùng transferId. 3. Đọc status/balance/ledger. |
| Test Data | received=3, same transferId and lineId on retry |
| Expected Result | Lần nhận đầu chỉ cộng 3; retry không cộng thêm, không tạo ledger nhận thứ hai; phiếu giữ một trạng thái cuối hợp lệ. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-010 — Hai kho đích đồng thời nhận cùng một transfer

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-010 / NV02-04 |
| Test Case Name | Chỉ một request nhận transfer được áp dụng |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Concurrency |
| Preconditions | T-I IN_TRANSIT, sent=8, destination=0; hai session của người có quyền kho đích |
| Test Steps | 1. Đồng bộ thời điểm gửi hai request receive cùng line/quantity=8. 2. Đợi cả hai response. 3. Đọc transfer, balance, ledger. |
| Test Data | Two requests, same transferId, same lineId, received=8 |
| Expected Result | Một request áp dụng nghiệp vụ nhận; đích tăng đúng 8 và ledger có một lần nhập. Request còn lại chỉ được trả kết quả đã xử lý/idempotent sau khi trạng thái đã cập nhật, không được tạo lần nhập thứ hai; cả hai phản hồi không làm phát sinh tăng tồn kép. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-011 — Từ chối điều chuyển khác Farm

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV02-011 / NV02-05 |
| Test Case Name | Không tạo transfer giữa hai Farm |
| Priority / Test Level | P0 / API |
| Test Design Technique | EP, Role-based Access |
| Preconditions | User có role kho ở F-A; WH-A thuộc F-A; WH-C thuộc F-B; item cùng loại có tồn tại ở F-A |
| Test Steps | 1. Gửi create transfer WH-A→WH-C. 2. Đọc API response và xác minh không tạo transfer hoặc ledger. |
| Test Data | from=WH-A/F-A; to=WH-C/F-B |
| Expected Result | Request bị từ chối theo baseline D01 “cùng Farm”; không đổi balance hai Farm. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

## NV05-03 — Xác nhận đơn, giữ tồn và ngăn dùng trùng lượng giữ

**Căn cứ:** baseline D03/D04. Một đơn dùng một Farm và kho bán đủ toàn giỏ; PENDING chưa giữ; xác nhận nhân viên giữ toàn bộ giỏ nguyên tử; tồn vật lý chỉ giảm khi phiếu xuất được kho xác nhận. Scenario tích hợp này bao trùm cạnh tranh với issue/transfer khác để tránh lặp Scenario chung NV02. Tồn vật lý và khả dụng phải đọc riêng: khả dụng = tồn vật lý trừ lượng giữ theo quy tắc.

### TC-NV05-001 — Đơn PENDING chưa giữ tồn

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-001 / NV05-03 |
| Test Case Name | Tạo đơn khách không làm giảm tồn hoặc tạo phiếu giữ |
| Priority / Test Level | P1 / Integration |
| Test Design Technique | State Transition |
| Preconditions | Customer C-A đăng nhập, không phải membership nhân viên; Farm F-A bán item P-A tại kho WH-S; tồn P-A=10; không có đơn khác |
| Test Steps | 1. Khách đặt 2 P-A. 2. Đọc order, balances, stock issues/transfers. |
| Test Data | P-A quantity=2; on-hand=10 |
| Expected Result | Đơn ở PENDING; tồn vật lý vẫn 10; chưa có reservation/phiếu xuất làm giảm khả dụng theo cơ chế xác nhận; giá/lượng đơn được snapshot. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-002 — Xác nhận đơn giữ đủ giỏ, tồn vật lý chưa giảm

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-002 / NV05-03 |
| Test Case Name | Nhân viên xác nhận đủ giỏ và tạo phiếu giữ |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | State Transition, Integration |
| Preconditions | Order O-A PENDING: P-A qty=2, P-B qty=3; cả hai cùng F-A/WH-S; on-hand lần lượt 10 và 6; employee có store role |
| Test Steps | 1. Nhân viên xác nhận O-A. 2. Đọc order và linked issue. 3. Tính available = on-hand trừ draft/pending allocations. |
| Test Data | P-A 10−2; P-B 6−3 |
| Expected Result | Order status CONFIRMED; có đúng một linked SALE issue giữ 2 và 3; tồn vật lý còn 10/6 cho tới khi kho xác nhận issue; khả dụng còn 8/3. Không giữ thiếu; không tạo reservation lặp. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-003 — Thiếu một dòng thì không giữ một phần giỏ

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-003 / NV05-03 |
| Test Case Name | Không tạo reservation một phần khi một sản phẩm không đủ |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Decision Table |
| Preconditions | O-B PENDING: P-A qty=2 có tồn 5; P-B qty=4 có tồn 3; cùng Farm/kho bán |
| Test Steps | 1. Nhân viên xác nhận O-B. 2. Đọc trạng thái order/issue, balances, available của cả hai dòng. |
| Test Data | P-A on-hand=5, requested=2; P-B on-hand=3, requested=4 |
| Expected Result | Xác nhận O-B không thành công; order vẫn ở PENDING và không có linked issue/reservation cho bất kỳ dòng nào. Không giữ một phần P-A; balance vật lý và ledger không đổi. Không dùng auto-transfer làm expected vì D03 cấm tự tạo bổ sung. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-004 — Hai đơn đồng thời tranh lượng tồn cuối

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-004 / NV05-03 |
| Test Case Name | Chỉ một đơn giữ được lượng hàng cuối cùng |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Concurrency |
| Preconditions | P-C có tồn khả dụng 5; O-C và O-D mỗi đơn P-C qty=5; cả hai PENDING; hai nhân viên session độc lập |
| Test Steps | 1. Đồng bộ gửi confirm O-C và O-D. 2. Thu response. 3. Đọc hai order, allocation/issue và balance. |
| Test Data | on-hand=5; requested total=10 |
| Expected Result | Chính xác một trong hai confirm được chấp nhận giữ 5; confirm còn lại bị từ chối vì không còn đủ khả dụng. Chỉ đơn thắng có linked issue/allocation 5; đơn kia không giữ; available không âm, tổng giữ không vượt 5; ledger vật lý chưa giảm trước xác nhận xuất. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-005 — Issue OTHER không lấy lượng đang giữ cho đơn

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-005 / NV05-03 |
| Test Case Name | Chặn xác nhận phiếu xuất khác nếu chỉ còn lượng đã giữ |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Decision Table, Integration |
| Preconditions | WH-S on-hand P-A=10; O-E đã giữ 10 bằng issue DRAFT/PENDING; user kho có quyền confirm issue OTHER |
| Test Steps | 1. Tạo issue OTHER cho P-A qty=1. 2. Xác nhận issue OTHER. 3. Đọc response, on-hand, held amount và order issue. |
| Test Data | on-hand=10; held(O-E)=10; other issue=1 |
| Expected Result | Issue OTHER bị từ chối vì available=0; O-E reservation giữ nguyên; on-hand/ledger không đổi. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-006 — Transfer khác không lấy lượng đã giữ cho đơn

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-006 / NV05-03 |
| Test Case Name | Chặn dispatch transfer nếu nguồn chỉ còn hàng đã giữ |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Decision Table, Integration |
| Preconditions | WH-S on-hand P-A=10; O-F giữ 10; transfer TX-F draft/pending muốn chuyển P-A qty=1 từ WH-S |
| Test Steps | 1. Duyệt TX-F nếu cần. 2. Gửi confirm/dispatch từ kho nguồn. 3. Đọc transfer, balances, order allocation, ledger. |
| Test Data | held=10; transfer quantity=1 |
| Expected Result | Không dispatch được lượng đã giữ; transfer không vào IN_TRANSIT; nguồn không giảm và đích không tăng; reservation của O-F vẫn nguyên. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-007 — Phiếu xuất của chính đơn tiêu thụ đúng lượng giữ

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-007 / NV05-03 |
| Test Case Name | Kho xuất đơn O-G theo đúng allocation của đơn |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Integration, State Transition |
| Preconditions | WH-S on-hand P-A=9; O-G giữ qty=4; đơn O-H khác giữ qty=1; không có hold khác; linked issue O-G phản ánh allocation 4; approver kho có quyền xác nhận xuất |
| Test Steps | 1. Mở phiếu xuất liên kết O-G. 2. Xác nhận xuất. 3. Đọc order, issue, on-hand, các order khác đang giữ và ledger. |
| Test Data | Trước xuất: on-hand=9; held O-G=4; held O-H=1; available=9−4−1=4; issue O-G xuất 4 |
| Expected Result | Trước xuất available=4. Sau xuất, on-hand=5; hold O-G được giải trừ/thay thế bởi chứng từ issue đã xuất và không tính kép; hold O-H vẫn là 1; available sau xuất=5−1=4. Ledger có đúng một debit 4; tồn không xuống dưới phần còn được giữ cho O-H. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-008 — Hủy đơn PENDING không có reservation

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-008 / NV05-03 |
| Test Case Name | Khách hủy đơn chưa xác nhận mà tồn không đổi |
| Priority / Test Level | P1 / Integration |
| Test Design Technique | State Transition |
| Preconditions | O-H thuộc customer C-A, status PENDING, chưa linked issue, on-hand P-A=7 |
| Test Steps | 1. Khách gửi hủy O-H. 2. Đọc trạng thái đơn và tồn/ledger. |
| Test Data | P-A qty=2; on-hand=7 |
| Expected Result | Đơn vào trạng thái hủy hợp lệ; không có reservation cần giải phóng, on-hand/ledger vẫn giữ nguyên; khả dụng không giảm. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-009 — Hủy đơn đã giữ giải phóng đúng lượng

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-009 / NV05-03 |
| Test Case Name | Hủy hợp lệ trước xuất giải phóng reservation một lần |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | State Transition, Integration |
| Preconditions | O-I status CONFIRMED, chưa xuất; linked SALE issue còn ở trạng thái chưa được kho xác nhận xuất; on-hand=8; O-I giữ 3; order khác giữ 2; actor được phép xử lý hủy đơn |
| Test Steps | 1. Actor hủy O-I theo luồng hiện có. 2. Đọc trạng thái order/issue và tính available trước/sau. 3. Gửi lại cùng yêu cầu hủy một lần. |
| Test Data | on-hand=8; held O-I=3; other held=2 |
| Expected Result | Yêu cầu hủy được chấp nhận; order status CANCELLED và linked issue status CANCELLED; lượng giữ O-I=3 được giải phóng đúng một lần; available tăng từ 3 lên 6, order khác vẫn giữ 2; on-hand và ledger vật lý không đổi. Retry không giải phóng thêm. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-010 — Rollback khi một phần giỏ không thể giữ

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-010 / NV05-03 |
| Test Case Name | Lỗi trong dòng sau không để lại reservation một phần |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Error Guessing, Integration |
| Preconditions | O-J có hai dòng; đủ tồn ban đầu; cấu hình fixture làm dòng thứ hai không còn balance hợp lệ trước confirm trong transaction test; employee hợp lệ |
| Test Steps | 1. Gửi confirm O-J. 2. Buộc lỗi có thể kiểm soát ở xử lý dòng thứ hai bằng fixture/API test harness. 3. Đọc order, issue, balances, ledger. |
| Test Data | P-A qty=2, P-B qty=1; failure injection chỉ trong DB test harness |
| Expected Result | Transaction rollback toàn bộ: không giữ dòng P-A, không tạo issue một phần, order không ở trạng thái đã xác nhận thành công, balances/ledger nguyên trạng. Không áp dụng fault injection vào DB dùng thật. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-011 — Retry xác nhận cùng một đơn

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-011 / NV05-03 |
| Test Case Name | Xác nhận lặp không tạo hai phiếu giữ |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Error Guessing, Idempotency |
| Preconditions | O-K PENDING, đủ tồn, employee có quyền; chưa có stockIssueId |
| Test Steps | 1. Confirm O-K. 2. Gửi lại cùng confirm sau response thành công. 3. Đọc order và số phiếu/dòng allocation. |
| Test Data | P-A qty=3; on-hand=8 |
| Expected Result | Chỉ một linked issue/hold qty=3; on-hand chưa giảm trước kho xuất; available đúng 5 sau khi giữ, không bị trừ reservation lần thứ hai. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV05-012 — Đơn chỉ dùng một kho bán đủ toàn giỏ

| Trường | Nội dung |
|---|---|
| Test Case ID / Scenario ID | TC-NV05-012 / NV05-03 |
| Test Case Name | Không gộp tồn kho nguồn để xác nhận đơn thiếu hàng |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Decision Table, Integration |
| Preconditions | F-A có WH-S là kho bán, WH-I là kho nội bộ; P-A ban đầu WH-S=5, WH-I=10; khách C-A đủ điều kiện checkout; chưa có target order |
| Test Steps | 1. Khách checkout 3 P-A khi WH-S còn 5 và xác minh O-T được tạo PENDING. 2. Sau checkout, khách tạo đơn độc lập O-X cho 3 P-A; nhân viên xác nhận O-X, rồi quản lý kho WH-S xác nhận phiếu SALE issue liên kết để xuất 3; xác minh WH-S còn 2. 3. Nhân viên thử xác nhận O-T. 4. Đọc O-T, issue/transfer liên quan và balance/ledger WH-S cùng WH-I. |
| Test Data | Checkout O-T: WH-S=5, WH-I=10, requested=3; sau đó O-X xuất hợp lệ=3; trước xác nhận O-T: WH-S=2, WH-I=10 |
| Expected Result | O-T chỉ được tạo PENDING ở checkout khi WH-S đủ 5. Sau khi giao dịch O-X làm WH-S còn 2, confirm O-T bị từ chối do thiếu hàng; O-T vẫn PENDING, không tạo issue/reservation/transfer cho O-T, WH-S vẫn 2 và WH-I vẫn 10; ledger không có giao dịch của O-T. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

## Tự kiểm tra phạm vi và chất lượng

| Scenario | TC dự kiến sau cập nhật | TC mẫu thực tế | Kỹ thuật áp dụng | Bao phủ chính | Còn thiếu căn cứ |
|---|---:|---:|---|---|---|
| NV01-02 | 14 | 14 | EP, BVA, State Transition, Decision Table, Error Guessing, Integration | QUANTITY/LOT/ASSET; zero/scale boundary; LOT mới/cũ; Web validation location/quantity/định danh; tham chiếu location chéo scope; update Web/Mobile độc lập | API DRAFT không bắt buộc ASSET location/quantity=1; confirm thuộc NV01-04. Web quantity ASSET cố định 1 nên ca quantity=2 cần component validation harness. Mobile update cần dùng đúng UI/API ở build kiểm thử |
| NV02-04 | 14 | 10 | EP, BVA, State Transition, Decision Table, Error Guessing, Integration, Concurrency | đề nghị từ kho đích; duyệt/dispatch nguồn; nhận đủ/thiếu/0/vượt; retry; đồng thời; ledger một lần; không có ASSET | UML yêu cầu sai lệch còn mở; code audit có thể đóng CONFIRMED. Receive contract chưa biểu diễn riêng hàng đạt/hỏng; enum trạng thái sai lệch chưa được UML đặt tên |
| NV02-05 | 8 | 1 | EP, Role-based Access, Integration | chuyển khác Farm bị từ chối; balance/ledger hai Farm không đổi | Bài kiểm tra chỉ được chuyển từ NV02-04; cần map role/scope theo guard trong fixture |
| NV05-03 | 18 | 12 | State Transition, Decision Table, Integration, Concurrency, Error Guessing | PENDING chưa giữ; giữ đủ/toàn giỏ; thiếu một dòng; hai đơn tranh tồn; issue/transfer ngoài; issue của đơn; hủy/giải giữ; rollback/retry; kho bán thiếu sau checkout | Audit P0-02 nêu khả năng issue/transfer lấy phần giữ; test phải chạy sau sửa. Fault injection/concurrency cần DB test harness riêng |

**Tổng Scenario:** 47. Tổng Test Case dự kiến trong bảng Scenario là **532** sau khi NV01-02 tăng 4 ca vì tách các trường hợp độc lập. TC mẫu có **37 Test Case**: NV01-02=14, NV02-04=10, NV02-05=1 (TC-NV02-011 được chuyển scenario), NV05-03=12. Đếm theo ID duy nhất trong các bảng TC; không lấy số dự kiến làm số thực tế. Tất cả 37 có Actual Result/Bug ID/Evidence trống và Not Run.

## Ghi chú trạng thái triển khai

- Requirement: D01–D04 được lấy từ baseline v1.1; yêu cầu UML mới NV02/03/04 được đối chiếu với HinhVeNghiepVu.docx và audit ngày 06/11. Các expected trong TC dùng quy tắc nghiệp vụ, không sao chép kết quả code đang sai.
- Implementation: audit 06/11 ghi NV01 Mobile sửa draft/location còn delta; NV02 thiếu xử lý discrepancy đúng và có mismatch; NV05 có T06/T07 nhưng P0-02 cross-transaction reservation cần sửa. Đây là trạng thái theo audit SHA c9dda5d, không khẳng định trạng thái sau khi Đạt tiếp tục sửa.
- Execution: chưa chạy 37 TC; không có Pass/Fail được gán.
- Chưa có API/hành vi đủ căn cứ thì TC nêu rõ “không thể kết luận từ DTO hiện tại” hoặc phần còn thiếu ở bảng tự kiểm; không tự tạo field/endpoint.
