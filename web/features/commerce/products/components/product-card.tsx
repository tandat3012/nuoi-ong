import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, ShoppingBag, Package } from 'lucide-react';
import type { StorefrontProduct } from '../types/product';
import { formatVndCurrency } from '@/shared/lib/currency';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface ProductCardProps {
  product: StorefrontProduct;
  onAddToCart?: (product: StorefrontProduct) => void;
  className?: string;
  isDetailImplemented?: boolean;
  isCartImplemented?: boolean;
}

export function ProductCard({
  product,
  onAddToCart,
  className,
  isDetailImplemented = false,
  isCartImplemented = false,
}: ProductCardProps) {
  const formattedPrice = formatVndCurrency(product.price);
  const hasDiscount =
    typeof product.originalPrice === 'number' && product.originalPrice > product.price;
  const formattedOriginalPrice = hasDiscount ? formatVndCurrency(product.originalPrice) : null;

  return (
    <article
      className={cn(
        'group flex flex-col justify-between rounded-2xl border border-[#ede6dc] dark:border-border/80 bg-white dark:bg-card text-foreground shadow-2xs overflow-hidden transition-all hover:shadow-xs',
        className,
      )}
    >
      <div>
        {/* Khung ảnh tràn viền hai bên (edge-to-edge), bo góc chỉ ở phía trên card */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#fbf9f5] dark:bg-stone-900/50">
          {/* Huy hiệu ưu đãi (Promotional badge) */}
          {product.badge && (
            <div className="absolute left-3 top-3 z-10 rounded-md bg-[#ebb02d] text-[#451a03] px-2 py-0.5 text-[0.6875rem] font-bold shadow-2xs uppercase tracking-wide">
              {product.badge}
            </div>
          )}

          {product.image?.src ? (
            <Image
              src={product.image.src}
              alt={product.image.alt || product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            /* Fallback ảnh trang nhã tràn viền */
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/35">
              <Package className="size-14 sm:size-16 stroke-1" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Khối thông tin chi tiết với padding nội bộ gọn gàng */}
        <div className="px-4 pt-3.5 pb-2 flex flex-col text-left">
          {/* Tên phân loại / danh mục */}
          <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[#8c827a] dark:text-muted-foreground">
            {product.category.name}
          </span>

          {/* Tên sản phẩm — Cố định chiều cao min-h & line-clamp-2 */}
          {isDetailImplemented ? (
            <Link
              href={`/products/${product.slug}`}
              className="mt-1 line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem] text-sm sm:text-base font-semibold leading-snug text-[#2d241e] dark:text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {product.name}
            </Link>
          ) : (
            <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem] text-sm sm:text-base font-semibold leading-snug text-[#2d241e] dark:text-foreground">
              {product.name}
            </h3>
          )}

          {/* Đánh giá 5 sao và số lượt nhận xét */}
          <div className="mt-1.5 flex h-5 items-center">
            {product.rating ? (
              <div
                className="flex items-center gap-1.5 text-xs"
                aria-label={`Đánh giá ${product.rating.score} trên 5 sao từ ${product.rating.reviewCount} lượt đánh giá`}
              >
                <div className="flex items-center gap-0.5 text-amber-500" aria-hidden="true">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'size-3.5',
                        i < Math.floor(product.rating!.score)
                          ? 'fill-amber-500 text-amber-500'
                          : 'fill-amber-200 text-amber-200',
                      )}
                    />
                  ))}
                </div>
                <span className="font-semibold text-[#2d241e] dark:text-foreground text-xs ml-0.5">
                  {product.rating.score.toFixed(1)}
                </span>
                <span className="text-[0.6875rem] text-muted-foreground">
                  ({product.rating.reviewCount})
                </span>
              </div>
            ) : (
              <span className="text-[0.6875rem] text-muted-foreground/60 select-none">
                Chưa có đánh giá
              </span>
            )}
          </div>

          {/* Hàng giá bán */}
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-bold text-[#2d241e] dark:text-foreground">
              {formattedPrice}
            </span>
            {formattedOriginalPrice && (
              <span className="text-xs text-muted-foreground/70 line-through">
                {formattedOriginalPrice}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nút thêm vào giỏ hàng hình chữ nhật màu kem nhạt */}
      <div className="px-4 pb-4 pt-1">
        {isCartImplemented ? (
          <Button
            type="button"
            onClick={() => onAddToCart?.(product)}
            size="sm"
            className="w-full h-9 rounded-lg border border-[#e5dcd1] dark:border-border bg-[#faf5ee] hover:bg-[#f3ebe0] dark:bg-muted/50 dark:hover:bg-muted text-[#453c35] dark:text-foreground font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <ShoppingBag className="size-4 text-[#786f66]" aria-hidden="true" />
            <span>Thêm vào giỏ</span>
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            aria-disabled="true"
            size="sm"
            title="Tính năng giỏ hàng đang được chuẩn bị"
            className="w-full h-9 rounded-lg border border-[#e5dcd1] dark:border-border bg-[#faf5ee] dark:bg-muted/50 text-[#453c35] dark:text-foreground font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90 select-none hover:bg-[#faf5ee] shadow-2xs"
          >
            <ShoppingBag className="size-4 text-[#786f66]" aria-hidden="true" />
            <span>Thêm vào giỏ</span>
          </Button>
        )}
      </div>
    </article>
  );
}
