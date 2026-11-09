"use client";

import React from "react";
import Link from "next/link";
import type { MaterialDetail } from "../types/material";
import {
  MATERIAL_TRACKING_MODE_LABELS,
} from "../types/material";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { ItemQrButton } from "@/features/qr/item-qr-dialog";
import { Button } from "@/shared/components/ui/button";
import {
  ArrowLeft,
  Edit,
  ExternalLink,
  Layers,
  Scale,
  Barcode,
  ShieldAlert,
  Clock,
  Calendar,
} from "lucide-react";
import {
  MaterialKindBadge,
  MaterialStatusBadge,
} from "./material-badges";

interface MaterialDetailViewProps {
  material: MaterialDetail;
  canWrite: boolean;
  onBack: () => void;
  onEdit: () => void;
}

function safeHref(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function MaterialDetailView({
  material,
  canWrite,
  onBack,
  onEdit,
}: MaterialDetailViewProps) {
  const { item, profile, categoryName, unitName, unitSymbol } = material;
  const imageHref = safeHref(item.imageUrl);
  const sourceHref = safeHref(item.sourceUrl);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header Card */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              aria-label="Quay lại danh sách vật tư"
              className="h-9 gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Quay lại</span>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {item.name}
                </h2>
                <MaterialStatusBadge status={item.status} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Mã vật tư:</span>
                <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                  {item.code}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/inventory?itemId=${item.id}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Xem tồn kho</span>
            </Link>
            <ItemQrButton itemId={item.id} />
            {canWrite && (
              <Button size="sm" onClick={onEdit} className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
                <Edit className="size-3.5" aria-hidden="true" />
                <span>Chỉnh sửa</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Metric Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Danh mục
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
              <Layers className="size-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2 text-sm font-bold text-foreground truncate">
            {categoryName || "—"}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Đơn vị tính
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
              <Scale className="size-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2 text-sm font-bold text-foreground">
            {unitName ? `${unitName} (${unitSymbol ?? "—"})` : "—"}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Theo dõi
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
              <Barcode className="size-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2 text-sm font-bold text-foreground">
            {MATERIAL_TRACKING_MODE_LABELS[item.trackingMode]}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Tồn tối thiểu
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
              <ShieldAlert className="size-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2 text-sm font-bold tabular-nums text-foreground">
            {item.minStockLevel
              ? `${item.minStockLevel} ${unitSymbol ?? ""}`
              : "0"}
          </p>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Basic Information Card */}
        <Card className="rounded-xl border border-border bg-card shadow-2xs">
          <CardHeader className="border-b border-border bg-muted/20 px-5 py-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              Thông tin cơ bản
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Nhận diện và phân loại của vật tư trong nông trại
            </p>
          </CardHeader>
          <CardContent className="p-5">
            <dl className="divide-y divide-border text-xs">
              <div className="grid grid-cols-3 py-3">
                <dt className="font-medium text-muted-foreground">Mã vật tư</dt>
                <dd className="col-span-2 font-mono font-bold text-foreground">
                  {item.code}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="font-medium text-muted-foreground">Tên vật tư</dt>
                <dd className="col-span-2 font-semibold text-foreground">
                  {item.name}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="font-medium text-muted-foreground">Mã vạch (Barcode)</dt>
                <dd className="col-span-2 font-mono text-foreground">
                  {item.barcode || "—"}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="font-medium text-muted-foreground">Trạng thái</dt>
                <dd className="col-span-2">
                  <MaterialStatusBadge status={item.status} />
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="font-medium text-muted-foreground">Mô tả</dt>
                <dd className="col-span-2 whitespace-pre-line text-foreground">
                  {item.description || "—"}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="font-medium text-muted-foreground">Ảnh đính kèm</dt>
                <dd className="col-span-2">
                  {imageHref ? (
                    <a
                      href={imageHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                    >
                      <span>Xem hình ảnh</span>
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="font-medium text-muted-foreground">Nguồn / Nhà cung cấp</dt>
                <dd className="col-span-2">
                  {sourceHref ? (
                    <a
                      href={sourceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                    >
                      <span>Mở liên kết nguồn</span>
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Profile & Shelf Life Card */}
        <Card className="rounded-xl border border-border bg-card shadow-2xs">
          <CardHeader className="border-b border-border bg-muted/20 px-5 py-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              Hồ sơ quản lý & Hạn dùng
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Chi tiết bảo quản, an toàn và theo dõi hạn sử dụng
            </p>
          </CardHeader>
          <CardContent className="p-5">
            {profile ? (
              <dl className="divide-y divide-border text-xs">
                <div className="grid grid-cols-3 py-3">
                  <dt className="font-medium text-muted-foreground">Loại vật tư</dt>
                  <dd className="col-span-2">
                    <MaterialKindBadge kind={profile.kind} />
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-3">
                  <dt className="font-medium text-muted-foreground">Theo dõi hạn dùng</dt>
                  <dd className="col-span-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                        profile.requiresExpiryTracking
                          ? "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400"
                          : "border-border bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {profile.requiresExpiryTracking
                        ? "Bắt buộc theo dõi hạn theo lô"
                        : "Không theo dõi hạn"}
                    </span>
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-3">
                  <dt className="font-medium text-muted-foreground">Cảnh báo trước hạn</dt>
                  <dd className="col-span-2 text-foreground font-semibold tabular-nums">
                    {profile.expiryWarningDays} ngày
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-3">
                  <dt className="font-medium text-muted-foreground">Hạn dùng tiêu chuẩn</dt>
                  <dd className="col-span-2 text-foreground tabular-nums">
                    {profile.defaultShelfLifeDays
                      ? `${profile.defaultShelfLifeDays} ngày`
                      : "—"}
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-3">
                  <dt className="font-medium text-muted-foreground">Hướng dẫn bảo quản</dt>
                  <dd className="col-span-2 whitespace-pre-line text-foreground">
                    {profile.storageInstructions || "—"}
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-3">
                  <dt className="font-medium text-muted-foreground">Lưu ý an toàn</dt>
                  <dd className="col-span-2 whitespace-pre-line text-foreground">
                    {profile.safetyNotes || "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Chưa có hồ sơ bổ sung
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vật tư này hiện chưa được thiết lập thông tin bảo quản và theo
                  dõi hạn sử dụng.
                </p>
                {canWrite && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={onEdit}
                    className="mt-3 text-xs"
                  >
                    + Thiết lập hồ sơ vật tư
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata Audit Card */}
      <div className="rounded-xl border border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Ngày tạo: <span className="font-medium text-foreground">{formatDate(item.createdAt)}</span></span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Cập nhật lần cuối: <span className="font-medium text-foreground">{formatDate(item.updatedAt)}</span></span>
          </span>
        </div>
      </div>
    </div>
  );
}
