# Mobile App

Khung thư mục dành cho ứng dụng React Native Expo của Nuoi Ong.

## Phạm vi

- Dùng chung Backend trong thư mục `api/`.
- Dùng Clerk để xác thực người dùng.
- Dùng `currentFarmId` cho mọi request có phạm vi farm.
- Các feature chính: chọn farm, quét QR, tài sản và nghiệp vụ kho.

## Cấu trúc

```text
mobile/
├── assets/                  # Ảnh và icon tĩnh
├── app/                     # Expo Router: các route và layout màn hình
├── e2e/                     # Kiểm thử luồng trên thiết bị/emulator
├── src/
│   ├── core/                # Hạ tầng dùng chung
│   │   ├── auth/            # Clerk session và token
│   │   ├── config/          # Base URL và cấu hình môi trường
│   │   ├── errors/          # Chuẩn hóa lỗi API
│   │   ├── network/         # HTTP client và request interceptor
│   │   ├── storage/         # Lưu session và farm đã chọn
│   │   └── theme/           # Theme dùng chung
│   ├── features/
│   │   ├── auth/            # Đăng nhập và trạng thái phiên
│   │   ├── farm/            # Danh sách và chọn farm hiện tại
│   │   ├── qr-scan/         # Camera, đọc qrToken và điều hướng scan
│   │   ├── assets/           # Tra cứu và chi tiết tài sản
│   │   └── inventory/       # Nhập, xuất và kiểm kê kho
│   └── shared/              # Component, model và utility dùng chung
└── __tests__/               # Unit test và component test
```

## Quy tắc triển khai

- Không hard-code `farmId`, `assetId` hoặc `qrToken`.
- Chưa có `currentFarmId` thì không gọi API nghiệp vụ.
- `GUEST` không được mở dữ liệu tài sản sau khi quét QR.
- Mọi API vẫn phải được Backend kiểm tra lại authentication, membership và role.
- QR chỉ chứa URL dạng `/scan/{qrToken}`, không chứa dữ liệu nhạy cảm.

Khung này chưa bao gồm màn hình, API client hoặc logic nghiệp vụ. Khi bắt đầu triển khai, khởi tạo Expo project bằng `create-expo-app`, chọn Expo Router và lần lượt hoàn thiện từng feature.
