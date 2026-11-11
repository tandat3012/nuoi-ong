import { describe, expect, it } from '@jest/globals';
import { getFriendlyErrorMessage } from './stock-errors';

describe('stock-errors', () => {
  it('translates customer order stock hold error', () => {
    expect(
      getFriendlyErrorMessage(
        'Insufficient available inventory: the stock is held for customer orders',
      ),
    ).toBe('Hàng đang được giữ cho đơn của khách');
  });

  it('translates asset held for customer order error', () => {
    expect(getFriendlyErrorMessage('ASSET is held for a customer order')).toBe(
      'Tài sản đã được giữ cho đơn khách',
    );
  });

  it('translates unverified payment error from code or message', () => {
    expect(
      getFriendlyErrorMessage('Order not paid', { code: 'PAYMENT_NOT_VERIFIED' }),
    ).toBe('Đơn chuyển khoản chưa được xác nhận đã thanh toán');

    expect(
      getFriendlyErrorMessage('Bank transfer order must be PAID before issuing'),
    ).toBe('Đơn chuyển khoản chưa được xác nhận đã thanh toán');
  });

  it('translates warranty exchange discrepancy error', () => {
    expect(
      getFriendlyErrorMessage(
        'Exchange issue must match the item, quantity and warehouse of the warranty request',
      ),
    ).toBe('Phiếu đổi bảo hành phải đúng mặt hàng và số lượng đã duyệt');
  });

  it('translates self approval error code', () => {
    expect(
      getFriendlyErrorMessage('Cannot approve own document', { code: 'SELF_APPROVAL' }),
    ).toBe('Phiếu kiểm kê có chênh lệch phải do người khác (không phải người lập) duyệt.');
  });

  it('translates stale stock count error code', () => {
    expect(
      getFriendlyErrorMessage('Stock count is stale', { code: 'STOCK_COUNT_STALE' }),
    ).toBe('Tồn kho đã thay đổi từ lúc lập phiếu kiểm kê. Vui lòng kiểm lại và lập phiếu mới.');
  });

  it('translates asset mismatch error code', () => {
    expect(
      getFriendlyErrorMessage('Asset code does not match', { code: 'ASSET_MISMATCH' }),
    ).toBe('Mã tài sản không khớp với yêu cầu điều chuyển (ASSET_MISMATCH).');
  });

  it('translates HTTP 403, 404, 401 when generic', () => {
    expect(getFriendlyErrorMessage('Forbidden', undefined, 403)).toBe(
      'Bạn không có quyền thực hiện thao tác này trong trang trại.',
    );
    expect(getFriendlyErrorMessage('Only modify own documents', undefined, 403)).toBe(
      'Bạn chỉ thao tác được phiếu do chính mình tạo.',
    );
    expect(getFriendlyErrorMessage('Asset not found', undefined, 404)).toBe(
      'Không tìm thấy tài sản trong trang trại.',
    );
    expect(getFriendlyErrorMessage('Unauthorized', undefined, 401)).toBe(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
  });

  it('returns raw message when no pattern matches', () => {
    expect(getFriendlyErrorMessage('Một lỗi không xác định')).toBe('Một lỗi không xác định');
  });
});
