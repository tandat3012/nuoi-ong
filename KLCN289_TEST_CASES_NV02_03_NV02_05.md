# KLCN289 – Test Case chi tiết NV02-03 và NV02-05

**Snapshot khảo sát:** `dev@c9dda5d6d6dea2e8733402997d4593e6a07dad18`. Đây là test design, không phải kết quả chạy; source có thể đã được Đạt sửa sau snapshot.

**Căn cứ:** `HinhVeNghiepVu.docx` (UML NV02, luồng hoàn trả/điều chuyển); baseline Dev/UML v1.1 mục 3.1–3.3; Scenario đã chốt. Hoàn trả chỉ khôi phục khả dụng sau khi kho thực nhận và xác nhận đạt. Điều chuyển: kho nguồn dispatch, kho đích receive.

**Fixture:** `F-A`, `WH-A/B/C`, `LOC-A/B/C/D`, `ASSET-A…H`, `MAT-A/Q/L`, `T-A…` là bí danh tạo mới trong DB test; không phải dữ liệu có sẵn. UUID do harness cấp. Mọi TC mới `Not Run`; Actual Result, Bug ID, Evidence để trống.

## NV02-03 — Hoàn trả theo dòng/cá thể, kiểm đạt-không đạt, khả dụng và tồn

### TC-NV02-041 — Nhận trả ASSET đủ điều kiện và cập nhật đúng cá thể, kho, assignment, tồn

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-041 |
| Scenario ID | NV02-03 |
| Test Case Name | Kho nhận lại ASSET đang được giao và khôi phục khả dụng một lần |
| Priority / Test Level | P0 / API Integration |
| Test Design Technique | State Transition, Integration |
| Preconditions | F-A có WH-A/LOC-A và WH-B/LOC-B ACTIVE. ASSET-A thuộc MAT-A, `IN_USE` tại WH-A/LOC-A, serial `SER-A`, assignment ACTIVE. Actor có quyền quản lý kho và scope kho trả. Balance MAT-A tại WH-B=2.000, chưa có giao dịch return của ASSET-A. Kho đã kiểm tra đạt và thực nhận tại WH-B/LOC-B. |
| Test Steps | 1. Ghi snapshot chỉ đọc asset, assignment, balance, ledger, audit. 2. Qua Web hoặc API hiện có, trả ASSET-A về WH-B/LOC-B, note `Kiểm tra đạt`. 3. Đọc lại các dữ liệu trên qua API/DB test chỉ đọc. |
| Test Data | ASSET-A/SER-A; MAT-A tracking ASSET; WH-B/LOC-B; on-hand trước 2.000; một cá thể. |
| Expected Result | Trả thành công; giữ nguyên asset ID/assetCode/serial; location chuyển LOC-B; assignment hoạt động được đóng; status hiện có phản ánh khả dụng. Balance WH-B tăng 2.000→3.000 đúng 1; có một `RETURN_IN` gắn đúng ASSET-A/kho và audit đúng actor. Không tạo asset mới. |
| Design Status | Có hợp đồng API/UI tại snapshot; cần đối chiếu lại build Đạt trước khi chạy. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-042 — Không nhận trả ASSET không có assignment đang hoạt động

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-042 |
| Scenario ID | NV02-03 |
| Test Case Name | Từ chối trả ASSET đang AVAILABLE, không được cấp phát |
| Priority / Test Level | P1 / API Integration |
| Test Design Technique | EP, State Transition, Error Guessing |
| Preconditions | ASSET-B thuộc F-A, status `AVAILABLE`, không có assignment ACTIVE; MAT-A balance WH-A=1.000; chưa có ledger return. Actor quản lý kho trong scope WH-A. |
| Test Steps | 1. Chụp snapshot asset, assignment, balance, ledger, audit. 2. Gửi yêu cầu trả ASSET-B tại WH-A/LOC-A qua thao tác hiện có. 3. Đọc lại dữ liệu. |
| Test Data | ASSET-B `AVAILABLE`; active assignment=0; balance=1.000. |
| Expected Result | Yêu cầu bị từ chối theo hợp đồng hiện có; status/assignment giữ nguyên; balance=1.000; không có `RETURN_IN` hay audit trả thành công. |
| Design Status | Có căn cứ từ state condition service snapshot; khi chạy ghi nhận response thực tế, không suy trước HTTP code. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-043 — Từ chối vị trí nhận sai kho hoặc không hoạt động

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-043 |
| Scenario ID | NV02-03 |
| Test Case Name | Chỉ nhận ASSET tại vị trí ACTIVE thuộc kho nhận |
| Priority / Test Level | P1 / API Integration |
| Test Design Technique | Decision Table, Integration, Error Guessing |
| Preconditions | ASSET-C `IN_USE`; actor quản lý kho có quyền tại WH-A và WH-B. WH-B ACTIVE. Chuẩn bị fixture độc lập: LOC-C thuộc WH-C; LOC-D thuộc WH-B nhưng INACTIVE. Balance MAT-A ở WH-B=0.000. |
| Test Steps | 1. Chụp baseline. 2. Gửi yêu cầu trả lần lượt với WH-B/LOC-C và WH-B/LOC-D trên hai fixture độc lập. 3. Đọc asset/location, assignment, balance, ledger, audit. |
| Test Data | WH-B nhận; LOC-C sai kho; LOC-D cùng kho nhưng INACTIVE; balance đầu=0.000. |
| Expected Result | Cả hai yêu cầu bị từ chối; asset, assignment giữ nguyên; balance vẫn 0; không có `RETURN_IN` hoặc audit trả thành công. |
| Design Status | DTO/service snapshot yêu cầu kho/vị trí ACTIVE, cùng Farm, vị trí thuộc đúng kho. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-044 — Không trả ASSET còn bản ghi bảo trì hoạt động

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-044 |
| Scenario ID | NV02-03 |
| Test Case Name | Từ chối trả khi ASSET còn bảo trì hoạt động |
| Priority / Test Level | P1 / API Integration |
| Test Design Technique | Decision Table, State Transition, Integration |
| Preconditions | ASSET-D `IN_USE` ở WH-A/LOC-A, có maintenance record thỏa điều kiện active theo state machine. Actor quản lý kho có quyền; balance MAT-A=0.000. |
| Test Steps | 1. Chụp baseline maintenance, asset, assignment, balance, ledger, audit. 2. Gửi yêu cầu trả qua hợp đồng hiện có. 3. Đọc lại dữ liệu. |
| Test Data | ASSET-D `IN_USE`; maintenance record active; balance=0.000. Không tự đặt tên trạng thái maintenance. |
| Expected Result | Không hoàn tất trả; không đóng assignment, đổi status/location hoặc tăng balance; không có ledger/audit trả thành công. Xử lý bảo trì thuộc NV04. |
| Design Status | Có căn cứ từ `AssetsService.returnAsset` tại snapshot; dựng maintenance bằng fixture DB test. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

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

