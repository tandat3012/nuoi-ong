# Tài liệu dự án Nuôi Ong

Đây là điểm vào chung cho tài liệu nghiệp vụ, kiến trúc, cấu hình và kiểm thử của Web, API và Mobile. Tài liệu được nhóm theo nghiệp vụ; một luồng dùng chung được mô tả trong cùng nhóm để tiện đối chiếu giữa các nền tảng.

## Cấu trúc

```text
docs/
├── README.md                       # Mục lục tổng
├── CONVENTIONS.md                  # Quy ước viết và cập nhật tài liệu
├── setup/                          # Thiết lập dự án, API và Web
├── architecture/                   # Kiến trúc, quy ước source code
├── mobile/                         # Đặc tả tổng thể Mobile
├── inventory/                      # Kho, vật tư và chứng từ
├── auth/                           # Tài khoản, cài đặt và phiên đăng nhập
├── notifications/                  # Thông báo trong app, thiết bị và push
└── data/                           # Nguồn dữ liệu và seed
```

## Thiết lập và kiến trúc

| Tài liệu | Nội dung |
| --- | --- |
| [Thiết lập dự án](setup/project.md) | README gốc: cấu trúc dự án, môi trường local, Docker và lệnh chạy |
| [API](setup/api.md) | README/API setup gốc và các lệnh NestJS |
| [Web](setup/web.md) | Thiết lập Next.js và cấu trúc Web |
| [Quy ước feature Web](architecture/web-features.md) | Phân chia route, feature và shared |
| [Khung Mobile ban đầu](architecture/mobile-scaffold.md) | Tài liệu scaffold gốc, được giữ làm tham chiếu kiến trúc ban đầu |

## Mobile

| Tài liệu | Nội dung |
| --- | --- |
| [Đặc tả chức năng Mobile](mobile/mobile-app-spec.md) | Phạm vi ban đầu, phân quyền, farm, QR và nghiệp vụ hiện trường |

## Kho và chứng từ

| Tài liệu | Nội dung |
| --- | --- |
| [API và Database module kho](inventory/api-and-database.md) | Tài liệu nền về warehouse, nhập/xuất, LOT, ASSET, tồn, chuyển kho và kiểm kê |
| [Warehouse UI W2](inventory/warehouse-ui-w2.md) | Báo cáo giao diện, danh sách/chi tiết và quản lý kho của giai đoạn W2 |
| [Kiểm thử chi tiết phiếu kho trên Mobile](inventory/mobile-stock-documents-test-guide.md) | Checklist đối chiếu chi tiết nhập/xuất/điều chuyển, thông tin kho và quyền sửa |
| [Kiểm thử hiển thị số lượng trên Mobile](inventory/mobile-quantity-display-test-guide.md) | Checklist định dạng số nguyên/thập phân và phạm vi màn hình tồn kho/chứng từ |

## Tài khoản và cài đặt

| Tài liệu | Nội dung |
| --- | --- |
| [Tài khoản và phiên trên Android](auth/account-and-session.md) | Màn hình quản lý app, thông tin tài khoản, cài đặt thông báo, đăng xuất, giữ phiên và Reload |

<a id="thong-bao"></a>

## Thông báo

Đọc các chặng theo thứ tự. Mỗi chặng có luồng xử lý, ràng buộc và hướng dẫn test tương ứng.

| Chặng | Tài liệu | Phạm vi |
| --- | --- | --- |
| 1 | [API đăng ký thiết bị](notifications/01-device-api.md) | PUT/GET/DELETE token, cô lập tài khoản và hủy job khi đổi liên kết |
| 2 | [Mobile đăng ký thiết bị](notifications/02-mobile-registration.md) | UUID installation, quyền, Expo token, đồng bộ và đăng xuất |
| 3 | [Outbox nghiệp vụ và gửi bù](notifications/03-outbox-catchup.md) | Transaction cùng phiếu/audit/notification, người nhận và giới hạn gửi bù |
| 4 | [Worker gửi push](notifications/04-push-worker.md) | Gửi Expo, ticket/receipt, retry, token lỗi, cấu hình và test một điện thoại |
| 5 | [Chạm push và mở đúng phiếu](notifications/05-push-tap-navigation.md) | Listener tap/cold start, xác minh tài khoản/farm, đánh dấu đã đọc và điều hướng an toàn; cần test thiết bị |
| 6 | [Kiểm thử chấp nhận trên điện thoại](notifications/06-device-acceptance.md) | Checklist test tổng trên Android thật sau khi chặng 5 hoàn tất |

Chặng 4 có code, kiểm thử tự động và người dùng đã xác nhận push hiển thị trên điện thoại thật trong một kịch bản; các tổ hợp khác còn lại trong checklist. Worker mặc định tắt và cần bật cấu hình theo tài liệu. Chặng 5 đã có listener tap/cold start, xác minh phiên/farm, PATCH đọc và điều hướng; người dùng xác nhận luồng tap chạy được trên điện thoại thật. Chặng 6 vẫn là checklist nghiệm thu tổng cho nhiều loại phiếu/trạng thái và các tình huống quyền/tài khoản.

## Dữ liệu và seed

| Tài liệu | Nội dung |
| --- | --- |
| [Survey catalog](data/survey-catalog.md) | Nguồn Excel, quy tắc ánh xạ catalog và phạm vi seed khảo sát ban đầu |

## Quy trình làm việc

- [Quy ước tài liệu](CONVENTIONS.md): vị trí lưu, tên file, cập nhật mục lục và liên kết.
- [Git workflow](../GIT_WORKFLOW.md): quy trình Git/GitHub hiện có.
- [Hướng dẫn agent](../AGENTS.md): yêu cầu đọc workflow và duy trì tài liệu tập trung.

Các đặc tả nền, scaffold và báo cáo giai đoạn được giữ nguyên nội dung khi chuyển vị trí; không coi chúng là xác nhận rằng mọi chi tiết đã đồng bộ với code mới. Khi thay đổi nghiệp vụ, cập nhật tài liệu liên quan và ghi rõ phần đã triển khai/đã test theo [quy ước](CONVENTIONS.md).
