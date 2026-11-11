# KLCN289 – 40 Test Case ưu tiên cho Chương 5

## Căn cứ và giới hạn

- Source/test design được đối chiếu tại `dev@c9b30228e418efb8c8af0573deb04099397920a6`. Đây là HEAD và ref local `origin/dev` đã xác minh trong workspace; SHA mới nhất trên GitHub chưa được xác minh độc lập trong phiên này.
- Sau bổ sung hai ca, bộ nguồn có 217 ID Test Case nghiệp vụ duy nhất và 52 ID UI/UX duy nhất. Danh sách ưu tiên gồm đúng 40 ID, trong đó có hai ID mới được thiết kế tại bản cập nhật này; không thay đổi/xóa ID cũ.
- Đây là danh sách chuẩn bị chạy, không phải kết quả kiểm thử. Tất cả Execution Status ban đầu là `Not Run`.
- Bộ automated test ghi nhận 383 PASS tại snapshot lịch sử `f868ea0e4785af7ab9c2d6d1e044105a5bc85e98`; không xem đây là kết quả của HEAD c9b302 hoặc là 383 Test Case nghiệp vụ. API PostgreSQL Integration và Mobile chưa có kết quả thực thi được xác nhận.
- `HinhVeNghiepVu copy.docx` có SHA-256 `7236a3c02c5e3575ef27fa6f8f1a7d21a708638b01e7fbb41f0cfa9b86b65446`. Hai tài liệu `KLCN289_QUY_TAC_VA_NGU_CANH_CHAT_MOI_2026-11-07.md`, `KLCN289_CHOT_NGHIEP_VU_CHUNG_DEV_UML_V1_1.md` và PDF khóa luận Minh Tuấn không tìm thấy trong workspace. Không suy diễn nội dung của các file thiếu.

## Phân bổ theo nhóm
| Nhóm | Số ca chọn | Ghi chú |
|---|---:|---|
| AUTH | 4 | |
| NV01 | 5 | |
| NV02 | 6 | |
| NV03 | 3 | |
| NV04 | 3 | |
| NV05 | 5 | Có TC-XFLOW-007; tính một lần trong tổng. |
| NV06 | 3 | |
| NV07 | 1 | |
| NV08 | 2 | |
| NV09 | 2 | |
| NV10 | 2 | |
| UI/UX | 4 | 2 Web, 2 Mobile. |
| **Tổng** | **40** | **40 ID duy nhất** |
Theo Priority trong nguồn: **P0 37**, **P1 3**, **P2 0**. TC-XFLOW-007 được tính một lần; danh sách chạm 30 Scenario ID nghiệp vụ. Các ca chưa có kết quả thực thi.

## Thay thế trong danh sách ưu tiên

| ID chuyển khỏi danh sách ưu tiên | ID đưa vào | Lý do | Scenario bị ảnh hưởng |
|---|---|---|---|
| TC-NV07-006 | TC-NV01-049 | TC-NV07-006 là P1 về QR tra cứu, vẫn được giữ trong bộ đầy đủ; chuyển suất ưu tiên sang nhánh P0 kiểm nhận hàng lỗi ngoài hệ thống và chỉ lập phiếu sau khi chấp nhận. | Rời NV07-03 khỏi mẫu 40; bổ sung NV01-04/NV01-05. |
| TC-NV04-001 | TC-NV04-011 | TC-NV04-001 là P1 báo hỏng không đổi tồn, vẫn được giữ trong bộ đầy đủ; ưu tiên ca mới kiểm tra quyết định đã chốt về điều phối viên tạo lịch trực tiếp. | Giữ NV04-01 trong mẫu; thêm kiểm tra quyền tạo lịch trực tiếp. |

Hai ID chuyển khỏi danh sách ưu tiên không bị xóa khỏi bộ Test Case nguồn. Các ca P0 khác về phân quyền, tồn kho, rollback, thanh toán và toàn vẹn dữ liệu được giữ nguyên.

