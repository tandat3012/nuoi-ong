export interface ErrorDetails {
  code?: string;
  message?: string | string[];
  statusCode?: number;
  error?: string;
}

const STOCK_ERROR_PATTERNS: Array<[RegExp, string]> = [
  // Stock holds (P1-10, P1-11, mobile/STOCK_HOLDS_MOBILE.md)
  [
    /Insufficient available inventory: the stock is held for customer orders|held for customer orders/i,
    'Hàng đang được giữ cho đơn của khách',
  ],
  [/ASSET is held for a customer order/i, 'Tài sản đã được giữ cho đơn khách'],
  [
    /PAYMENT_NOT_VERIFIED|bank transfer order must be PAID/i,
    'Đơn chuyển khoản chưa được xác nhận đã thanh toán',
  ],
  [
    /Exchange issue must match the item, quantity and warehouse of the warranty request|Exchange issue must match|Warranty exchange issue/i,
    'Phiếu đổi bảo hành phải đúng mặt hàng và số lượng đã duyệt',
  ],

  // Self approval & Stale stock count (P1-12, NV03)
  [
    /SELF_APPROVAL|other than its author/i,
    'Phiếu kiểm kê có chênh lệch phải do người khác (không phải người lập) duyệt.',
  ],
  [
    /STOCK_COUNT_STALE/i,
    'Tồn kho đã thay đổi từ lúc lập phiếu kiểm kê. Vui lòng kiểm lại và lập phiếu mới.',
  ],

  // Two-step Asset Transfer (P1-02, NV02)
  [/ASSET_MISMATCH/i, 'Mã tài sản không khớp với yêu cầu điều chuyển (ASSET_MISMATCH).'],
  [/A note is required for a damaged asset/i, 'Cần ghi chú tình trạng khi nhận tài sản hỏng.'],

  // General inventory conflicts & document states
  [/Cancel the linked order instead/i, 'Phiếu gắn với đơn hàng: hãy hủy đơn hàng thay vì từ chối phiếu.'],
  [/Only DRAFT .* can be submitted|can be submitted/i, 'Phiếu không còn ở trạng thái nháp nên không gửi duyệt được.'],
  [/Only DRAFT .* can be edited/i, 'Chỉ phiếu nháp mới được chỉnh sửa.'],
  [/Only DRAFT .* can be cancelled/i, 'Phiếu không còn ở trạng thái nháp nên không hủy được.'],
  [/can be rejected/i, 'Phiếu không còn ở trạng thái chờ duyệt nên không từ chối được.'],
  [/can be confirmed/i, 'Phiếu không còn chờ xác nhận.'],
  [/can be received/i, 'Phiếu không còn ở trạng thái đang chuyển.'],
  [/Insufficient inventory|Insufficient source inventory/i, 'Số lượng tồn kho khả dụng không đủ để thực hiện.'],
  [/Asset is already at this location/i, 'Tài sản đã ở vị trí này.'],
  [/Asset has active maintenance/i, 'Tài sản đang có yêu cầu bảo trì chưa hoàn tất.'],
  [/WAREHOUSE_NOT_EMPTY/i, 'Kho còn hàng hoặc tài sản, không thể xóa hoặc ngừng hoạt động.'],
  [/Only AVAILABLE assets/i, 'Chỉ tài sản đang sẵn sàng (AVAILABLE) mới được thực hiện thao tác này.'],
];

/**
 * Translates backend API conflict / stock hold / business errors into user-friendly Vietnamese messages.
 * Matches exact error codes (PAYMENT_NOT_VERIFIED, SELF_APPROVAL, etc.), HTTP status, and error message patterns.
 */
export function getFriendlyErrorMessage(
  rawMessage: string,
  details?: unknown,
  status?: number,
): string {
  const detailsObj = details && typeof details === 'object' ? (details as ErrorDetails) : undefined;
  const code = detailsObj?.code;

  if (code === 'PAYMENT_NOT_VERIFIED') {
    return 'Đơn chuyển khoản chưa được xác nhận đã thanh toán';
  }
  if (code === 'SELF_APPROVAL') {
    return 'Phiếu kiểm kê có chênh lệch phải do người khác (không phải người lập) duyệt.';
  }
  if (code === 'STOCK_COUNT_STALE') {
    return 'Tồn kho đã thay đổi từ lúc lập phiếu kiểm kê. Vui lòng kiểm lại và lập phiếu mới.';
  }
  if (code === 'ASSET_MISMATCH') {
    return 'Mã tài sản không khớp với yêu cầu điều chuyển (ASSET_MISMATCH).';
  }

  for (const [pattern, translation] of STOCK_ERROR_PATTERNS) {
    if (pattern.test(rawMessage)) {
      return translation;
    }
  }

  // Handle by HTTP status if raw message is generic
  if (status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (status === 403) {
    if (/own documents/i.test(rawMessage)) {
      return 'Bạn chỉ thao tác được phiếu do chính mình tạo.';
    }
    return 'Bạn không có quyền thực hiện thao tác này trong trang trại.';
  }
  if (status === 404) {
    if (/Asset.*not found/i.test(rawMessage)) {
      return 'Không tìm thấy tài sản trong trang trại.';
    }
    if (/Stock count.*not found/i.test(rawMessage)) {
      return 'Không tìm thấy phiếu kiểm kê.';
    }
    return 'Dữ liệu không tồn tại hoặc không thuộc trang trại này.';
  }

  return rawMessage;
}
