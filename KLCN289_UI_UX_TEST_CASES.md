# KLCN289 — Bộ kiểm thử UI/UX Web và Mobile

## 1. Phạm vi

Các ca dưới đây là kiểm thử giao diện độc lập với kiểm thử nghiệp vụ/API. Các trang được xác định từ route Web `web/app` và route Mobile `mobile/app` tại `dev@f868ea0e4785af7ab9c2d6d1e044105a5bc85e98`. Ref local `origin/dev` trùng HEAD; không kết nối được GitHub khi xác minh ref từ remote. Không có browser/device UI automation trong source; các ca này là thiết kế manual UI test, chưa chạy.

### Điều kiện dùng chung

- Dữ liệu là fixture giả lập trên môi trường test; không dùng DB demo/production, email/mật khẩu thật hoặc thanh toán thật.
- Bộ kích thước thiết bị dùng để tái lập: desktop 1366×768, tablet 768×1024, điện thoại 375×812. Đây là cấu hình test, không phải ngưỡng pixel pass/fail.
- Dùng API fixture/harness để tạo trạng thái loading, empty, validation error, server error và success; không sửa source để ép giao diện.
- Expected Result chỉ nêu dấu hiệu quan sát được: nội dung, nhãn, điều khiển, trạng thái, điều hướng, lỗi/ thành công và dữ liệu. Không dùng tiêu chí chủ quan như “đẹp”.
- Tất cả ca có `Execution Status = Not Run`; Actual Result, Bug ID, Evidence để trống.

## 2. Kiểm thử chéo giao diện

### UIUX-WEB-001 — Bố cục dashboard thích ứng theo kích thước cửa sổ

- **Màn hình / Platform:** Web `/dashboard`, nhóm trang trong `(dashboard)`; Desktop, tablet, mobile browser.
- **Priority:** P1
- **Preconditions:** User có quyền mở dashboard; fixture có đủ các thẻ chỉ số và điều hướng.
- **Các bước:** 1. Mở Dashboard ở ba kích thước thiết bị. 2. Cuộn đầu/cuối trang. 3. Mở/thu điều hướng nếu có. 4. Tab qua các action chính bằng bàn phím.
- **Expected Result:** Nội dung và hành động chính vẫn truy cập được; không có thành phần che nút/giá trị; khi đổi kích thước, phần nội dung bố trí lại và không tạo cuộn ngang làm mất cột dữ liệu.
- **Execution Status:** Not Run

### UIUX-WEB-002 — Điều hướng theo vai trò không hiện mục không được phép

- **Màn hình / Platform:** Web sidebar/navigation trên dashboard và storefront admin.
- **Priority:** P0
- **Preconditions:** Có tài khoản test cho WAREHOUSE_MANAGER, STORE_MANAGER, DELIVERY_STAFF và EMPLOYEE.
- **Các bước:** 1. Đăng nhập lần lượt từng role. 2. Ghi nhận menu. 3. Dán trực tiếp URL của trang ngoài quyền. 4. Thử mở link cũ sau khi đổi Farm.
- **Expected Result:** Menu chỉ hiện các mục theo role; URL trực tiếp không vượt qua bảo vệ route; điều hướng sau đổi Farm không mở dữ liệu Farm cũ.
- **Execution Status:** Not Run

### UIUX-WEB-003 — Loading, empty và API error có trạng thái dễ nhận biết

- **Màn hình / Platform:** Web danh sách Warehouse, Materials, Receipts, Orders, Reports.
- **Priority:** P1
- **Preconditions:** API fixture trả lần lượt delay, danh sách rỗng và lỗi xác thực/lỗi máy chủ.
- **Các bước:** 1. Mở mỗi nhóm màn hình với response delay. 2. Lặp với empty result. 3. Lặp với lỗi API. 4. Thử tải lại nếu giao diện cung cấp action.
- **Expected Result:** Loading không bị nhầm với empty; empty state nói rõ chưa có dữ liệu và không giả có dòng; lỗi hiển thị trạng thái lỗi, không hiển thị stack/secret/transport body; retry không tạo mutation.
- **Execution Status:** Not Run

### UIUX-WEB-004 — Dialog xác nhận hỗ trợ hủy và đóng an toàn

- **Màn hình / Platform:** Web modal/dialog ở Receipt, Issue, Transfer, Count, Warehouse, Store Order.
- **Priority:** P1
- **Preconditions:** Có thao tác cần xác nhận và dữ liệu fixture ở trạng thái phù hợp.
- **Các bước:** 1. Mở dialog. 2. Tab qua các nút/field. 3. Đóng bằng nút hủy/close hoặc Escape nếu dialog hỗ trợ. 4. Mở lại và xác nhận thao tác trên fixture độc lập.
- **Expected Result:** Dialog có tiêu đề/nội dung/action rõ; nút hủy đóng mà không gọi mutation; xác nhận chỉ gọi đúng action một lần; focus không bị mất khỏi ngữ cảnh giao diện.
- **Execution Status:** Not Run

### UIUX-WEB-005 — Form validation gắn lỗi với trường dữ liệu

- **Màn hình / Platform:** Web Receipt draft, Stock Issue draft, Warehouse form, Store Product/Variant form.
- **Priority:** P1
- **Preconditions:** Có form hợp lệ và các field bắt buộc theo màn hình.
- **Các bước:** 1. Submit form trống. 2. Nhập giá trị sai định dạng đã được DTO quy định. 3. Sửa field lỗi thành dữ liệu hợp lệ. 4. Submit lại.
- **Expected Result:** Lỗi được hiển thị gần field hoặc trong vùng lỗi dễ nhận biết; focus/action cho phép sửa; không gửi request nếu frontend validation ngăn được; server validation lỗi được ánh xạ thành thông báo sử dụng được.
- **Execution Status:** Not Run

