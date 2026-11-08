# Kiểm kê tài sản theo từng mã (P1-12, NV03) — ghi chú cho Mobile

- `POST/PATCH /stock-counts` nhận dòng ASSET: `{ itemId, assetId, actualQuantity: "1" | "0", assetCondition?: "GOOD" | "DAMAGED", foundLocationId?, note? }`. `1` = có (**bắt buộc** gửi `assetCondition`, thiếu → 400), `0` = thiếu (không gửi condition/location; tài sản đang `DAMAGED` không được ghi thiếu → 400). Mỗi tài sản một dòng, chỉ tài sản đang `AVAILABLE`/`DAMAGED` ở kho kiểm; sai → 400/404/409.
- Chi tiết phiếu có thêm `assetCode`, `assetCondition`, `foundLocationId`, `foundLocationCode`, `foundLocationName` trên dòng.
- Thiếu/hỏng/sai vị trí cần người khác người lập duyệt (403 `SELF_APPROVAL`). Khi duyệt: thiếu → `LOST` + sự cố mất + trừ tồn; hỏng → `DAMAGED`; sai vị trí → chuyển về vị trí thực thấy. Tài sản đổi trạng thái sau khi kiểm → 409 `STOCK_COUNT_STALE`.
- Gợi ý Mobile: quét QR từng tài sản để tạo dòng; lịch sử tài sản có hành động `ASSET_COUNTED`.
- **Cần sửa trên Mobile trước khi cho sửa phiếu có dòng tài sản:** khi mở lại phiếu nháp rồi lưu/gửi duyệt, phải giữ nguyên `assetId`, `assetCondition`, `foundLocationId` của từng dòng (API trả `actualQuantity` dạng `"1.000"`/`"0.000"`). Nếu bỏ `foundLocationId`, việc chuyển về vị trí thực thấy sẽ mất mà không báo lỗi. Cách tạm: chặn sửa phiếu kiểm kê có dòng `assetId` trên Mobile.
