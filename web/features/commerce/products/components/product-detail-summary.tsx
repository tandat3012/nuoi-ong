'use client';

import * as React from 'react';
import { Star, Truck, ShieldCheck, RotateCcw } from 'lucide-react';
import type { StorefrontProductDetail, StorefrontProductVariant } from '../types/product';
import {
  computeDetailDiscount,
  resolveActiveProductSnapshot,
} from './product-detail.logic';
import { getProductCardRating } from './product-card.logic';
import { ProductQuantitySelector } from './product-quantity-selector';
import { ProductPurchaseActions } from './product-purchase-actions';
import { formatVndCurrency } from '@/shared/lib/currency';
import { cn } from '@/shared/lib/utils';
import { useCart } from '@/features/commerce/cart/hooks/use-cart';

export interface ProductDetailSummaryProps {
  product: StorefrontProductDetail;
  onVariantChange?: (variant?: StorefrontProductVariant) => void;
  className?: string;
}

export function ProductDetailSummary({
  product,
  onVariantChange,
  className,
}: ProductDetailSummaryProps) {
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 1;
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | undefined>(
    hasVariants && product.variants ? product.variants[0].id : undefined,
  );
  const [quantity, setQuantity] = React.useState<number>(1);

  const selectedVariant = React.useMemo(() => {
    if (!hasVariants || !product.variants) return undefined;
    return product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  }, [hasVariants, product.variants, selectedVariantId]);

  const snapshot = React.useMemo(() => {
    return resolveActiveProductSnapshot(product, selectedVariant);
  }, [product, selectedVariant]);

  const discount = React.useMemo(() => {
    return computeDetailDiscount(snapshot.price, snapshot.originalPrice);
  }, [snapshot.price, snapshot.originalPrice]);

  const ratingInfo = React.useMemo(() => {
    return getProductCardRating(product.rating);
  }, [product.rating]);

  const { addItem } = useCart();

  const handleSelectVariant = (variant: StorefrontProductVariant) => {
    setSelectedVariantId(variant.id);
    onVariantChange?.(variant);
  };

  const handleAddToCart = React.useCallback(() => {
    if (!snapshot.inStock) return;

    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      unitPrice: snapshot.price,
      originalPrice: snapshot.originalPrice,
      image: snapshot.image,
      quantity,
      purchaseLimit: product.purchaseLimit,
      inStock: snapshot.inStock,
    });
  }, [addItem, product, selectedVariant, snapshot, quantity]);

  return (
    <div className={cn('flex flex-col gap-5 text-left', className)}>
      {/* 1. Optional verified badge */}
      {product.badge && (
        <span className="inline-block w-fit rounded-md bg-[#ebb02d] text-[#451a03] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide shadow-2xs">
          {product.badge}
        </span>
      )}

      {/* 2. Product name as the page's single H1 */}
      <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#2d241e] dark:text-foreground leading-snug">
        {product.name}
      </h1>

      {/* 3. Optional SKU and brand */}
      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
        {snapshot.sku && (
          <>
            <span>SKU: {snapshot.sku}</span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>Thương hiệu: {product.brand || 'Mộc Ong'}</span>
      </div>

      {/* 4. Rating summary only when data exists */}
      {ratingInfo && (
        <div
          className="flex items-center gap-2 text-xs sm:text-sm"
          aria-label={ratingInfo.ariaLabel}
        >
          <div className="flex items-center gap-0.5" aria-hidden="true">
            {ratingInfo.fillPercentages.map((percentage, i) => (
              <div key={i} className="relative inline-block size-4">
                <Star className="size-4 fill-store-rating-empty-fill text-store-rating-empty-stroke" />
                {percentage > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 overflow-hidden"
                    style={{ width: `${percentage}%` }}
                  >
                    <Star className="size-4 fill-store-rating-fill text-store-rating-stroke" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <span className="font-semibold text-foreground">
            {ratingInfo.score.toFixed(1)}
          </span>
          <span className="text-muted-foreground">
            ({ratingInfo.reviewCount} đánh giá)
          </span>
        </div>
      )}

      {/* 5. Current price, valid previous price, and calculated savings */}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-2xl sm:text-3xl font-bold text-[#2d241e] dark:text-foreground">
          {formatVndCurrency(snapshot.price)}
        </span>

        {discount.hasDiscount && snapshot.originalPrice && (
          <>
            <span className="text-sm sm:text-base text-muted-foreground line-through">
              {formatVndCurrency(snapshot.originalPrice)}
            </span>
            <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
              Tiết kiệm {formatVndCurrency(discount.savings)}
            </span>
          </>
        )}
      </div>

      {/* 6. Availability */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-block size-2 rounded-full',
            snapshot.inStock ? 'bg-emerald-500' : 'bg-muted-foreground/60',
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            'text-xs sm:text-sm font-medium',
            snapshot.inStock
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-muted-foreground',
          )}
        >
          {snapshot.inStock ? 'Còn hàng' : 'Hết hàng'}
        </span>
      </div>

      {/* 7. Product-specific short description */}
      {product.description && (
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          {product.description}
        </p>
      )}

      {/* 8. Variants, if supported by data */}
      {hasVariants && product.variants && (
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-xs sm:text-sm font-medium text-foreground">
            Quy cách
          </span>
          <div
            role="radiogroup"
            aria-label="Chọn quy cách sản phẩm"
            className="flex flex-wrap gap-2.5"
          >
            {product.variants.map((v) => {
              const isSelected = v.id === selectedVariantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectVariant(v)}
                  className={cn(
                    'rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-primary',
                    isSelected
                      ? 'bg-[#ebb02d] text-[#451a03] font-semibold shadow-xs'
                      : 'border border-[#ede5db] dark:border-border/80 bg-background text-foreground hover:bg-muted/50',
                  )}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. Quantity control */}
      <div className="pt-1">
        <ProductQuantitySelector
          quantity={quantity}
          onChange={setQuantity}
          purchaseLimit={product.purchaseLimit}
          disabled={!snapshot.inStock}
        />
      </div>

      {/* 10. Purchase controls */}
      <ProductPurchaseActions
        inStock={snapshot.inStock}
        onAddToCart={handleAddToCart}
      />

      {/* 11. Concise service information */}
      <div className="mt-4 pt-6 border-t border-[#ede6dc] dark:border-border/80 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-primary shrink-0" aria-hidden="true" />
          <span>Giao hàng toàn quốc</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary shrink-0" aria-hidden="true" />
          <span>Chính hãng</span>
        </div>
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-primary shrink-0" aria-hidden="true" />
          <span>Đổi trả 7 ngày</span>
        </div>
      </div>
    </div>
  );
}
