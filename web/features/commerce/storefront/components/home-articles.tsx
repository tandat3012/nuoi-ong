import * as React from 'react';
import Link from 'next/link';
import { Sprout, Package, Droplets, BookOpen } from 'lucide-react';
import { STOREFRONT_CONFIG } from '../config/storefront-config';
import { cn } from '@/shared/lib/utils';

const ARTICLE_ICONS = {
  sprout: Sprout,
  package: Package,
  droplets: Droplets,
  book: BookOpen,
} as const;

export function HomeArticles({ className }: { className?: string } = {}) {
  const { articles } = STOREFRONT_CONFIG;

  return (
    <section
      aria-labelledby="articles-heading"
      className={cn('py-12 sm:py-16 lg:py-20 bg-background text-foreground', className)}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Tiêu đề & Lối tắt Xem bài viết */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div className="text-left">
            <h2
              id="articles-heading"
              className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground"
            >
              {articles.heading}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
              {articles.description}
            </p>
          </div>

          <div>
            {articles.viewAll.isImplemented ? (
              <Link
                href={articles.viewAll.href}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span>{articles.viewAll.label}</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground/60 select-none"
              >
                <span>{articles.viewAll.label}</span>
                <span aria-hidden="true">&rarr;</span>
              </span>
            )}
          </div>
        </div>

        {/* Lưới 3 bài viết chia sẻ kinh nghiệm */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {articles.items.map((item) => {
            const IconComponent = ARTICLE_ICONS[item.icon] || BookOpen;

            return (
              <article key={item.id} className="group flex flex-col text-left">
                {/* Khung ảnh bài viết (Placeholder trang nhã theo tỷ lệ 16:10) */}
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[#faf4ea] dark:bg-stone-900/50 border border-border/70 flex items-center justify-center transition-colors group-hover:border-primary/40">
                  <div className="flex flex-col items-center justify-center gap-2 text-primary/50">
                    <IconComponent className="size-10 sm:size-12 stroke-1 transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
                  </div>
                  <span className="sr-only">Hình ảnh minh họa cho {item.title}</span>
                </div>

                {/* Nội dung tóm tắt bài viết */}
                <div className="mt-4 flex flex-col">
                  {/* Phân loại danh mục */}
                  <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#92400e] dark:text-amber-400">
                    {item.category}
                  </span>

                  {/* Tiêu đề bài viết */}
                  {item.isImplemented ? (
                    <Link
                      href={item.href}
                      className="mt-1.5 font-serif text-base sm:text-lg font-bold text-foreground leading-snug transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <h3 className="mt-1.5 font-serif text-base sm:text-lg font-bold text-foreground leading-snug">
                      {item.title}
                    </h3>
                  )}

                  {/* Tóm tắt mô tả */}
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Thông báo minh họa bản xem trước */}
        <p className="mt-8 text-center text-xs text-muted-foreground/70 select-none">
          * Bài viết và kiến thức nuôi ong đang trong quá trình biên tập nội dung.
        </p>
      </div>
    </section>
  );
}
