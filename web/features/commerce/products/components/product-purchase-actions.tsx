'use client';

import * as React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface ProductPurchaseActionsProps {
  inStock: boolean;
  canAdd?: boolean;
  onAddToCart?: () => void;
  onBuyNow?: () => void;
  className?: string;
}

export function ProductPurchaseActions({
  inStock,
  canAdd = inStock,
  onAddToCart,
  onBuyNow,
  className,
}: ProductPurchaseActionsProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row gap-3 pt-2', className)}>
      {/* Nút Thêm vào giỏ — Hành động chính (Primary) */}
      <Button
        type="button"
        disabled={!canAdd}
        aria-disabled={!canAdd}
        onClick={onAddToCart}
        aria-label={inStock ? 'Thêm vào giỏ hàng' : 'Sản phẩm tạm hết hàng'}
        className={cn(
          'flex-1 h-12 rounded-xl border border-[#e5dcd1] dark:border-border bg-[#faf5ee] hover:bg-[#f3ebe0] dark:bg-muted/50 dark:hover:bg-muted text-[#453c35] dark:text-foreground font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer',
          !inStock && 'opacity-50 cursor-not-allowed hover:bg-[#faf5ee]',
        )}
      >
        <ShoppingBag
          className="size-4 sm:size-5 text-[#786f66]"
          aria-hidden="true"
        />
        <span>{inStock ? 'Thêm vào giỏ' : 'Hết hàng'}</span>
      </Button>

      {/* Đặt hàng nhanh với đúng biến thể và số lượng đang chọn. */}
      <Button
        type="button"
        disabled={!canAdd || !onBuyNow}
        aria-disabled={!canAdd || !onBuyNow}
        onClick={onBuyNow}
        aria-label={inStock ? 'Mua ngay' : 'Sản phẩm tạm hết hàng'}
        className={cn(
          'flex-1 h-12 rounded-xl bg-[#ebb02d] text-[#451a03] font-semibold text-sm sm:text-base flex items-center justify-center gap-2 hover:bg-[#e0a51d] shadow-2xs disabled:cursor-not-allowed disabled:opacity-50',
          !inStock && 'opacity-40',
        )}
      >
        <span>Mua ngay</span>
        <ArrowRight className="size-4 sm:size-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