### UIUX-WEB-006 — Trường dài, số lớn và ký tự tiếng Việt không phá bố cục

- **Màn hình / Platform:** Web detail, notes/rejection reason, product description, address, supplier/partner fields.
- **Priority:** P2
- **Preconditions:** Fixture chứa văn bản dài trong giới hạn DTO, tên có dấu, mã/số lượng lớn hợp lệ.
- **Các bước:** 1. Mở detail/list trên desktop và điện thoại. 2. Cuộn nội dung dài. 3. Mở dialog sửa và kiểm tra hiển thị.
- **Expected Result:** Nội dung không đè nút/action; xuống dòng hoặc cuộn theo vùng; tiếng Việt không lỗi font; số tiền/số lượng giữ được định dạng và không bị cắt mất phần cần đọc.
- **Execution Status:** Not Run

### UIUX-WEB-007 — Điều khiển chính truy cập bằng bàn phím và có tên dễ đọc

- **Màn hình / Platform:** Web sign-in, dashboard, data table, form và modal.
- **Priority:** P2
- **Preconditions:** Trình duyệt desktop và tài khoản fixture.
- **Các bước:** 1. Không dùng chuột, dùng Tab/Shift+Tab/Enter/Space qua các action chính. 2. Kiểm tra focus hiển thị. 3. Dùng accessibility tree/reader để kiểm tra label của input/button/icon action.
- **Expected Result:** Thứ tự focus đi theo luồng đọc hợp lý; focus nhìn thấy được; icon-only action có accessible name; input có label/description tương ứng; không đặt ngưỡng score chưa thống nhất.
- **Execution Status:** Not Run

## 3. Web bán hàng công khai

### UIUX-WEB-008 — Trang chủ và điều hướng storefront

- **Màn hình / Platform:** `/`, storefront layout, header, category navigation, footer.
- **Priority:** P2
- **Preconditions:** Có catalog public và nội dung home fixture.
- **Các bước:** 1. Mở trang ở desktop/mobile. 2. Dùng category/nav/search. 3. Cuộn đến footer. 4. Thử link policy/about/contact.
- **Expected Result:** Điều hướng tới route tương ứng; nội dung tải xong hoặc hiển thị loading/error state; menu mobile mở/đóng được và không che nội dung cần thao tác.
- **Execution Status:** Not Run

### UIUX-WEB-009 — Trang danh sách sản phẩm phản ánh filter/sort/search

- **Màn hình / Platform:** `/products`, category listing, filter sidebar/mobile filter/sort select.
- **Priority:** P1
- **Preconditions:** Catalog fixture có nhiều danh mục, biến thể và khoảng giá khác nhau.
- **Các bước:** 1. Tìm sản phẩm bằng từ khóa. 2. Chọn filter danh mục/giá/tình trạng có sẵn. 3. Đổi sort. 4. Xóa filter.
- **Expected Result:** URL/kết quả đồng bộ với thao tác; loading/empty state phân biệt được; danh sách chỉ chứa sản phẩm đúng điều kiện; không hiển thị số tồn nội bộ nếu UI không được thiết kế để lộ.
- **Execution Status:** Not Run

### UIUX-WEB-010 — Chi tiết sản phẩm và biến thể hiển thị lựa chọn rõ ràng

- **Màn hình / Platform:** `/products/[slug]`, gallery, variant selector, quantity selector, warranty/quality information.
- **Priority:** P1
- **Preconditions:** P-A có nhiều variant, một variant unavailable; có nội dung mô tả dài.
- **Các bước:** 1. Mở P-A. 2. Đổi variant. 3. Tăng/giảm số lượng. 4. Thử chọn variant không khả dụng. 5. Kiểm tra ảnh chính và ảnh thu nhỏ.
- **Expected Result:** Tên/giá/thông tin thay đổi theo variant; variant unavailable không thể submit; gallery đổi ảnh theo lựa chọn; số lượng không xuống dưới mức UI cho phép.
- **Execution Status:** Not Run

### UIUX-WEB-011 — Giỏ rỗng, giỏ có hàng và lỗi availability phân biệt

- **Màn hình / Platform:** `/cart`, cart drawer, region check.
- **Priority:** P1
- **Preconditions:** Fixture có giỏ rỗng, giỏ hợp lệ và một variant vừa hết khả năng phục vụ.
- **Các bước:** 1. Mở giỏ rỗng. 2. Thêm hàng. 3. Thay region hoặc nhận availability error. 4. Sửa/xóa dòng.
- **Expected Result:** Empty state có hành động quay lại cửa hàng; giá/dòng hàng hiển thị đúng; lỗi availability không bị diễn đạt như xác nhận còn hàng; người dùng sửa/xóa được dòng.
- **Execution Status:** Not Run

### UIUX-WEB-012 — Checkout thể hiện lỗi field và trạng thái gửi đơn

- **Màn hình / Platform:** `/checkout`.
- **Priority:** P0
- **Preconditions:** Customer signed-in; cart fixture; API có thể trả validation error, price changed và success.
- **Các bước:** 1. Gửi checkout thiếu địa chỉ/điện thoại. 2. Sửa dữ liệu. 3. Quan sát loading và gửi một lần. 4. Fixture trả price changed; xác nhận lại giá.
- **Expected Result:** Required field và lỗi có thể xác định; nút gửi không tạo request lặp do double-click; giá/phí và phương thức được tóm tắt trước khi gửi; khi giá đổi, khách được yêu cầu xem lại thay vì âm thầm đặt giá mới.
- **Execution Status:** Not Run

### UIUX-WEB-013 — Trang đơn hàng khách và tracking hiển thị đúng bước

