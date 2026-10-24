'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getProductStore } from '../api/product.api';
import { resolveCartInput, resolveProductForCart } from '../../cart/components/cart.logic';
import Link from 'next/link';
import { Star, ShoppingBag, Package } from 'lucide-react';
import type { StorefrontProduct } from '../types/product';
import { formatVndCurrency } from '@/shared/lib/currency';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  computeDiscountState,
  getProductCardRating,
} from './product-card.logic';
import { useOptionalCart } from '@/features/commerce/cart/hooks/use-cart';

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
  isCartImplemented = true,
}: ProductCardProps) {
  const { hasDiscount } = computeDiscountState(
    product.price,
    product.originalPrice,
  );
  const formattedPrice = formatVndCurrency(product.price);
  const formattedOriginalPrice = hasDiscount
    ? formatVndCurrency(product.originalPrice)
    : null;
  const ratingInfo = getProductCardRating(product.rating);

  const cart = useOptionalCart();
  const router = useRouter();
  const [isAdding, setIsAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const adding = React.useRef(false);
  const hasMultipleVariants = Array.isArray(product.variants) && product.variants.length > 1;

  const handleAddToCart = async () => {
    if (!product.inStock || adding.current) return;
    adding.current = true;
    setIsAdding(true);
    setAddError(null);
    try {
      const resolved = await resolveProductForCart(product, getProductStore);
      if (!resolved || resolved.id !== product.id) {
        setAddError('Không còn tìm thấy sản phẩm. Vui lòng tải lại danh sách.');
        return;
      }
      if (resolved.variants && resolved.variants.length > 1) {
        router.push(`/products/${product.slug}`);
        return;
      }
      const input = resolveCartInput(resolved);
      if (!input) {
        setAddError('Chưa thể xác minh quy cách, giá hoặc tình trạng hàng. Vui lòng xem chi tiết.');
        return;
      }
      if (onAddToCart) onAddToCart(resolved);
      else if (!cart?.addItem(input)) setAddError('Chưa thể thêm sản phẩm vào giỏ hàng.');
    } catch {
      setAddError('Không tải được thông tin sản phẩm. Vui lòng thử lại.');
    } finally {
      adding.current = false;
      setIsAdding(false);
    }
  };

  return (
    <article
      className={cn(
        'group flex flex-col justify-between rounded-2xl border border-[#ede6dc] dark:border-border/80 bg-white dark:bg-card text-foreground shadow-2xs overflow-hidden transition-all duration-200 hover:shadow-xs hover:border-[#dbcbb8] dark:hover:border-primary/40',
        className,
      )}
    >
      <div>
        {/* Khung ảnh tràn viền hai bên (edge-to-edge), tỉ lệ 4:3 ổn định */}
        {isDetailImplemented ? (
          <Link
            href={`/products/${product.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className="block relative aspect-[4/3] w-full overflow-hidden bg-[#fbf9f5] dark:bg-stone-900/50"
          >
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
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/35">
                <Package className="size-14 sm:size-16 stroke-1" aria-hidden="true" />
              </div>
            )}
          </Link>
        ) : (
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#fbf9f5] dark:bg-stone-900/50">
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
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/35">
                <Package className="size-14 sm:size-16 stroke-1" aria-hidden="true" />
              </div>
            )}
          </div>
        )}

        {/* Khối thông tin chi tiết */}
        <div className="px-4 pt-3.5 pb-2 flex flex-col text-left">
          {/* Tên phân loại / danh mục */}
          <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-[#8c827a] dark:text-muted-foreground truncate">
            {product.category.name}
          </span>

          {/* Tên sản phẩm — Cố định chiều cao min-h & line-clamp-2 để thẻ luôn thẳng hàng */}
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

          {/* Đánh giá sao phân đoạn (fractional stars) và số nhận xét — Giữ h-5 để chống layout shift */}
          <div className="mt-1.5 flex h-5 items-center">
            {ratingInfo ? (
              <div
                className="flex items-center gap-1.5 text-xs"
                aria-label={ratingInfo.ariaLabel}
              >
                <div className="flex items-center gap-0.5" aria-hidden="true">
                  {ratingInfo.fillPercentages.map((percentage, i) => (
                    <div key={i} className="relative inline-block size-3.5">
                      {/* Ngôi sao nền màu nhạt */}
                      <Star className="size-3.5 fill-store-rating-empty-fill text-store-rating-empty-stroke" />
                      {/* Ngôi sao phủ màu vàng cắt theo tỷ lệ phần trăm thực tế */}
                      {percentage > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 overflow-hidden"
                          style={{ width: `${percentage}%` }}
                        >
                          <Star className="size-3.5 fill-store-rating-fill text-store-rating-stroke" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <span className="font-semibold text-[#2d241e] dark:text-foreground text-xs ml-0.5">
                  {ratingInfo.score.toFixed(1)}
                </span>
                <span className="text-[0.6875rem] text-muted-foreground">
                  ({ratingInfo.reviewCount})
                </span>
              </div>
            ) : null}
          </div>
          <p
            className={cn(
              'mt-1 text-xs font-medium',
              product.inStock
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-muted-foreground',
            )}
          >
            {product.inStock ? 'Còn hàng' : 'Hết hàng'}
          </p>

          {/* Hàng giá bán — min-h cố định chống layout shift khi không có giá cũ */}
          <div className="mt-2.5 flex items-baseline gap-2 min-h-[1.75rem]">
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

      {/* Nút thêm vào giỏ hàng hoặc chọn quy cách */}
      <div className="px-4 pb-4 pt-1">
        {hasMultipleVariants ? (
          <Link
            href={`/products/${product.slug}`}
            className="w-full h-9 rounded-lg border border-[#e5dcd1] dark:border-border bg-[#faf5ee] hover:bg-[#f3ebe0] dark:bg-muted/50 dark:hover:bg-muted text-[#453c35] dark:text-foreground font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>Chọn quy cách</span>
          </Link>
        ) : isCartImplemented ? (
          <Button
            type="button"
            disabled={!product.inStock || isAdding}
            aria-busy={isAdding}
            onClick={handleAddToCart}
            size="sm"
            aria-label={
              product.inStock
                ? `Thêm ${product.name} vào giỏ hàng`
                : `${product.name} tạm hết hàng`
            }
            className={cn(
              'w-full h-9 rounded-lg border border-[#e5dcd1] dark:border-border bg-[#faf5ee] hover:bg-[#f3ebe0] dark:bg-muted/50 dark:hover:bg-muted text-[#453c35] dark:text-foreground font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer',
              !product.inStock && 'opacity-60 cursor-not-allowed hover:bg-[#faf5ee]',
            )}
          >
            <ShoppingBag className="size-4 text-[#786f66]" aria-hidden="true" />
            <span>{isAdding ? 'Đang xác minh…' : product.inStock ? 'Thêm vào giỏ' : 'Hết hàng'}</span>
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            aria-disabled="true"
            aria-label={`Thêm ${product.name} vào giỏ hàng`}
            size="sm"
            className="w-full h-9 rounded-lg border border-[#e5dcd1] dark:border-border bg-[#faf5ee] dark:bg-muted/50 text-[#453c35] dark:text-foreground font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80 select-none hover:bg-[#faf5ee] shadow-2xs"
          >
            <ShoppingBag className="size-4 text-[#786f66]" aria-hidden="true" />
            <span>Thêm vào giỏ</span>
          </Button>
        )}
        {addError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {addError} <Link href={`/products/${product.slug}`} className="underline">Xem chi tiết</Link>
          </p>
        )}
      </div>
    </article>
  );
}
