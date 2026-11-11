# Tóm tắt cập nhật `dev` và xử lý conflict

## Phạm vi

- **Repository:** `nuoi-ong`
- **Nhánh local:** `feature/warehouse`
- **Nhánh nguồn:** `origin/dev`
- **Trước pull:** `6f4996574ca793ac4a3bf3e55821359ce3acc520`
- **Sau pull:** `63558f6cebfa5d55b092a3aa88f187e4e632010b`
- **Cách cập nhật:** `git pull origin dev` fast-forward; không tạo merge commit.

## Các thay đổi mới nhận từ `dev`

Pull cập nhật 55 file (728 dòng thêm, 288 dòng xóa). Nội dung tập trung vào:

- **API:** quyền truy cập vai trò Farm, nghiệp vụ tài sản, tồn kho, bảo trì, phiếu kho/điều chuyển và các integration test tương ứng.
- **Web:** lịch sử thao tác, hồ sơ bảo trì, phiếu nhập, yêu cầu, điều chuyển, quản trị bán hàng và điều hướng.
- **Tests:** cập nhật test API/Web cho các luồng và quyền vừa thay đổi.

## Conflict và cách xử lý

Sau khi khôi phục stash, chỉ còn conflict nội dung tại `api/src/modules/notifications/notification-push-outbox.ts`.

- Giữ kiểm tra quyền của `dev` cho thông báo `DISCREPANCY`: gửi tới quản trị Farm hoặc người tạo phiếu.
- Giữ điều kiện thông báo bảo trì từ thay đổi local: người nhận hợp lệ, yêu cầu trả tài sản và mốc lịch bảo trì.
- Ghép hai phần trong cùng `documentPushEligibility()`; đã xóa các conflict marker và stage file sau khi xử lý.
- `api/src/modules/warehouses/stock-transfers.service.ts` được Git auto-merge; phần mới gửi thông báo chênh lệch cho quản trị Farm và người tạo phiếu được giữ lại.

## Trạng thái local hiện tại

- Hai file API trên đang staged: `notification-push-outbox.ts` và `stock-transfers.service.ts`.
- `api/src/modules/notifications/notification-events.ts`, các thay đổi Mobile, tài liệu và thư mục `tools/` vẫn còn local; chưa được đưa vào commit.
- Stash `tam-cat-truoc-khi-pull-dev` vẫn được giữ làm bản dự phòng (`stash@{0}`).
- Nhánh `feature/warehouse` đang ahead `origin/feature/warehouse` 15 commit.
- Chưa tạo commit hoặc push.

## Kiểm tra

- Xung đột đã được đánh dấu giải quyết; `git status` không còn `UU`.
- Chưa chạy test/build sau khi cập nhật `dev` và xử lý conflict.
- Không chạy migration và không thay đổi dữ liệu DB.
