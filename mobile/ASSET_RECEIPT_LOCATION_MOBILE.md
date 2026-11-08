# Bàn giao mobile: vị trí bắt buộc khi nhập tài sản (T02) và kiểm kê cạnh tranh (T01)

Ngày 05/11/2026. Căn cứ: `docs/CHOT_NGHIEP_VU.md` (baseline v1.1), ticket T01 (AC09) và T02 (AC02). API và web đã sửa; **mã trong `mobile/` chưa sửa**, phần mobile do người phụ trách mobile thực hiện theo tài liệu này. Nếu tài liệu và API khác nhau, theo API.

| Ticket | Nhánh | Commit | Mobile phải sửa? |
| --- | --- | --- | --- |
| T01 kiểm kê cạnh tranh | `feature/t01-stock-count-race` | `1c42c3f`, `5fc0920` | Không |
| T02 nhập ASSET bắt buộc vị trí | `feature/t02-asset-receipt-location` | `013fdd6` | **Có** |

## Phía API/web đã làm

### T01: xác nhận kiểm kê không làm mất phiếu nhập/xuất/chuyển chạy cùng lúc

- Khi xác nhận phiếu kiểm kê, API khóa dòng tồn trước khi so với số sổ sách. Nếu tồn đã đổi so với lúc lập phiếu thì trả `409` với `message: "STOCK_COUNT_STALE"`, không ghi đè.
- Trước đây, kiểm kê một lô/mặt hàng chưa từng có tồn luôn bị báo `STOCK_COUNT_STALE`. Lỗi này đã sửa.
- Web dịch `STOCK_COUNT_STALE` thành: "Tồn kho đã thay đổi từ lúc lập phiếu kiểm kê… Hãy kiểm lại và lập phiếu mới."

**Mobile không phải sửa.** Mobile chỉ tạo, lưu và gửi duyệt phiếu kiểm kê (`StockCountScreen.tsx`), không gọi `/stock-counts/:id/confirm`. Hợp đồng tạo, lưu và gửi duyệt không đổi.

### T02: dòng ASSET phải có vị trí trước khi xác nhận nhập

- `POST /stock-receipts/:id/confirm` trả `400` với `message: "ASSET receipt lines require a location"` nếu một dòng của mặt hàng `trackingMode = ASSET` chưa có `locationId`. Khi bị từ chối, API không tạo asset và không ghi sổ kho.
- Tạo, sửa và gửi duyệt phiếu (`POST`, `PATCH`, `/submit`) **không** kiểm tra điều này, nên phiếu thiếu vị trí vẫn gửi duyệt được. Lỗi chỉ xuất hiện khi quản lý kho xác nhận trên web.
- `locationId` phải là vị trí `ACTIVE` thuộc **kho nhập** của phiếu. Vị trí sai kho hoặc không tồn tại thì API trả `400`/`404` ngay khi tạo hoặc sửa phiếu. Chỉ dòng ASSET được gửi `locationId`; dòng QUANTITY hoặc LOT gửi kèm sẽ bị trả `400` "Only ASSET receipt lines can select a location".
- Web đã bắt buộc chọn vị trí cho dòng tài sản ngay trên form.
- `api/scripts/list-assets-without-location.sql` liệt kê asset cũ đang `AVAILABLE` mà thiếu vị trí. Script chỉ đọc, không sửa dữ liệu.

## Mobile cần sửa (T02)

Hiện mobile **không có ô chọn vị trí** và `receiptItemsPayload` bỏ `locationId`. Vì vậy mọi phiếu nhập ASSET tạo từ mobile sẽ gửi duyệt được nhưng **không xác nhận được**. Sau khi đã gửi duyệt, phiếu `PENDING_APPROVAL` không sửa được nữa, nên quản lý chỉ có thể từ chối để người tạo lập lại.

1. **Kiểu dữ liệu:** thêm `locationId?: string | null` vào `StockDocumentLine` (`src/features/inventory/api.ts:282`). API chi tiết phiếu đã trả `locationId` trên từng dòng. Nếu cần hiển thị tên vị trí thì lấy từ `GET /locations`.
2. **Payload:** thêm `locationId?: string | null` vào `ReceiptPayloadItem` và gửi `locationId: item.locationId || undefined` trong `receiptItemsPayload` (`src/features/inventory/receipt-payload.ts`).
3. **Giữ vị trí khi mở lại phiếu:** khi map dòng phiếu từ API (`ReceiptDetailScreen.tsx`, khoảng dòng 400–414), giữ `locationId: line.locationId ?? null`. Nếu không giữ, một phiếu nháp tạo trên web có vị trí sẽ mất vị trí khi lưu lại từ mobile.
4. **Ô chọn vị trí:** mỗi dòng ASSET (cạnh ô "Mã tài sản", khoảng dòng 1266) cần một ô chọn vị trí `ACTIVE` của kho nhập. Dùng lại cách tải nhiều trang `activeLocations(token, farmId, warehouseId)` trong `src/features/assets/presentation/AssetTransferRequestScreen.tsx:37`. Khi đổi kho nhập thì xóa vị trí đã chọn của mọi dòng.
5. **Kiểm tra trước khi gửi:** trong bước kiểm tra `missingAsset` (khoảng dòng 847), chặn dòng ASSET chưa có vị trí, ví dụ: `Alert.alert('Thiếu vị trí', 'Tài sản “…” cần chọn vị trí trong kho.')`.
6. **Lưu sửa đổi của phiếu nháp đã mở lại:** ở luồng gửi duyệt (khoảng dòng 880–889), `else if (!params.id)` khiến phiếu mở từ danh sách (`params.id` có giá trị) **không được PATCH** trước `/submit`. Vị trí vừa chọn trên mobile sẽ không được lưu. Cần PATCH phiếu nháp trước khi submit, trừ khi màn hình đang ở chế độ chỉ xem.
7. **Test:** bổ sung `src/features/inventory/receipt-payload.test.ts` cho các trường hợp: dòng ASSET gửi `locationId`; dòng QUANTITY/LOT không gửi; mở lại phiếu vẫn giữ vị trí. Nếu có test màn hình: thiếu vị trí bị chặn, đổi kho thì xóa vị trí, phiếu mở lại được PATCH trước khi gửi.

## Tiêu chí nghiệm thu phía mobile (AC02)

- Tạo phiếu nhập có dòng ASSET và chọn vị trí trên mobile, gửi duyệt, rồi quản lý xác nhận trên web: asset được tạo `AVAILABLE` với `currentLocationId` đúng vị trí đã chọn.
- Không chọn vị trí thì mobile chặn ngay trước khi gửi, không để phiếu lên tới bước duyệt.
- Mở lại một phiếu nháp tạo trên web (đã có vị trí), sửa số serial rồi gửi duyệt từ mobile: vị trí vẫn còn.
- Phiếu QUANTITY/LOT không đổi hành vi.

## Dữ liệu đang có

Những phiếu ASSET đã gửi duyệt từ mobile mà thiếu vị trí sẽ không xác nhận được. Quản lý từ chối các phiếu đó, rồi người tạo lập lại phiếu sau khi mobile đã có bản sửa. Không sửa trực tiếp trong DB.
