'use client';

import * as React from 'react';
import Link from 'next/link';
import { SlidersHorizontal, Check } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { StorefrontCategory } from '../../categories/types/category';
import { StoreLoadError } from '../../storefront/components/store-load-error';
import {
  type ProductsQueryCriteria,
  buildProductsHref,
} from './products-page.logic';
import { ProductsPriceFilter } from './products-price-filter';

export interface ProductsMobileFilterProps {
  categories: readonly StorefrontCategory[];
  categoriesError?: boolean;
  criteria: ProductsQueryCriteria;
  selectedCategoryName?: string;
}

export function ProductsMobileFilter({
  categories,
  categoriesError,
  criteria,
  selectedCategoryName,
}: ProductsMobileFilterProps) {
  const [open, setOpen] = React.useState(false);
  const selectedCategory = criteria.category;
  const hasActivePrice =
    criteria.minPrice !== undefined || criteria.maxPrice !== undefined;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm font-medium shadow-2xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
          aria-label="Mở bộ lọc sản phẩm"
        >
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Bộ lọc{selectedCategory ? `: ${selectedCategoryName}` : ''}
            {hasActivePrice ? ' · Giá' : ''}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        theme="storefront"
        className="w-[85vw] max-w-sm p-6 flex flex-col justify-between overflow-y-auto"
      >
        <div className="space-y-6">
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif text-xl font-bold text-foreground">
              Bộ lọc sản phẩm
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Chọn danh mục hoặc khoảng giá để lọc sản phẩm
            </SheetDescription>
          </SheetHeader>

          {/* Danh mục sản phẩm */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Danh mục
            </h3>
            {categoriesError && (
              <StoreLoadError>Không tải được danh mục.</StoreLoadError>
            )}
            <nav
              aria-label="Bộ lọc danh mục trên di động"
              className="flex flex-col gap-1.5"
            >
              {/* Tùy chọn xem tất cả sản phẩm */}
              <Link
                href={buildProductsHref(
                  { ...criteria, page: 1 },
                  { category: undefined },
                )}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  !selectedCategory
                    ? 'bg-store-category-selected text-store-category-selected-foreground font-semibold shadow-2xs'
                    : 'text-foreground hover:bg-[#faf4ea] dark:hover:bg-muted',
                )}
              >
                <span>Tất cả sản phẩm</span>
                {!selectedCategory && (
                  <Check
                    className="size-4 shrink-0 text-amber-400"
                    aria-hidden="true"
                  />
                )}
              </Link>

              {/* Các danh mục cụ thể */}
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.slug;
                return (
                  <Link
                    key={`mobile-filter-${cat.slug}`}
                    href={buildProductsHref(
                      { ...criteria, page: 1 },
                      { category: cat.slug },
                    )}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                      isSelected
                        ? 'bg-store-category-selected text-store-category-selected-foreground font-semibold shadow-2xs'
                        : 'text-foreground hover:bg-[#faf4ea] dark:hover:bg-muted',
                    )}
                  >
                    <span className="min-w-0 break-words">{cat.name}</span>
                    {isSelected && (
                      <Check
                        className="size-4 shrink-0 text-amber-400"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bộ lọc khoảng giá trên di động */}
          <div className="border-t border-border pt-5">
            <ProductsPriceFilter
              idPrefix="mobile-price"
              appliedMinPrice={criteria.minPrice}
              appliedMaxPrice={criteria.maxPrice}
              onApplied={() => setOpen(false)}
            />
          </div>
        </div>

        <div className="pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Trang trại Mộc Ong · Vật tư & thiết bị nuôi ong
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
