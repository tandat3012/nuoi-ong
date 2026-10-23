import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { STOREFRONT_CONFIG } from '../config/storefront-config';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export function HomeNewsletter({ className }: { className?: string } = {}) {
  const { newsletter } = STOREFRONT_CONFIG;

  return (
    <section
      aria-labelledby="newsletter-heading"
      className={cn(
        'w-full bg-store-newsletter py-10 sm:py-14 text-store-newsletter-foreground transition-colors',
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-12">
          {/* Thông tin thông điệp bản tin */}
          <div className="text-left max-w-xl">
            <h2
              id="newsletter-heading"
              className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-store-newsletter-foreground leading-snug"
            >
              {newsletter.heading}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-store-newsletter-subtext leading-relaxed">
              {newsletter.description}
            </p>
          </div>

          {/* Biểu mẫu đăng ký email (Trạng thái vô hiệu hóa có thông báo rõ ràng) */}
          <div className="w-full max-w-md lg:max-w-lg">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center rounded-2xl bg-white dark:bg-card p-1.5 shadow-2xs border border-amber-300/60 dark:border-border">
              <label htmlFor="newsletter-email" className="sr-only">
                {newsletter.emailPlaceholder}
              </label>
              <input
                id="newsletter-email"
                type="email"
                disabled
                aria-disabled="true"
                placeholder={newsletter.emailPlaceholder}
                className="w-full min-w-0 px-4 py-2.5 text-xs sm:text-sm bg-transparent text-[#2d241e] dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-muted-foreground focus:outline-none cursor-not-allowed select-none"
              />
              <Button
                type="button"
                disabled
                aria-disabled="true"
                size="sm"
                className="mt-2 sm:mt-0 shrink-0 rounded-xl bg-store-newsletter-action text-store-newsletter-action-foreground px-5 py-2.5 text-xs sm:text-sm font-semibold cursor-not-allowed select-none opacity-90 shadow-none hover:bg-store-newsletter-action flex items-center justify-center gap-1.5"
              >
                <span>{newsletter.submitLabel}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Thông báo tính năng đang chuẩn bị */}
            <p className="mt-2.5 text-xs text-store-newsletter-subtext select-none">
              * {newsletter.availabilityMessage}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
