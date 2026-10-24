import * as React from 'react';
import { getProductsStore } from '../api/product.api';
import { ProductCard } from './product-card';
import { filterRelatedProducts } from './product-detail.logic';
import { cn } from '@/shared/lib/utils';

export interface ProductRelatedProductsProps {
  categorySlug: string;
  currentProductId: string;
  currentProductSlug: string;
  className?: string;
}

export async function ProductRelatedProducts({
  categorySlug,
  currentProductId,
  currentProductSlug,
  className,
}: ProductRelatedProductsProps) {
  if (!categorySlug) return null;

  let relatedItems: ReturnType<typeof filterRelatedProducts> = [];

  try {
    // Only fetch a small bounded set from the same category
    const result = await getProductsStore({
      category: categorySlug,
      pageSize: 5,
    });

    relatedItems = filterRelatedProducts(
      currentProductId,
      currentProductSlug,
      result.data,
      4,
    );
  } catch {
    // Graceful degradation: omit related products if API fails
    return null;
  }

  // If no suitable related products exist, omit the section
  if (relatedItems.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="related-products-heading"
      className={cn('pt-12 sm:pt-16 border-t border-[#ede6dc] dark:border-border/80', className)}
    >
      <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h2
            id="related-products-heading"
            className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#2d241e] dark:text-foreground"
          >
            Có thể bạn cũng cần
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Sản phẩm cùng danh mục được nhiều người nuôi ong quan tâm
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
        {relatedItems.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isDetailImplemented={true}
          />
        ))}
      </div>
    </section>
  );
}
