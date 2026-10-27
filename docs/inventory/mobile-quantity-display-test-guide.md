# Hướng dẫn kiểm thử hiển thị số lượng trên Mobile

**Trạng thái:** formatter dùng chung đã được tích hợp; `pnpm typecheck` đã đạt. Kiểm thử hiển thị thủ công trên thiết bị chưa được ghi nhận.

Formatter nhận chuỗi số từ API/DB, loại phần thập phân không có ý nghĩa và không nhóm hàng nghìn để tránh nhầm `2.000` với hai nghìn. Phần lẻ còn ý nghĩa được giữ tối đa ba chữ số và dùng dấu phẩy thập phân theo locale tiếng Việt. Đây chỉ là thay đổi hiển thị; giá trị gửi API và logic tính toán không đổi.

| Giá trị API/số đầu vào | Kết quả mong đợi |
| --- | --- |
| `"2.000"` | `2` |
| `2` | `2` |
| `2000` | `2000` |
| `"1.250"` | `1,25` |
| `"0.125"` | `0,125` |

## Phạm vi màn hình cần kiểm tra

- Tổng quan: tổng số lượng tồn.
- Tồn kho: thẻ vật tư, tồn và định mức; dự báo lượng xuất trung bình và số ngày còn.
- Chi tiết tồn kho, chi tiết lô và kết quả quét QR.
- Cảnh báo tồn dưới định mức.
- Tạo/xem phiếu nhập, phiếu xuất, điều chuyển và kiểm kê; chú ý các số lượng, mức tồn khả dụng và tổng phiếu.
- Chi tiết thông báo điều chuyển và lịch sử thao tác nếu có trường số lượng.

## Các bước kiểm thử thủ công

1. Chọn một farm/kho có dữ liệu số nguyên như `2.000` hoặc `23.000`; xác nhận UI hiện `2` hoặc `23` kèm đơn vị, không còn hậu tố `.000`.
2. Chọn vật tư có số tồn thật là 2000 nếu có; xác nhận hiển thị `2000`, không thành `2`.
3. Với giá trị lẻ như `1.250`, xác nhận hiện `1,25`; với `0.125`, hiện `0,125`.
4. Mở phiếu nhập/xuất/điều chuyển và xác nhận số lượng dòng, tổng số lượng, tồn khả dụng và đơn vị vẫn đúng với dữ liệu API.
5. Tăng/giảm số lượng trong bản nháp rồi lưu hoặc gửi theo quyền hiện tại. Xác nhận payload/giá trị lưu vẫn là số lượng đã nhập; formatter không làm tròn dữ liệu nghiệp vụ.
6. Kiểm tra trên các màn hình ở phạm vi trên để tìm chỗ còn hiện trực tiếp chuỗi như `2.000`.

## Chạy kiểm tra TypeScript

Đứng tại thư mục `mobile`:

```powershell
pnpm typecheck
```

Lệnh này kiểm tra kiểu, không thay thế việc mở UI và đối chiếu các giá trị trên thiết bị. Khi báo lỗi, ghi màn hình, loại giá trị đầu vào và giá trị mong đợi; không gửi token hoặc dữ liệu bí mật.