- **Màn hình / Platform:** `/orders`, `/orders/[id]`, `/track-order`.
- **Priority:** P1
- **Preconditions:** Có order PENDING, SHIPPING, COMPLETED và một order không thuộc customer.
- **Các bước:** 1. Mở danh sách đơn. 2. Mở detail và tracking cho từng trạng thái. 3. Thử ID order không thuộc user.
- **Expected Result:** Tiến trình/nhãn trạng thái khớp order; không có action không hợp lệ ở terminal state; order trái quyền không lộ dữ liệu khách khác.
- **Execution Status:** Not Run

## 4. Web quản trị và nghiệp vụ

### UIUX-WEB-014 — Dashboard thể hiện trạng thái tải, bộ lọc và nhãn chỉ số

- **Màn hình / Platform:** `/dashboard`.
- **Priority:** P1
- **Preconditions:** Có summary có dữ liệu và summary rỗng; date range fixture.
- **Các bước:** 1. Mở dashboard. 2. Chọn khoảng ngày nếu UI có filter. 3. So nhãn, đơn vị, loading và empty state.
- **Expected Result:** Nhãn chỉ số nói đúng đơn vị/phạm vi; không diễn đạt giá trị ước tính thành lợi nhuận; dữ liệu rỗng hiển thị rõ là không phát sinh/chưa có dữ liệu theo response.
- **Execution Status:** Not Run

### UIUX-WEB-015 — Danh sách tồn và sổ giao dịch giữ nguyên filter khi xem detail

- **Màn hình / Platform:** `/inventory`, inventory ledger page.
- **Priority:** P1
- **Preconditions:** Có nhiều kho/item/lot và nhiều trang dữ liệu.
- **Các bước:** 1. Lọc kho/item/ngày. 2. Mở detail/QR hoặc ledger. 3. Quay lại danh sách. 4. Đổi page.
- **Expected Result:** Filter được giữ hoặc reset có chủ đích; phân trang không trộn kết quả; cột quantity/lot/asset phân biệt; dữ liệu rỗng/lỗi có trạng thái riêng.
- **Execution Status:** Not Run

### UIUX-WEB-016 — Màn hình vật tư hỗ trợ lọc và form tạo/sửa có field phù hợp

- **Màn hình / Platform:** `/materials`, materials detail/form/filter toolbar.
- **Priority:** P1
- **Preconditions:** Có MATERIAL và item types/tracking fixture.
- **Các bước:** 1. Lọc/tìm item. 2. Mở create/edit. 3. Chọn loại tracking. 4. Gửi dữ liệu sai rồi hợp lệ.
- **Expected Result:** Mỗi tracking mode hiển thị field tương ứng; lỗi field rõ; save thành công có xác nhận; không hiển thị trạng thái tồn mới chỉ vì tạo mẫu.
- **Execution Status:** Not Run

### UIUX-WEB-017 — Asset list/detail hiển thị trạng thái và action theo lifecycle

- **Màn hình / Platform:** `/assets`, `/assets/[id]`, holder/history/action dialogs.
- **Priority:** P1
- **Preconditions:** Có asset AVAILABLE, IN_USE, MAINTENANCE, DAMAGED/RETIRED theo enum hiện hữu.
- **Các bước:** 1. Mở list và detail cho từng trạng thái. 2. Kiểm tra holder/history. 3. Mở action dialog. 4. Thử hủy dialog.
- **Expected Result:** Badge và action phù hợp lifecycle; holder/serial/location không nhầm; action không hợp lệ không hiện hoặc bị chặn; cancel không ghi thay đổi.
- **Execution Status:** Not Run

### UIUX-WEB-018 — Danh sách và detail phiếu nhập phân biệt draft/approval/final

- **Màn hình / Platform:** `/receipts` và receipt detail/draft form.
- **Priority:** P0
- **Preconditions:** Fixture DRAFT, PENDING_APPROVAL, REJECTED, CONFIRMED; actor roles phù hợp.
- **Các bước:** 1. Lọc/mở từng phiếu. 2. Mở draft edit. 3. Gửi/từ chối/confirm trên các fixture tương ứng. 4. Quan sát loading, lỗi và success.
- **Expected Result:** Action/nhãn theo state; draft chưa xác nhận không hiển thị như đã nhập tồn; API error không làm mất draft; thành công hiển thị kết quả và refresh detail/list.
- **Execution Status:** Not Run

### UIUX-WEB-019 — Phiếu xuất và hoàn trả thể hiện dòng/cá thể và kết quả đạt-không đạt

- **Màn hình / Platform:** `/issues`, issue detail, return panel.
- **Priority:** P0
- **Preconditions:** Issue QUANTITY/LOT/ASSET fixture; có phiếu trả được phép và phiếu chưa đủ điều kiện.
- **Các bước:** 1. Mở issue detail. 2. Mở return form. 3. Nhập accepted/rejected quantity và lý do theo contract. 4. Hủy rồi xác nhận trên fixture riêng.
- **Expected Result:** Form cho biết dòng/asset thực trả; accepted và rejected không bị gộp; required reason hiện rõ; không xác nhận đơn giản một cách khó hiểu; sau success hiển thị trạng thái mới.
- **Execution Status:** Not Run

### UIUX-WEB-020 — Điều chuyển thể hiện dispatched, received và discrepancy

- **Màn hình / Platform:** `/transfers`, transfer receive panel và resolve panel.
- **Priority:** P0
- **Preconditions:** Phiếu dispatch đủ, nhận thiếu, chờ resolve và đã resolve.
- **Các bước:** 1. Mở từng trạng thái. 2. Xem lượng yêu cầu/thực xuất/thực nhận/chênh lệch. 3. Mở receive/resolve panel theo role. 4. Hủy panel.
- **Expected Result:** Kho nguồn/đích và số lượng phân biệt rõ; nhận thiếu không bị hiển thị như hoàn tất; action theo role; cancel không ghi nhận nhận/resolve.
- **Execution Status:** Not Run

