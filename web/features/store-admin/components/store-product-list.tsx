"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { imageLoader } from "@/shared/lib/cloudinary-image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff, Plus } from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  createStoreCategory,
  createStoreProduct,
  getStoreCategories,
  getStoreProducts,
} from "../api/store-admin.api";
import { storeAdminError, storeStatusLabels } from "../store-admin.logic";
import type {
  StoreCategory,
  StoreProductFilters,
  StoreProductRow,
  StoreProductStatus,
} from "../types/store-admin";
import { StoreCategoryForm, StoreProductForm } from "./store-product-form";

export const statusVariant = {
  DRAFT: "secondary",
  PUBLISHED: "success",
  ARCHIVED: "outline",
} as const;

export function StoreProductList({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const router = useRouter();
  const [filters, setFilters] = useState<StoreProductFilters>({ page: 1 });
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<PaginatedResponse<StoreProductRow>>();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string>();
  const [dialog, setDialog] = useState<"product" | "category" | null>(null);
  const [reload, setReload] = useState(0);

  const key = `${JSON.stringify(filters)}:${reload}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getStoreProducts(request, farmId, filters),
      getStoreCategories(request, farmId),
    ])
      .then(([products, categoryResponse]) => {
        if (cancelled) return;
        setResult(products);
        setCategories(categoryResponse.data);
        setError(null);
      })
      .catch((failure) => !cancelled && setError(storeAdminError(failure)))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
  }, [request, farmId, filters, key]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sản phẩm cửa hàng"
        description="Quản lý sản phẩm, quy cách bán và ảnh hiển thị trên cửa hàng."
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog("category")}>
              <Plus className="size-4" aria-hidden="true" />
              Danh mục
            </Button>
            <Button
              onClick={() => setDialog("product")}
              disabled={categories.length === 0}
              title={categories.length === 0 ? "Cần tạo danh mục trước" : undefined}
            >
              <Plus className="size-4" aria-hidden="true" />
              Sản phẩm
            </Button>
          </>
        }
      />

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters((current) => ({ ...current, page: 1, search }));
        }}
      >
        <Input
          type="search"
          aria-label="Tìm theo tên"
          placeholder="Tìm theo tên sản phẩm"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label="Trạng thái"
          className="sm:w-48"
          value={filters.status ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              page: 1,
              status: (event.target.value || undefined) as
                | StoreProductStatus
                | undefined,
            }))
          }
        >
          <option value="">Mọi trạng thái</option>
          {Object.entries(storeStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Tìm
        </Button>
      </form>

      {error && (
        <ErrorAlert message={error} onRetry={() => setReload((n) => n + 1)} />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ảnh</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Quy cách</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result?.data.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        loader={imageLoader(product.imageUrl)}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 rounded-md object-cover"
                      />
                    ) : (
                      <ImageOff
                        className="size-5 text-muted-foreground"
                        aria-label="Chưa có ảnh"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/store-products/${product.id}`}
                      className="font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      /{product.slug}
                    </p>
                  </TableCell>
                  <TableCell>{product.category.name}</TableCell>
                  <TableCell>{product.variantCount}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[product.status]}>
                      {storeStatusLabels[product.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {result && result.data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Chưa có sản phẩm phù hợp.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {result && (
          <Pagination
            pageInfo={result.page}
            isLoading={loading}
            itemLabel="sản phẩm"
            onPageChange={(page) =>
              setFilters((current) => ({ ...current, page }))
            }
          />
        )}
      </Card>

      {dialog === "product" && (
        <StoreProductForm
          categories={categories}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const { data } = await createStoreProduct(request, farmId, input);
            router.push(`/store-products/${data.id}`);
          }}
        />
      )}
      {dialog === "category" && (
        <StoreCategoryForm
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            await createStoreCategory(request, farmId, input);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
