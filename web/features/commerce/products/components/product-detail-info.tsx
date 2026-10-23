'use client';

import * as React from 'react';
import { Check, Star } from 'lucide-react';
import type { StorefrontProductDetail } from '../types/product';
import {
  getAvailableDetailTabs,
  type DetailTabKey,
} from './product-detail.logic';
import { cn } from '@/shared/lib/utils';

export interface ProductDetailInfoProps {
  product: StorefrontProductDetail;
  className?: string;
}

export function ProductDetailInfo({
  product,
  className,
}: ProductDetailInfoProps) {
  const tabs = React.useMemo(() => {
    return getAvailableDetailTabs(product);
  }, [product]);

  const [selectedTab, setSelectedTab] = React.useState<DetailTabKey>('description');

  const tabListRef = React.useRef<HTMLDivElement>(null);

  // Compute effective tab based on current available tabs
  const activeTab = tabs.some((t) => t.id === selectedTab)
    ? selectedTab
    : (tabs[0]?.id ?? 'description');

  // Keyboard navigation for accessible tabs (ARIA WAI-ARIA tab pattern)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) {
      setSelectedTab(nextTab.id);
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  // If no content or only description exists, render a straightforward section without redundant tabs
  if (tabs.length <= 1) {
    return (
      <section
        aria-labelledby="detail-info-heading"
        className={cn('pt-12 sm:pt-16 border-t border-[#ede6dc] dark:border-border/80', className)}
      >
        <h2
          id="detail-info-heading"
          className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#2d241e] dark:text-foreground"
        >
          Thông tin sản phẩm
        </h2>
        <div className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-4xl space-y-4">
          <p>{product.description}</p>
          <div className="pt-2 flex flex-col gap-2 text-sm text-[#453c35] dark:text-foreground/90">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
              <span>Đóng gói cẩn thận, kiểm tra trước khi giao.</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
              <span>Đội ngũ tư vấn đồng hành trong quá trình sử dụng.</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Chi tiết và thông số sản phẩm"
      className={cn('pt-12 sm:pt-16 border-t border-[#ede6dc] dark:border-border/80', className)}
    >
      {/* Tab bar */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Các mục thông tin sản phẩm"
        className="flex gap-4 sm:gap-8 border-b border-[#ede6dc] dark:border-border/80 overflow-x-auto pb-0"
      >
        {tabs.map((tab, index) => {
          const isSelected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelectedTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'relative pb-3 text-sm sm:text-base font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-primary',
                isSelected
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span>{tab.label}</span>
              {isSelected && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="mt-6">
        {/* Panel 1: Mô tả */}
        {activeTab === 'description' && (
          <div
            role="tabpanel"
            id="panel-description"
            aria-labelledby="tab-description"
            tabIndex={0}
            className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-4xl space-y-4 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <p>{product.description}</p>
            <div className="pt-2 flex flex-col gap-2 text-sm text-[#453c35] dark:text-foreground/90">
              <div className="flex items-center gap-2">
                <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
                <span>Đóng gói cẩn thận, kiểm tra trước khi giao.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="size-4 text-primary shrink-0" aria-hidden="true" />
                <span>Đội ngũ tư vấn đồng hành trong quá trình sử dụng.</span>
              </div>
            </div>
          </div>
        )}

        {/* Panel 2: Thông số kỹ thuật */}
        {activeTab === 'specifications' && product.specifications && (
          <div
            role="tabpanel"
            id="panel-specifications"
            aria-labelledby="tab-specifications"
            tabIndex={0}
            className="max-w-2xl overflow-hidden rounded-xl border border-[#ede6dc] dark:border-border/80 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Thông số kỹ thuật {product.name}</caption>
              <tbody className="divide-y divide-[#ede6dc] dark:divide-border/80">
                {product.specifications.map((spec, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? 'bg-[#fbf9f5]/60 dark:bg-muted/20' : 'bg-transparent'}
                  >
                    <th scope="row" className="px-4 py-3 font-medium text-foreground w-1/3">
                      {spec.name}
                    </th>
                    <td className="px-4 py-3 text-muted-foreground">
                      {spec.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Panel 3: Hướng dẫn sử dụng */}
        {activeTab === 'usage' && product.usageGuidance && (
          <div
            role="tabpanel"
            id="panel-usage"
            aria-labelledby="tab-usage"
            tabIndex={0}
            className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-4xl focus-visible:outline-2 focus-visible:outline-primary"
          >
            <p>{product.usageGuidance}</p>
          </div>
        )}

        {/* Panel 4: Đánh giá */}
        {activeTab === 'reviews' && product.reviews && product.reviews.length > 0 && (
          <div
            role="tabpanel"
            id="panel-reviews"
            aria-labelledby="tab-reviews"
            tabIndex={0}
            className="space-y-4 max-w-3xl focus-visible:outline-2 focus-visible:outline-primary"
          >
            {product.reviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-[#ede6dc] dark:border-border/80 p-4 bg-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground text-sm">{rev.author}</span>
                  {rev.date && <span className="text-xs text-muted-foreground">{rev.date}</span>}
                </div>
                <div className="flex items-center gap-1 mt-1" aria-label={`${rev.rating} trên 5 sao`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'size-3.5',
                        i < rev.rating
                          ? 'fill-amber-400 text-amber-500'
                          : 'fill-muted text-muted-foreground/30',
                      )}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{rev.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
