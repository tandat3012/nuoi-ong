# Chặng 6 — Kiểm thử chấp nhận thông báo trên điện thoại

**Trạng thái: checklist dự kiến, chưa ghi nhận nghiệm thu.** Đây là kiểm thử end-to-end sau chặng 5; các mục push thật ở [chặng 4](./04-push-worker.md) và tap routing ở [chặng 5](./05-push-tap-navigation.md) phải được kiểm tra riêng trước.

## Chuẩn bị

- [ ] Android development APK đã cài, có `expo-notifications` và cấu hình FCM V1 đúng Firebase Android app / EAS project.
- [ ] Đã cấp quyền notification ở Android và channel `stock-documents` được bật.
- [ ] Điện thoại truy cập API; API dùng DB local đúng dữ liệu farm; worker bật có chủ ý.
- [ ] Tài khoản test có membership ACTIVE trong farm và role phù hợp. Dùng Web/Swagger làm tài khoản thực hiện nghiệp vụ ở phía còn lại.
- [ ] Đăng ký thật của điện thoại đang active; xóa/DELETE token giả Swagger trước khi bật worker.
- [ ] Có sẵn query outbox trong [tài liệu chặng 4](./04-push-worker.md); không ghi Expo token, Clerk JWT hoặc FCM key vào ảnh/báo cáo.

## Ma trận kiểm thử

### Giao nhận từ nghiệp vụ

- [ ] Nhân viên gửi phiếu cần duyệt; điện thoại của owner/admin trong đúng farm nhận push chờ duyệt.
- [ ] Owner/admin duyệt phiếu; đúng người tạo nhận push xác nhận.
- [ ] Owner/admin từ chối phiếu; đúng người tạo nhận push từ chối, lý do đúng với DB.
- [ ] Chạy các loại có luồng notification: nhập kho, xuất kho, điều chuyển kho, kiểm kê và yêu cầu bảo trì. Không tự tạo push cho nháp hoặc sự kiện không thuộc quy tắc nghiệp vụ.
- [ ] Người gửi không nhận push yêu cầu tự duyệt; farm khác và tài khoản không đủ role không nhận notification.
- [ ] Notification trong app vẫn đọc được từ DB ngay cả khi push bị từ chối, bị tắt quyền hoặc thiết bị offline.

### Trạng thái app và hiển thị hệ điều hành

- [ ] App foreground: push hợp lệ hiện banner theo quyền/channel, không hiện push của account/farm khác.
- [ ] App background hoặc khóa màn hình: push hiển thị trong khay thông báo Android.
- [ ] App bị đóng hẳn rồi chạm push: mở app và xử lý response đúng một lần sau khi Clerk/AuthContext sẵn sàng.
- [ ] Chạm nhiều lần hoặc response lặp: không mở nhiều màn hình, không gọi mark-read lặp gây sai trạng thái.
- [ ] Tắt quyền/channel: không kỳ vọng Android hiển thị push; nghiệp vụ và Notification Center vẫn hoạt động.
- [ ] Đăng xuất rồi phát sinh sự kiện: device không nhận job mới; notification lịch sử không bị xóa.

### Định tuyến, farm và tài khoản

- [ ] Tap push gửi tới từng loại phiếu mở đúng màn hình chi tiết theo route allowlist hiện có.
- [ ] Notification thuộc farm khác đang chọn nhưng farm vẫn thuộc membership: app chọn đúng farm rồi mở phiếu.
- [ ] Farm không nằm trong membership hiện tại: không điều hướng vào dữ liệu; không tự thêm/chọn farm.
- [ ] Payload recipient khác user đang đăng nhập hoặc response đến sau khi đổi tài khoản: bỏ qua; không đổi farm, không đánh dấu đã đọc.
- [ ] Tap notification hợp lệ đánh dấu đúng notification đã đọc; trạng thái đọc cập nhật trong Notification Center.
- [ ] Phiếu đã được xử lý trước lúc tap: mở chi tiết hiện trạng thái cuối hiện tại từ API, không dùng status cũ trong payload làm trạng thái phiếu.
- [ ] Payload thiếu ID, UUID sai, loại không hỗ trợ hoặc route không allowlist: không crash và không điều hướng tùy ý.
- [ ] API chậm/mất mạng khi tap: app không crash; hiển thị lỗi có thể thử lại, không đánh dấu đã đọc cục bộ khi PATCH thất bại.

### Đối chiếu API/DB và vận hành

- [ ] Job hợp lệ tiến tới `SUCCEEDED` sau khi receipt được xác nhận; lỗi có phân loại và retry theo chính sách chặng 4.
- [ ] `notification_push_outbox.notification_id` trỏ đúng notification/user; `device_push_token_id` trỏ đúng installation/user.
- [ ] Không có job chưa hoàn tất cho device inactive hoặc cặp notification/device khác chủ sở hữu.
- [ ] Mỗi nghiệp vụ chỉ có notification tới người nhận đã quy định; chuyển farm/account không phát sinh lộ chéo.
- [ ] Không có token/JWT/service key trong log Metro, log API, nội dung tài liệu hoặc ảnh chụp kết quả.

## Mẫu ghi kết quả

Mỗi lần test ghi: ngày giờ, model/Android, mã build APK EAS, farm code, role tài khoản nhận, loại phiếu/trạng thái, trạng thái app (foreground/background/cold start), thao tác, kết quả mong đợi/thực tế, outbox status và pass/fail. Chỉ ghi email rút gọn nếu cần đối chiếu; không đưa bí mật xác thực vào báo cáo.

## Điều kiện hoàn tất

Chặng thông báo trên điện thoại chỉ được coi là hoàn thiện khi các mục bắt buộc ở giao nhận, tap routing, farm/account và DB đều đạt trên điện thoại thật; không có lỗi nghiêm trọng về lộ dữ liệu, sai người nhận, sai farm hoặc mở sai phiếu. Ghi lại mục không thể chạy và lý do thay vì đánh dấu đạt. Đây là kế hoạch test, không phải bằng chứng các bước đã chạy.