### TC-NV02-046 — Hoàn trả QUANTITY theo lượng thực nhận

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-046 |
| Scenario ID | NV02-03 |
| Test Case Name | Chỉ khôi phục lượng QUANTITY kho thực nhận và chấp nhận |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | EP, Decision Table, Integration |
| Preconditions | Phiếu xuất MAT-Q tại WH-A đã xác nhận lượng 5.000; chưa hoàn; balance sau xuất=5.000. Người dùng yêu cầu trả 5.000; kho nhận 4.000 đạt và 1.000 không đạt. Cần API/UI hoàn QUANTITY được nhóm xác nhận. |
| Test Steps | 1. Chụp chứng từ xuất, balance, ledger. 2. Tạo yêu cầu hoàn theo hợp đồng sau khi có. 3. Trước xác nhận kho, kiểm balance không đổi. 4. Ghi nhận thực nhận 4.000 đạt/1.000 không đạt và xác nhận theo luồng được duyệt. 5. Đọc chứng từ, balance, ledger, audit. Nếu chưa có hợp đồng, dừng trước bước 2. |
| Test Data | MAT-Q; xuất 5.000; trả yêu cầu 5.000; đạt 4.000; không đạt 1.000; balance trước nhận=5.000. |
| Expected Result | Trước xác nhận, balance không tăng. Sau xác nhận, khả dụng = 5.000+4.000=9.000; không cộng 1.000 không đạt vào khả dụng. Chứng từ/ledger đúng phiếu xuất và lượng thực nhận. Hạch toán tồn vật lý phần không đạt cần nhóm chốt. |
| Design Status | IMPLEMENTATION_GAP: snapshot không có API/chứng từ hoàn QUANTITY hoặc payload cập nhật tồn. Không thể thực thi trước khi Dev triển khai hợp đồng. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-047 — Hoàn trả LOT giữ nguyên lô và lượng được chấp nhận

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-047 |
| Scenario ID | NV02-03 |
| Test Case Name | Không chuyển hàng LOT trả về sang lô khác hoặc cộng trước xác nhận |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Decision Table, Integration |
| Preconditions | Phiếu xuất MAT-L/LOT-A đã xác nhận lượng 6.000; balance LOT-A sau xuất=2.000; LOT-B cùng mặt hàng balance=9.000. Trả thực tế 5.000 gồm 4.000 đạt, 1.000 không đạt. Cần hợp đồng hoàn LOT được chốt. |
| Test Steps | 1. Chụp hai balance lô, phiếu xuất, ledger. 2. Tạo yêu cầu hoàn LOT-A theo hợp đồng. 3. Xác minh chưa tăng tồn trước khi kho xác nhận. 4. Ghi nhận lượng đạt và xác nhận. 5. Đọc lại hai lô, chứng từ, ledger, audit. Nếu chưa có contract, dừng trước bước 2. |
| Test Data | LOT-A: xuất 6.000, balance 2.000; LOT-B balance 9.000; trả 5.000, đạt 4.000, không đạt 1.000. |
| Expected Result | Trước xác nhận không tăng tồn. Sau xác nhận LOT-A=2.000+4.000=6.000; LOT-B vẫn 9.000. Không cộng toàn bộ 5.000 vào khả dụng, không đổi định danh lô. Hạch toán vật lý phần không đạt chờ nhóm chốt. |
| Design Status | IMPLEMENTATION_GAP: snapshot không có luồng hoàn QUANTITY/LOT, DTO không có lot/quantity/condition/original issue reference. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-048 — Retry trả ASSET không ghi tồn hoặc ledger lần hai

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-048 |
| Scenario ID | NV02-03 |
| Test Case Name | Retry cùng cá thể không tạo biến động trả lặp |
| Priority / Test Level | P0 / API Integration |
| Test Design Technique | Error Guessing, State Transition, Integration |
| Preconditions | ASSET-F `IN_USE` tại WH-A, assignment ACTIVE; WH-A/LOC-A ACTIVE; balance MAT-A=3.000; chưa có ledger trả. Actor có quyền và scope. DB test riêng. |
| Test Steps | 1. Gửi yêu cầu trả ASSET-F một lần. 2. Gửi lại cùng yêu cầu như client retry. 3. Đọc status, assignment, balance, ledger, audit. |
| Test Data | ASSET-F; on-hand trước=3.000; hai request cùng asset ID. |
| Expected Result | Lần đầu tăng đúng một: 3.000→4.000, một `RETURN_IN`. Retry không tăng thêm, không ghi ledger/audit trả thành công thứ hai. Retry có thể bị từ chối trạng thái theo hợp đồng; dữ liệu sau retry phải giữ nguyên. |
| Design Status | Hợp đồng hiện hữu. `api/test/assets.integration.e2e-spec.ts` có test duplicate return tương tự; liên kết automation sau khi chạy suite. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-049 — Hai request đồng thời trả cùng cá thể chỉ hạch toán một lần

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-049 |
| Scenario ID | NV02-03 |
| Test Case Name | Ngăn hai giao dịch đồng thời trả một ASSET hai lần |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Concurrency, Integration |
| Preconditions | ASSET-G `IN_USE`, assignment ACTIVE, WH-A/LOC-A ACTIVE; balance MAT-A=0.000; chưa có ledger trả. DB test có runner gửi đồng thời. |
| Test Steps | 1. Harness gửi đồng thời hai request trả ASSET-G về WH-A/LOC-A. 2. Chờ hai transaction hoàn tất. 3. Truy vấn asset, assignment, balance, ledger, audit. |
| Test Data | Cùng asset ID cho 2 request; on-hand trước=0.000. |
| Expected Result | Tối đa một lần trả thành công; balance cuối=1.000, không phải 2.000; một `RETURN_IN`, một lần đóng assignment và một audit trả. Request còn lại bị từ chối/xung đột theo hợp đồng, không để dữ liệu dở dang. |
| Design Status | Cần DB test harness. Snapshot có concurrency trên hai asset khác nhau và issue-vs-return, chưa phải cùng một asset với hai request return. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-050 — Rollback toàn bộ trả ASSET nếu ghi ledger thất bại

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-050 |
| Scenario ID | NV02-03 |
| Test Case Name | Không cập nhật một phần asset, assignment hoặc balance khi insert ledger lỗi |
| Priority / Test Level | P0 / Integration |
| Test Design Technique | Error Guessing, Integration, Transaction |
| Preconditions | ASSET-H `IN_USE` tại WH-A/LOC-A, assignment ACTIVE; balance tại WH-B chưa có dòng; WH-B/LOC-B ACTIVE; actor có scope nguồn và quyền kho nhận. DB test hỗ trợ fault injection insert ledger. |
| Test Steps | 1. Chụp snapshot asset, assignment, balance, ledger, audit. 2. Cài hook/trigger chỉ trong DB test để làm lỗi insert `ASSET_RETURN` của ASSET-H. 3. Gửi yêu cầu trả tới WH-B/LOC-B. 4. Gỡ hook và đọc lại toàn bộ dữ liệu. |
| Test Data | ASSET-H; destination balance chưa có row; inject lỗi tại insert inventory transaction. |
| Expected Result | Transaction trả thất bại; asset giữ status/location cũ; assignment vẫn ACTIVE; balance không được tạo hoặc giữ nguyên giá trị cũ; không có `RETURN_IN`/audit trả thành công. Không để trạng thái dở dang. |
| Design Status | Cần DB test/fault injection. Snapshot `api/test/assets.integration.e2e-spec.ts` có rollback test tương tự khi insert ledger lỗi. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

