import * as React from 'react';
import Link from 'next/link';
import { Sprout, Package, Wrench, Droplets, ChevronRight } from 'lucide-react';
import { STOREFRONT_CONFIG } from '../config/storefront-config';
import type { StorefrontCategorySectionConfig } from '../config/storefront-config';
import { getCategoriesStore } from '../../categories/api/category.api';
import type { StorefrontCategory } from '../../categories/types/category';
import { ErrorAlert } from '@/shared/components/ui/error-alert';
import { cn } from '@/shared/lib/utils';

const ICON_MAP = {
  sprout: Sprout,
  package: Package,
  wrench: Wrench,
  droplets: Droplets,
} as const;

export async function HomeCategories() {
  const categories: StorefrontCategorySectionConfig = STOREFRONT_CONFIG.categories;
  let items: StorefrontCategory[];

  try {
    items = (await getCategoriesStore(1, 4)).data;
  } catch {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <ErrorAlert message="Không tải được danh mục. Vui lòng tải lại trang." />
      </div>
    );
  }

  return (
    <section
      aria-label="Danh mục ngành hàng Mộc Ong"
      className="py-10 sm:py-14 lg:py-16 bg-store-warm/30 text-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Tiêu đề phần danh mục */}
        <div className="text-left mb-6 sm:mb-8 lg:mb-10">
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {categories.heading}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {categories.description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {items.length === 0 && (
            <p className="col-span-full text-muted-foreground">Chưa có danh mục.</p>
          )}
          {items.map((item) => {
            const presentation = categories.presentationBySlug[item.slug];
            const IconComponent = ICON_MAP[presentation?.icon ?? 'package'];

            const cardContent = (
              <>
                {/* Khối bên trái: Icon trong hình tròn màu trắng */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    aria-hidden="true"
                    className="size-12 shrink-0 rounded-full bg-white flex items-center justify-center shadow-xs border border-amber-100/70"
                  >
                    <IconComponent className="size-6 text-amber-600" aria-hidden="true" />
                  </div>
                  {/* Tên danh mục và diễn giải phụ */}
                  <div className="flex flex-col text-left min-w-0 flex-1">
                    <h3 className="font-bold text-base text-[#2d241e] dark:text-foreground leading-snug truncate">
                      {item.name}
                    </h3>
                    {presentation?.subtitle && (
                      <p className="text-[0.6875rem] text-[#786f66] dark:text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                        {presentation.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mũi tên điều hướng bên phải */}
                <ChevronRight
                  className="size-4 text-[#8c827a] shrink-0 ml-2"
                  aria-hidden="true"
                />
              </>
            );

            const cardClassName = cn(
              'w-full h-24 rounded-2xl border border-[#e8dbcc]  bg-[#f5ede1]  px-4 py-3 flex items-center justify-between shadow-2xs transition-colors',
              'hover:bg-[#efe4d5] hover:border-amber-300 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer',
            );

            return (
              <div key={item.id} className="h-full">
                <Link
                  href={`/products?category=${encodeURIComponent(item.slug)}`}
                  className={cardClassName}
                >
                  {cardContent}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
