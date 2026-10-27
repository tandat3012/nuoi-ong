# Tài khoản, cài đặt và phiên trên Android

## Giao diện

- Tổng quan → chạm ô tài khoản → **Tài khoản & cài đặt**.
- **Thông tin tài khoản**: tên, email và vai trò tại farm đang chọn từ `/auth/me`. Không cho tự sửa role hoặc membership.
- **Quản lý thông báo**: xem trạng thái đăng ký, mở cài đặt hệ điều hành để bật/tắt quyền, đồng bộ thiết bị, xem hộp thông báo của farm hiện tại. Không tạo thêm thông báo hoặc thay đổi đối tượng nhận.
- **Đăng xuất**: popup xác nhận theo chủ đề hiện có; gỡ đăng ký push của installation hiện tại trước khi kết thúc phiên Clerk. Không xóa farm, phiếu, thông báo hoặc phiên ở thiết bị khác.
- Các trang dùng `AppShell`, font/màu/card/chip hiện có; giữ bottom navigation và khoảng trống cuộn phía dưới.

## Quy tắc phiên mới

1. Ra nền rồi mở lại: giữ phiên.
2. Đóng app khỏi Recent Apps rồi mở lại, hoặc khởi động lại điện thoại: khôi phục phiên Clerk đã lưu, nếu phiên còn hợp lệ.
3. Development build Android: **Reload** từ dev menu hoặc lệnh `r` ở Metro tạo lại JS trong Activity hiện tại → hủy đăng ký thiết bị và đăng xuất.
4. Fast Refresh/remount component không reset JS global → giữ phiên.
5. Production không tự đăng xuất khi restart JS; đăng xuất bằng nút hoặc khi phiên Clerk hết hạn/bị thu hồi.

Không dùng thời gian tắt/mở hay `AppState` để đoán người dùng vừa Reload. Module Android local `modules/session-lifecycle` lưu UUID bằng native `WeakHashMap` cho từng Activity. Reload trong cùng Activity giữ UUID; lần mở Activity mới có UUID mới. SecureStore lưu UUID của lần khởi tạo JS trước. Promise bootstrap lưu trong JS global ngăn Fast Refresh khởi động lại policy. Không lưu hoặc gửi JWT trong UUID này.

Khi đăng xuất, app gỡ đăng ký push trước, đóng popup xác nhận rồi mới gọi Clerk để đổi trạng thái route. Chỉ một nơi điều hướng sau đăng nhập; route đăng nhập, tổng quan và tài khoản tắt animation native để tránh tháo view đồng thời với cập nhật cây giao diện. Đây là biện pháp giảm tranh chấp mount Android; cần xác nhận lại trên development APK vì lỗi `addViewAt` là lỗi native và không thể chứng minh bằng TypeScript.

## Cần build lại APK một lần

Module native mới được Expo tự liên kết từ thư mục `modules`. Cần build lại development APK để có thể phân biệt Reload và mở mới:

```powershell
cd "D:\Dai Hoc\Nam 4\Khoá Luận\nuoi-ong\mobile"
pnpm dlx eas-cli build --platform android --profile development
```

Cài đè APK mới (giữ package `com.nuoi.ong.mobile` và keystore hiện có; không gỡ app/xóa dữ liệu), rồi:

```powershell
pnpm exec expo start --dev-client
```

APK cũ/Expo Go vẫn mở các màn hình mới và giữ phiên, nhưng chưa tự đăng xuất theo Reload vì chưa có module native. Metro ghi nhắc build, không tự thay bằng hành vi đăng xuất mỗi lần mở app. Module hiện chỉ dành cho Android; trên iOS cũng giữ phiên và cần bổ sung module tương ứng nếu muốn quy tắc Reload giống Android.

Khởi động lại Metro mà không reload app không phải một thao tác đăng xuất. Nhấn `r` sau khi thiết bị kết nối để gửi Reload. Nếu dev client đóng và mở Activity mới, đây là lần mở mới và giữ phiên.

## Checklist test trên điện thoại

| Thao tác                                           | Kỳ vọng                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chạm ô tài khoản trên Tổng quan                    | Mở trang quản lý đúng chủ đề, bottom bar còn hiển thị                                                                                                  |
| Xem thông tin / chuyển farm ở Tổng quan rồi mở lại | Tên farm, vai trò đúng farm đã chọn; không hiện UUID                                                                                                   |
| Quản lý thông báo → Quyền thông báo                | Mở cài đặt hệ điều hành; tắt quyền rồi trở lại app thì đăng ký thiết bị không còn hoạt động                                                            |
| Bật quyền / Đồng bộ lại                            | Trạng thái đăng ký cập nhật; hộp thông báo vẫn theo farm hiện tại                                                                                      |
| Đăng xuất → Ở lại                                  | Phiên còn nguyên                                                                                                                                       |
| Đăng xuất → Xác nhận                               | Về đăng nhập; Back không vào được trang tài khoản, tồn kho, phiếu; GET thiết bị bằng JWT cũ cùng tài khoản cho `isActive=false` nếu gỡ đăng ký có mạng |
| Đăng nhập A, ra nền / khóa màn hình rồi mở         | A vẫn đăng nhập                                                                                                                                        |
| Đóng khỏi Recent Apps, mở lại                      | A vẫn đăng nhập nếu Clerk còn phiên hợp lệ                                                                                                             |
| APK mới: Expo dev menu → Reload hoặc Metro `r`     | Về đăng nhập, không còn dữ liệu trang được bảo vệ                                                                                                      |
| Đăng nhập B sau đăng xuất                          | Các trang hiển thị dữ liệu B, đăng ký installation thuộc B                                                                                             |
| Sửa giao diện để Fast Refresh                      | Không tự đăng xuất nếu chỉ Fast Refresh, không phải full Reload                                                                                        |

Khi mất mạng không thể bảo đảm API nhận DELETE ngay. Việc gỡ đăng ký vẫn dùng giới hạn thời gian và quy tắc chuyển chủ sở hữu đã có của chặng API token.