## NV02-05 — Quyền và phạm vi Farm/kho nguồn/đích khi lập, dispatch, nhận điều chuyển

### TC-NV02-051 — Quản lý kho đích lập đề nghị từ kho nguồn cùng Farm

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-051 |
| Scenario ID | NV02-05 |
| Test Case Name | Cho phép kho đích tạo đề nghị nhận từ kho nguồn cùng Farm |
| Priority / Test Level | P1 / API Integration |
| Test Design Technique | Role-based Access, Integration |
| Preconditions | F-A có WH-A (nguồn), WH-B (đích), cùng ACTIVE. M-A là WAREHOUSE_MANAGER được phân công WH-B nhưng không WH-A. MAT-Q thuộc F-A; balance WH-A=7.000. Actor có quyền tạo chứng từ kho theo role. |
| Test Steps | 1. Gọi API tạo transfer hiện có bằng M-A với WH-A→WH-B, MAT-Q=2.000. 2. Đọc transfer và hai balance/ledger. |
| Test Data | F-A; source WH-A; destination WH-B; quantity=2.000; source on-hand=7.000. |
| Expected Result | Đề nghị tạo với đúng hai warehouse cùng Farm, trạng thái nháp/đề nghị theo enum hiện hành. Tạo không làm đổi balance và không tạo transaction dispatch. Quyền lập không đồng nghĩa M-A có quyền xác nhận xuất tại WH-A. |
| Design Status | UML quy định kho đích đề nghị; service snapshot cho phép tạo nếu actor thuộc ít nhất một đầu kho và kiểm tra cùng Farm. UML mô tả kho đích lập; source chưa ràng buộc actor là thành viên kho đích. Recheck build và xác nhận có cấm nguồn tạo thay đích không. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-052 — Chỉ quản lý trong scope nguồn xác nhận dispatch

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-052 |
| Scenario ID | NV02-05 |
| Test Case Name | Quản lý nguồn xác nhận thực xuất với quyền tại kho nguồn |
| Priority / Test Level | P0 / API Integration |
| Test Design Technique | Role-based Access, Integration |
| Preconditions | T-A hợp lệ F-A, WH-A→WH-B, chờ xử lý; MAT-Q=2.000; balance WH-A=5.000. M-S là WAREHOUSE_MANAGER được gán WH-A; lưu baseline tồn/ledger. |
| Test Steps | 1. Đăng nhập API bằng M-S. 2. Gọi thao tác confirm/dispatch hiện có trên T-A. 3. Đọc trạng thái, balance hai kho, ledger. |
| Test Data | M-S scope WH-A; quantity=2.000; on-hand nguồn=5.000. |
| Expected Result | Backend cho phép actor có role và scope nguồn dispatch. Theo NV02-04, nguồn giảm 5.000→3.000, đích chưa tăng; chứng từ ghi actor/thời điểm nguồn và trạng thái đang điều chuyển theo enum hiện tại. Ca này chỉ xác nhận quyền nguồn, không thay nhánh số lượng NV02-04. |
| Design Status | Service snapshot confirm kiểm scope kho nguồn; phải đối chiếu lại build mới trước chạy. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-053 — Chỉ quản lý trong scope đích xác nhận receive

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-053 |
| Scenario ID | NV02-05 |
| Test Case Name | Quản lý đích xác nhận nhận với quyền tại kho đích |
| Priority / Test Level | P0 / API Integration |
| Test Design Technique | Role-based Access, Integration |
| Preconditions | T-A đã dispatch WH-A→WH-B, đang chờ nhận; MAT-Q gửi=2.000, balance đích=1.000. M-D là WAREHOUSE_MANAGER thuộc WH-B, không thuộc WH-A. |
| Test Steps | 1. Đăng nhập API bằng M-D. 2. Gọi receive trên T-A bằng route hiện có. 3. Đọc transfer, actor nhận, balance và ledger hai kho. |
| Test Data | M-D scope WH-B; T-A đang chờ receive; lượng=2.000; balance đích trước=1.000. |
| Expected Result | Backend cho phép actor thuộc scope đích xác nhận nhận; transfer hoàn tất theo enum hiện hành; balance đích tăng lượng được nhận theo NV02-04; actor/thời điểm là M-D. Không giảm tồn nguồn lần nữa. Ca này chỉ xác nhận quyền tại đầu đích. |
| Design Status | Service snapshot receive kiểm scope kho đích; recheck build sau thay đổi Đạt. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-054 — Kho nguồn không xác nhận receive thay kho đích

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-054 |
| Scenario ID | NV02-05 |
| Test Case Name | Từ chối quản lý nguồn nhận transfer thay kho đích |
| Priority / Test Level | P0 / API Integration |
| Test Design Technique | Role-based Access, Error Guessing |
| Preconditions | T-A `IN_TRANSIT` từ WH-A đến WH-B; M-S quản lý kho chỉ được phân công WH-A. Lưu baseline transfer, balance đích, ledger/audit. |
| Test Steps | 1. Gọi API receive hiện có bằng token M-S cho T-A. 2. Đọc transfer, balance, ledger, audit. |
| Test Data | M-S scope WH-A; destination=WH-B; status IN_TRANSIT. |
| Expected Result | Backend từ chối vì actor không có scope WH-B; transfer chờ nhận; balance đích/ledger/audit không đổi. Phải gọi API trực tiếp, không chỉ xác minh nút bị ẩn. |
| Design Status | `StockTransfersService.receive` snapshot kiểm scope `toWarehouseId`. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-055 — Kho đích không xác nhận dispatch thay kho nguồn

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-055 |
| Scenario ID | NV02-05 |
| Test Case Name | Từ chối quản lý đích dispatch transfer thay kho nguồn |
| Priority / Test Level | P0 / API Integration |
| Test Design Technique | Role-based Access, Error Guessing |
| Preconditions | T-A chờ dispatch WH-A→WH-B; M-D quản lý kho chỉ thuộc WH-B; balance WH-A=5.000. |
| Test Steps | 1. Gọi API confirm/dispatch hiện có bằng M-D cho T-A. 2. Đọc transfer, balance hai kho, ledger, audit. |
| Test Data | M-D scope WH-B; source WH-A; quantity=2.000; balance nguồn=5.000. |
| Expected Result | Backend từ chối vì actor không có scope WH-A; transfer chưa dispatch; balance nguồn vẫn 5.000, đích không đổi; không có ledger dispatch/audit xác nhận nguồn. |
| Design Status | `StockTransfersService.confirm` snapshot kiểm scope `fromWarehouseId`. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-056 — Người ngoài scope hai đầu không đọc hoặc thao tác transfer

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-056 |
| Scenario ID | NV02-05 |
| Test Case Name | Cô lập transfer khỏi người quản lý kho thứ ba trong cùng Farm |
| Priority / Test Level | P0 / API Integration |
| Test Design Technique | Role-based Access, Error Guessing |
| Preconditions | F-A có WH-A/B/C; T-A thuộc WH-A→WH-B. M-C là WAREHOUSE_MANAGER chỉ thuộc WH-C. Snapshot T-A, tồn và audit đã lưu. |
| Test Steps | 1. Bằng token M-C gọi API chi tiết T-A. 2. Thử confirm hoặc receive qua API hiện có. 3. Đọc lại T-A, tồn, ledger/audit bằng actor được phép. |
| Test Data | M-C scope={WH-C}; T-A source=WH-A, destination=WH-B. |
| Expected Result | M-C không đọc được dữ liệu T-A và không thể confirm/receive; transfer, tồn, ledger/audit không đổi. HTTP 403 hay 404 theo hợp đồng, bất biến là không lộ dữ liệu và không sửa được chứng từ. |
| Design Status | `get`/`list` và thao tác nguồn/đích có lọc scope tại snapshot; đây là ranh giới transfer, không lặp AUTH-04 chung. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-057 — Thành viên nhiều kho vẫn bị giới hạn theo kho của từng thao tác

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-057 |
| Scenario ID | NV02-05 |
| Test Case Name | Cho phép thao tác ở các kho được gán nhưng chặn kho thứ ba |
| Priority / Test Level | P1 / API Integration |
| Test Design Technique | Decision Table, Role-based Access |
| Preconditions | M-AB là WAREHOUSE_MANAGER thuộc WH-A và WH-B, không thuộc WH-C. Fixture T-AB (A→B) chờ dispatch/receive theo từng lượt; T-CB (C→B) chờ dispatch. |
| Test Steps | 1. M-AB confirm T-AB ở đầu nguồn WH-A. 2. Tạo fixture T-AB đang chờ nhận; M-AB receive tại WH-B. 3. Dùng M-AB thử confirm T-CB tại đầu nguồn WH-C. 4. Đọc scope/chứng từ/balance/ledger mỗi lần. |
| Test Data | Scope={WH-A, WH-B}; transfer A→B và C→B tách biệt; C không thuộc scope. |
| Expected Result | M-AB được phép thực hiện các thao tác tại A/B tương ứng với trạng thái; bị từ chối thao tác cần scope C. Backend kiểm tra đúng source cho dispatch và destination cho receive. |
| Design Status | `warehouseScope` snapshot tạo tập nhiều warehouse; cần fixture DB với nhiều assignment. Không kiểm ma trận role tổng quát. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

