"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, Pencil, Plus } from "lucide-react";
import { useAuthenticatedRequest, useFarmMembership } from "@/features/auth";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";
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
  removeStoreVariantItem,
  saveStoreVariant,
  setStoreVariantItem,
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
import { StoreItemPicker } from "./store-item-picker";
import { StoreVariantForm } from "./store-variant-form";
import { formatInventoryQuantity } from "@/features/inventory";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

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
  const { canEditCatalog, canManageFarm } = useFarmMembership();
  const [mapping, setMapping] = useState<StoreVariant | null>(null);
  const [unmapping, setUnmapping] = useState<StoreVariant | null>(null);
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
    return (
      <ErrorAlert message={error} onRetry={() => setReload((n) => n + 1)} />
    );
  if (!product) return <BeeLoader label="Đang tải sản phẩm…" />;

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

  const mappedCount = product.variants.filter((v) => v.item).length;
  const prices = product.variants.map((v) => Number(v.price));

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
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs">/products/{product.slug}</span>
            <span aria-hidden="true">·</span>
            <span>
              {categories.find((c) => c.id === product.categoryId)?.name ??
                "Chưa có danh mục"}
            </span>
          </span>
        }
        badge={
          <Badge variant={statusVariant[product.status]}>
            {storeStatusLabels[product.status]}
          </Badge>
        }
        actions={
          canEditCatalog && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden="true" />
                Sửa
              </Button>
              {statusActions[product.status].map((action) => (
                <Button
                  key={action.status}
                  variant={
                    action.status === "PUBLISHED" ? "default" : "outline"
                  }
                  isLoading={pendingStatus === action.status}
                  disabled={pendingStatus !== undefined}
                  onClick={() => void changeStatus(action.status)}
                >
                  {action.label}
                </Button>
              ))}
            </>
          )
        }
      />
      {actionError && <ErrorAlert message={actionError} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Quy cách", value: String(product.variants.length) },
          {
            label: "Đã gắn vật tư",
            value: `${mappedCount}/${product.variants.length}`,
            warn: mappedCount < product.variants.length,
          },
          { label: "Giá thấp nhất", value: prices.length ? formatVndCurrency(Math.min(...prices)) : "—" },
          { label: "Giá cao nhất", value: prices.length ? formatVndCurrency(Math.max(...prices)) : "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card px-4 py-3 shadow-2xs"
          >
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold tabular-nums",
                stat.warn && "text-warning",
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      {product.description && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-2xs">
          <p className="text-xs font-medium text-muted-foreground">Mô tả</p>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground">
            {product.description}
          </p>
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Quy cách bán</h2>
              <p className="text-sm text-muted-foreground">
                Trại chỉ bán quy cách đã gắn vật tư của trại đang chọn.
              </p>
            </div>
            {canEditCatalog && (
              <Button onClick={() => setVariant("new")}>
                <Plus className="size-4" aria-hidden="true" />
                Thêm quy cách
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider">Quy cách</TableHead>
                  <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider">Vật tư của trại</TableHead>
                  <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider text-right">Giá</TableHead>
                  <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider text-right">Bước bán</TableHead>
                  <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider">Trạng thái</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {row.item ? (
                        <>
                          <span className="font-mono text-xs">{row.item.code}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.item.name}
                          </span>
                        </>
                      ) : (
                        <Badge variant="warning">Chưa gắn vật tư</Badge>
                      )}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {row.farmCount} trại cung cấp
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatVndCurrency(Number(row.price))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatInventoryQuantity(row.quantityStep)}{" "}
                      {row.unit?.symbol ?? row.unit?.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.active ? "success" : "outline"}>
                        {row.active ? "Đang bán" : "Tạm ngừng"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap text-right">
                      {canManageFarm && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMapping(row)}
                        >
                          <Link2 className="size-3.5" aria-hidden="true" />
                          {row.item ? "Đổi vật tư" : "Gắn vật tư"}
                        </Button>
                      )}
                      {canManageFarm && row.item && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setUnmapping(row)}
                        >
                          Gỡ
                        </Button>
                      )}
                      {canEditCatalog && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setVariant(row)}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Sửa
                        </Button>
                      )}
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

      {canEditCatalog && (
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
      )}

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
      {mapping && (
        <FormDialog
          errorMessage={storeAdminError}
          title={`Vật tư cung cấp "${mapping.name}"`}
          description={`Chọn vật tư của trại, cùng đơn vị ${mapping.unit?.name ?? "với quy cách"}.`}
          onClose={() => setMapping(null)}
          onSubmit={async (data) =>
            setProduct(
              (
                await setStoreVariantItem(
                  request,
                  farmId,
                  id,
                  mapping.id,
                  String(data.get("itemId")),
                )
              ).data,
            )
          }
        >
          <StoreItemPicker farmId={farmId} />
        </FormDialog>
      )}
      <ConfirmDialog
        open={unmapping !== null}
        onOpenChange={(open) => !open && setUnmapping(null)}
        title={`Ngừng cung cấp "${unmapping?.name ?? ""}" từ trại này?`}
        description="Các trại khác vẫn bán quy cách này nếu đã gắn vật tư."
        confirmLabel="Gỡ"
        variant="destructive"
        onConfirm={async () => {
          if (!unmapping) return;
          setActionError(null);
          try {
            await removeStoreVariantItem(request, farmId, id, unmapping.id);
            setReload((n) => n + 1);
          } catch (failure) {
            setActionError(storeAdminError(failure));
          }
          setUnmapping(null);
        }}
      />
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
