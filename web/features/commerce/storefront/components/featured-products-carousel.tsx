'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import type { StorefrontProduct } from '@/features/commerce/products/types/product';
import { ProductCard } from '@/features/commerce/products/components/product-card';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  filterProductsByCategory,
  computeScrollBoundaries,
  calculateScrollStep,
} from './home-featured-products.logic';

export interface FeaturedProductsCarouselProps {
  products: readonly StorefrontProduct[];
  className?: string;
}

export function FeaturedProductsCarousel({
  products,
  className,
}: FeaturedProductsCarouselProps) {
  const categories = new Map(
    products.map(({ category }) => [category.slug, category]),
  );
  const tabs = [
    { id: 'all', label: 'Tất cả' },
    ...Array.from(categories.values(), ({ slug, name }) => ({
      id: slug,
      label: name,
    })),
  ];
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const [boundaries, setBoundaries] = React.useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const filteredProducts = React.useMemo(
    () => filterProductsByCategory(products, selectedCategory),
    [products, selectedCategory],
  );

  // Cập nhật ranh giới cuộn (Scroll Boundaries)
  const updateBoundaries = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, clientWidth, scrollWidth } = container;
    setBoundaries(
      computeScrollBoundaries(scrollLeft, clientWidth, scrollWidth),
    );
  }, []);

  // Lắng nghe sự kiện scroll và resize để cập nhật ranh giới cuộn chính xác
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateBoundaries();

    const handleScroll = () => {
      updateBoundaries();
    };

    const handleResize = () => {
      updateBoundaries();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [updateBoundaries, filteredProducts]);

  // Khi chuyển đổi danh mục, đặt lại vị trí cuộn về đầu (scrollLeft = 0)
  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollLeft = 0;
    }
  };

  // Cuộn sang trái hoặc sang phải với hỗ trợ reduced-motion
  const handleScroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const step = calculateScrollStep(container.clientWidth);
    const delta = direction === 'left' ? -step : step;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    container.scrollBy({
      left: delta,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Thanh điều khiển: Bộ lọc danh mục và Nút điều hướng Carousel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Nhóm nút lọc danh mục (Button Group with aria-pressed) */}
        <div
          role="group"
          aria-label="Lọc sản phẩm nổi bật theo danh mục"
          className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none"
        >
          {tabs.map((tab) => {
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                id={`featured-filter-${tab.id}`}
                aria-pressed={isSelected}
                onClick={() => handleSelectCategory(tab.id)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                  isSelected
                    ? 'bg-[#2d241e] dark:bg-primary text-[#faf6f0] dark:text-primary-foreground shadow-2xs font-semibold'
                    : 'bg-[#faf6f0] dark:bg-muted/60 text-[#5c5249] dark:text-muted-foreground hover:bg-[#f3ebe0] dark:hover:bg-muted border border-[#ede5db] dark:border-border',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Nút điều hướng Carousel (Trước / Sau) */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            disabled={!boundaries.canScrollLeft}
            aria-disabled={!boundaries.canScrollLeft}
            aria-label="Cuộn xem sản phẩm trước"
            aria-controls="featured-products-carousel"
            className={cn(
              'flex size-9 items-center justify-center rounded-full border border-[#ede5db] dark:border-border bg-card text-foreground transition-all focus-visible:outline-2 focus-visible:outline-primary',
              boundaries.canScrollLeft
                ? 'hover:bg-[#f3ebe0] dark:hover:bg-muted cursor-pointer shadow-2xs active:scale-95'
                : 'opacity-35 cursor-not-allowed select-none',
            )}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            disabled={!boundaries.canScrollRight}
            aria-disabled={!boundaries.canScrollRight}
            aria-label="Cuộn xem sản phẩm tiếp theo"
            aria-controls="featured-products-carousel"
            className={cn(
              'flex size-9 items-center justify-center rounded-full border border-[#ede5db] dark:border-border bg-card text-foreground transition-all focus-visible:outline-2 focus-visible:outline-primary',
              boundaries.canScrollRight
                ? 'hover:bg-[#f3ebe0] dark:hover:bg-muted cursor-pointer shadow-2xs active:scale-95'
                : 'opacity-35 cursor-not-allowed select-none',
            )}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Vùng hiển thị danh sách sản phẩm hoặc trạng thái rỗng */}
      {filteredProducts.length === 0 ? (
        <div
          id="featured-products-carousel"
          aria-live="polite"
          className="rounded-2xl border border-dashed border-[#ede5db] dark:border-border bg-[#fdfbf7] dark:bg-card/40 py-12 px-4 text-center"
        >
          <Package
            className="mx-auto size-12 stroke-1 text-muted-foreground/40"
            aria-hidden="true"
          />
          <h3 className="mt-3 text-sm sm:text-base font-semibold text-foreground">
            Chưa có sản phẩm trong danh mục này
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
            Các sản phẩm thuộc nhóm này đang được chuẩn bị. Quý khách vui lòng chọn
            danh mục khác hoặc xem tất cả.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSelectCategory('all')}
            className="mt-4 rounded-lg border-[#ede5db] dark:border-border text-xs sm:text-sm"
          >
            Xem tất cả sản phẩm
          </Button>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          id="featured-products-carousel"
          aria-label="Danh sách sản phẩm nổi bật"
          className="flex gap-5 sm:gap-6 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="flex-none snap-start w-[82vw] max-w-[320px] min-w-[260px] sm:w-[calc(50%-12px)] sm:max-w-none lg:w-[calc(25%-18px)]"
            >
              <ProductCard
                product={product}
                isDetailImplemented={true}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