### TC-NV02-058 — Quản lý đích tra cứu tồn nguồn cùng Farm theo UML

| Trường | Nội dung |
|---|---|
| Test Case ID | TC-NV02-058 |
| Scenario ID | NV02-05 |
| Test Case Name | Tra cứu tồn nguồn phục vụ đề nghị không cấp quyền dispatch nguồn |
| Priority / Test Level | P1 / API Integration |
| Test Design Technique | Role-based Access, Integration |
| Preconditions | F-A có WH-A/B; M-D quản lý kho thuộc WH-B, không thuộc WH-A. MAT-Q balance WH-A=7.000. UML luồng điều chuyển yêu cầu kho đích tra cứu nguồn/lượng trước khi lập đề nghị. Có dữ liệu kiểm soát ở Farm khác. |
| Test Steps | 1. Đăng nhập Web/API bằng M-D. 2. Mở lựa chọn nguồn hoặc gọi đúng API tra cứu tồn được giao diện sử dụng. 3. Xác minh balance WH-A hiển thị theo yêu cầu và dữ liệu Farm khác không lộ. Nếu không có luồng tra cứu, dừng; không gọi endpoint chưa tồn tại. |
| Test Data | M-D scope WH-B; nguồn WH-A cùng F-A, MAT-Q=7.000; Farm khác làm đối chứng. |
| Expected Result | Theo UML, M-D đọc được lượng tại WH-A để lập đề nghị nhưng không được sửa tồn hoặc xác nhận dispatch tại WH-A; không đọc dữ liệu Farm khác. |
| Design Status | IMPLEMENTATION_GAP tại snapshot: `InventoryService.listBalances` áp scope warehouse được gán nên M-D chỉ thuộc WH-B không đọc balance WH-A. Recheck build mới; nếu hợp đồng đã đổi thì cập nhật oracle. |
| Actual Result | |
| Execution Status | Not Run |
| Bug ID | |
| Evidence | |

