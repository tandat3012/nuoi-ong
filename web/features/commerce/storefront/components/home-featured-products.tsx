import * as React from "react";
import Link from "next/link";
import { STOREFRONT_CONFIG } from "../config/storefront-config";
import { STOREFRONT_FEATURED_PRODUCTS } from "@/features/commerce/products/fixtures/product-fixtures";
import { ProductCard } from "@/features/commerce/products/components/product-card";
import { StorefrontProduct } from "../../products/types/product";
import { getProductsStore } from "../../products/api/product.api";
import { ErrorAlert } from "@/shared/components/ui/error-alert";

export async function HomeFeaturedProducts() {
  const { featuredProducts } = STOREFRONT_CONFIG;

  let products: StorefrontProduct[];

  try {
    products = (await getProductsStore(1, 4)).data;
  } catch (err) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <ErrorAlert message="Không tải được sản phẩm. Vui lòng tải lại trang." />
      </div>
    );
  }
  return (
    <section
      aria-label="Sản phẩm nổi bật được nhà ong tin chọn"
      className="py-12 sm:py-16 bg-background text-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Tiêu đề & Lối tắt Xem tất cả */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div className="text-left">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              {featuredProducts.heading}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
              {featuredProducts.description}
            </p>
          </div>

          <div>
            {featuredProducts.viewAll.isImplemented ? (
              <Link
                href={featuredProducts.viewAll.href}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span>{featuredProducts.viewAll.label}</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            ) : (
              <span
                aria-disabled="true"
                title="Trang danh mục sản phẩm đang được chuẩn bị"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground/60 select-none cursor-not-allowed"
              >
                <span>{featuredProducts.viewAll.label}</span>
                <span aria-hidden="true">&rarr;</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {products.length === 0 ? (
            <p className="col-span-full text-muted-foreground">
              Chưa có sản phẩm{" "}
            </p>
          ) : (
            products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
