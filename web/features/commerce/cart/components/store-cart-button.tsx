'use client';

import * as React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../hooks/use-cart';
import { cn } from '@/shared/lib/utils';

export interface StoreCartButtonProps {
  className?: string;
}

export function StoreCartButton({ className }: StoreCartButtonProps) {
  const { totalUnits, openDrawer, isHydrated } = useCart();
  const showBadge = isHydrated && totalUnits > 0;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={
        showBadge
          ? `Mở giỏ hàng, hiện có ${totalUnits} sản phẩm`
          : 'Mở giỏ hàng, giỏ hàng trống'
      }
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground hover:bg-muted/70 hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer',
        className,
      )}
    >
      <div className="relative inline-flex items-center justify-center">
        <ShoppingBag className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {showBadge && (
          <span
            className="absolute -top-1.5 -right-2 flex size-4.5 items-center justify-center rounded-full bg-primary text-[0.625rem] font-bold text-primary-foreground shadow-2xs animate-in zoom-in-75 duration-200"
            aria-hidden="true"
          >
            {totalUnits > 99 ? '99+' : totalUnits}
          </span>
        )}
      </div>
      <span className="hidden sm:inline">Giỏ hàng</span>
    </button>
  );
}
