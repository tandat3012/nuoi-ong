# Chuyển kho 2 bước: lưu ý cho Mobile (T04)

API tách xác nhận phiếu chuyển kho thành **xuất** (kho nguồn) và **nhận** (kho đích). Mobile hiện chỉ tạo, xem và gửi duyệt phiếu chuyển, nên **không có API nào Mobile đang gọi bị đổi**. Cần cập nhật phần hiển thị.

## Trạng thái mới

```text
DRAFT ─submit─▶ PENDING_APPROVAL ─confirm (kho nguồn)─▶ IN_TRANSIT ─receive (kho đích)─▶ CONFIRMED
```

| `status` | Ý nghĩa | Gợi ý nhãn |
|---|---|---|
| `IN_TRANSIT` | Kho nguồn đã xuất, đã trừ tồn nguồn; kho đích **chưa** được cộng | "ĐANG CHUYỂN" (tông amber) |
| `CONFIRMED` | Kho đích đã nhận; với phiếu chuyển nên hiển thị "ĐÃ NHẬN" | giữ tông success |

Chỗ cần thêm `IN_TRANSIT`: `ReceiptListScreen.tsx` (hàm tone/nhãn trạng thái), `TransferNotificationDetailScreen.tsx` (`statusTone`), `NotificationCenterScreen.tsx` (nhãn trạng thái). Hiện `IN_TRANSIT` sẽ rơi vào nhánh mặc định (neutral), không crash.

## Trường mới (chỉ đọc)

- `transfer.dispatchedAt`, `transfer.dispatchedByMemberId`: lúc/ai xuất. `confirmedAt`/`confirmedByMemberId` của phiếu chuyển giờ là lúc/ai **nhận**. Phiếu cũ (trước T04) có `dispatchedAt = null`.
- Mỗi dòng: `receivedQuantity` (null khi chưa nhận và ở phiếu cũ = nhận đủ), `discrepancyReason` (lý do khi nhận thiếu). Màn chi tiết nên hiện "Đã xuất / Thực nhận / Lý do lệch" khi `receivedQuantity` khác null.

## Thông báo mới

- `type = STOCK_TRANSFER_IN_TRANSIT`, `data.status = IN_TRANSIT`, gửi cho quản lý kho **đích** khi kho nguồn xuất. `entityType` vẫn là `STOCK_TRANSFER`, nên điều hướng hiện tại vẫn mở đúng `TransferNotificationDetailScreen`.
- Người tạo phiếu chỉ nhận một thông báo `STOCK_TRANSFER_CONFIRMED` khi kho đích nhận xong (không còn thông báo lúc duyệt).

## Nếu sau này Mobile cho phép nhận hàng

`POST /stock-transfers/:id/receive?farmId=…`, body tùy chọn `{ items: [{ id: <id dòng>, receivedQuantity: "4", discrepancyReason: "1 chai vỡ" }] }`; dòng không gửi coi là nhận đủ. Lỗi 400: `Received quantity cannot exceed the dispatched quantity`, `A short line needs a discrepancy reason`, `Transfer line not found`; 409: `Only IN_TRANSIT transfers can be received`; người không thuộc kho đích: `This warehouse is not one of your assigned warehouses`.
