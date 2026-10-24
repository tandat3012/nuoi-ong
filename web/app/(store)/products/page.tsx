import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductsLoading } from "@/features/commerce/products/components/products-loading";
import { ProductsPage } from "@/features/commerce/products/components/products-page";
import { parseAndValidateProductsQuery } from "@/features/commerce/products/components/products-page.logic";

export const metadata: Metadata = { title: "Sản phẩm" };

export default async function StoreProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    category?: string | string[];
    q?: string | string[];
    minPrice?: string | string[];
    maxPrice?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const page = Number(query.page ?? "1");
  const category = query.category || undefined;

  if (
    Array.isArray(query.page) ||
    !Number.isSafeInteger(page * 20) ||
    !Number.isInteger(page) ||
    page < 1 ||
    (category !== undefined &&
      (typeof category !== "string" ||
        category.length > 100 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)))
  ) {
    notFound();
  }

  const validation = parseAndValidateProductsQuery(query);

  const criteria = validation.criteria;
  criteria.page = page;
  if (category) {
    criteria.category = category;
  }

  return (
    <Suspense
      key={`${page}:${category ?? ""}:${query.q ?? ""}:${query.minPrice ?? ""}:${query.maxPrice ?? ""}:${query.sort ?? ""}`}
      fallback={<ProductsLoading />}
    >
      <ProductsPage
        criteria={criteria}
        validationError={!validation.isValid ? validation.error : undefined}
      />
    </Suspense>
  );
}