### UIUX-WEB-021 — Count screen phân biệt tồn hệ thống, số đếm và chênh lệch

- **Màn hình / Platform:** `/counts`, count detail và `count-asset-fields`.
- **Priority:** P0
- **Preconditions:** Count QUANTITY, LOT, ASSET; có case số bằng 0, difference dương/âm và ASSET missing/damaged.
- **Các bước:** 1. Mở list/detail. 2. Nhập số thực tế. 3. Mở trường asset location/condition. 4. Submit/cancel theo quyền.
- **Expected Result:** On-hand/snapshot không bị nhầm actual count; zero và missing biểu thị riêng; ASSET theo cá thể; chênh lệch/approval state được đọc rõ.
- **Execution Status:** Not Run

### UIUX-WEB-022 — Request review hiển thị loại, lý do và quyền xử lý

- **Màn hình / Platform:** `/requests`, request cards/review panel.
- **Priority:** P1
- **Preconditions:** Maintenance request và asset transfer request ở pending/reviewed; role approver và employee.
- **Các bước:** 1. Mở từng request role phù hợp. 2. Thử approve/reject với lý do. 3. Mở lại sau khi đã xử lý.
- **Expected Result:** Request type, asset, Farm, trạng thái và rejection reason nhìn thấy được; người không duyệt không có control thành công; request đã xử lý không còn action lặp.
- **Execution Status:** Not Run

### UIUX-WEB-023 — Màn hình bảo trì phân tách điều phối, kho và quyết định cuối

- **Màn hình / Platform:** `/maintenance`, maintenance record cards/actions.
- **Priority:** P0
- **Preconditions:** Record đã schedule, đang sửa, returned PASSED/FAILED và chờ final decision.
- **Các bước:** 1. Mở record theo từng role. 2. Kiểm tra timeline, đối tác, chi phí, ngày, return receipt. 3. Thử action theo role. 4. Hủy dialog.
- **Expected Result:** Người thực hiện từng bước được thể hiện; hoàn thành sửa không bị nhầm với kho đã nhận; FAILED không hiển thị như khả dụng; giá trị chi phí/nhãn không bị cắt.
- **Execution Status:** Not Run

### UIUX-WEB-024 — Personnel list/detail làm rõ membership, role và workplace

- **Màn hình / Platform:** `/personnel`, `/personnel/[memberId]`, create/edit forms.
- **Priority:** P1
- **Preconditions:** Có user nhiều Farm, nhiều role, workplace và tài khoản inactive fixture.
- **Các bước:** 1. Tìm nhân sự. 2. Mở detail. 3. Tạo/add existing account trên fixture test. 4. Sửa role/workplace/status.
- **Expected Result:** Farm context rõ; role và nơi làm việc không bị trình bày như cùng một khái niệm; validation và trạng thái account/membership đọc được; thao tác lưu có kết quả rõ.
- **Execution Status:** Not Run

### UIUX-WEB-025 — Warehouse list/form phân biệt active/inactive và lỗi validation

- **Màn hình / Platform:** `/warehouses`, warehouse detail/form/filter toolbar.
- **Priority:** P1
- **Preconditions:** Kho active/inactive; actor FARM_OWNER/Warehouse role phù hợp.
- **Các bước:** 1. Lọc danh sách. 2. Tạo/sửa kho với field trống/sai. 3. Mở deactivate confirmation. 4. Hủy rồi xác nhận trên fixture khác.
- **Expected Result:** Trạng thái dễ phân biệt; lỗi field gần input; cảnh báo nêu rõ action sẽ làm gì; hủy không cập nhật kho.
- **Execution Status:** Not Run

### UIUX-WEB-026 — Báo cáo trình bày chart, bảng và CSV theo cùng bộ lọc

- **Màn hình / Platform:** `/reports`, reports tabs, stock-report-tab.
- **Priority:** P1
- **Preconditions:** Có dữ liệu kho theo nhiều kỳ/kho; browser có thể tải file test.
- **Các bước:** 1. Chọn tab/bộ lọc. 2. Đối chiếu chart và bảng. 3. Export nếu action có mặt. 4. Mở CSV test.
- **Expected Result:** Chart/bảng và export dùng cùng filter; tên cột/đơn vị rõ; phần giá chưa định giá có ghi chú riêng; không gọi giá trị ước tính là lợi nhuận.
- **Execution Status:** Not Run

### UIUX-WEB-027 — Audit history đọc được actor và thay đổi trước/sau

- **Màn hình / Platform:** `/history`.
- **Priority:** P2
- **Preconditions:** Fixture có CREATE, UPDATE và event chứa field nested/array.
- **Các bước:** 1. Lọc module/khoảng ngày. 2. Mở từng history entry. 3. Kiểm actor, thời điểm, old/new, phân trang.
- **Expected Result:** Actor có fallback hợp lý; thay đổi được trình bày thành các field dễ đọc, không lộ raw secret/token; filter/pagination không làm mất phạm vi.
- **Execution Status:** Not Run

### UIUX-WEB-028 — Notification center phân biệt chưa đọc/đã đọc và liên kết đúng hồ sơ

- **Màn hình / Platform:** Notification bell/center trên dashboard.
- **Priority:** P2
- **Preconditions:** Có notification chưa đọc, đã đọc và target record tồn tại/không còn tồn tại.
- **Các bước:** 1. Mở notification center. 2. Đánh dấu đọc một dòng và tất cả. 3. Mở notification detail link. 4. Kiểm empty/error.
- **Expected Result:** Badge/read state cập nhật sau response thành công; lỗi API được giữ hiển thị; link dẫn đúng Farm/record hoặc thông báo không thể mở; không dùng click để thay đổi nghiệp vụ target.
- **Execution Status:** Not Run

