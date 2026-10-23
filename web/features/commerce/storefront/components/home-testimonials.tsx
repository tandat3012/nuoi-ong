import * as React from 'react';
import { Star } from 'lucide-react';
import { STOREFRONT_CONFIG } from '../config/storefront-config';
import { cn } from '@/shared/lib/utils';

export function HomeTestimonials({ className }: { className?: string } = {}) {
  const { testimonials } = STOREFRONT_CONFIG;

  return (
    <section
      aria-labelledby="testimonials-heading"
      className={cn(
        'py-12 sm:py-16 lg:py-20 bg-[#fbf8f2] dark:bg-stone-900/40 border-t border-[#ede6dc] dark:border-border text-foreground',
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Tiêu đề & Phụ đề phần Đánh giá khách hàng */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2
            id="testimonials-heading"
            className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground"
          >
            {testimonials.heading}
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
            {testimonials.description}
          </p>
        </div>

        {/* Lưới 3 thẻ đánh giá khách hàng */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {testimonials.items.map((item) => (
            <figure
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-[#ede5db] dark:border-border bg-white dark:bg-card p-6 sm:p-7 shadow-2xs transition-shadow duration-200 hover:shadow-xs"
            >
              <div>
                {/* 5 sao đánh giá chất lượng */}
                <div
                  className="flex items-center gap-1"
                  aria-label={`Đánh giá ${item.rating} trên 5 sao`}
                >
                  {Array.from({ length: item.rating }).map((_, index) => (
                    <Star
                      key={index}
                      className="size-4 fill-store-rating-fill text-store-rating-stroke"
                      aria-hidden="true"
                    />
                  ))}
                </div>

                {/* Nội dung trích dẫn ý kiến khách hàng */}
                <blockquote className="mt-4 text-sm sm:text-base leading-relaxed text-[#3d332a] dark:text-foreground/90 italic">
                  “{item.quote}”
                </blockquote>
              </div>

              {/* Thông tin tác giả & Avatar ký tự đầu */}
              <figcaption className="mt-6 flex items-center gap-3.5 pt-4 border-t border-[#f0e8de] dark:border-border/60">
                <div
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f2e9dc] dark:bg-muted text-xs font-bold text-[#63482d] dark:text-foreground select-none"
                >
                  {item.author.initials}
                </div>
                <div className="text-left min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {item.author.name}
                  </div>
                  <cite className="not-italic text-xs text-muted-foreground block mt-0.5 truncate">
                    {item.author.role}
                  </cite>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Thông báo minh họa bản xem trước */}
        <p className="mt-8 text-center text-xs text-muted-foreground/70 select-none">
          * Đánh giá mẫu phục vụ hiển thị giao diện cho bản xem trước.
        </p>
      </div>
    </section>
  );
}
