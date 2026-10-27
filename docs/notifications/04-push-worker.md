# Chặng 4 — Worker gửi push

Worker chạy trong process API khi bật cấu hình, dùng outbox hiện có; không cần Redis, cron ngoài hoặc migration mới. Không đổi trạng thái phiếu, tồn kho, người nhận, notification hoặc read_at. Chạm push để chuyển farm/mở chi tiết vẫn thuộc chặng 5.

## Cấu hình và cách chạy local

Giữ các cấu hình EAS/FCM V1 và development APK đã hoàn thành. API chỉ gửi Expo Push Token tới Expo; không đưa Firebase service-account JSON vào Mobile hoặc API để thực hiện luồng này.

Trước khi bật worker, gọi DELETE cho **các UUID đăng ký giả đã tạo trên Swagger**, bằng đúng tài khoản sở hữu. Giữ đăng ký thật của điện thoại. Không dùng token giả để thử nhận push.

Tại `api/.env`, bổ sung:

```dotenv
PUSH_WORKER_ENABLED=true
PUSH_RECEIPT_DELAY_MS=60000
```

`60000` cho lần test local: kiểm tra receipt sau một phút. Mặc định code là `900000` (15 phút). Tài liệu Expo khuyến nghị kiểm tra receipt sau khoảng 15 phút, và receipt thành công chỉ xác nhận FCM/APNs nhận được yêu cầu, không xác nhận người dùng đã xem. [Tài liệu gửi push của Expo](https://docs.expo.dev/push-notifications/sending-notifications/).

Nếu dự án EAS bật enhanced push security, thêm `EXPO_ACCESS_TOKEN` vào **API** bằng access token hợp lệ của Expo. Không dùng Clerk JWT ở đây, không đặt access token này vào biến `EXPO_PUBLIC_*` hoặc Mobile. Nếu chưa bật enhanced security, có thể để trống.

Restart API đang chạy, tránh khởi động thêm process cùng cổng 5050:

```powershell
pnpm start:dev
```

Hoặc không sửa `.env`, thiết lập cho terminal hiện tại trước khi chạy:

```powershell
$env:PUSH_WORKER_ENABLED = 'true'
$env:PUSH_RECEIPT_DELAY_MS = '60000'
pnpm start:dev
```

Kỳ vọng log `Push worker enabled`. Đặt `PUSH_WORKER_ENABLED=false` và restart để tắt. Mặc định flag là false để không tự gửi các đăng ký giả còn sót trong DB.

Nếu API chạy Docker, đặt các biến tại `.env` ở root; Compose đã chuyển chúng vào service `api`. Chạy `docker compose up -d --build api` để nhận code/cấu hình mới. Không cần reset volume hoặc seed lại.

Mobile tiếp tục dùng APK Nuôi Ong và `pnpm exec expo start --dev-client`. Bản code JavaScript mới bổ sung hiển thị foreground; APK đã có `expo-notifications` không cần rebuild riêng cho chặng 4. Giữ yêu cầu APK có module phiên Android của tác vụ tài khoản trước đó nếu muốn hành vi Reload tương ứng.

## Luồng xử lý

1. Mỗi vòng lấy tối đa 12 job tới hạn bằng transaction ngắn và `FOR UPDATE SKIP LOCKED`. Chuyển sang PROCESSING, gán lock_id/locked_at; nhiều API process có thể chạy đồng thời.
2. Trước request, kiểm tra lại user/farm active, đúng chủ device, device active, notification chưa đọc/trong 24 giờ và điều kiện quyền/trạng thái phiếu của chặng 3. Job không còn phù hợp chuyển CANCELLED.
3. Gửi tối đa 3 request đồng thời trên một worker. Timeout HTTP 8 giây; lease 60 giây. Không giữ transaction DB mở trong lúc chờ mạng.
4. Ticket OK lưu expo_ticket_id, chuyển AWAITING_RECEIPT và đặt lịch kiểm tra. Chưa chuyển SUCCEEDED chỉ dựa vào ticket.
5. Receipt OK chuyển SUCCEEDED. Chưa có receipt thì kiểm tra lại, không gửi lại message. Receipt/network lookup lỗi tạm thời vẫn giữ ticket; backoff bền vững tới 15 phút giữa các lần lỗi liên tiếp.
6. Send lỗi mạng/timeout/429/5xx hoặc provider MessageRateExceeded retry với backoff tăng dần và jitter, tối đa 5 lần gửi. Receipt MessageRateExceeded là một từ chối xác định nên có thể chuyển về PENDING để thử gửi lại; thiếu receipt không được suy ra cần gửi lại.
7. MessageTooBig/InvalidCredentials/MismatchSenderId/HTTP 4xx cố định chuyển FAILED, không vô hiệu hóa token chỉ vì lỗi cấu hình/payload.
8. DeviceNotRegistered ở ticket/receipt vô hiệu hóa **đúng liên kết token đã xử lý** và hủy job chưa hoàn tất của device đó; không hủy device khác. Nếu đăng ký đã đổi chủ/token hoặc vừa refresh trong lúc request chờ, callback cũ không được vô hiệu hóa đăng ký mới.
9. Lease hết hạn được phục hồi; job đã có ticket quay lại kiểm tra receipt. Callback về trễ chỉ cập nhật khi lock_id còn khớp và còn trong lease. Worker kiểm tra lại quyền/chủ device trước khi ghi kết quả.
10. Shutdown dừng timer và abort request đang chờ. Job chưa xong được lần chạy sau phục hồi bằng lease. Job/tin hết hạn không chờ vô hạn.

Payload dùng channel `stock-documents`, tag bằng notification UUID và các ID xác định tài khoản/farm/phiếu; không nhận route điều hướng từ client. Tiêu đề/nội dung preview có giới hạn để tránh payload quá lớn; nội dung đầy đủ trong notifications không đổi. Không ghi Expo token, access token, JWT hoặc thông báo lỗi nguyên văn từ provider vào log/last_error.

Mobile foreground chỉ hiện banner/list/sound khi payload đúng hợp đồng và khớp DB user đang đăng nhập cùng farm còn trong memberships. Không tự đổi farm, đánh dấu đã đọc hoặc điều hướng trong chặng này. Khi app ở background, hệ điều hành và FCM quản lý hiển thị.

## Giới hạn giao nhận

DB đảm bảo một cặp notification/device và fencing callback, nhưng request gửi ra ngoài không có transaction chung với DB. Nếu Expo nhận push rồi process chết hoặc phản hồi bị mất trước khi lưu ticket, lần phục hồi có thể gửi lại. Cơ chế là **at least once**, không hứa exactly once. Android tag ổn định giúp thay thế cùng notification trên khay; không biến transport thành exactly once.

Một push đã bắt đầu gửi hoặc đã nằm ở FCM/thiết bị không thể thu hồi bằng cách đổi DB. Đổi chủ/đăng xuất hủy các job còn quản lý được; callback cũ không ghi đè hoặc tắt token của tài khoản mới. SUCCEEDED không đồng nghĩa read_at đã có giá trị.

## Test với một điện thoại thật

1. Đăng nhập tài khoản **nhân viên A** trên điện thoại; xác nhận chuông báo điện thoại đã đăng ký. Đăng nhập **owner/admin B** của cùng farm trên Web hoặc dùng JWT B ở Swagger.
2. A tạo phiếu nhập/xuất/chuyển kho/kiểm kê rồi gửi duyệt. Đưa app ra nền bằng Home hoặc khóa màn hình, giữ app đã đăng nhập.
3. B duyệt hoặc từ chối. Notification kết quả gửi cho A; điện thoại A phải nhận push. Với từ chối có lý do trong preview (nội dung dài có thể rút gọn).
4. Kiểm tra DB: PENDING → PROCESSING → AWAITING_RECEIPT → SUCCEEDED sau khi có receipt. Nếu lỗi, xem last_error. Không cần A/B đều có điện thoại để test kết quả duyệt.
5. Muốn test push **cần duyệt**, giữ owner/admin A trên điện thoại và dùng tài khoản nhân viên B trên Web/Swagger gửi phiếu. Người vừa gửi không tự nhận yêu cầu duyệt.
6. Test foreground bằng việc giữ app mở; kiểm tra banner/sound theo quyền Android. Không nhấn đọc notification trước khi worker gửi vì worker sẽ bỏ qua tin đã đọc.
7. Đăng xuất trên điện thoại, phát sinh phiếu mới: device inactive không nhận job mới. Đổi tài khoản → kiểm tra user mới nhận đúng thông báo; không kỳ vọng thu hồi push đã gửi trước lúc đăng xuất.
8. Chạm push hiện chưa được nối với điều hướng trong app. Kiểm thử mở đúng chi tiết, đánh dấu đã đọc và chuyển đúng farm thuộc chặng 5.

### Query trạng thái, không lộ token

Thay mã phiếu và chạy trong PowerShell:

```powershell
@'
SELECT n.data->>'documentCode' AS document_code, u.email AS recipient,
       d.installation_id, d.is_active, o.status, o.attempt_count,
       o.expo_ticket_id, o.last_error, o.next_attempt_at, o.updated_at,
       n.read_at
FROM notification_push_outbox o
JOIN notifications n ON n.id=o.notification_id
JOIN users u ON u.id=n.user_id
JOIN device_push_tokens d ON d.id=o.device_push_token_id
WHERE n.data->>'documentCode' = 'MA_PHIEU_CAN_TEST'
ORDER BY o.created_at DESC;
'@ | docker exec -i nuoi-ong_postgres psql -U postgres -d nuoi_ong
```

| last_error                                                            | Cách kiểm tra                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| EXPO_HTTP_401/403 hoặc UNAUTHORIZED                                   | Access token Expo nếu bật enhanced security; không dùng JWT Clerk |
| InvalidCredentials / MismatchSenderId                                 | FCM V1 trên EAS và Firebase project của google-services.json      |
| DeviceNotRegistered                                                   | Đăng ký bị tắt; mở lại app và đồng bộ để lấy đăng ký hợp lệ       |
| EXPO_NETWORK_ERROR / EXPO_REQUEST_ABORTED / EXPO_HTTP_429/5xx         | Kết nối Internet của máy chạy API; worker tự retry có giới hạn    |
| EXPO_RECEIPT_NOT_READY                                                | Chưa có receipt; đang chờ, không phải đã gửi lại                  |
| NOTIFICATION_READ / ACCESS_OR_DOCUMENT_CHANGED / NOTIFICATION_EXPIRED | Tin không còn đủ điều kiện gửi; giữ lịch sử trong app             |

## Kiểm thử tự động

Worker tests dùng schema PostgreSQL tạm riêng, clone cấu trúc bảng và dọn sau test; chỉ giả lập transport Expo, không gửi tới thiết bị thật và không nhận job của DB đang dùng. Có test rollback/race ở chặng 3, worker lease/concurrency/late callback/retry ở chặng 4 và parser HTTP riêng.

```powershell
pnpm exec tsc --noEmit --incremental false
pnpm exec jest --runInBand --runTestsByPath src/modules/notifications/expo-push.client.spec.ts src/modules/notifications/notification-push.worker.spec.ts
pnpm exec jest --config ./test/jest-e2e.json --runInBand --runTestsByPath test/notification-push-worker.integration.e2e-spec.ts
```

Từ `mobile`: `pnpm typecheck`, `pnpm test -- --runInBand`.

## Kiểm thử trên điện thoại thật

Các test tự động ở trên kiểm tra worker và giả lập transport Expo; chúng không chứng minh FCM đã hiện thông báo trên thiết bị thật. Người dùng đã xác nhận push đã hiển thị thành công trên điện thoại thật trong lần kiểm thử hiện tại (27/10/2026). Đây là xác nhận nhận/hiển thị push cho một kịch bản; các biến thể khác vẫn cần nghiệm thu.

- [ ] Development APK có `expo-notifications`, Firebase Android app đúng `applicationId`, FCM V1 key đã gán trên EAS và quyền thông báo Android được cấp.
- [ ] API trên máy test truy cập được từ điện thoại, worker bật đúng cấu hình; không còn token giả đang active.
- [ ] Nhân viên gửi phiếu, owner/admin nhận push chờ duyệt khi app ở nền; DB outbox tiến đến `SUCCEEDED` sau receipt.
- [ ] Owner/admin duyệt phiếu, đúng người tạo nhận kết quả; từ chối có lý do trong preview nếu nội dung hệ điều hành cho phép.
- [ ] App đang mở ở foreground: banner/sound chỉ hiện với đúng người nhận và farm thuộc membership.
- [ ] Tắt quyền hoặc đăng xuất: không tạo job mới cho thiết bị không còn active; thông báo trong Notification Center vẫn được giữ theo dữ liệu DB.
- [x] Push đã hiển thị thành công trên điện thoại thật theo xác nhận của người dùng (27/10/2026); chưa đủ để kết luận mọi loại phiếu, tài khoản và trạng thái đều đạt.
- [ ] Ghi lại loại thiết bị/Android, phiên bản APK, trạng thái permission, thời gian thao tác và trạng thái outbox khi có lỗi. Không chụp hoặc ghi Expo token/JWT.

Tap push và điều hướng được mô tả/triển khai tại [chặng 5](./05-push-tap-navigation.md). Kiểm thử app nền/tắt và điều hướng cross-farm được ghi tại [nghiệm thu chặng 6](./06-device-acceptance.md).
