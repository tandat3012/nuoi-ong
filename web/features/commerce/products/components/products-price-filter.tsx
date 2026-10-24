'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { validatePriceDraft } from './products-page.logic';

export interface ProductsPriceFilterProps {
  idPrefix: string;
  appliedMinPrice?: number;
  appliedMaxPrice?: number;
  onApplied?: () => void;
  className?: string;
}

function ProductsPriceFilterInner({
  idPrefix,
  appliedMinPrice,
  appliedMaxPrice,
  onApplied,
  className,
}: ProductsPriceFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const appliedMinStr =
    appliedMinPrice !== undefined ? String(appliedMinPrice) : '';
  const appliedMaxStr =
    appliedMaxPrice !== undefined ? String(appliedMaxPrice) : '';

  const [minInput, setMinInput] = React.useState(appliedMinStr);
  const [maxInput, setMaxInput] = React.useState(appliedMaxStr);
  const [error, setError] = React.useState<string | null>(null);

  const [prevMin, setPrevMin] = React.useState(appliedMinStr);
  const [prevMax, setPrevMax] = React.useState(appliedMaxStr);

  // Điều chỉnh draft khi URL / props thay đổi (khi bấm Back/Forward hoặc reset)
  if (prevMin !== appliedMinStr || prevMax !== appliedMaxStr) {
    setPrevMin(appliedMinStr);
    setPrevMax(appliedMaxStr);
    setMinInput(appliedMinStr);
    setMaxInput(appliedMaxStr);
    setError(null);
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validatePriceDraft(minInput, maxInput);

    if (!result.isValid) {
      setError(result.error ?? 'Khoảng giá không hợp lệ.');
      return;
    }

    setError(null);
    const nextParams = new URLSearchParams(searchParams?.toString() ?? '');
    // Reset về trang 1 khi lọc giá
    nextParams.delete('page');

    if (result.min !== undefined) {
      nextParams.set('minPrice', String(result.min));
    } else {
      nextParams.delete('minPrice');
    }

    if (result.max !== undefined) {
      nextParams.set('maxPrice', String(result.max));
    } else {
      nextParams.delete('maxPrice');
    }

    const qs = nextParams.toString();
    router.push(qs ? `/products?${qs}` : '/products');
    onApplied?.();
  };

  const handleClear = () => {
    setMinInput('');
    setMaxInput('');
    setError(null);

    const nextParams = new URLSearchParams(searchParams?.toString() ?? '');
    nextParams.delete('page');
    nextParams.delete('minPrice');
    nextParams.delete('maxPrice');

    const qs = nextParams.toString();
    router.push(qs ? `/products?${qs}` : '/products');
    onApplied?.();
  };

  const minId = `${idPrefix}-min-price`;
  const maxId = `${idPrefix}-max-price`;
  const hasActivePrice =
    appliedMinPrice !== undefined || appliedMaxPrice !== undefined;
  const hasDraftPrice = minInput.trim() !== '' || maxInput.trim() !== '';

  return (
    <form
      onSubmit={handleApply}
      className={cn('flex flex-col gap-3', className)}
      aria-label="Bộ lọc khoảng giá"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Khoảng giá (VNĐ)
        </h3>
        {(hasActivePrice || hasDraftPrice) && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[0.6875rem] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Xóa giá
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 items-center">
        <div>
          <label htmlFor={minId} className="sr-only">
            Giá tối thiểu (VNĐ)
          </label>
          <Input
            id={minId}
            name="minPrice"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Từ ₫"
            value={minInput}
            onChange={(e) => {
              setMinInput(e.target.value);
              if (error) setError(null);
            }}
            className="h-9 text-xs rounded-xl bg-background"
          />
        </div>

        <div>
          <label htmlFor={maxId} className="sr-only">
            Giá tối đa (VNĐ)
          </label>
          <Input
            id={maxId}
            name="maxPrice"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Đến ₫"
            value={maxInput}
            onChange={(e) => {
              setMaxInput(e.target.value);
              if (error) setError(null);
            }}
            className="h-9 text-xs rounded-xl bg-background"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="text-xs text-destructive font-medium leading-tight"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        className="w-full h-8.5 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
      >
        Áp dụng
      </Button>
    </form>
  );
}

export function ProductsPriceFilter(props: ProductsPriceFilterProps) {
  return (
    <React.Suspense fallback={null}>
      <ProductsPriceFilterInner {...props} />
    </React.Suspense>
  );
}
