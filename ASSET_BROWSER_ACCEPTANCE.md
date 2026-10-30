# Nghiệm thu asset — Phase 6–7

Ngày kiểm tra: 2026-10-25. FE chạy Next dev; BE chạy trực tiếp TypeScript. **Không chạy build** trong lượt nghiệm thu này. Không sửa dữ liệu ứng dụng hay production.

## Kết quả tự động

| Nhóm | Kết quả và giới hạn |
| --- | --- |
| Chromium, 1440×1000 và 390×844 | Danh sách, phân trang, lọc, menu mobile, modal, Tab/Escape, bố cục không tràn ngang đạt trong các ca đã chạy. |
| UI → API → PostgreSQL | Tạo tài sản giữ nguyên số tiền `9007199254740993.01` và ngày; cấp phát → sử dụng → bàn giao → trả → chuyển kho; báo mất → đóng báo cáo → thu hồi → ngừng sử dụng; bắt đầu/hoàn tất bảo trì rồi nhập trả rõ ràng đạt. Có kiểm tra trạng thái, tồn kho và ledger trong DB riêng. |
| Quyền và dữ liệu đến muộn | Quyền chỉ xem không có nút ghi, API từ chối ghi `403`; chuyển trại bỏ qua phản hồi cũ; đổi kho nhận xóa vị trí; detail/holder cũ không xuất hiện ở trại mới. |
| Ghi dữ liệu khi mạng lỗi | Phản hồi bị ngắt sau khi DB đã commit không tự gửi lại; buộc tải lại. Gửi form hai lần chỉ ghi một lần; không đóng modal khi đang ghi. Xung đột metadata giữ bản mới và yêu cầu tải lại; lỗi quyền che dữ liệu/actions cũ. |
| QR | Tải SVG, tài liệu in trong iframe riêng, mã/tên trên tem; nhập mã đúng trại; từ chối URL ngoài; camera bị từ chối vẫn nhập tay được. Camera tổng hợp dùng SVG thật và bộ giải mã ZXing thật; giải phóng track khi chuyển trang hoặc hủy trong lúc chờ quyền đạt. |
| Lỗi Escape | Lượt đầy đủ ban đầu **21/22 đạt**. Ca còn lại làm đóng dialog cha khi focus ở nút lookup. Đã sửa cả dialog mutation và trả tài sản; regression sau sửa **Chromium 4/4, Firefox 4/4 đạt**, xác minh giữ dialog cha và trả focus. Chưa chạy lại toàn bộ 22 ca sau bản sửa. |
| FE/BE với Clerk thật, chưa đăng nhập | Health DB `200`; API thiếu/sai token `401`; preflight CORS đúng origin `204`; ba route `/assets`, `/maintenance`, `/scan` chuyển tới màn hình Clerk sign-in. Chưa xác minh phiên đăng nhập thành công. |
| Kiểm tra mã nguồn | Frontend TypeScript, scoped ESLint và 14 test logic/API/QR/issue đạt. Backend 182 test HTTP/PostgreSQL thuộc lượt Phase 2–3 đã ghi trong kế hoạch; không tính là vừa chạy lại. |

Các ca nghiệp vụ browser dùng identity fixture tại ranh giới Clerk; API, farm guard, service và PostgreSQL thực sự chạy. Kết quả này chưa chứng minh JWT của tài khoản Clerk thật hoạt động xuyên suốt. PostgreSQL kiểm thử dùng cổng 55440, DB `nuoi_ong_asset_browser_test`, tmpfs và không có volume ứng dụng.

Các tiến trình dev và container DB tạm do lượt kiểm thử này tạo đã được dừng sau khi hoàn tất; các lệnh bên dưới dựng môi trường manual riêng.

Minh chứng lưu tại [web/test-artifacts/assets](web/test-artifacts/assets/):

- [Lượt 22 ca ban đầu](web/test-artifacts/assets/browser-results.json), giữ nguyên cả ca FAIL để đối chiếu.
- [Regression Escape sau sửa](web/test-artifacts/assets/escape-regression/) và [baseline lỗi Chromium](web/test-artifacts/assets/escape-baseline/chromium.json).
- [Smoke FE/BE thật](web/test-artifacts/assets/real-environment-smoke.json), [màn hình Clerk](web/test-artifacts/assets/clerk-sign-in.png).
- [Desktop](web/test-artifacts/assets/assets-desktop-1440.png), [mobile](web/test-artifacts/assets/assets-mobile-390.png), [form mobile](web/test-artifacts/assets/asset-create-mobile-390.png), [chi tiết mobile](web/test-artifacts/assets/asset-detail-mobile-390.png), [tem QR](web/test-artifacts/assets/asset-qr-label.png).

### Chạy lại regression Escape

