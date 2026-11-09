# Điều chuyển tài sản hai bước (P1-02, NV02) — ghi chú cho Mobile

- Cùng kho: `POST /assets/:id/transfer` và duyệt yêu cầu chuyển vẫn đổi vị trí ngay như cũ.
- Khác kho: chỉ là **xuất**. Tài sản thành `TRANSFER_PENDING`, `currentLocationId = null`, kho nguồn trừ 1, kho đích **chưa** cộng. Yêu cầu chuyển có trạng thái mới `IN_TRANSIT` (chuyển trực tiếp của quản lý cũng tạo một yêu cầu `IN_TRANSIT`).
- Kho đích nhận: `POST /asset-transfer-requests/:id/receive` `{ assetCode, condition: "GOOD" | "DAMAGED", note? }` (chỉ quản lý của kho đích; `DAMAGED` bắt buộc `note`). Mã không khớp → 409 `ASSET_MISMATCH`. Nhận xong: yêu cầu `CONFIRMED`, có `receivedByMemberId`, `receivedAt`, `receivedCondition`, `receiveNote`; tài sản `AVAILABLE` hoặc `DAMAGED` tại vị trí đích.
- Màn yêu cầu chuyển nên hiện nhãn "Đang chuyển, chờ kho đích nhận" cho `IN_TRANSIT` và nút nhận (quét QR → `assetCode`). Lịch sử tài sản có hai hành động mới `ASSET_TRANSFER_DISPATCHED`, `ASSET_TRANSFER_RECEIVED`.
