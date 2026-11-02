# Bàn giao mobile: lọc theo ngày cho phiếu nhập, phiếu xuất và lịch sử biến động

## Phạm vi

API và web triển khai trên nhánh `feature/stock-list-filters` (xếp sau `feature/maintenance-return-workflow`). Không sửa mã trong `mobile/`. Không có migration, không đổi response, không đổi quyền.

## API

Ba danh sách nhận thêm hai query tùy chọn `dateFrom`, `dateTo` dạng `YYYY-MM-DD`. Có thể gửi một trong hai hoặc cả hai; khoảng gồm cả hai đầu.

| Endpoint                          | Lọc theo cột          | Ghi chú                                                   |
| --------------------------------- | --------------------- | --------------------------------------------------------- |
| GET `/stock-receipts`             | `receiptDate` (date)  | Ngày chứng từ hiển thị trên bảng                          |
| GET `/stock-issues`               | `issueDate` (date)    | Ngày chứng từ hiển thị trên bảng                          |
| GET `/inventory/transactions`     | `createdAt` (timestamp) | Tính theo ngày giờ Việt Nam (Asia/Ho_Chi_Minh)          |

Lỗi: ngày sai định dạng hoặc không tồn tại (vd. `2026-02-30`) trả 400 `dateFrom must be a valid date (YYYY-MM-DD)`; `dateFrom > dateTo` trả 400 `dateFrom must not be after dateTo`. Gửi chuỗi rỗng tương đương không lọc, nhưng nên bỏ hẳn tham số.

Ví dụ: `GET /stock-receipts?farmId=<uuid>&dateFrom=2026-10-01&dateTo=2026-10-31&page=1&pageSize=20`.

## Gợi ý cho mobile

- Đổi bộ lọc ngày thì về trang 1, giữ các bộ lọc khác (trạng thái, kho, vật tư, loại biến động).
- Cho người dùng nhập ngày theo dạng ngày/tháng/năm, chỉ chuyển sang `YYYY-MM-DD` khi gửi API. Web dùng ô nhập dd/mm/yyyy cố định thay vì ô ngày của trình duyệt vì ô gốc hiện theo locale (mm/dd) gây nhầm.
- Chặn ở client khi từ ngày > đến ngày; API vẫn kiểm tra lại.
- Danh sách rỗng khi đang lọc nên báo "không có kết quả phù hợp với bộ lọc", không báo "chưa có dữ liệu".

## Kiểm thử nghiệm thu mobile

1. Lọc phiếu nhập/xuất tháng có dữ liệu → chỉ hiện phiếu có ngày chứng từ trong khoảng, phân trang đúng tổng.
2. Lọc lịch sử biến động một ngày → gồm giao dịch từ 00:00 đến 23:59 giờ Việt Nam của ngày đó.
3. Chỉ nhập "từ ngày" hoặc chỉ "đến ngày" → lọc một phía.
4. Từ ngày > đến ngày → không gửi request, hiện lỗi.
5. Xóa ngày → danh sách trở về đầy đủ.