### UIUX-WEB-029 — Catalog admin phân biệt DRAFT/PUBLISHED/ARCHIVED

- **Màn hình / Platform:** `/store-products`, product detail/form, variant form, status control.
- **Priority:** P1
- **Preconditions:** Product ở ba trạng thái; ADMIN/FARM_OWNER/STORE_MANAGER fixture.
- **Các bước:** 1. Mở list theo từng status. 2. Tạo draft. 3. Mở status action. 4. Đăng nhập role không có quyền và mở trực tiếp URL.
- **Expected Result:** Trạng thái và action phân biệt; DRAFT được chỉnh mà không bắt đủ điều kiện publish; role không quyền không thực hiện mutation qua UI/direct route; không hiển thị workflow approval không tồn tại.
- **Execution Status:** Not Run

### UIUX-WEB-030 — Quản lý hình ảnh sản phẩm có empty/loading/error state

- **Màn hình / Platform:** Store product images/gallery admin.
- **Priority:** P2
- **Preconditions:** Product không ảnh và product có nhiều ảnh; API fixture trả lỗi upload/list.
- **Các bước:** 1. Mở product detail. 2. Thêm/sắp xếp/sửa/xóa ảnh theo chức năng hiện có. 3. Giả lập lỗi upload. 4. Kiểm tra preview/loading.
- **Expected Result:** Ảnh hiện thứ tự nhất quán; upload error không giả thành công; thao tác sắp xếp/xóa có phản hồi; UI không hiển thị token/secret hoặc URL có credential.
- **Execution Status:** Not Run

### UIUX-WEB-031 — Store sales settings và phí giao có quyền và vùng rõ ràng

- **Màn hình / Platform:** `/store-products` settings, shipping fees.
- **Priority:** P0
- **Preconditions:** Farm đã có sales settings; ADMIN/FARM_OWNER/STORE_MANAGER fixtures.
- **Các bước:** 1. Mở settings. 2. Chọn kho bán/region. 3. Mở shipping fees bằng từng role. 4. Nhập phí sai/đúng.
- **Expected Result:** Kho bán và vùng của Farm hiển thị rõ; phí chung được phân biệt với cấu hình Farm; lỗi amount được chỉ rõ; control bị ẩn không thay thế kiểm tra API.
- **Execution Status:** Not Run

### UIUX-WEB-032 — Store orders/payment/delivery có status và action nhất quán

- **Màn hình / Platform:** `/store-orders`, order detail/customer detail, `/store-payments`.
- **Priority:** P0
- **Preconditions:** Order PENDING, PAID/unpaid, SHIPPING, COMPLETED, cancelled; COD và BANK_TRANSFER.
- **Các bước:** 1. Lọc danh sách. 2. Mở từng order. 3. Kiểm nút confirm/ship/complete/refund/mark paid theo role/state. 4. Mở payment detail.
- **Expected Result:** Payment method/status không bị nhầm; action theo trạng thái/role; đơn bank chưa PAID không nhìn như sẵn giao; thông tin khách và snapshot được trình bày rõ.
- **Execution Status:** Not Run

### UIUX-WEB-033 — Delivery screen xác định người giao và trạng thái lần giao

- **Màn hình / Platform:** `/deliveries`.
- **Priority:** P1
- **Preconditions:** Delivery được phân công và một order chưa phân công; user DELIVERY_STAFF.
- **Các bước:** 1. Mở danh sách deliveries. 2. Mở detail. 3. Thử đánh dấu giao thành công/không thành công. 4. Reload sau phản hồi.
- **Expected Result:** Người nhận, địa chỉ, COD và trạng thái rõ; user chỉ thao tác đơn được giao; error không đổi trạng thái cục bộ như đã thành công.
- **Execution Status:** Not Run

### UIUX-WEB-034 — Warranty screen thể hiện timeline, quote và quyết định khách

- **Màn hình / Platform:** `/store-warranties` và detail/action panel.
- **Priority:** P1
- **Preconditions:** Warranty claim ở intake, sent, quoted, declined, returned, exchanged/closed.
- **Các bước:** 1. Lọc và mở claim. 2. Thực hiện quote/decide/return/exchange action được phép. 3. Đóng/mở lại detail.
- **Expected Result:** Claim gắn với order/line/asset đúng; timeline và quyết định khách dễ đọc; consent không bị hiển thị thành đã thu tiền; action terminal không lặp.
- **Execution Status:** Not Run

### UIUX-WEB-035 — QR lookup phân biệt item, balance và asset result

- **Màn hình / Platform:** `/scan`, `/scan/[assetCode]`, `/scan/item/[itemId]`, `/scan/inventory/[balanceId]`.
- **Priority:** P1
- **Preconditions:** Có nhãn hợp lệ cho item/balance/asset và một nhãn sai Farm.
- **Các bước:** 1. Nhập/quét mã. 2. Mở kết quả. 3. Quét mã lỗi/sai Farm. 4. Thử từ bàn phím.
- **Expected Result:** Kết quả ghi rõ loại hồ sơ; invalid/foreign label có lỗi có thể hiểu; tra cứu không cung cấp action ghi nếu role không đủ.
- **Execution Status:** Not Run

## 5. Mobile

### UIUX-MOB-001 — Đăng nhập và hết hạn phiên có trạng thái rõ

- **Màn hình / Platform:** Mobile `/auth`, AuthScreen.
- **Priority:** P1
- **Preconditions:** Thiết bị test iOS/Android hoặc emulator; Clerk test tenant.
- **Các bước:** 1. Đăng nhập sai. 2. Đăng nhập đúng. 3. Làm phiên hết hạn. 4. Mở route bảo vệ.
- **Expected Result:** Sai credential có thông báo an toàn; loading không khóa vĩnh viễn; session hết hạn dẫn về auth và không để lộ dữ liệu cũ.
- **Execution Status:** Not Run

