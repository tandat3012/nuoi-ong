# Quy ước tài liệu dự án

## Nơi lưu

- Mọi tài liệu Markdown mới về nghiệp vụ, thiết kế, API, DB, cấu hình, triển khai hoặc kiểm thử của dự án đặt dưới `docs/` ở root.
- Chọn nhóm theo nghiệp vụ, ví dụ `auth/`, `inventory/`, `notifications/`, `data/`. Dùng `architecture/` cho tổ chức source và `setup/` cho cách chạy/cấu hình chung.
- Tài liệu một luồng dùng chung Web/API/Mobile nằm trong cùng nhóm; chia các mục theo nền tảng khi cần. Không tạo bản sao cùng nội dung tại `api/docs/` hoặc `mobile/docs/`.
- Tạo nhóm mới khi có tài liệu thực tế cần lưu, chẳng hạn tài sản, bảo trì hoặc audit. Thêm nhóm và tài liệu vào [mục lục tổng](README.md).
- `AGENTS.md` tại root/module và `GIT_WORKFLOW.md` tại root giữ vị trí phục vụ công cụ/quy trình. README ở root/module/feature là điểm vào ngắn, liên kết về tài liệu chính trong `docs/`.
- Chỉ dùng vị trí khác khi người dùng yêu cầu rõ hoặc công cụ/framework bắt buộc; không tự chuyển các file điều khiển của công cụ vào tài liệu nghiệp vụ.

## Tên và nội dung

- Dùng tên thư mục/file tiếng Anh, chữ thường, `kebab-case.md`; nội dung có thể viết tiếng Việt.
- Chỉ đánh số khi tài liệu có thứ tự thực hiện rõ, như `notifications/01-device-api.md` đến `04-push-worker.md`. Số chặng là quy trình của tính năng, không phải migration DB.
- Mỗi nghiệp vụ nên có tài liệu chính; cập nhật file hiện có khi mở rộng cùng luồng. Tách file khi nội dung có phạm vi riêng và liên kết qua lại.
- Ghi rõ mục tiêu, đối tượng/quyền, phạm vi farm/kho/tài khoản, luồng thao tác, trạng thái/transaction, API/DB liên quan, cấu hình và cách test khi chúng áp dụng.
- Phân biệt phần đã có code, đã kiểm thử tự động, đã xác nhận trên thiết bị và phần đang dự kiến. Không trình bày plan chưa thực hiện như tính năng đã chạy.
- Giữ phần lịch sử/scaffold/báo cáo giai đoạn có nhãn rõ. Không tự sửa logic hoặc dữ liệu dự án chỉ để khớp tài liệu cũ; yêu cầu mới của người dùng và code/schema hiện tại là căn cứ đối chiếu.
- Dùng placeholder cho JWT, token, mật khẩu và khóa dịch vụ; không đưa giá trị bí mật thực vào tài liệu.

## Khi tạo hoặc di chuyển file

1. Chọn đúng nhóm trong `docs/`, đọc tài liệu liên quan trước khi tạo bản mới.
2. Thêm/cập nhật liên kết và mô tả trong `docs/README.md`; cập nhật README điểm vào nếu cần.
3. Khi đổi tên/chuyển vị trí, cập nhật các liên kết ở toàn repository và giữ một bản nội dung chính. Không để đường dẫn cũ trong hướng dẫn đang dùng.
4. Dùng liên kết Markdown tương đối từ file tài liệu. Đường dẫn source có thể tính từ root repository; ghi rõ đang đứng tại `api`, `web`, `mobile` hoặc root trước các lệnh terminal.
5. Kiểm tra các liên kết file cục bộ sau khi chỉnh sửa. Không cần chạy lại build/test nghiệp vụ chỉ vì đổi vị trí Markdown, trừ khi tài liệu được dùng làm đầu vào cho công cụ khác.

Quy ước này được dẫn từ [AGENTS.md](../AGENTS.md) để các phiên làm việc sau tiếp tục dùng cùng cấu trúc.
