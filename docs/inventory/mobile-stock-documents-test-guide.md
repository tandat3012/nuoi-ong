# Hướng dẫn kiểm thử chi tiết phiếu kho trên Mobile

**Trạng thái:** có thay đổi trong code; `pnpm typecheck` đã đạt. Kiểm thử thủ công trên thiết bị chưa được ghi nhận.

Tài liệu này hướng dẫn kiểm tra cách trình bày và dữ liệu của chi tiết phiếu nhập, phiếu xuất, điều chuyển kho trên Mobile. Nội dung nghiệp vụ, trạng thái phiếu và quyền thao tác phải giữ theo dữ liệu/API hiện tại.

## Chuẩn bị

- Chạy API và database của môi trường test; đăng nhập tài khoản có membership ACTIVE ở farm có dữ liệu chứng từ.
- Chuẩn bị ít nhất một phiếu nhập, một phiếu xuất và một phiếu điều chuyển đã tồn tại trong DB. Ghi lại mã phiếu, trạng thái, farm và kho của từng phiếu từ Web hoặc API.
- Mở Mobile development build hoặc Expo Go theo cấu hình hiện dùng; bảo đảm thiết bị gọi được API.

## Kiểm thử danh sách và chi tiết phiếu nhập/xuất

1. Mở **Phiếu kho**, chọn từng loại phiếu nhập và phiếu xuất; mở một phiếu có sẵn.
2. Đối chiếu mã phiếu, trạng thái, thời gian, người tạo, kho và ghi chú với Web/API.
3. Xác nhận thông tin được chia thành các card/khối nội dung rõ ràng, các dòng vật tư có tên, mã, đơn vị và số lượng tương ứng; lô hoặc tài sản phải đúng dòng.
4. Kiểm tra kho xuất hiện ở cả phần thông tin phiếu và phần tổng kết. Không được hiện “Chọn kho”/“Chưa chọn” nếu API trả `warehouseId` hợp lệ thuộc farm đang xem.
5. Mở phiếu thuộc kho khác trong cùng farm và kiểm tra đúng tên/mã kho khác đó được hiển thị.
6. Mở phiếu của farm khác bằng tài khoản không có quyền truy cập; dữ liệu không được lộ qua danh sách hoặc chi tiết.
7. Với trạng thái không phải `DRAFT`, xác nhận các trường và dòng phiếu không cho sửa. Với `DRAFT`, xác nhận khả năng sửa đúng theo quyền hiện có.

## Kiểm thử chi tiết điều chuyển

1. Mở một phiếu điều chuyển từ danh sách hoặc thông báo hợp lệ.
2. Đối chiếu kho nguồn, kho đích, thời gian, người tạo, trạng thái, ghi chú và từng dòng vật tư với Web/API.
3. Xác nhận bố cục card dễ đọc và tên/mã/số lượng/lô hoặc tài sản gắn đúng dòng.
4. Mở phiếu ở trạng thái đã gửi/đã xử lý và xác nhận không thể chỉnh sửa dữ liệu. Kiểm tra các thao tác duyệt/từ chối chỉ xuất hiện theo role và trạng thái được phép.

## Kết quả cần ghi lại

Ghi mã build, model/Android, farm code, loại và mã phiếu, trạng thái, kho nguồn/đích, kết quả đối chiếu Web/API và ảnh màn hình nếu có lỗi. Không ghi Clerk JWT, Expo token hoặc khóa dịch vụ.

**Chỉ đánh dấu kiểm thử thiết bị đạt sau khi các ca trên được chạy thực tế.** Lỗi cần báo kèm loại phiếu, trạng thái, `warehouseId` đã đối chiếu và nội dung UI đang hiển thị.
