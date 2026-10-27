# Chặng 5 — Chạm push và mở đúng phiếu

**Trạng thái: đã triển khai, kiểm thử tự động đạt và người dùng xác nhận chạy được trên điện thoại thật (27/10/2026).** Listener xử lý push response khi app đang chạy hoặc mở từ nền/tắt đã được nối với điều hướng hiện có. Code xác thực payload, danh tính Clerk so với `/auth/me`, recipient DB, membership farm, route allowlist, chuyển farm, đánh dấu đã đọc và dedupe. Việc test thành công xác nhận luồng tap đã hoạt động; ma trận các loại phiếu/trạng thái và trường hợp sai tài khoản/farm vẫn thuộc nghiệm thu tổng chặng 6.

## Mục tiêu

- Chạm một push sẽ mở đúng chứng từ/ yêu cầu tương ứng với notification.
- Chỉ điều hướng nếu notification thuộc user đang đăng nhập và farm vẫn nằm trong membership hiện tại.
- Nếu notification thuộc farm khác mà user hiện tại có membership ACTIVE, chuyển farm qua `AuthContext.selectFarm` rồi mới mở chi tiết.
- Dùng PATCH đánh dấu đúng notification đã đọc; không tạo hoặc sửa notification, phiếu, tồn kho hay quyền nghiệp vụ.
- Push không hợp lệ, cũ, trùng response hoặc của tài khoản khác không làm app đổi farm, không mở dữ liệu chéo tài khoản và không đánh dấu nhầm notification.

## Luồng đã triển khai

1. Đăng ký response listener khi app đang chạy và đọc/clear cold-start response một lần bằng Expo Notifications.
2. Đọc payload theo hợp đồng worker: `version`, `notificationId`, `recipientUserId`, `farmId`, `entityType`, `entityId`, `type`. Payload là dữ liệu định tuyến không đáng tin cho tới khi so khớp với phiên và membership hiện tại.
3. Chờ Clerk và `/auth/me` hoàn tất. So `recipientUserId` với DB user đang đăng nhập; response đến muộn của tài khoản cũ phải bị bỏ qua. Khi đăng xuất/chuyển tài khoản, xóa response đang chờ của phiên trước.
4. Kiểm tra UUID, loại chứng từ và cặp trạng thái/loại đã hỗ trợ. Dùng route map cố định hiện tại; không nhận URL tùy ý từ payload.
5. Kiểm tra `farmId` có trong `auth.memberships`. Nếu không có, dừng điều hướng và báo không có quyền. Nếu có nhưng chưa phải farm đang chọn, gọi `selectFarm(farmId)` để lưu/chuyển farm đúng quy ước app.
6. Gọi `PATCH /notifications/{notificationId}/read?farmId=...` theo quyền API hiện có rồi điều hướng tới route chi tiết. Nếu PATCH lỗi nhưng payload và phiên vẫn hợp lệ, báo lỗi và vẫn mở route đã allowlist như Notification Center hiện có; trạng thái unread giữ nguyên, không đánh dấu cục bộ là đã đọc.
7. Dedupe response theo notification/response identifier trong vòng đời khởi động để một lần chạm không mở hai màn hình hoặc gửi hai PATCH.
8. Detail screen tiếp tục tải dữ liệu từ API có kiểm tra farm/quyền. Không nhúng dữ liệu nhạy cảm hoặc thông tin phiếu làm nguồn sự thật vào push.

## Phạm vi kỹ thuật đã triển khai

- Điểm tích hợp: `mobile/src/features/notifications/context/PushRegistrationProvider.tsx`, `mobile/src/features/notifications/push-response.ts`, `mobile/src/features/notifications/api.ts`, route map và các route hiện có trong `mobile/app/`.
- Tái sử dụng `notificationRoute`, `markNotificationRead`, `AuthContext.selectFarm` và các màn hình chi tiết hiện tại.
- Khi auth còn loading, response chỉ được giữ tạm trong bộ nhớ. Khi auth kết thúc, đối chiếu `recipientUserId`; nếu user khác hoặc người dùng logout thì bỏ response, không lưu chéo sang lần đăng nhập khác.
- Không cần migration, bảng mới, thay người nhận push hoặc thay transaction nghiệp vụ nếu API hiện tại đáp ứng PATCH đọc thông báo và detail endpoint theo farm.
- Unit tests bao phủ parse/validate payload, đối chiếu recipient, farm membership và route allowlist. Dedupe và vòng đời listener được xử lý trong provider; cần kiểm thử thiết bị cho cold start, account switch và farm switch.
- Giữ nguyên hành vi tap từ Notification Center; không tạo popup thay thế hay thêm điều hướng UI không liên quan.

## Cách kiểm thử chặng 5 trên thiết bị thật

1. Cài development APK có `expo-notifications`; đăng nhập đúng tài khoản nhận push, bảo đảm API và `PUSH_WORKER_ENABLED=true` đang chạy.
2. **App nền:** nhận push, chạm push. App phải mở đúng phiếu/yêu cầu và chọn đúng farm nếu tài khoản có membership ACTIVE ở farm đó.
3. **Cold start:** đóng hẳn app, tạo push mới, chạm push từ khay thông báo. Sau khi Clerk và `/auth/me` tải xong, app phải mở đúng chi tiết.
4. Kiểm tra notification tương ứng đã đọc trong Notification Center/API. Nếu API PATCH đọc lỗi, app vẫn mở route an toàn và báo lỗi; không được tự đánh dấu đã đọc cục bộ.
5. Xác nhận push không mở route tùy ý, không đổi farm nếu farm không còn membership, và không mở/đánh dấu tin gửi cho user khác sau khi đổi tài khoản.
6. Chạm cùng một response lặp lại không được tạo nhiều lần điều hướng.

**Dừng tại chặng 5:** code và kiểm thử tự động hoàn tất; chưa đánh dấu kiểm thử thiết bị đạt. Sau khi người dùng chạy các ca trên, mới sang nghiệm thu tổng chặng 6.

Liên kết: [worker và kiểm thử thiết bị chặng 4](./04-push-worker.md), [kiểm thử chấp nhận chặng 6](./06-device-acceptance.md).
