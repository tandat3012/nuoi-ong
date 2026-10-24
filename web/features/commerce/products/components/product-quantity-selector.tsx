'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { validateAndClampQuantity } from './product-detail.logic';
import { cn } from '@/shared/lib/utils';

export interface ProductQuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
  purchaseLimit?: number;
  disabled?: boolean;
  className?: string;
}

export function ProductQuantitySelector({
  quantity,
  onChange,
  purchaseLimit,
  disabled = false,
  className,
}: ProductQuantitySelectorProps) {
  const [typingValue, setTypingValue] = React.useState<string | null>(null);
  const displayValue = typingValue !== null ? typingValue : String(quantity);

  const canDecrease = !disabled && quantity > 1;
  const canIncrease =
    !disabled &&
    (purchaseLimit === undefined || quantity < purchaseLimit);

  const handleDecrease = () => {
    if (!canDecrease) return;
    const next = validateAndClampQuantity(quantity - 1, purchaseLimit);
    setTypingValue(null);
    onChange(next);
  };

  const handleIncrease = () => {
    if (!canIncrease) return;
    const next = validateAndClampQuantity(quantity + 1, purchaseLimit);
    setTypingValue(null);
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty string while user is actively typing
    if (raw === '') {
      setTypingValue('');
      return;
    }
    // Only accept numeric characters
    if (/^\d*$/.test(raw)) {
      setTypingValue(raw);
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        const clamped = validateAndClampQuantity(parsed, purchaseLimit);
        onChange(clamped);
      }
    }
  };

  const handleBlur = () => {
    // On blur, enforce minimum 1 and clamp
    const normalized = validateAndClampQuantity(
      typingValue !== null ? typingValue : quantity,
      purchaseLimit,
    );
    setTypingValue(null);
    onChange(normalized);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span id="quantity-label" className="text-xs sm:text-sm font-medium text-foreground">
        Số lượng
      </span>
      <div
        role="group"
        aria-labelledby="quantity-label"
        className="inline-flex h-10 w-fit items-center rounded-xl border border-[#ede5db] dark:border-border/80 bg-background shadow-2xs overflow-hidden"
      >
        <button
          type="button"
          onClick={handleDecrease}
          disabled={!canDecrease}
          aria-label="Giảm số lượng 1 sản phẩm"
          className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-label="Số lượng sản phẩm muốn mua"
          className="h-full w-12 text-center text-sm font-semibold text-foreground focus:outline-none bg-transparent"
        />

        <button
          type="button"
          onClick={handleIncrease}
          disabled={!canIncrease}
          aria-label="Tăng số lượng 1 sản phẩm"
          className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {purchaseLimit !== undefined && purchaseLimit > 0 && (
        <span className="text-xs text-muted-foreground">
          Giới hạn tối đa {purchaseLimit} sản phẩm/đơn hàng.
        </span>
      )}
    </div>
  );
}