## Tổng hợp và truy vết

| Scenario | TC dự kiến | TC thực tế mới | Kỹ thuật | Bao phủ | Điểm thiếu căn cứ / trạng thái |
|---|---:|---:|---|---|---|
| NV02-03 | 12 | 10 | EP, BVA, Decision Table, State Transition, Error Guessing, Integration, Concurrency | ASSET đạt/không đủ điều kiện; vị trí; bảo trì; không đạt; QUANTITY/LOT; retry, đồng thời, rollback; định danh/assignment/ledger | Snapshot chỉ có ASSET return và luôn `AVAILABLE`; QUANTITY/LOT và tình trạng không đạt chưa có hợp đồng. 049–050 cần DB test harness. |
| NV02-05 | 8 | 8 | Role-based Access, Decision Table, Integration, Error Guessing | Người lập ở kho đích; dispatch nguồn/receive đích; chặn chéo; ngoài scope; nhiều kho; tra cứu nguồn | TC-058 là gap tại snapshot; 051–057 phải xác minh qua API, không chỉ UI. |
| **Tổng** | **20** | **18** | — | — | Ít hơn dự kiến do không bịa payload cho QUANTITY/LOT. |

### Ca cần DB test harness

- TC-NV02-049: hai request đồng thời trên cùng asset.
- TC-NV02-050: fault injection khi ghi ledger trong DB test riêng.
- TC-NV02-048: API integration; snapshot có automation duplicate return tương tự.
- TC-NV02-057: membership nhiều warehouse assignment.

