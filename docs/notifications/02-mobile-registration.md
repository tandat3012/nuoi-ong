# Chặng 2 — Mobile đăng ký thiết bị nhận push

Chặng này đăng ký/gỡ đăng ký thiết bị với API đã hoàn tất ở chặng 1. Chưa tạo công việc outbox, gửi bù, chạy worker hoặc xử lý thao tác chạm vào push. Thông báo trong ứng dụng và các nghiệp vụ phiếu giữ nguyên.

## Cách chạy trên điện thoại

1. Chạy API ở cổng 5050 và bảo đảm điện thoại truy cập được `/api/v1/health/database` bằng địa chỉ mạng của máy tính.
2. Tại thư mục `mobile`, chạy:

   ```powershell
   pnpm exec expo start --dev-client
   ```

3. Mở development build **Nuoi Ong** đã cài, kết nối Metro vừa chạy. Không mở bằng Expo Go để kiểm thử remote push.
4. Đăng nhập, cho phép thông báo khi Android hỏi. Mở icon chuông: mục **Thông báo điện thoại** phải hiện **Điện thoại đã đăng ký nhận thông báo.**

Riêng đăng ký thông báo sử dụng các module native đã có trong development build đã cấu hình `expo-notifications`. Yêu cầu mới về giữ phiên khi mở app và đăng xuất khi Reload bổ sung module native Android, nên cần build lại một lần theo [hướng dẫn tài khoản và phiên](../auth/account-and-session.md).

## Luồng đăng ký

- Chỉ đăng ký sau khi Clerk có phiên và `/auth/me` xác nhận đúng tài khoản DB.
- Tạo một UUID `installationId`, lưu SecureStore và giữ nguyên qua đăng xuất/reload. Cài lại ứng dụng có thể tạo UUID mới.
- Tạo Android channel `stock-documents`, kiểm tra/xin quyền, lấy native token rồi Expo push token với EAS project ID của dự án.
- Gọi `PUT /api/v1/notifications/devices/{installationId}` với JWT tài khoản hiện tại. Body chỉ có `expoPushToken` và `platform`; API tự xác định chủ sở hữu.
- Khi app trở lại foreground, kiểm tra quyền và đồng bộ lại. Khi native token thay đổi, đăng ký lại token mới.
- Lỗi mạng không cản đăng nhập hoặc sử dụng nghiệp vụ. Tự thử lại tối đa ba lần (5, 15, 45 giây); có nút **Thử lại** và thử lại khi trở về app.
- Trước khi người dùng đăng xuất hoặc development Reload, gỡ đăng ký bằng JWT cũ; thời gian chờ tối đa ba giây. Mở lại app thông thường giữ phiên theo yêu cầu mới.
- Các đăng ký đang chạy được xếp hàng theo phiên. Kết quả của tài khoản cũ không được cập nhật trạng thái cho tài khoản mới.
- Không lưu JWT hoặc Expo push token trong phần dữ liệu đăng ký thiết bị của SecureStore. Phần này chỉ lưu UUID, chủ sở hữu và trạng thái cần gỡ đăng ký; bộ nhớ phiên giữ token để đồng bộ.

Nếu đăng xuất khi mất mạng, máy chủ chưa thể biết ngay việc gỡ đăng ký. Mobile tiếp tục đăng xuất và giữ dấu cần dọn; khi đăng nhập/đăng ký lại, API cập nhật chủ sở hữu và hủy công việc chưa hoàn tất theo quy tắc chặng 1. Không thể thu hồi thông báo đã được hệ điều hành nhận.

## Kiểm thử thủ công

Trong terminal Metro, tìm log `[Push registration]`. Log chỉ chứa `installationId`, `deviceId` và trạng thái; không chứa JWT/Expo token. Dùng **UUID thực tế của điện thoại** trong các bước dưới, không dùng UUID thử tay của chặng 1.

| Tình huống            | Thao tác                                                                                            | Kết quả cần đạt                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Đăng ký lần đầu       | Đăng nhập A, cấp quyền; dùng JWT A gọi Swagger `GET /api/v1/notifications/devices/{installationId}` | 200; `userId` thuộc A, `isActive=true`                                                       |
| Đồng bộ lại           | Đưa app ra nền rồi mở lại                                                                           | Cùng `installationId` và `deviceId`, không tạo thêm đăng ký                                  |
| Reload                | APK mới: Reload từ Expo dev menu hoặc Metro `r`                                                     | Về đăng nhập; khi API có mạng, đăng ký cũ chuyển `isActive=false`                            |
| Mở lại app            | Đóng rồi mở lại app                                                                                 | Giữ phiên và đăng ký thiết bị của tài khoản hiện tại nếu Clerk còn phiên hợp lệ              |
| Đăng nhập lại A       | Đăng nhập sau reload                                                                                | Cùng installation, đăng ký hoạt động trở lại                                                 |
| Đổi sang B            | Reload, đăng nhập B rồi kiểm tra bằng JWT B                                                         | GET 200, chủ sở hữu là B; JWT A GET/DELETE installation này trả 404                          |
| Từ chối quyền         | Trên thiết bị chưa cấp quyền, chọn từ chối                                                          | Không PUT đăng ký; mục chuông báo đang tắt; nghiệp vụ và thông báo trong app vẫn dùng được   |
| Tắt quyền sau đăng ký | Tắt quyền thông báo trong cài đặt Android, trở về app                                               | Gỡ đăng ký của tài khoản hiện tại; GET trả `isActive=false` nếu có mạng                      |
| Bật lại quyền         | Bật trong cài đặt, trở lại app hoặc bấm Thử lại                                                     | Đăng ký trở lại, cùng installation                                                           |
| Mất mạng/API tắt      | Ngắt kết nối rồi đồng bộ                                                                            | Hiện lỗi gọn trong popup; app không treo; kết nối lại và Thử lại để đăng ký                  |
| Đổi farm              | Chọn farm khác trong cùng tài khoản                                                                 | Không thay installation/chủ sở hữu; danh sách thông báo trong app tiếp tục theo farm đã chọn |

Chặng này **chưa kỳ vọng có thông báo xuất hiện trên màn hình khóa**. Chỉ chuyển sang outbox nghiệp vụ và gửi bù sau khi kiểm thử đăng ký trên điện thoại đạt.

## Kiểm tra tự động

Chạy tại `mobile`:

```powershell
pnpm typecheck
pnpm exec jest --runInBand
```

Các test bao phủ adapter API, lưu UUID, xin quyền/channel, token rotation, kết quả phiên cũ, đổi tài khoản, gỡ đăng ký, lỗi mạng và giới hạn thời gian chờ trước đăng xuất. Kiểm thử native thật và quyền Android vẫn cần điện thoại.
