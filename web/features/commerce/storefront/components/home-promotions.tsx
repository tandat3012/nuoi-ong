import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Sprout, Wrench } from 'lucide-react';
import { STOREFRONT_CONFIG } from '../config/storefront-config';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export function HomePromotions({ className }: { className?: string } = {}) {
  const { promotions } = STOREFRONT_CONFIG;

  return (
    <section
      aria-labelledby="promotions-heading"
      className={cn('py-12 sm:py-16 bg-background text-foreground', className)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="promotions-heading" className="sr-only">
          {promotions.srHeading}
        </h2>

        {/* Lưới 2 banner khuyến mãi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {promotions.items.map((item) => {
            const isSupplies = item.visual.subject === 'supplies';

            return (
              <article
                key={item.id}
                className={cn(
                  'group relative overflow-hidden rounded-3xl border border-border p-6 sm:p-8 lg:p-10 flex flex-col justify-between shadow-2xs transition-all duration-300 hover:shadow-xs',
                  isSupplies
                    ? 'bg-gradient-to-br from-card via-store-promo-supplies to-muted/70'
                    : 'bg-gradient-to-br from-card via-store-promo-equipment to-muted/70',
                )}
              >
                {/* Vùng nội dung chữ & hành động */}
                <div className="relative z-10 flex flex-col items-start max-w-lg">
                  {/* Dòng nhãn định vị (Eyebrow) */}
                  <span className="text-[0.6875rem] sm:text-xs font-bold uppercase tracking-widest text-primary">
                    {item.eyebrow}
                  </span>

                  {/* Tiêu đề biểu đạt lợi ích */}
                  <h3 className="mt-2.5 font-serif text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground leading-snug">
                    {item.heading}
                  </h3>

                  {/* Mô tả ưu đãi */}
                  <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>

                  {/* Nút hành động (CTA) */}
                  <div className="mt-6 sm:mt-8">
                    {item.action.isImplemented ? (
                      <Link
                        href={item.action.href}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-200 shadow-2xs hover:shadow-xs active:scale-95 focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span>{item.action.label}</span>
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        disabled
                        aria-disabled="true"
                        aria-label={`${item.action.label} (chức năng đang chuẩn bị)`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground/80 px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium cursor-not-allowed select-none opacity-85 shadow-none"
                      >
                        <span>{item.action.label}</span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Vùng đồ họa trang trí minh họa (Fallback trung thực chuẩn nhận diện thương hiệu) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none mt-6 sm:mt-0 sm:absolute sm:right-6 sm:bottom-6 lg:right-8 lg:bottom-8 flex flex-col items-end justify-end"
                >
                  <div className="flex size-20 sm:size-24 lg:size-28 items-center justify-center rounded-2xl bg-card/85 backdrop-blur-xs border border-border/80 text-primary/80 shadow-xs transition-transform duration-300 group-hover:scale-105">
                    {isSupplies ? (
                      <Sprout className="size-10 sm:size-12 lg:size-14 stroke-1" />
                    ) : (
                      <Wrench className="size-10 sm:size-12 lg:size-14 stroke-1" />
                    )}
                  </div>
                  {item.visual.badge && (
                    <span className="mt-2 inline-block rounded-md bg-store-badge text-store-badge-foreground px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide shadow-2xs">
                      {item.visual.badge}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Thông báo minh họa bản xem trước */}
        <p className="mt-6 text-center text-xs text-muted-foreground/70 select-none">
          * Nội dung ưu đãi mang tính chất minh họa cho bản xem trước.
        </p>
      </div>
    </section>
  );
}