[Script assertion](web/test-artifacts/assets/recheck-dialogs.mjs) sao chép các component thật vào thư mục tạm, cung cấp lookup fixture, tự chạy Next dev trên cổng trống rồi dọn dẹp. Không kết nối API/Clerk và không thêm dependency vào dự án. Cần Playwright Core cùng browser đã cài; nếu module nằm ngoài dự án, truyền đường dẫn **file** `index.mjs`:

```bash
rtk proxy env PLAYWRIGHT_MODULE=/duong-dan/playwright-core/index.mjs node web/test-artifacts/assets/recheck-dialogs.mjs
rtk proxy env ENGINE=firefox PLAYWRIGHT_MODULE=/duong-dan/playwright-core/index.mjs node web/test-artifacts/assets/recheck-dialogs.mjs
```

Mỗi browser kiểm tra hai dialog, với focus ở ô tìm và ở nút lookup. Nhấn Escape lần đầu phải đóng lookup, giữ dialog cha; chọn giá trị vẫn giữ dialog; Escape sau đó đóng dialog và trả focus về nút mở.

## Tự nghiệm thu Clerk thật

### 1. Chuẩn bị DB riêng và chạy dev

Dùng Clerk **development instance**, FE và BE cùng instance. `web/.env.local` cần `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`; `api/.env` cần `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. Không gửi khóa, mật khẩu hay JWT vào chat.

Ví dụ tạo DB mới trên cổng 55441; chờ PostgreSQL sẵn sàng trước bước migrate:

```bash
rtk proxy docker run --rm -d --name nuoi-ong-asset-manual-test --publish 127.0.0.1:55441:5432 --env POSTGRES_PASSWORD=asset-manual-only --env POSTGRES_DB=nuoi_ong_asset_manual_test --tmpfs /var/lib/postgresql postgres:18-bookworm
rtk proxy docker exec nuoi-ong-asset-manual-test pg_isready -U postgres -d nuoi_ong_asset_manual_test
```

Terminal BE, trong `api/`:

```bash
export DATABASE_URL='postgresql://postgres:asset-manual-only@127.0.0.1:55441/nuoi_ong_asset_manual_test'
export PORT=5155 WEB_ORIGIN=http://localhost:3105 NODE_ENV=development
rtk proxy corepack pnpm db:migrate
rtk proxy corepack pnpm db:seed
# Hoàn thành bước ánh xạ tài khoản bên dưới trước lần đăng nhập đầu tiên.
rtk proxy corepack pnpm exec ts-node --transpile-only src/main.ts
```

`nest start`/`start:dev` có bước biên dịch; dùng lệnh `ts-node` trên để chạy trực tiếp, không tạo application build. Seed chỉ chạy trên DB mới này, một lần trước khi ánh xạ Clerk.

Trong Clerk Dashboard, chuẩn bị hai tài khoản test và lấy User ID dạng `user_...`: một chủ trại, một khách chỉ xem. Trước khi đăng nhập ứng dụng lần đầu, ánh xạ hai user seed trên **container manual-test vừa tạo**; thay các giá trị mẫu bằng User ID thật:

```bash
rtk proxy docker exec -i nuoi-ong-asset-manual-test psql -U postgres -d nuoi_ong_asset_manual_test -v owner_id='user_REPLACE_OWNER' -v guest_id='user_REPLACE_GUEST' <<'SQL'
BEGIN;
UPDATE users SET auth_provider='CLERK', auth_provider_user_id=:'owner_id'
WHERE auth_provider='SEED' AND auth_provider_user_id='seed_farm_owner';
UPDATE users SET auth_provider='CLERK', auth_provider_user_id=:'guest_id'
WHERE auth_provider='SEED' AND auth_provider_user_id='seed_guest';
COMMIT;
SQL
```

Hai lệnh phải báo `UPDATE 1`. Membership và role của seed được giữ lại; không chạy lại seed sau ánh xạ. Nếu đã đăng nhập và tạo user thật trong DB trước bước này, dùng luồng quản trị để gán membership cho user hiện có thay vì thay ID hoặc xóa user có lịch sử. Chưa được gán membership sẽ thấy thông báo chưa có quyền vào trại, không phải lỗi đăng nhập Clerk.

Terminal FE, trong `web/`:

```bash
rtk proxy env NEXT_PUBLIC_API_URL=http://localhost:5155 corepack pnpm dev --webpack --port 3105 --hostname 127.0.0.1
```

Mở `http://localhost:3105/assets`. API có prefix `/api/v1` tự ghép trong client; không thêm prefix đó vào `NEXT_PUBLIC_API_URL`.

### 2. Checklist và kết quả mong đợi

