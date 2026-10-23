'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';
import type { ProductSortOption } from './products-page.logic';

export interface ProductsSortSelectProps {
  currentSort?: ProductSortOption;
  className?: string;
}

function ProductsSortSelectInner({
  currentSort,
  className,
}: ProductsSortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const nextParams = new URLSearchParams(searchParams?.toString() ?? '');

    // Reset về trang 1 khi đổi sắp xếp
    nextParams.delete('page');

    if (val === 'price_asc' || val === 'price_desc') {
      nextParams.set('sort', val);
    } else {
      nextParams.delete('sort');
    }

    const qs = nextParams.toString();
    router.push(qs ? `/products?${qs}` : '/products');
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label
        htmlFor="products-sort-select"
        className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap"
      >
        Sắp xếp:
      </label>
      <div className="w-38 sm:w-44">
        <Select
          id="products-sort-select"
          value={currentSort ?? ''}
          onChange={handleChange}
          className="h-8.5 text-xs sm:text-sm rounded-xl bg-card"
        >
          <option value="">Mặc định</option>
          <option value="price_asc">Giá: thấp đến cao</option>
          <option value="price_desc">Giá: cao đến thấp</option>
        </Select>
      </div>
    </div>
  );
}

export function ProductsSortSelect(props: ProductsSortSelectProps) {
  return (
    <React.Suspense fallback={null}>
      <ProductsSortSelectInner {...props} />
    </React.Suspense>
  );
}