### UIUX-MOB-002 — Mobile shell, menu và nội dung không bị bàn phím che

- **Màn hình / Platform:** Mobile app shell, navigation, form pages.
- **Priority:** P1
- **Preconditions:** Điện thoại 375×812; có form dài và bàn phím ảo.
- **Các bước:** 1. Mở menu/route. 2. Đi tới field cuối form. 3. Mở bàn phím và cuộn. 4. Xoay thiết bị nếu hỗ trợ.
- **Expected Result:** Nút lưu/hủy và field đang sửa vẫn truy cập được; menu đóng/mở nhất quán; nội dung không bị keyboard che mà không có cách cuộn.
- **Execution Status:** Not Run

### UIUX-MOB-003 — Dashboard Mobile ghi rõ phạm vi số liệu

- **Màn hình / Platform:** Mobile `/dashboard`, DashboardScreen.
- **Priority:** P1
- **Preconditions:** Farm có dữ liệu nhiều kho; role user có scope kho giới hạn và role OWNER toàn Farm.
- **Các bước:** 1. Mở dashboard theo hai role. 2. Kiểm tra nhãn phạm vi, khoảng ngày, tổng số và loading/error state.
- **Expected Result:** Nhãn không gọi danh sách/page giới hạn là tổng toàn Farm; số liệu thể hiện scope Farm/warehouse tương ứng; không hiện giá chưa biết như giá trị đầy đủ.
- **Execution Status:** Not Run

### UIUX-MOB-004 — Inventory list/detail/ledger giữ được bộ lọc và đơn vị

- **Màn hình / Platform:** Mobile `/inventory`, `/inventory-detail`, `/inventory-ledger`, `/low-stock`, `/lots/[id]`.
- **Priority:** P1
- **Preconditions:** Nhiều item QUANTITY/LOT/ASSET; date range và lot fixture.
- **Các bước:** 1. Lọc danh sách. 2. Mở detail/lot/ledger. 3. Dùng date range. 4. Quay về list.
- **Expected Result:** Tên, mã, đơn vị, lot và trạng thái rõ; page/date filters không làm lẫn giao dịch; empty/error states không bị nhầm với số 0 tồn.
- **Execution Status:** Not Run

### UIUX-MOB-005 — Receipt list và form tạo nháp có validation và save feedback

- **Màn hình / Platform:** `/receipts`, `/receipts/new`, `/receipts/[id]`.
- **Priority:** P1
- **Preconditions:** Receipt fixture DRAFT; item QUANTITY/LOT/ASSET; API delay/error harness.
- **Các bước:** 1. Tạo draft với field thiếu. 2. Sửa và lưu. 3. Mở lại draft. 4. Thực hiện submit riêng trên fixture.
- **Expected Result:** Field error chỉ đúng dữ liệu; save success/error hiển thị rõ; loading chặn gửi lặp; user thấy được nội dung đã lưu trước submit.
- **Execution Status:** Not Run

### UIUX-MOB-006 — Receipt detail không làm mất thay đổi khi sửa rồi submit

- **Màn hình / Platform:** `/receipts/[id]`, ReceiptDetailScreen.
- **Priority:** P0
- **Preconditions:** Receipt DRAFT được tạo trước; sửa một trường dòng; không có request đồng thời.
- **Các bước:** 1. Mở draft. 2. Sửa số lượng/note/location hợp lệ. 3. Lưu. 4. Tải lại detail. 5. Submit. 6. Đọc lại Web/API.
- **Expected Result:** Submit chỉ dùng dữ liệu sau PATCH/lưu thành công; nếu save thất bại thì không submit dữ liệu cũ như mới; Web thấy nội dung giống Mobile.
- **Execution Status:** Not Run

### UIUX-MOB-007 — Stock count form phân biệt số hệ thống và số đếm

- **Màn hình / Platform:** `/counts/new`, `/counts/[id]`, StockCountScreen.
- **Priority:** P0
- **Preconditions:** Có MAT-Q balance, LOT-A và ASSET-A; count đang DRAFT.
- **Các bước:** 1. Mở count. 2. Nhập actual quantity bằng 0/giá trị hợp lệ. 3. Kiểm tra ASSET picker/condition/location. 4. Save/submit.
- **Expected Result:** Nhãn số hệ thống và số đếm thực tế phân biệt; số 0 không bị coi là field trống; ASSET nhập theo cá thể, location/tình trạng có thể nhập theo contract.
- **Execution Status:** Not Run

### UIUX-MOB-008 — Mobile stock count ASSET hiển thị theo cá thể

- **Màn hình / Platform:** `/counts/new`, `/counts/[id]`.
- **Priority:** P0
- **Preconditions:** ASSET-A trong WH-A; user có quyền count; API list trả asset count data.
- **Các bước:** 1. Chọn kho. 2. Tìm ASSET-A. 3. Nhập found/missing, condition và found location. 4. Lưu rồi mở Web.
- **Expected Result:** Có thể thao tác từng ASSET theo ID, tình trạng và vị trí; dữ liệu Mobile gửi đúng và Web đọc lại; không quy đổi thành tổng QUANTITY.
- **Execution Status:** Not Run
- **Implementation Status:** Gap đã biết tại source HEAD: StockCountScreen lọc ASSET và không có assetCondition/foundLocationId UI. Đây là gap thiết kế, không phải kết quả Fail runtime.

### UIUX-MOB-009 — Phiếu chuyển báo đúng DISCREPANCY, không báo đã kết thúc

