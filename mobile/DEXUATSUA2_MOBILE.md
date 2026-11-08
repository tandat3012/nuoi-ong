# Đợt sửa dexuatsua2 (08/11) — việc còn lại cho Mobile

API/Web đã sửa xong các mục dưới đây. Mobile **chưa** được sửa (theo phân công). Mỗi mục ghi rõ API trả gì, chỗ Mobile đang sai và cách sửa tối thiểu. Nếu chưa kịp sửa, dùng cách tạm ghi ở cuối mỗi mục.

## A6 — P2-02: hiển thị `DISCREPANCY` của phiếu chuyển kho

- File: `src/features/notifications/presentation/TransferNotificationDetailScreen.tsx` (hàm tô màu trạng thái ~dòng 29 và thông báo ~dòng 135).
- Hiện tại `DISCREPANCY` rơi vào nhánh cuối: "Phiếu đã kết thúc; tồn kho không thay đổi." — **sai**: kho nguồn đã bị trừ khi xuất, kho đích đã cộng phần nhận hợp lệ.
- Sửa:
  - Tông `amber`, nhãn "Nhận thiếu, chờ xử lý".
  - Thông báo: "Kho nguồn đã trừ tồn khi xuất; kho đích chỉ cộng phần thực nhận. Phần thiếu chờ chủ trại xử lý."
  - Mỗi dòng đã hiện "Đã xuất / Thực nhận" (`quantity` / `receivedQuantity`); thêm `discrepancyReason` nếu có.
  - Sau khi xử lý, phiếu về `CONFIRMED` với `resolution` (`RETURN_TO_SOURCE` = trả phần thiếu về kho nguồn, `WRITE_OFF` = ghi nhận mất), `resolutionNote`. Hiện 2 trường này nếu có.
- Phiếu cũ có thể thiếu `receivedQuantity`/timestamp: giữ điều kiện `!= null` như hiện tại.
- Không cần làm màn xử lý sai lệch trên Mobile (`POST /stock-transfers/:id/resolve` chỉ ADMIN/FARM_OWNER, làm trên Web).

## A5 — P1-12: kiểm kê từng tài sản (ASSET)

- File: `src/features/inventory/presentation/StockCountScreen.tsx` ~dòng 62–112 đang lọc bỏ dòng ASSET (`// dev rejects ASSET lines…`). API đã nhận dòng ASSET từ migration `0047`.
- Hợp đồng API: xem `ASSET_STOCK_COUNT_MOBILE.md` (dòng ASSET `{ itemId, assetId, actualQuantity: "1" | "0", assetCondition?, foundLocationId?, note? }`).
- Sửa tối thiểu:
  1. Bỏ bộ lọc `trackingMode !== 'ASSET'`; mỗi tài sản là một dòng (lấy danh sách tài sản `AVAILABLE`/`DAMAGED` của kho kiểm).
  2. Dòng tài sản: chọn "Có — tốt" / "Có — hỏng" / "Không thấy"; khi có thì chọn vị trí thực thấy (mặc định vị trí hiện tại).
  3. Cho nhập mã tài sản bằng tay khi không quét được QR.
  4. Khi mở lại nháp rồi lưu: giữ `assetId`, `assetCondition`, `foundLocationId` của từng dòng.
- Không tự điều chỉnh tồn trên Mobile; duyệt chênh lệch vẫn qua API (403 `SELF_APPROVAL`, 409 `STOCK_COUNT_STALE`).
- Cách tạm: chặn sửa/lưu phiếu kiểm kê có dòng `assetId`, chỉ cho xem.

## A4 — P1-08: phiếu nhập hàng trả từ đơn giao thất bại (`orderReturn: true`)

API mới (đã chạy):
- Dòng khớp `lineId` mà request **không gửi** `assetCondition` / `locationId` / `unitPrice` / `note` → giữ giá trị đã lưu. Gửi `assetCondition: null` mới là xoá.
- Dòng tài sản của phiếu hàng trả **không có `lineId` khớp** (hoặc dùng lại một `lineId` hai lần) → 400 `An order return line of an asset must keep the lineId of a shipped asset`.

Mobile đang sai (`ReceiptDetailScreen.tsx`, `receipt-payload.ts`):
- Không giữ `assetId`, `assetCondition` của dòng ⇒ không hiện/không chọn được kết quả kiểm nhận; phiếu không thể xác nhận trên Mobile (API bắt buộc condition).
- `newAssetLine` (~dòng 702) sao chép cả `lineId` của dòng cũ ⇒ tăng số lượng tài sản sẽ gửi trùng `lineId` → giờ bị 400.

Sửa:
- Đọc/giữ `lineId`, `assetId`, `assetCondition`, `locationId` mỗi dòng; hiện ô chọn "Tốt / Hỏng" cho dòng có `assetId`; gửi `assetCondition`.
- Phiếu `orderReturn`: không cho thêm tài sản mới; dòng mới không được kế thừa `lineId`.
- Cách tạm (an toàn nhất): phiếu có `orderReturn: true` chỉ xem trên Mobile, sửa/xác nhận trên Web.

## A1 — P0-03: phiếu nhập hoàn trả nội bộ (mới)

- Phiếu nhập có `receipt.sourceIssueId` = hoàn trả từ phiếu xuất. Dòng có `sourceIssueItemId`, `rejectedQuantity`, `rejectionReason`; `quantity` là lượng **đạt** (có thể `"0.000"` khi hỏng hết).
- API **từ chối PATCH** phiếu loại này (409 `An internal return cannot be edited…`). Mobile hiện PATCH trước khi gửi duyệt ⇒ sẽ lỗi.
- Sửa: phiếu có `sourceIssueId` → ẩn sửa, gửi duyệt/xác nhận không PATCH; hiện "Không đạt: x — lý do" và không áp kiểm tra số lượng > 0 cho các dòng này.
- Tạo phiếu (tuỳ chọn trên Mobile): `POST /stock-receipts/from-issue/:issueId` `{ items: [{ issueItemId, acceptedQuantity, rejectedQuantity?, rejectionReason? }], note?, receiptDate? }`. Chi tiết phiếu xuất có `items[].returnedQuantity` và `issue.warrantyRequestId`.

## A2 — P1-02: điều chuyển tài sản nhận hỏng

- `asset_transfer_requests.status` có thêm `DISCREPANCY` = kho đích đã nhận nhưng tài sản hỏng (tài sản `DAMAGED`, đã nằm ở kho đích), chờ ADMIN/FARM_OWNER xử lý.
- Trường mới: `resolvedAt`, `resolvedByMemberId`, `resolutionNote` (sau `POST /asset-transfer-requests/:id/resolve { note }` → `CONFIRMED`).
- Thông báo mới: `ASSET_TRANSFER_REQUEST_DISCREPANCY` (người tạo + người duyệt kho).
- `AssetTransferRequestDetailScreen.tsx` đang hiện chữ `DISCREPANCY` thô: thêm nhãn "Nhận hỏng, chờ xử lý", hiện `receivedCondition`, `receiveNote` và phần xử lý.

## Không đổi với Mobile

- A3 (bảo trì): API chặn nhân viên bảo trì làm việc đã giao cho nhân viên bảo trì khác (403 `This maintenance job is assigned to another staff member`) và chặn họ tự đổi người phụ trách. Mobile chỉ đọc bảo trì nên không cần sửa; nếu sau này cho thao tác, ẩn nút khi `performedByStaff && performedByMemberId !== memberId`.
- A7/A8/A9/A10: chỉ API/Web.
