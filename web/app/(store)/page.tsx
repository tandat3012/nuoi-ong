import { HomeHero } from '@/features/commerce/storefront/components/home-hero';
import { HomeBenefits } from '@/features/commerce/storefront/components/home-benefits';
import { HomeCategories } from '@/features/commerce/storefront/components/home-categories';
import { HomeFeaturedProducts } from '@/features/commerce/storefront/components/home-featured-products';

export default function StoreHomePage() {
  return (
    <main>
      <HomeHero />
      <HomeBenefits />
      <HomeCategories />
      <HomeFeaturedProducts />
    </main>
  );
}