- **Màn hình / Platform:** `/transfers/[id]`, `TransferNotificationDetailScreen`.
- **Priority:** P0
- **Preconditions:** Phiếu đã dispatch 10, nhận 8, status đang chờ xử lý chênh lệch.
- **Các bước:** 1. Mở thông báo/phiếu. 2. Kiểm badge, lượng dispatch/receive, discrepancy, reason và source/destination. 3. Mở phiếu sau resolve.
- **Expected Result:** DISCREPANCY được hiểu là đang chờ xử lý; hiển thị số đã xuất/nhận/lệch khi có; không nói tồn kho không đổi/phiếu kết thúc khi nguồn đã giảm và đích đã nhận một phần.
- **Execution Status:** Not Run
- **Implementation Status:** Gap đã biết tại source HEAD: nhãn/badge/default message chưa xử lý DISCREPANCY đúng.

### UIUX-MOB-010 — Asset detail và return form hiển thị tình trạng trước khi gửi

- **Màn hình / Platform:** Mobile asset detail/return route hiện có, `AssetDetailScreen`.
- **Priority:** P0
- **Preconditions:** ASSET-A đang được sử dụng; có tình huống GOOD và DAMAGED trong fixture.
- **Các bước:** 1. Mở asset. 2. Chọn return. 3. Chọn condition và note. 4. Lưu; Web mở lại kết quả.
- **Expected Result:** Asset identity/serial/holder/location không bị nhầm; condition truyền đúng; khi app không hỗ trợ field thì không giả vờ đã lưu/không gửi payload làm mất condition.
- **Execution Status:** Not Run

### UIUX-MOB-011 — Maintenance request/history/detail có trạng thái và ngày dễ đọc

- **Màn hình / Platform:** `/maintenance/new`, `/maintenance/history`, `/maintenance/requests/[id]`.
- **Priority:** P1
- **Preconditions:** Request pending, approved, rejected và record đang bảo trì.
- **Các bước:** 1. Tạo request. 2. Mở history/detail. 3. Xem lịch/ngày và lý do reject. 4. Dùng refresh.
- **Expected Result:** Ngày giờ theo local format nhất quán; status/reason/asset ID dễ nhận biết; refresh error không giả thành dữ liệu mới.
- **Execution Status:** Not Run

### UIUX-MOB-012 — QR scanner xin quyền camera và có phương án khi camera lỗi

- **Màn hình / Platform:** `/scan`, `/scan/[qrToken]`, QR scan/result screens.
- **Priority:** P1
- **Preconditions:** Thiết bị có/không cấp quyền camera; QR hợp lệ và QR sai.
- **Các bước:** 1. Mở scanner lần đầu và từ chối quyền. 2. Mở lại sau khi cấp quyền. 3. Quét mã hợp lệ và mã lỗi.
- **Expected Result:** App giải thích quyền camera; từ chối quyền không làm app treo; kết quả đúng loại hồ sơ; lỗi/mã lạ hiển thị rõ và không ghi nghiệp vụ.
- **Execution Status:** Not Run

### UIUX-MOB-013 — Notification center/detail tải lại và điều hướng đúng bản ghi

- **Màn hình / Platform:** `/notifications`, account notifications, transfer notification detail.
- **Priority:** P1
- **Preconditions:** Có notification STOCK_RECEIPT, STOCK_TRANSFER, MAINTENANCE_RECORD và loại không hỗ trợ.
- **Các bước:** 1. Mở notification list. 2. Đánh dấu đã đọc. 3. Mở deep link. 4. Làm mới và giả lập API lỗi.
- **Expected Result:** Read/unread hiển thị rõ; link tới ID đúng; loại không hỗ trợ không dẫn nhầm route; lỗi giữ nội dung và cho retry.
- **Execution Status:** Not Run

### UIUX-MOB-014 — Account/profile/preferences giữ trạng thái sau khi lưu

- **Màn hình / Platform:** `/account`, `/account/profile`, `/account/notifications`.
- **Priority:** P2
- **Preconditions:** User có profile/contact và notification preferences fixture.
- **Các bước:** 1. Mở profile. 2. Sửa field hợp lệ. 3. Lưu và tải lại. 4. Đổi notification setting.
- **Expected Result:** Giá trị lưu được hiển thị lại sau reload; lỗi không bị che; setting không đổi khi request thất bại.
- **Execution Status:** Not Run

### UIUX-MOB-015 — Activity list/detail phân biệt bản ghi liên quan và thao tác tạo mới

- **Màn hình / Platform:** `/activity`, `/activity/[id]`, `/activity/record`.
- **Priority:** P2
- **Preconditions:** Có activity record liên quan nhiều chứng từ và một user không có quyền ghi.
- **Các bước:** 1. Mở list/detail. 2. Mở related record link. 3. Thử record action bằng role read-only.
- **Expected Result:** Nội dung gắn đúng chứng từ; route liên kết không nhầm Farm; user read-only không thấy action thành công; empty state rõ.
- **Execution Status:** Not Run

### UIUX-MOB-016 — Bảng/form Mobile không tràn ngang và action chính luôn dùng được

- **Màn hình / Platform:** Inventory, receipt, count, transfer, maintenance, notifications.
- **Priority:** P1
- **Preconditions:** Điện thoại portrait và landscape; text dài/mã dài; bàn phím mở.
- **Các bước:** 1. Mở các màn hình đã liệt kê. 2. Xoay thiết bị. 3. Cuộn ngang/dọc nếu màn hỗ trợ. 4. Tab/VoiceOver/TalkBack qua action chính.
- **Expected Result:** Dữ liệu quan trọng và action không bị che; nội dung dài xuống dòng hoặc cuộn trong vùng phù hợp; nút có nhãn đọc được; không đặt tiêu chí score/pixel chưa thống nhất.
- **Execution Status:** Not Run

