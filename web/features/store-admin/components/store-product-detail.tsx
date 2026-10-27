"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatVndCurrency } from "@/shared/lib/currency";
import {
  getStoreCategories,
  getStoreProduct,
  saveStoreVariant,
  updateStoreProduct,
  updateStoreProductStatus,
} from "../api/store-admin.api";
import { storeAdminError, storeStatusLabels } from "../store-admin.logic";
import type {
  StoreCategory,
  StoreProduct,
  StoreProductStatus,
  StoreVariant,
} from "../types/store-admin";
import { StoreProductForm } from "./store-product-form";
import { StoreProductImages } from "./store-product-images";
import { statusVariant } from "./store-product-list";
import { StoreVariantForm } from "./store-variant-form";

const statusActions: Record<
  StoreProductStatus,
  { status: StoreProductStatus; label: string }[]
> = {
  DRAFT: [
    { status: "PUBLISHED", label: "Xuất bản" },
    { status: "ARCHIVED", label: "Lưu trữ" },
  ],
  PUBLISHED: [
    { status: "DRAFT", label: "Chuyển về nháp" },
    { status: "ARCHIVED", label: "Lưu trữ" },
  ],
  ARCHIVED: [{ status: "DRAFT", label: "Khôi phục về nháp" }],
};

export function StoreProductDetail({
  farmId,
  id,
}: {
  farmId: string;
  id: string;
}) {
  const request = useAuthenticatedRequest();
  const [product, setProduct] = useState<StoreProduct>();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<StoreProductStatus>();
  const [editing, setEditing] = useState(false);
  const [variant, setVariant] = useState<StoreVariant | "new" | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getStoreProduct(request, farmId, id),
      getStoreCategories(request, farmId),
    ])
      .then(([productResponse, categoryResponse]) => {
        if (cancelled) return;
        setProduct(productResponse.data);
        setCategories(categoryResponse.data);
        setError(null);
      })
      .catch((failure) => !cancelled && setError(storeAdminError(failure)));
    return () => {
      cancelled = true;
    };
  }, [request, farmId, id, reload]);

  if (error)
    return <ErrorAlert message={error} onRetry={() => setReload((n) => n + 1)} />;
  if (!product) return <p role="status">Đang tải sản phẩm…</p>;

  const changeStatus = async (status: StoreProductStatus) => {
    setPendingStatus(status);
    setActionError(null);
    try {
      setProduct(
        (await updateStoreProductStatus(request, farmId, id, status)).data,
      );
    } catch (failure) {
      setActionError(storeAdminError(failure));
    } finally {
      setPendingStatus(undefined);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/store-products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Sản phẩm cửa hàng
      </Link>
      <PageHeader
        title={product.name}
        description={`/products/${product.slug} · ${
          categories.find((c) => c.id === product.categoryId)?.name ?? ""
        }`}
        badge={
          <Badge variant={statusVariant[product.status]}>
            {storeStatusLabels[product.status]}
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Sửa
            </Button>
            {statusActions[product.status].map((action) => (
              <Button
                key={action.status}
                variant={action.status === "PUBLISHED" ? "default" : "outline"}
                isLoading={pendingStatus === action.status}
                disabled={pendingStatus !== undefined}
                onClick={() => void changeStatus(action.status)}
              >
                {action.label}
              </Button>
            ))}
          </>
        }
      />
      {actionError && <ErrorAlert message={actionError} />}
      {product.description && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {product.description}
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Quy cách bán</h2>
              <p className="text-sm text-muted-foreground">
                Cần ít nhất một quy cách đang bán để xuất bản.
              </p>
            </div>
            <Button variant="outline" onClick={() => setVariant("new")}>
              <Plus className="size-4" aria-hidden="true" />
              Thêm
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quy cách</TableHead>
                  <TableHead>Vật tư</TableHead>
                  <TableHead className="text-right">Giá</TableHead>
                  <TableHead className="text-right">Bước</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {row.item?.code} — {row.item?.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVndCurrency(Number(row.price))}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.quantityStep} {row.unit?.symbol ?? row.unit?.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.active ? "success" : "outline"}>
                        {row.active ? "Đang bán" : "Tạm ngừng"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setVariant(row)}
                      >
                        Sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {product.variants.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-muted-foreground"
                    >
                      Chưa có quy cách bán.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <StoreProductImages
            farmId={farmId}
            productId={id}
            images={product.images}
            onChange={(images) =>
              setProduct((current) => current && { ...current, images })
            }
          />
        </CardContent>
      </Card>

      {editing && (
        <StoreProductForm
          product={product}
          categories={categories}
          onClose={() => setEditing(false)}
          onSubmit={async (input) =>
            setProduct(
              (await updateStoreProduct(request, farmId, id, input)).data,
            )
          }
        />
      )}
      {variant && (
        <StoreVariantForm
          farmId={farmId}
          variant={variant === "new" ? undefined : variant}
          onClose={() => setVariant(null)}
          onSubmit={async (input) => {
            await saveStoreVariant(
              request,
              farmId,
              id,
              input,
              variant === "new" ? undefined : variant.id,
            );
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