## Danh sách 40 ca theo thứ tự chuẩn bị fixture
| STT | Test Case ID | Nghiệp vụ | Scenario | Mục tiêu | Priority | Platform | Lý do chọn | File nguồn |
|---:|---|---|---|---|---|---|---|---|
| 1 | `TC-AUTH-001` | AUTH | AUTH-01 | Đăng nhập và nạp membership hiện hành | P1 | Web | Luồng đăng nhập nền tảng để xác nhận phiên và membership thật trước các ca bảo vệ dữ liệu. | [KLCN289_TEST_CASES_CONTINUED.md:27](KLCN289_TEST_CASES_CONTINUED.md#L27) |
| 2 | `TC-AUTH-004` | AUTH | AUTH-03 | Chuyển giữa hai Farm mà không giữ dữ liệu Farm trước | P0 | Web, Mobile | Kiểm tra chuyển Farm không giữ nhầm ngữ cảnh hoặc dữ liệu của Farm trước. | [KLCN289_TEST_CASES_CONTINUED.md:75](KLCN289_TEST_CASES_CONTINUED.md#L75) |
| 3 | `TC-AUTH-005` | AUTH | AUTH-03 | Người biết ID nhưng không có membership không đọc được Farm khác | P0 | API | Ca từ chối truy cập trực tiếp bằng ID khác Farm, rủi ro cô lập dữ liệu cao. | [KLCN289_TEST_CASES_CONTINUED.md:91](KLCN289_TEST_CASES_CONTINUED.md#L91) |
| 4 | `TC-AUTH-006` | AUTH | AUTH-04 | Ma trận role không cho STORE_MANAGER sửa catalog chung | P0 | Web, API | Kiểm tra role STORE_MANAGER không vượt sang quản lý catalog chung. | [KLCN289_TEST_CASES_CONTINUED.md:107](KLCN289_TEST_CASES_CONTINUED.md#L107) |
| 5 | `TC-NV08-004` | NV08 | NV08-02, NV08-03 | Thêm tài khoản Clerk đã có vào Farm thứ hai với role riêng | P0 | Web, API, DB test | Đại diện membership nhiều Farm với role riêng, đồng thời kiểm tra dữ liệu không bị gộp. | [KLCN289_TEST_CASES_CONTINUED.md:1111](KLCN289_TEST_CASES_CONTINUED.md#L1111) |
| 6 | `TC-NV08-008` | NV08 | NV08-03 | Không vô hiệu hóa OWNER đang hoạt động cuối cùng | P0 | Web, API, DB test | Bảo vệ OWNER cuối cùng, rủi ro khóa quyền quản trị Farm. | [KLCN289_TEST_CASES_CONTINUED.md:1175](KLCN289_TEST_CASES_CONTINUED.md#L1175) |
| 7 | `TC-NV07-004` | NV07 | NV07-02 | Tạo ASSET đầu kỳ ghi đúng một cá thể và không nhầm receipt | P0 | Web, API, DB test | Ngăn tạo tài sản đầu kỳ trùng hoặc biến thành phiếu nhập. | [KLCN289_TEST_CASES_CONTINUED.md:995](KLCN289_TEST_CASES_CONTINUED.md#L995) |
| 8 | `TC-NV01-031` | NV01 | NV01-04 | Xác nhận QUANTITY cập nhật đúng một giao dịch | P0 | Web + DB test | Đại diện xác nhận nhập QUANTITY và đối chiếu biến động tồn/ledger một lần. | [KLCN289_TEST_CASES_NV01_REMAINING.md:332](KLCN289_TEST_CASES_NV01_REMAINING.md#L332) |
| 9 | `TC-NV01-034` | NV01 | NV01-04 | Xác nhận ASSET định danh và vị trí | P0 | Web + DB test | Kiểm tra tạo ASSET định danh, vị trí và tính nhất quán cá thể. | [KLCN289_TEST_CASES_NV01_REMAINING.md:386](KLCN289_TEST_CASES_NV01_REMAINING.md#L386) |
| 10 | `TC-NV01-032` | NV01 | NV01-04 | Xác nhận LOT mới | P0 | Web + DB test | Xác nhận LOT mới với nhà cung cấp, lưu định danh lô/ngày và cộng đúng balance/ledger một lần. | [KLCN289_TEST_CASES_NV01_REMAINING.md:350](KLCN289_TEST_CASES_NV01_REMAINING.md#L350) |
| 11 | `TC-NV01-045` | NV01 | NV01-05 | Lỗi định danh ở dòng sau rollback dòng LOT trước đó | P0 | API + DB test harness | Ca lỗi sau một dòng hợp lệ để kiểm chứng rollback, không nhập một phần ngoài quy tắc. | [KLCN289_TEST_CASES_NV01_REMAINING.md:587](KLCN289_TEST_CASES_NV01_REMAINING.md#L587) |
| 12 | `TC-NV01-049` | NV01 | NV01-04, NV01-05 | Kiểm nhận hàng không đạt ngoài hệ thống; chỉ nhập sau khi hàng được chấp nhận | P0 | Web/API + PostgreSQL test | Kiểm tra quy trình không lập phiếu cho hàng chưa đạt và phần mềm chỉ tăng tồn sau khi phiếu hợp lệ được xác nhận; xử lý nhà cung cấp ở ngoài ứng dụng. | [KLCN289_TEST_CASES_CONTINUED.md:1664](KLCN289_TEST_CASES_CONTINUED.md#L1664) |
| 13 | `TC-NV02-017` | NV02 | NV02-01 | Quản lý kho xác nhận phiếu PENDING và trừ tồn đúng một lần | P0 | Theo bước/fixture trong nguồn; xác nhận khi lập lịch chạy | Xác nhận QUANTITY qua người có quyền và kiểm tra thời điểm trừ tồn thực xuất. | [KLCN289_TEST_CASES_NV02_01_NV02_02.md:110](KLCN289_TEST_CASES_NV02_01_NV02_02.md#L110) |
| 14 | `TC-NV02-046` | NV02 | NV02-03 | Hoàn trả QUANTITY theo lượng thực nhận | P0 | Theo bước/fixture trong nguồn; xác nhận khi lập lịch chạy | Đối chiếu hàng hoàn trả QUANTITY chỉ phục hồi lượng đạt đã nhận. | [KLCN289_TEST_CASES_NV02_03_NV02_05.md:106](KLCN289_TEST_CASES_NV02_03_NV02_05.md#L106) |
| 15 | `TC-NV02-047` | NV02 | NV02-03 | Hoàn trả LOT giữ nguyên lô và lượng được chấp nhận | P0 | Theo bước/fixture trong nguồn; xác nhận khi lập lịch chạy | Đảm bảo hoàn trả LOT giữ đúng định danh lô và lượng được chấp nhận. | [KLCN289_TEST_CASES_NV02_03_NV02_05.md:125](KLCN289_TEST_CASES_NV02_03_NV02_05.md#L125) |
| 16 | `TC-NV02-004` | NV02 | NV02-04 | Nhận thiếu có lý do, chưa hoàn tất theo UML | P0 | API + DB test harness | Điều chuyển nhận thiếu phải tăng tồn theo thực nhận và giữ DISCREPANCY chờ xử lý. | [KLCN289_SAMPLE_TEST_CASES_NV01_NV02_NV05.md:309](KLCN289_SAMPLE_TEST_CASES_NV01_NV02_NV05.md#L309) |
| 17 | `TC-NV02-045` | NV02 | NV02-03 | ASSET không đạt không được đưa vào tồn khả dụng | P0 | API + DB test | Kiểm tra ASSET trả DAMAGED được ghi nhận nhưng không chuyển sang khả dụng/cấp phát. | [KLCN289_TEST_CASES_NV02_03_NV02_05.md:87](KLCN289_TEST_CASES_NV02_03_NV02_05.md#L87) |
| 18 | `TC-NV02-061` | NV02 | NV02-06 | Kho đích xác nhận nhận đúng ASSET đã gửi | P1 | API, DB test | Điều chuyển ASSET chỉ hoàn tất nhận tại đích khi xác nhận đúng cá thể. | [KLCN289_TEST_CASES_CONTINUED.md:175](KLCN289_TEST_CASES_CONTINUED.md#L175) |
| 19 | `TC-NV03-002` | NV03 | NV03-01, NV03-03 | Thay đổi tồn sau snapshot không bị ghi đè bằng số cũ | P0 | DB test harness | Kiểm tra snapshot cũ không ghi đè biến động tồn phát sinh sau đó. | [KLCN289_TEST_CASES_CONTINUED.md:259](KLCN289_TEST_CASES_CONTINUED.md#L259) |
| 20 | `TC-NV03-004` | NV03 | NV03-02 | Chênh lệch chỉ được áp dụng sau khi người duyệt đúng thẩm quyền phê duyệt | P0 | API, DB test | Đại diện nhánh P0 phê duyệt chênh lệch trước khi áp dụng điều chỉnh. | [KLCN289_TEST_CASES_CONTINUED.md:291](KLCN289_TEST_CASES_CONTINUED.md#L291) |
| 21 | `TC-NV03-006` | NV03 | NV03-03 | Gửi lại xác nhận count không tạo điều chỉnh kép | P0 | DB test | Retry không được tạo điều chỉnh hoặc ledger kép. | [KLCN289_TEST_CASES_CONTINUED.md:323](KLCN289_TEST_CASES_CONTINUED.md#L323) |
| 22 | `TC-NV04-011` | NV04 | NV04-01 | Điều phối viên được phân quyền tạo lịch trực tiếp; nhân viên không quyền bị từ chối | P1 | API + Web readback; DB test | Kiểm tra quyết định mới không yêu cầu duyệt lịch, đồng thời giữ riêng quyền xuất/nhận và quyết định cuối. | [KLCN289_TEST_CASES_CONTINUED.md:1680](KLCN289_TEST_CASES_CONTINUED.md#L1680) |
| 23 | `TC-NV04-004` | NV04 | NV04-02 | Chỉ vai trò kho xác nhận xuất thiết bị đi sửa | P0 | API, DB test | Chỉ kho được xác nhận xuất tài sản đi bảo trì. | [KLCN289_TEST_CASES_CONTINUED.md:455](KLCN289_TEST_CASES_CONTINUED.md#L455) |
| 24 | `TC-NV04-006` | NV04 | NV04-04 | Nhận lại đúng ASSET cũ và chưa tự cho dùng trước quyết định cuối | P0 | Web, API, DB test | Nhận lại đúng ASSET cũ nhưng chưa cấp dùng trước quyết định cuối. | [KLCN289_TEST_CASES_CONTINUED.md:487](KLCN289_TEST_CASES_CONTINUED.md#L487) |
| 25 | `TC-NV05-004` | NV05 | NV05-03 | Hai đơn đồng thời tranh lượng tồn cuối | P0 | API + DB concurrency harness | Hai đơn tranh tồn cuối là nhánh đồng thời rủi ro cao với tính đúng của lượng giữ. | [KLCN289_SAMPLE_TEST_CASES_NV01_NV02_NV05.md:500](KLCN289_SAMPLE_TEST_CASES_NV01_NV02_NV05.md#L500) |
| 26 | `TC-NV05-018` | NV05 | NV05-04 | Webhook chuyển khoản hợp lệ ghi PAID một lần | P0 | API, DB test | Webhook hợp lệ xác nhận PAID đúng một lần. | [KLCN289_TEST_CASES_CONTINUED.md:651](KLCN289_TEST_CASES_CONTINUED.md#L651) |
| 27 | `TC-NV05-019` | NV05 | NV05-04 | Webhook sai chữ ký hoặc sai số tiền không xác nhận PAID | P0 | API | Chữ ký/số tiền sai không được xác nhận PAID. | [KLCN289_TEST_CASES_CONTINUED.md:667](KLCN289_TEST_CASES_CONTINUED.md#L667) |
| 28 | `TC-NV05-027` | NV05 | NV05-06 | Kho nhận hàng trả về chỉ cộng lượng đạt thực nhận | P0 | Web, API, DB test | Hàng khách trả chỉ được cộng lại theo lượng thực nhận đạt. | [KLCN289_TEST_CASES_CONTINUED.md:795](KLCN289_TEST_CASES_CONTINUED.md#L795) |
| 29 | `TC-XFLOW-007` | NV05 | NV05-02, NV05-03, NV05-04, NV05-05 | Order đi từ xác nhận giữ hàng đến thanh toán, thực xuất và giao | P0 | Web, API, DB test | Luồng liên nghiệp vụ kiểm tra PENDING, hold, thanh toán, xuất và giao xuyên hệ thống. | [KLCN289_TEST_CASES_CONTINUED.md:1571](KLCN289_TEST_CASES_CONTINUED.md#L1571) |
| 30 | `TC-NV06-004` | NV06 | NV06-01, NV06-03 | ASSET claim trỏ đúng cá thể/serial đã bán | P0 | API, DB test | Ràng buộc claim với ASSET/serial đúng sản phẩm đã bán. | [KLCN289_TEST_CASES_CONTINUED.md:863](KLCN289_TEST_CASES_CONTINUED.md#L863) |
| 31 | `TC-NV06-005` | NV06 | NV06-02 | Không bắt đầu sửa có phí trước khi khách đồng ý báo giá | P0 | Web, API | Không bắt đầu sửa có phí trước khi khách chấp thuận báo giá. | [KLCN289_TEST_CASES_CONTINUED.md:879](KLCN289_TEST_CASES_CONTINUED.md#L879) |
| 32 | `TC-NV06-007` | NV06 | NV06-03 | Đổi sản phẩm tạo phiếu xuất đúng item/quantity và không làm hỏng dòng gốc | P0 | Web, API, DB test | Đổi sản phẩm phải tạo xuất kho đúng mặt hàng/số lượng và giữ nguyên dòng gốc. | [KLCN289_TEST_CASES_CONTINUED.md:911](KLCN289_TEST_CASES_CONTINUED.md#L911) |
| 33 | `TC-NV09-001` | NV09 | NV09-01 | Dashboard chỉ trả dữ liệu Farm và role được phép | P0 | Web, API | Đảm bảo dữ liệu dashboard giới hạn đúng Farm và quyền người gọi. | [KLCN289_TEST_CASES_CONTINUED.md:1195](KLCN289_TEST_CASES_CONTINUED.md#L1195) |
| 34 | `TC-NV09-004` | NV09 | NV09-02 | Hàng thiếu giá được tách khỏi giá trị đã định giá | P0 | API, Web, DB test | Không đồng nhất hàng chưa định giá với 0 đồng hoặc tổng đầy đủ. | [KLCN289_TEST_CASES_CONTINUED.md:1243](KLCN289_TEST_CASES_CONTINUED.md#L1243) |
| 35 | `TC-NV10-005` | NV10 | NV10-02 | FARM_OWNER map variant vào item thuộc Farm mình | P0 | Web, API, DB test | Kiểm tra ánh xạ Farm-owner, giới hạn Farm và không làm biến động tồn. | [KLCN289_TEST_CASES_CONTINUED.md:1407](KLCN289_TEST_CASES_CONTINUED.md#L1407) |
| 36 | `TC-NV10-007` | NV10 | NV10-03 | Chỉ ADMIN quản lý phí giao chung; phí mới không đổi order snapshot | P0 | Web, API, DB test | Kiểm tra ADMIN cập nhật phí chung, quyền role và snapshot phí đơn đã tạo. | [KLCN289_TEST_CASES_CONTINUED.md:1439](KLCN289_TEST_CASES_CONTINUED.md#L1439) |
| 37 | `UIUX-WEB-023` | UI/UX | UI/UX | Màn hình bảo trì phân tách điều phối, kho và quyết định cuối | P0 | Web | Kiểm tra trực quan timeline bảo trì, actor, trạng thái và nội dung chi phí. | [KLCN289_UI_UX_TEST_CASES.md:219](KLCN289_UI_UX_TEST_CASES.md#L219) |
| 38 | `UIUX-WEB-032` | UI/UX | UI/UX | Store orders/payment/delivery có status và action nhất quán | P0 | Web | Kiểm tra nhất quán trạng thái/action trong trang đơn hàng, thanh toán và giao hàng. | [KLCN289_UI_UX_TEST_CASES.md:300](KLCN289_UI_UX_TEST_CASES.md#L300) |
| 39 | `UIUX-MOB-006` | UI/UX | UI/UX | Receipt detail không làm mất thay đổi khi sửa rồi submit | P0 | Mobile | Kiểm tra mobile giữ nguyên thay đổi phiếu khi sửa, lưu và gửi. | [KLCN289_UI_UX_TEST_CASES.md:383](KLCN289_UI_UX_TEST_CASES.md#L383) |
| 40 | `UIUX-MOB-009` | UI/UX | UI/UX | Phiếu chuyển báo đúng DISCREPANCY, không báo đã kết thúc | P0 | Mobile | Kiểm tra Mobile thể hiện đúng DISCREPANCY và số lượng thực tế. | [KLCN289_UI_UX_TEST_CASES.md:411](KLCN289_UI_UX_TEST_CASES.md#L411) |
## Phân loại theo cách thực thi

Các nhóm có thể giao nhau: một ca có thể cần thao tác UI, gọi API và đối chiếu DB cùng lượt.

| Cách thực thi | Test Case ID | Ghi chú |
|---|---|---|
| Manual Web/Mobile | `TC-AUTH-001`, `TC-AUTH-004`, `TC-AUTH-006`, `TC-NV08-004`, `TC-NV08-008`, `TC-NV07-004`, `TC-NV01-031`, `TC-NV01-034`, `TC-NV01-032`, `TC-NV01-049`, `TC-NV04-011`, `TC-NV04-006`, `TC-NV05-027`, `TC-XFLOW-007`, `TC-NV06-005`, `TC-NV06-007`, `TC-NV09-001`, `TC-NV09-004`, `TC-NV10-005`, `TC-NV10-007` | Thao tác hoặc đọc lại giao diện theo Platform trong từng ca. |
| API Integration | `TC-AUTH-005`, `TC-AUTH-006`, `TC-NV08-004`, `TC-NV08-008`, `TC-NV07-004`, `TC-NV01-045`, `TC-NV01-049`, `TC-NV02-017`, `TC-NV02-046`, `TC-NV02-047`, `TC-NV02-004`, `TC-NV02-045`, `TC-NV02-061`, `TC-NV03-004`, `TC-NV04-011`, `TC-NV04-004`, `TC-NV04-006`, `TC-NV05-004`, `TC-NV05-018`, `TC-NV05-019`, `TC-NV05-027`, `TC-XFLOW-007`, `TC-NV06-004`, `TC-NV06-005`, `TC-NV06-007`, `TC-NV09-001`, `TC-NV09-004`, `TC-NV10-005`, `TC-NV10-007` | Dùng API test environment; ca Web/Mobile cũng có thể cần API để kiểm tra hợp đồng. |
| Database/transaction | `TC-NV08-004`, `TC-NV08-008`, `TC-NV07-004`, `TC-NV01-031`, `TC-NV01-034`, `TC-NV01-032`, `TC-NV01-045`, `TC-NV01-049`, `TC-NV02-004`, `TC-NV02-045`, `TC-NV02-061`, `TC-NV03-002`, `TC-NV03-004`, `TC-NV03-006`, `TC-NV04-011`, `TC-NV04-004`, `TC-NV04-006`, `TC-NV05-004`, `TC-NV05-018`, `TC-NV05-027`, `TC-XFLOW-007`, `TC-NV06-004`, `TC-NV06-007`, `TC-NV09-004`, `TC-NV10-005`, `TC-NV10-007` | Cần DB test độc lập; TC-NV01-045 cần fault injection/rollback harness. |
| Concurrency harness | `TC-NV03-002`, `TC-NV05-004` | Dùng DB test riêng và hai luồng/kết nối theo Test Steps; không mô phỏng như thao tác Web thủ công đơn giản. |
| UI/UX | `UIUX-WEB-023`, `UIUX-WEB-032`, `UIUX-MOB-006`, `UIUX-MOB-009` | 2 ca Web, 2 ca Mobile; kiểm tra trực quan, chưa chạy. |

## Kiểm soát khả năng thực thi

- Nguồn gốc từng ca được liên kết theo file, dòng bắt đầu và anchor ID. Nội dung đầy đủ được giữ ở file nguồn; bảng này không thay Expected Result.
- Với các Test Case đời trước dùng bảng Markdown thay cho trường Platform, Platform trong bảng là suy ra từ bước và fixture ghi trong chính ca đó; chưa thêm endpoint hoặc thao tác không có trong nguồn.
- `TC-NV03-004` ghi pending về vai trò phê duyệt chính xác. Giữ Expected Result nguyên trạng và chốt ma trận quyền trước khi chạy. Hiện vẫn `Not Run`, chưa phải Blocked vì chưa có lần chạy.
- `TC-NV10-007` kiểm tra biểu phí chung bằng fixture quyền ADMIN đã cấp. Nhánh ADMIN không có membership Farm là vấn đề riêng còn cần xác nhận; không suy rộng kết quả của ca này sang nhánh đó.
- **Cập nhật code tại HEAD:** `TC-NV02-004` có thể đối chiếu trạng thái `DISCREPANCY` và bước resolve trong [stock-transfers.service.ts](api/src/modules/warehouses/stock-transfers.service.ts#L625). Ghi chú implementation gap trong Test Case gốc phản ánh audit trước đây; không phải tình trạng kết luận cho HEAD mới. `TC-NV02-045`: DTO/service hiện xử lý `DAMAGED`, đặt lifecycle DAMAGED, cộng một đơn vị tồn vật lý và ghi RETURN_IN tại [return-asset.dto.ts](api/src/modules/assets/dto/return-asset.dto.ts#L17), [assets.service.ts](api/src/modules/assets/assets.service.ts#L235) và [assets.service.ts](api/src/modules/assets/assets.service.ts#L244). Khi chạy phải phân biệt tồn vật lý với khả dụng: xác minh tài sản DAMAGED không thể cấp phát/bán, không yêu cầu tồn vật lý không đổi. Ghi chú Implementation Gap trong ca gốc là snapshot cũ. `TC-NV02-046/047`: hợp đồng hoàn QUANTITY/LOT hiện có trong [create-issue-return.dto.ts](api/src/modules/warehouses/dto/create-issue-return.dto.ts#L28), [stock-receipts.controller.ts](api/src/modules/warehouses/stock-receipts.controller.ts#L272) và [stock-receipts.service.ts](api/src/modules/warehouses/stock-receipts.service.ts#L229). Đây là kiểm tra tĩnh, chưa phải runtime PASS. Quy tắc hạch toán tồn vật lý của phần trả không đạt vẫn cần nhóm chốt; chỉ lượng accepted được cộng khả dụng theo yêu cầu hiện hành.
- TC-NV01-049 mô phỏng hàng nhà cung cấp không đạt và việc xử lý/kiểm nhận lại ngoài phần mềm; ca xác minh không lập phiếu trong giai đoạn đó, rồi kiểm tra một phiếu nhập hợp lệ sau khi đủ 10 đơn vị đạt. Không yêu cầu quality hold/resolve API hay status riêng.
- TC-NV04-011 kiểm tra lịch tạo trực tiếp không cần duyệt trước theo quyết định mới. API cho phép nhóm MAINTENANCE_SCHEDULE_ROLES gồm MAINTENANCE_STAFF; source chưa tách điều phối viên riêng, Web chỉ có đọc danh sách/chi tiết. Chốt mapping role trong fixture trước khi chạy.
- `TC-XFLOW-007` cần DB kiểm thử cô lập và dịch vụ thanh toán giả lập/sandbox. COD và BANK_TRANSFER là hai lần chạy dữ liệu riêng nếu nhóm muốn xác minh cả hai; không gửi thanh toán thật.
- `UIUX-MOB-009` kiểm tra trạng thái DISCREPANCY có thể phơi bày sai lệch trình bày đã được ghi trong test source; đây vẫn là ca chưa chạy, không phải Fail.

## Nhánh quan trọng chưa được chọn

Trong 49 Test Case NV01, TC-NV01-049 bao phủ kịch bản xử lý hàng nhà cung cấp không đạt ngoài hệ thống và xác nhận phiếu chỉ sau khi hàng đã được chấp nhận; không cần bổ sung quality hold/resolve vào source. TC-NV07-006 và TC-NV04-001 không còn nằm trong mẫu 40 nhưng vẫn được bảo toàn trong bộ nguồn. Các nhánh chưa thuộc mẫu gồm: TC-NV05-021 chặn xuất đơn chuyển khoản chưa PAID; TC-NV03-007 kiểm kê/xuất đồng thời; TC-NV10-006 giới hạn một kho bán; TC-NV09-002 lọc báo cáo; TC-NV07-007 QR Farm khác; TC-NV02-036 xác nhận riêng việc người nhận nhận ASSET; TC-NV02-055 kiểm tra quyền dispatch theo kho nguồn. Đây là giới hạn chọn mẫu, không phải kết luận các nhánh đã đạt. Lập lịch chạy mở rộng sau khi 40 ca ưu tiên hoàn thành.
