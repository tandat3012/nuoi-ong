# Chặng 3 — Outbox nghiệp vụ và gửi bù

Chặng này chỉ ghi công việc vào PostgreSQL. Worker gửi Expo push, xử lý ticket/receipt và điều hướng khi chạm push thuộc các chặng sau. Vì vậy `PENDING`, `attempt_count=0` là kết quả đúng ở chặng 3; chưa có thông báo xuất hiện trên màn hình khóa.

Chặng 4 đã bổ sung [worker gửi push](./04-push-worker.md), mặc định tắt bằng cấu hình. Khi bật worker, job sẽ tiếp tục chuyển trạng thái như tài liệu chặng 4; các quy tắc nghiệp vụ và gửi bù bên dưới giữ nguyên.

## Phạm vi

- Áp dụng cho phiếu nhập, xuất, chuyển kho và kiểm kê.
- Giữ nguyên các trạng thái, điều kiện duyệt/từ chối, cập nhật tồn, audit log, người nhận và API response hiện có.
- Dùng hai bảng đã migrate `device_push_tokens`, `notification_push_outbox` cùng `notifications`. Không có migration mới, không seed hoặc sửa dữ liệu hiện có.
- Phần Mobile, Web và giao diện không thay đổi. Chỉ cần restart API nếu không chạy watch; không cần build lại APK cho chặng này.

## Giao dịch nghiệp vụ

`Phiếu + thay đổi tồn (nếu có) + notification + outbox + audit log` cùng commit hoặc cùng rollback trong `auditedDocumentTransaction` đang có. Không gọi dịch vụ ngoài trong transaction.

| Sự kiện                    | Người nhận                                                                                               | Outbox                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Gửi duyệt                  | User ACTIVE, membership ACTIVE, role FARM_OWNER/ADMIN trong đúng farm, loại người gửi                    | Một notification/người; một job/notification/thiết bị đang active của người đó           |
| Xác nhận / từ chối         | User thực sự tạo phiếu, ánh xạ `created_by_member_id → farm_members.user_id`, còn active trong đúng farm | Một job cho mỗi thiết bị active của người nhận; từ chối giữ lý do trong nội dung/data cũ |
| Nháp / sửa nháp / hủy nháp | Theo nghiệp vụ cũ, không phát thêm notification                                                          | Không tạo push                                                                           |

Một người có nhiều role chỉ nhận một notification. Một người có nhiều thiết bị nhận một job cho từng thiết bị. Tài khoản không có thiết bị vẫn có notification trong app.

Outbox kiểm tra lại tài khoản/farm đang ACTIVE, role hiện tại của người duyệt hoặc người tạo thực tế, entity và trạng thái phiếu. Type không hỗ trợ, phiếu không tồn tại, sai farm hoặc trạng thái không còn phù hợp không được xếp hàng.

Không thay đổi/ẩn notification lịch sử khi phiếu đã đổi trạng thái. Job chờ duyệt cũ đã có trước khi phiếu được xử lý có thể vẫn PENDING ở chặng này; **worker phải kiểm tra lại điều kiện ngay trước gửi**, hủy job không còn phù hợp. Không dùng title/body/route từ client làm căn cứ quyền.

## Gửi bù khi đăng ký thiết bị

Trong cùng transaction của PUT `/api/v1/notifications/devices/{installationId}`:

1. Khóa installation/token theo quy tắc chặng 1, xác định chủ cũ/chủ mới.
2. Khóa đồng bộ theo các user ID, rồi khóa và kiểm tra lại bản ghi thiết bị. Nếu chủ đã đổi đồng thời sang user chưa được khóa, trả 409 để client thử lại.
3. Đổi chủ/token/installation/platform hoặc kích hoạt lại thì hủy job chưa hoàn tất của liên kết cũ và cập nhật thiết bị như trước.
4. Với thiết bị mới hoặc liên kết vừa thay đổi/kích hoạt lại, lấy tối đa **5 notification hợp lệ mới nhất**, chưa đọc, trong **24 giờ**, chỉ của user mới. Dùng `statement_timestamp()` của PostgreSQL sau khi chờ khóa, không dùng giờ điện thoại hoặc giờ bắt đầu transaction trước khi chờ.
5. Chỉ tạo PENDING nếu chưa có cặp `(notification_id, device_push_token_id)`. Không hồi sinh CANCELLED/FAILED/SUCCEEDED, không sửa read_at, không tạo notification mới để gửi bù.

PUT cùng liên kết đang active chỉ cập nhật thời điểm hoạt động, không vét dần backlog. Giới hạn 5 được áp dụng trước khi bỏ qua cặp đã có, nên quay token/relogin không lấy thêm 5 tin cũ hơn mỗi lần. Thiết bị mới khác có thể nhận cùng thông báo chưa đọc nếu còn hợp lệ.

Với thông báo cần duyệt, phiếu phải còn PENDING_APPROVAL và user còn là ADMIN/FARM_OWNER tại farm đó. Với kết quả CONFIRMED/REJECTED, phiếu phải còn đúng trạng thái và user phải là người tạo. Farm/role/membership khác không cấp quyền chéo.

## Đồng thời và lỗi

