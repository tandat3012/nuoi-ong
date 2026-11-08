import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';
import type { StorefrontCategory } from '../../categories/types/category';
import { StoreLoadError } from '../../storefront/components/store-load-error';
import {
  type ProductsQueryCriteria,
  buildProductsHref,
} from './products-page.logic';
import { ProductsPriceFilter } from './products-price-filter';

export interface ProductsSidebarProps {
  categories: readonly StorefrontCategory[];
  categoriesError?: boolean;
  criteria: ProductsQueryCriteria;
  className?: string;
}

export function ProductsSidebar({
  categories,
  categoriesError,
  criteria,
  className,
}: ProductsSidebarProps) {
  const selectedCategory = criteria.category;
  const totalCatalogCount = categories.every(
    (cat) => typeof cat.productCount === 'number',
  )
    ? categories.reduce((sum, cat) => sum + (cat.productCount ?? 0), 0)
    : undefined;

  return (
    <aside
      aria-label="Bộ lọc sản phẩm"
      className={cn('w-64 shrink-0 hidden lg:block', className)}
    >
      <div className="sticky top-28 rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-5">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Danh mục sản phẩm
          </h2>

          {categoriesError && (
            <StoreLoadError>Không tải được danh mục.</StoreLoadError>
          )}

          <nav aria-label="Bộ lọc danh mục trên máy tính">
            <ul className="space-y-1">
              {/* Tùy chọn tất cả sản phẩm */}
              <li>
                <Link
                  href={buildProductsHref(
                    { ...criteria, page: 1 },
                    { category: undefined },
                  )}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                    !selectedCategory
                      ? 'bg-store-category-selected text-store-category-selected-foreground font-semibold shadow-2xs'
                      : 'text-[#5c5249] dark:text-muted-foreground hover:bg-[#faf4ea] dark:hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span>Tất cả sản phẩm</span>
                  {totalCatalogCount !== undefined && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums',
                        !selectedCategory
                          ? 'bg-background/20 text-store-category-selected-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {totalCatalogCount}
                    </span>
                  )}
                </Link>
              </li>

              {/* Từng danh mục sản phẩm */}
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.slug;
                return (
                  <li key={`desktop-filter-${cat.slug}`}>
                    <Link
                      href={buildProductsHref(
                        { ...criteria, page: 1 },
                        { category: cat.slug },
                      )}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                        isSelected
                          ? 'bg-store-category-selected text-store-category-selected-foreground font-semibold shadow-2xs'
                          : 'text-[#5c5249] dark:text-muted-foreground hover:bg-[#faf4ea] dark:hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span className="truncate">{cat.name}</span>
                      {typeof cat.productCount === 'number' && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums',
                            isSelected
                              ? 'bg-background/20 text-store-category-selected-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {cat.productCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Bộ lọc khoảng giá desktop */}
        <div className="border-t border-border pt-5">
          <ProductsPriceFilter
            idPrefix="desktop-price"
            appliedMinPrice={criteria.minPrice}
            appliedMaxPrice={criteria.maxPrice}
          />
        </div>
      </div>
    </aside>
  );
}
