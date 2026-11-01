'use client';

import { useCart } from '../hooks/use-cart';

export function CartVerificationNote() {
  const { items, isReconciling, reconcileCart } = useCart();
  const failed = items.some((item) => item.verification === 'error');
  const pending = items.some((item) => item.verification === 'pending');
  return (
    <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
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
