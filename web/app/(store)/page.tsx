import { Suspense } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { HomeHero } from '@/features/commerce/storefront/components/home-hero';
import { HomeBenefits } from '@/features/commerce/storefront/components/home-benefits';
import { HomeCategories } from '@/features/commerce/storefront/components/home-categories';
import { HomeFeaturedProducts } from '@/features/commerce/storefront/components/home-featured-products';
import { HomePromotions } from '@/features/commerce/storefront/components/home-promotions';
import { HomeTestimonials } from '@/features/commerce/storefront/components/home-testimonials';
import { HomeArticles } from '@/features/commerce/storefront/components/home-articles';
import { HomeNewsletter } from '@/features/commerce/storefront/components/home-newsletter';

export default function StoreHomePage() {
  return (
    <main>
      <HomeHero />
      <HomeBenefits />
      <Suspense
        fallback={
          <HomeSectionLoading label="Đang tải danh mục" cardClassName="h-24" />
        }
      >
        <HomeCategories />
      </Suspense>
      <Suspense
        fallback={
          <HomeSectionLoading label="Đang tải sản phẩm" cardClassName="h-96" />
        }
      >
        <HomeFeaturedProducts />
      </Suspense>
      <HomePromotions />
      <HomeTestimonials />
      <HomeArticles />
      <HomeNewsletter />
    </main>
  );
}

function HomeSectionLoading({
  label,
  cardClassName,
}: {
  label: string;
  cardClassName: string;
}) {
  return (
    <section
      role="status"
      aria-label={label}
      className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
    >
      <Skeleton className="mb-4 h-8 w-64" />
      <Skeleton className="mb-8 h-4 w-full max-w-lg" />
      <div
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className={cardClassName} />
        ))}
      </div>
    </section>
  );
}
