import { HomeHero } from "@/features/commerce/storefront/components/home-hero";
import { HomeBenefits } from "@/features/commerce/storefront/components/home-benefits";
import { HomeCategories } from "@/features/commerce/storefront/components/home-categories";
import { HomeFeaturedProducts } from "@/features/commerce/storefront/components/home-featured-products";
import { Suspense } from "react";

export default function StoreHomePage() {
  return (
    <main>
      <HomeHero />
      <HomeBenefits />
      <Suspense
        fallback={
          <p role="status" className="px-4 py-12 text-center">
            Đang tải danh mục…
          </p>
        }
      >
        <HomeCategories />
      </Suspense>
      <Suspense
        fallback={
          <p role="status" className="px-4 py-12 text-center">
            Đang tải sản phẩm…
          </p>
        }
      >
        <HomeFeaturedProducts />
      </Suspense>
    </main>
  );
}
