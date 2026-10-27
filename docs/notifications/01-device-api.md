# API token thiết bị: chặng 1

Tài liệu gốc của chặng 1 quản lý đăng ký nhận push. Mobile đăng ký tự động đã
được nối ở chặng 2. Chặng 3 bổ sung outbox và gửi bù trong transaction của PUT,
giữ nguyên URL/body/response bên dưới; xem [outbox nghiệp vụ](./03-outbox-catchup.md).
Chưa gọi Expo để gửi push ở các chặng này.

## Các endpoint

Tất cả endpoint yêu cầu Clerk session JWT. User được lấy từ JWT và phải là tài
khoản DB `ACTIVE`. Không truyền `userId` hoặc `farmId` trong body.

| Method | URL                                              | Kết quả                                          |
| ------ | ------------------------------------------------ | ------------------------------------------------ |
| PUT    | `/api/v1/notifications/devices/{installationId}` | Đăng ký hoặc cập nhật thiết bị cho user hiện tại |
| GET    | `/api/v1/notifications/devices/{installationId}` | Xem đăng ký của chính user                       |
| DELETE | `/api/v1/notifications/devices/{installationId}` | Vô hiệu hóa đăng ký của chính user               |

`installationId` là UUID ổn định của lượt cài app, được giữ riêng với phiên
đăng nhập. Mỗi lượt cài dùng một UUID khác nhau. Response trả metadata thiết bị,
không trả Expo Push Token.

Body PUT:

```json
{
  "expoPushToken": "ExponentPushToken[stage1_test_token]",
  "platform": "ANDROID"
}
```

Token ví dụ chỉ để test API chặng 1. API kiểm tra định dạng, chưa xác minh token
thực sự nhận được push. `platform` nhận `ANDROID` hoặc `IOS`.

## Quy tắc cập nhật

- Cùng installation và token: cập nhật thời điểm hoạt động, giữ nguyên ID đăng
  ký; không hủy các job hợp lệ đang có.
- Installation có token mới: cập nhật cùng bản ghi; hủy job chưa hoàn tất của
  liên kết cũ.
- Đổi user trên cùng installation: chuyển đăng ký sang user hiện tại, hủy job
  chưa hoàn tất của chủ cũ trong cùng transaction. User cũ không xem/hủy được
  đăng ký sau khi chuyển.
- Token cũ được đăng ký với installation mới sau cài lại app: tái sử dụng bản
  ghi token để tránh trùng; hủy job chưa hoàn tất của liên kết cũ.
- Nếu installation và token đã thuộc hai bản ghi khác nhau: trả `409`, không
  tự xóa hoặc gộp hai bản ghi.
- DELETE đặt `isActive=false`; gọi lại vẫn trả `200`. Chỉ tác động thiết bị được
  chỉ định, không hủy đăng ký các thiết bị khác.
- Chặng 3: tạo/đổi liên kết hoặc bật lại thiết bị xếp hàng tối đa 5 notification
  chưa đọc mới nhất trong 24 giờ, còn đúng quyền/trạng thái phiếu. PUT thường
  không vét backlog. Cặp notification/device đã có không được tạo lại hoặc hồi sinh.

Job ở `PENDING`, `PROCESSING`, `AWAITING_RECEIPT` được chuyển `CANCELLED` khi cần
hủy liên kết; xóa khóa worker để phản hồi cũ không được ghi đè trạng thái mới.
Job `SUCCEEDED`, `FAILED`, `CANCELLED` giữ nguyên. Worker ở chặng sau phải cập
nhật kết quả kèm điều kiện `lock_id` còn khớp và kiểm tra lại chủ token trước gửi.

Các thao tác này không xóa `notifications`, không đổi `read_at`, không thay phiếu
hoặc tồn kho. Push đã rời máy chủ không được thu hồi bằng thao tác hủy job DB.

## Test bằng Swagger

1. Khởi động hoặc restart API với `NODE_ENV=development`, mở
   `http://localhost:5050/api/v1/docs`. Bấm Authorize bằng JWT Clerk tài khoản A.
2. Tạo một UUID, ví dụ chạy `[guid]::NewGuid().ToString()` trong PowerShell. Dùng
   UUID đó làm `installationId` cho toàn bộ lượt test này.
3. PUT với body ví dụ ở trên: nhận `200`, `data.userId` là user DB của A và
   `data.isActive=true`. Không có field `expoPushToken` trong response.
4. PUT lại đúng input: `data.id` và `createdAt` giữ nguyên. GET cùng UUID trả
   đúng đăng ký của A.
5. Đổi token sang `ExponentPushToken[stage1_rotated_token]`, PUT lại: `data.id`
   giữ nguyên.
6. Authorize bằng tài khoản B: GET/DELETE UUID của A đều trả `404`. PUT cùng UUID
   và token hiện tại sẽ chuyển đăng ký sang B. Sau đó B GET được; A GET/DELETE
   trả `404`.
7. Với JWT của chủ hiện tại, DELETE: `isActive=false`. DELETE lặp vẫn thành công.
   PUT lại cho phép bật đăng ký trở lại. DELETE lần cuối để dọn đăng ký dùng token
   giả trước khi triển khai worker gửi push.
8. UUID sai, token sai định dạng, platform sai, thêm `userId` hoặc `farmId` vào
   body đều trả `400`. Thiếu JWT trả `401`; user DB không có hoặc `INACTIVE`
   trả `403`.

## Kiểm thử tự động

Từ thư mục `api`, sau khi PostgreSQL hoạt động và migration đã áp dụng:

```powershell
pnpm exec jest --config ./test/jest-e2e.json --runInBand --runTestsByPath test/notification-devices.integration.e2e-spec.ts --cacheDirectory .jest-cache
```

Suite dùng PostgreSQL thật với user/notification/token fixture riêng và dọn sau
test. Chỉ khâu xác minh token Clerk được giả lập trong test; API thật vẫn dùng
guard Clerk hiện có. Suite kiểm tra HTTP validation, Swagger, cô lập user,
đăng ký đồng thời, logout đến trễ, hủy job và rollback transaction.