- Đăng ký, hủy đăng ký và phát sự kiện dùng cùng advisory transaction lock theo user ID, theo thứ tự cố định; khóa device row sau user lock. Sự kiện và đăng ký đồng thời được nối bằng fan-out hoặc gửi bù, tránh trường hợp cả hai cùng bỏ lỡ.
- Ràng buộc UNIQUE cặp notification/device chống trùng khi retry.
- Hủy đăng ký vẫn chỉ tác động installation hiện tại. Đổi A → B hủy job A trên thiết bị đó, không hủy job A ở thiết bị khác; gửi bù chỉ cho B.
- Nếu ghi outbox lỗi, rollback cả thay đổi liên quan; không trả thành công khi notification/job chưa commit.
- Thông báo đã rời máy chủ không thể thu hồi. Worker về sau phải kiểm tra chủ thiết bị, quyền, trạng thái phiếu, read_at và lock_id trước khi gửi/cập nhật kết quả.

## Hướng dẫn test thủ công

1. Restart API bằng `pnpm start:dev` tại `api` nếu API cũ đang chạy bản build. Giữ DB local đã migrate. Không chạy thêm một API khác cùng cổng 5050.
2. Đăng nhập tài khoản owner/admin tại một thiết bị và tài khoản nhân viên tại thiết bị khác (hoặc dùng PUT thiết bị trên Swagger để tạo fixture token). Xác nhận thiết bị active ở chặng 2.
3. Nhân viên tạo và gửi duyệt một phiếu có mã dễ nhận diện. Query bên dưới với mã phiếu đó: owner/admin của đúng farm có notification và PENDING job; nhân viên khác và quản lý farm khác không có.
4. Duyệt hoặc từ chối trên Web/Swagger. Kết quả có notification/job cho đúng người tạo; từ chối có lý do. Xác nhận tồn và trạng thái phiếu vẫn theo nghiệp vụ cũ. Lặp với cả bốn loại phiếu.
5. Test gửi bù: dùng user có các notification chưa đọc gần đây nhưng chưa có thiết bị. PUT **installation và token mới**: chỉ tối đa 5 notification mới nhất còn hợp lệ được xếp hàng. PUT cùng input lại: số job không tăng. Danh sách thông báo/read_at không bị thay đổi.
6. Đánh dấu notification đã đọc trước khi đăng ký một thiết bị mới; phiếu đã xử lý xong hoặc user mất quyền duyệt cũng phải bị loại khỏi gửi bù.
7. Đổi cùng installation sang B: job chưa hoàn tất của A trên installation đó thành CANCELLED; job B chỉ trỏ notification của B. Đừng xóa notification/read_at để test.
8. DELETE đăng ký dùng token giả của Swagger sau khi test, trước khi bật worker thật.

### Query bằng PowerShell và Docker

Thay `MA_PHIEU_CAN_TEST` bằng mã phiếu vừa thao tác, rồi chạy từ terminal:

```powershell
@'
SELECT n.created_at, n.data->>'documentCode' AS document_code,
       u.email AS recipient, f.code AS farm_code, n.type, n.read_at,
       d.installation_id, d.is_active, o.status AS push_status, o.attempt_count
FROM notifications n
JOIN users u ON u.id = n.user_id
LEFT JOIN farms f ON f.id = n.farm_id
LEFT JOIN notification_push_outbox o ON o.notification_id = n.id
LEFT JOIN device_push_tokens d ON d.id = o.device_push_token_id
WHERE n.data->>'documentCode' = 'MA_PHIEU_CAN_TEST'
ORDER BY n.created_at, u.email, d.installation_id;
'@ | docker exec -i nuoi-ong_postgres psql -U postgres -d nuoi_ong
```

LEFT JOIN giữ được notification chưa có thiết bị/job. Query không xuất Expo push token hoặc JWT. Sau chuyển chủ, job CANCELLED vẫn có thể liên kết notification của A với device đang thuộc B; đây là lịch sử đã hủy. Không được có job chưa hoàn tất mang cặp chủ sở hữu lệch nhau.

```powershell
@'
SELECT o.id, o.status, n.user_id AS recipient_id, d.user_id AS device_owner_id
FROM notification_push_outbox o
JOIN notifications n ON n.id=o.notification_id
JOIN device_push_tokens d ON d.id=o.device_push_token_id
WHERE o.status IN ('PENDING', 'PROCESSING', 'AWAITING_RECEIPT')
  AND (n.user_id <> d.user_id OR NOT d.is_active);
'@ | docker exec -i nuoi-ong_postgres psql -U postgres -d nuoi_ong
```

Kỳ vọng truy vấn thứ hai không có dòng do các thao tác đăng ký/hủy đăng ký hợp lệ tạo ra. Query không tự sửa bất kỳ dữ liệu nào.

## Kiểm thử tự động

Từ `api`, DB local đang hoạt động:

```powershell
pnpm exec tsc --project tsconfig.build.json --noEmit
pnpm exec jest --config ./test/jest-e2e.json --runInBand --runTestsByPath test/notification-devices.integration.e2e-spec.ts test/notification-outbox.integration.e2e-spec.ts
```

Outbox test dùng service nghiệp vụ và quyền farm thật với PostgreSQL, kiểm tra cả bốn loại phiếu, rollback tồn/phiếu/audit/notification/job, người nhận, dedup, giới hạn tuổi/số lượng, đổi chủ và hai thứ tự giao nhau giữa đăng ký và gửi phiếu. Fixture dùng UUID riêng và dọn sau test.

**Dừng chặng 3 để kiểm thử.** Chỉ chuyển sang worker sau khi người dùng xác nhận.