### So sánh với 40 Test Case NV02 hiện có

- TC-NV02-001–010 thuộc NV02-04; TC-NV02-011 là chặn khác Farm. Không viết lại ca cross-Farm.
- TC-NV02-012–029 thuộc NV02-01; TC-NV02-030–040 thuộc NV02-02. TC mới 041–050 chỉ kiểm hoàn trả; 051–058 chỉ quyền/phạm vi transfer.
- Integration tests hiện có về return ASSET được liên kết với 041/042/043/044/048/050; chúng không phải kết quả Test Case đã chạy trong lần này.

## Implementation Gap và Requirement Pending

| Mã | Phân loại | Bằng chứng tại source snapshot | Hành vi yêu cầu | Tác động / xử lý tối thiểu |
|---|---|---|---|---|
| NV02-03-G1 | IMPLEMENTATION_GAP | `api/src/modules/assets/dto/return-asset.dto.ts`; `api/src/modules/assets/assets.service.ts` (`returnAsset`) | Ghi tình trạng; chỉ hàng đạt được phục hồi khả dụng, hàng lỗi không khả dụng. | DTO không có field tình trạng; service luôn chuyển ASSET sang `AVAILABLE`, tăng balance 1. Cần chốt cách lưu hàng không đạt, không tự thêm enum trong TC. |
| NV02-03-G2 | IMPLEMENTATION_GAP | Cùng DTO/controller/service; schema ASSET/issue | Hoàn QUANTITY/LOT gắn dòng cấp phát gốc, lượng thực nhận, đúng lot, partial receive và ledger. | Snapshot chỉ `POST /assets/:id/return`, body có warehouse/location/note; thiếu quantity/lot/condition/original issue reference. Cần Dev bổ sung contract nếu phạm vi đã chốt vẫn yêu cầu. Không tìm thấy màn hình hoàn trả ASSET Mobile trong `mobile/app` và `mobile/src` tại snapshot; chỉ ghi nhận để đối chiếu yêu cầu UI, chưa kết luận Mobile là bắt buộc. |
| NV02-03-G3 | IMPLEMENTATION_GAP | `api/src/modules/assets/assets.service.ts`; `api/test/assets.integration.e2e-spec.ts` | Truy vết người trả, người nhận kho, kho/vị trí, tình trạng, thời điểm. | Có actor kho, location, đóng assignment, `RETURN_IN` và audit; chưa biểu diễn riêng người giao và người kiểm nhận hoặc condition theo dòng. Chốt actor/event trong contract. |
| NV02-05-G1 | IMPLEMENTATION_GAP | `api/src/modules/inventory/inventory.service.ts` (`listBalances`); `api/src/modules/warehouses/warehouses.service.ts` (`warehouseScope`) | Kho đích xem tồn nguồn cùng Farm để đề nghị, không có quyền xuất tại nguồn. | Snapshot lọc balance theo assigned scope; tài khoản chỉ được WH-B không đọc WH-A. Bổ sung read scope cùng Farm nếu requirement UML vẫn yêu cầu. |
| NV02-05-G2 | NEEDS_CONFIRMATION / đối chiếu code sau sửa | `api/src/modules/warehouses/stock-transfers.service.ts` (`create`, `confirm`, `receive`); `warehouse-scope.ts` | UML mô tả kho đích lập; nguồn dispatch; đích receive. | `confirm` kiểm source, `receive` kiểm destination; `create` chỉ yêu cầu một trong hai warehouse nằm trong scope. Cần Dev/nhóm xác nhận quản lý nguồn có bị cấm tạo yêu cầu thay kho đích không; nếu có thì bổ sung kiểm tra phía tạo. Recheck code sau sửa trước chạy. |