### UIUX-MOB-017 — Danh sách và chi tiết yêu cầu điều chuyển ASSET giữ đúng ngữ cảnh

- **Màn hình / Platform:** Mobile `/assets/transfer-request`, `/assets/transfer-requests/[id]`.
- **Priority:** P1
- **Preconditions:** Có yêu cầu chuyển ASSET ở các trạng thái chờ xử lý, đã dispatch và đã receive; user có quyền đọc trong Farm fixture.
- **Các bước:** 1. Mở danh sách yêu cầu và dùng bộ lọc/tải lại nếu có. 2. Mở từng chi tiết fixture. 3. Đối chiếu ASSET code/serial, kho nguồn/đích, actor và trạng thái với Web/API. 4. Đổi Farm rồi mở lại deep link cũ.
- **Expected Result:** Danh sách và chi tiết thể hiện cùng yêu cầu, đúng cá thể và hai kho; trạng thái chuyển tiếp không bị trình bày như hoàn tất trước khi kho đích nhận; deep link không làm lộ dữ liệu Farm khác.
- **Execution Status:** Not Run

## 6. Ánh xạ route hiện có sang bộ UI/UX

Các route được lấy từ `web/app/**/page.tsx` và `mobile/app/**/*.{tsx,ts}` ở HEAD nêu trên. Một ca có thể bao phủ nhiều route cùng một mẫu giao diện; bảng này là bản đồ độ phủ màn hình, không khẳng định ca đã chạy.

### Web

| Pathname | Test Case |
|---|---|
| `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]`, `/auth/continue`, `/account/change-password` | UIUX-WEB-002, 005, 007 |
| `/dashboard` | UIUX-WEB-001, 014 |
| `/assets`, `/assets/[id]` | UIUX-WEB-017 |
| `/catalog`, `/store-products`, `/store-products/[id]` | UIUX-WEB-029, 030 |
| `/counts` | UIUX-WEB-021 |
| `/deliveries` | UIUX-WEB-033 |
| `/history` | UIUX-WEB-027 |
| `/inventory` | UIUX-WEB-015 |
| `/issues`, `/issues/[id]` | UIUX-WEB-019 |
| `/maintenance` | UIUX-WEB-023 |
| `/materials` | UIUX-WEB-016 |
| `/personnel`, `/personnel/[memberId]` | UIUX-WEB-024 |
| `/receipts` | UIUX-WEB-018 |
| `/reports`, `/store-reports` | UIUX-WEB-026 |
| `/requests` | UIUX-WEB-022 |
| `/scan`, `/scan/[assetCode]`, `/scan/item/[itemId]`, `/scan/inventory/[balanceId]` | UIUX-WEB-035 |
| `/store-orders`, `/store-orders/[id]`, `/store-orders/customers/[userId]`, `/store-payments` | UIUX-WEB-032 |
| `/store-stock` | UIUX-WEB-015, 031 |
| `/store-warranties` | UIUX-WEB-034 |
| `/transfers` | UIUX-WEB-020 |
| `/warehouses` | UIUX-WEB-025 |
| `/`, `/about`, `/blog`, `/contact`, `/policy/[slug]` | UIUX-WEB-008 |
| `/products` | UIUX-WEB-009 |
| `/products/[slug]` | UIUX-WEB-010 |
| `/cart` | UIUX-WEB-011 |
| `/checkout` | UIUX-WEB-012 |
| `/orders`, `/orders/[id]`, `/track-order` | UIUX-WEB-013 |

### Mobile

| Pathname / layout | Test Case |
|---|---|
| Expo layout `_layout.tsx` (shell, không phải URL) và `/` | UIUX-MOB-002 |
| `/auth` | UIUX-MOB-001 |
| `/dashboard` | UIUX-MOB-003, 016 |
| `/inventory`, `/inventory-detail`, `/inventory-ledger`, `/low-stock`, `/lots/[id]` | UIUX-MOB-004, 016 |
| `/receipts`, `/receipts/new`, `/receipts/[id]` | UIUX-MOB-005, 006, 016 |
| `/counts/new`, `/counts/[id]` | UIUX-MOB-007, 008 |
| `/assets/return` | UIUX-MOB-010 |
| `/assets/transfer-request`, `/assets/transfer-requests/[id]` | UIUX-MOB-017 |
| `/maintenance/history`, `/maintenance/new`, `/maintenance/requests/[id]` | UIUX-MOB-011 |
| `/materials/new` | UIUX-MOB-016 |
| `/scan`, `/scan/[qrToken]`, `/scan/inventory/[balanceId]`, `/scan/item/[itemId]` | UIUX-MOB-012 |
| `/transfers/new`, `/transfers/[id]` | UIUX-MOB-009, 016 |
| `/notifications`, `/account/notifications` | UIUX-MOB-013, 014 |
| `/account`, `/account/profile` | UIUX-MOB-014 |
| `/activity`, `/activity/record`, `/activity/[id]` | UIUX-MOB-015 |

## 7. Kiểm kê UI/UX

- Web: 35 ca thiết kế; bao quát storefront công khai, auth, dashboard, kho, chứng từ, kiểm kê, bảo trì, nhân sự, báo cáo, lịch sử, catalog, đơn, thanh toán, giao hàng, bảo hành, QR.
- Mobile: 17 ca thiết kế; bao quát auth, dashboard, tồn, phiếu nhập, kiểm kê, tài sản/hoàn trả/điều chuyển, bảo trì, QR, notification, account và activity.
- Tổng: **52 UI/UX Test Case** (35 Web, 17 Mobile), tất cả `Not Run`.
- Không có automated browser E2E/visual test trong source tại HEAD đã kiểm tra. Các ca Mobile ASSET count và transfer DISCREPANCY giữ lại để xác nhận implementation gap; không được đánh Fail trước khi chạy UI thật.
