# Duyệt chênh lệch tồn kho (P0-01, NV03) — ghi chú cho Mobile

- `POST /stock-counts/:id/confirm`: phiếu kiểm kê **có chênh lệch** mà người xác nhận chính là người lập ⇒ 403 `{ code: "SELF_APPROVAL", message: "A stock difference must be approved by someone other than its author" }`. Phiếu không chênh lệch người lập tự hoàn tất được.
- `POST /inventory/adjustments`: mọi đề xuất điều chỉnh, kể cả của ADMIN/FARM_OWNER/WAREHOUSE_MANAGER, giờ trả `adjustment.status = PENDING_APPROVAL` và `transaction = null` (trước đây người duyệt được áp dụng ngay). Một người duyệt **khác** gọi `POST /inventory/adjustments/:id/approve`; tự duyệt ⇒ 403 `SELF_APPROVAL`.
- Màn Mobile nào hiện "đã ghi tồn" ngay sau khi người duyệt tạo điều chỉnh cần đổi sang "chờ duyệt"; ẩn nút duyệt trên đề xuất của chính mình (`requester.id === memberId`).