| Thao tác | Kết quả cần thấy |
| --- | --- |
| Đăng nhập chủ trại; mở DevTools Network | `/auth/me` và `/assets?farmId=...` trả `200`; request có Bearer session JWT. Chủ trại thấy các trại được cấp quyền và nút ghi phù hợp. Không chia sẻ bản sao token/HAR có thông tin đăng nhập. |
| Chọn trại A/B, tải lại trang và mở tab mới | Chỉ dữ liệu của trại đang chọn xuất hiện; lựa chọn lưu cho đúng user. API nhận đúng `farmId`. Trại không thuộc membership không truy cập được bằng sửa query. |
| Dùng vật tư ASSET, kho và vị trí ACTIVE để tạo một tài sản test mới | Mã/serial/ngày/giá đúng; tăng đúng một đơn vị tồn và có lịch sử nhập. Không dùng “Thêm tài sản” cho thiết bị đã được tạo từ phiếu nhập. |
| Cấp phát → bắt đầu sử dụng → bàn giao → trả kho | Chỉ cấp phát đầu tiên trừ tồn; dùng/bàn giao không trừ tiếp; trả tăng đúng một đơn vị. Holder cũ kết thúc, chỉ một holder hoạt động. |
| Báo mất → đóng báo cáo → thu hồi | Đóng báo cáo vẫn LOST và không tăng tồn. Thu hồi mới nhận một đơn vị vào đúng kho/vị trí; không khôi phục holder cũ. |
| Bảo trì → hoàn tất → trả kho | Hoàn tất vẫn ngoài tồn khả dụng; chỉ nhập trả rõ ràng mới tăng tồn. |
| Mở lookup rồi Shift+Tab về nút mở, nhấn Escape | Đóng lookup, giữ form cha và nội dung đã nhập. Escape tiếp theo đóng form và trả focus đúng nút mở. Kiểm tra tương tự khi trả kho. |
| Mở phiên riêng với tài khoản guest | Xem được tài sản của trại được cấp; không có nút ghi. Gửi request ghi trực tiếp bằng chính phiên guest phải bị `403`; DB không đổi. |
| Đăng xuất, Back và refresh trang bảo vệ | Không dùng lại dữ liệu cache để thao tác; về đăng nhập. Tài khoản khác không kế thừa lựa chọn trại/quyền của phiên trước. |

Chỉ thực hiện các thao tác ghi trên DB test. Luồng mật khẩu khởi tạo thuộc personnel có thể yêu cầu đổi mật khẩu trước khi vào dashboard; không bỏ cờ kiểm tra để vượt qua luồng này. Origin allowlist ở môi trường triển khai ngoài development và phiên/token hết hạn vẫn cần nghiệm thu trong môi trường tương ứng.

## Tự nghiệm thu thiết bị và in

1. **Điện thoại thật:** mở môi trường test qua HTTPS; `localhost` trên điện thoại là điện thoại, HTTP qua địa chỉ LAN thường không được cấp camera. Dùng FE/API test truy cập được từ thiết bị, cùng cấu hình origin/Clerk phù hợp. Máy tính local dùng `http://localhost` được để thử camera.
2. **Camera:** thử cho phép và từ chối quyền; quét tem tài sản đúng trại; thử mã không tồn tại, mã của trại không được cấp và URL ngoài. Không tự điều hướng tới website ngoài. Khi từ chối quyền vẫn nhập mã tay được. Dừng camera/chuyển trang phải tắt chỉ báo camera; thử hủy trong khi hộp xin quyền còn mở.
3. **Tem thật:** tải SVG, mở in, kiểm tra mã và tên đúng; in cỡ tem dự kiến rồi quét lại bằng điện thoại. Kiểm tra mép trắng, tương phản và kích thước thực tế. Headless chỉ xác minh SVG/tài liệu in, chưa chứng minh máy in, hộp thoại hệ điều hành hay khả năng đọc tem giấy.
4. **Safari/iOS và Android Chrome:** thử màn 390px, xoay ngang, bàn phím ảo, form dài/serial dài, chọn kho/vị trí và đóng hộp chọn. Không tràn ngang, nút xác nhận còn tiếp cận được, dữ liệu nhập không mất ngoài ý muốn. WebKit headless hiện thiếu thư viện host (`libicu74`, `libxml2`, `libflite1`), chưa dùng để kết luận Safari đạt.

Ghi browser/OS, tài khoản theo vai trò, trại, mã tài sản test, thao tác và kết quả. Phases 6–7 chỉ hoàn tất khi Clerk đã đăng nhập và camera/in trên thiết bị thật có bằng chứng đạt. Phases 4–5 vẫn theo trạng thái riêng trong [kế hoạch](ASSET_MANAGEMENT_PHASES.md).

Sau khi thử xong: dừng hai terminal dev bằng Ctrl+C, rồi dừng đúng container manual bằng `rtk proxy docker stop nuoi-ong-asset-manual-test`; dữ liệu tmpfs sẽ mất. Không dừng container ứng dụng hoặc container test của tác vụ khác.
