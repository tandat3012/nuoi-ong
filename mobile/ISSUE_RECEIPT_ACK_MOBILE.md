# Người nhận xác nhận thực nhận (P1-11, NV02) — ghi chú cho Mobile

- Phiếu xuất (`POST/PATCH /stock-issues`) nhận thêm `recipientMemberId` (không bắt buộc; lấy danh sách từ `GET /assets/members`). Chi tiết phiếu có `recipientMemberId`, `recipientName`, `receivedAt`, `receivedRecordedByMemberId`, `receiptNote`.
- Khi phiếu `CONFIRMED` và `receivedAt = null`: người nhận gọi `POST /stock-issues/:id/acknowledge` với `{ note? }`; quản lý kho ghi thay phải gửi `note` (căn cứ), thiếu → 400. Người khác → 404. Gọi lại khi đã nhận không đổi gì. Không trừ tồn.
- Người nhận thấy phiếu của mình trong `GET /stock-issues` dù không phải người lập.
- Tài sản: `POST /assets/:id/start-use` giờ cho chính người được giao gọi (mọi vai trò khu trại); quản lý kho ghi thay phải gửi `{ note }`, thiếu → 400; người khác → 403. Mobile hiện chưa gọi route này.
