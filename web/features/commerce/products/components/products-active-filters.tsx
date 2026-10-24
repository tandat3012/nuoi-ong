import * as React from 'react';
import Link from 'next/link';
import { X, RotateCcw } from 'lucide-react';
import {
  type ProductsQueryCriteria,
  buildProductsHref,
  formatAppliedPriceRange,
} from './products-page.logic';

export interface ProductsActiveFiltersProps {
  criteria: ProductsQueryCriteria;
  categoryName?: string;
  className?: string;
}

export function ProductsActiveFilters({
  criteria,
  categoryName,
  className,
}: ProductsActiveFiltersProps) {
  const { category, q, minPrice, maxPrice, sort } = criteria;
  const hasPrice = minPrice !== undefined || maxPrice !== undefined;
  const hasAnyFilter = Boolean(category || q || hasPrice || sort);

  if (!hasAnyFilter) {
    return null;
  }

  // URL khi xóa từng tiêu chí (đồng thời reset về trang 1)
  const removeCategoryHref = buildProductsHref(
    { ...criteria, page: 1 },
    { category: undefined },
  );
  const removeQHref = buildProductsHref(
    { ...criteria, page: 1 },
    { q: undefined },
  );
  const removePriceHref = buildProductsHref(
    { ...criteria, page: 1 },
    { minPrice: undefined, maxPrice: undefined },
  );
  const removeSortHref = buildProductsHref(
    { ...criteria, page: 1 },
    { sort: undefined },
  );

  return (
    <div
      aria-label="Các bộ lọc đang áp dụng"
      className={className ?? 'mb-6 flex flex-wrap items-center gap-2'}
    >
      <span className="text-xs font-medium text-muted-foreground">
        Đang lọc theo:
      </span>

      {/* Pill: Từ khóa tìm kiếm */}
      {q && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground shadow-2xs">
          <span>
            Tìm kiếm: <strong className="font-semibold">&ldquo;{q}&rdquo;</strong>
          </span>
          <Link
            href={removeQHref}
            aria-label="Xóa từ khóa tìm kiếm"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-3" aria-hidden="true" />
          </Link>
        </span>
      )}

      {/* Pill: Danh mục */}
      {category && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground shadow-2xs">
          <span>
            Danh mục: <strong className="font-semibold">{categoryName || category}</strong>
          </span>
          <Link
            href={removeCategoryHref}
            aria-label={`Xóa bộ lọc danh mục ${categoryName || category}`}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-3" aria-hidden="true" />
          </Link>
        </span>
      )}

      {/* Pill: Khoảng giá */}
      {hasPrice && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground shadow-2xs">
          <span>
            Giá:{' '}
            <strong className="font-semibold">
              {formatAppliedPriceRange(minPrice, maxPrice)}
            </strong>
          </span>
          <Link
            href={removePriceHref}
            aria-label="Xóa bộ lọc khoảng giá"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-3" aria-hidden="true" />
          </Link>
        </span>
      )}

      {/* Pill: Sắp xếp */}
      {sort && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground shadow-2xs">
          <span>
            Sắp xếp:{' '}
            <strong className="font-semibold">
              {sort === 'price_asc' ? 'Giá thấp đến cao' : 'Giá cao đến thấp'}
            </strong>
          </span>
          <Link
            href={removeSortHref}
            aria-label="Xóa tùy chọn sắp xếp"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-3" aria-hidden="true" />
          </Link>
        </span>
      )}

      {/* Nút xóa tất cả bộ lọc */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline ml-1"
      >
        <RotateCcw className="size-3" aria-hidden="true" />
        <span>Xóa bộ lọc</span>
      </Link>
    </div>
  );
}