**Requirement Pending:** Chưa xác định rõ hạch toán tồn vật lý/ledger của phần không đạt. Không biến yêu cầu “không khả dụng” thành phép cộng/trừ vật lý tự suy đoán.

## Tổng Test Case đã thiết kế trong các nghiệp vụ liên quan

| Nghiệp vụ | Tổng mục thiết kế | Ghi chú |
|---|---:|---|
| NV01 | 48 | 46 sẵn sàng thực thi; 028/039 pending requirement, không có oracle cuối. |
| NV02 | 58 | ID 001–058 duy nhất/liên tục; 018 pending requirement; gap cases vẫn Not Run. |
| NV05 | 12 | Test Case mẫu hiện có; không chỉnh lần này. |
| **Tổng** | **118** | Đếm mục thiết kế, không phải kết quả đã thực thi. |

## Tự kiểm tra

- ID mới liên tục `TC-NV02-041`–`TC-NV02-058`, không trùng 001–040; NV02-03 có 10 ca, NV02-05 có 8.
- Mỗi TC có đủ trường; Scenario ID đúng. Actual Result, Bug ID, Evidence rỗng; Execution Status đều `Not Run`.
- Không lặp NV02-011 cross-Farm, NV02-04 số lượng/dispatch/receive, NV02-02 cấp phát hay AUTH-04 ma trận quyền chung.
- Không đặt trạng thái mới cho hàng lỗi hoặc bàn giao; phần chưa biểu diễn được ghi gap. Không coi tồn vật lý và khả dụng là một.
- Concurrency cùng ASSET và fault injection dùng DB test riêng. Không chạy app/test/migration, không truy cập DB, không sửa source.
- Mọi kết luận source chỉ áp dụng snapshot `c9dda5d`, không phải xác nhận build hiện tại của Đạt.
