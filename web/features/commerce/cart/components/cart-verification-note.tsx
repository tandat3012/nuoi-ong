'use client';

import { useCart } from '../hooks/use-cart';

export function CartVerificationNote() {
  const { items, isReconciling, reconcileCart } = useCart();
  const failed = items.some((item) => item.verification === 'error');
  const pending = items.some((item) => item.verification === 'pending');
  return (
    <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
      <p>
        Tạm tính chỉ là ước tính, cần máy chủ xác nhận lại giá và tình trạng
        hàng khi thanh toán. Dòng hết hàng, không còn tồn tại hoặc cần chọn lại
        quy cách không được tính vào tạm tính. Nếu thiếu giá hợp lệ, tổng sẽ
        hiển thị “Chưa xác định”.
      </p>
      {(pending || failed) && (
        <p role="status">
          {pending
            ? 'Đang xác minh giỏ hàng…'
            : 'Chưa xác nhận được giá/tình trạng hàng hiện tại; đang hiển thị thông tin đã lưu.'}
          {failed && (
            <button
              type="button"
              disabled={isReconciling}
              onClick={() => void reconcileCart()}
              className="ml-1 underline text-foreground disabled:opacity-50"
            >
              Thử lại
            </button>
          )}
        </p>
      )}
    </div>
  );
}
