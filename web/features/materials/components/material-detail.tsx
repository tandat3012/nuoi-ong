"use client";

import React from "react";
import Link from "next/link";
import type { MaterialDetail } from "../types/material";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_TRACKING_MODE_LABELS,
  RECORD_STATUS_LABELS,
} from "../types/material";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
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
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBack}
              aria-label="Quay lại danh sách vật tư"
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>Quay lại</span>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {item.name}
                </h2>
                <Badge
                  variant={item.status === "ACTIVE" ? "success" : "warning"}
                >
                  {RECORD_STATUS_LABELS[item.status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mã vật tư:{" "}
                <span className="font-mono font-medium text-foreground">
                  {item.code}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/inventory?itemId=${item.id}`}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Xem tồn kho</span>
            </Link>
            <ItemQrButton itemId={item.id} />
            {canWrite && (
              <Button size="sm" onClick={onEdit} className="gap-1.5">
                <Edit className="size-3.5" aria-hidden="true" />
                <span>Chỉnh sửa</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Metric Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Danh mục
            </p>
            <Layers className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-2 text-base font-bold text-foreground truncate">
            {categoryName || "—"}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Đơn vị tính
            </p>
            <Scale className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-2 text-base font-bold text-foreground">
            {unitName ? `${unitName} (${unitSymbol ?? "—"})` : "—"}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Theo dõi
            </p>
            <Barcode className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-2 text-base font-bold text-foreground">
            {MATERIAL_TRACKING_MODE_LABELS[item.trackingMode]}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Tồn tối thiểu
            </p>
            <ShieldAlert className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-2 text-base font-bold text-foreground">
            {item.minStockLevel
              ? `${item.minStockLevel} ${unitSymbol ?? ""}`
              : "0"}
          </p>
        </Card>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Basic Information Card */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base font-semibold">
              Thông tin cơ bản
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Nhận diện và phân loại của vật tư trong nông trại
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <dl className="divide-y divide-border/60 text-sm">
              <div className="grid grid-cols-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">Mã vật tư</dt>
                <dd className="col-span-2 font-mono font-semibold text-foreground">
                  {item.code}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">Tên vật tư</dt>
                <dd className="col-span-2 font-medium text-foreground">
                  {item.name}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">Mã vạch (Barcode)</dt>
                <dd className="col-span-2 font-mono text-foreground">
                  {item.barcode || "—"}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">Trạng thái</dt>
                <dd className="col-span-2">
                  <Badge
                    variant={item.status === "ACTIVE" ? "success" : "warning"}
                  >
                    {RECORD_STATUS_LABELS[item.status]}
                  </Badge>
                </dd>
              </div>

              <div className="grid grid-cols-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">Mô tả</dt>
                <dd className="col-span-2 whitespace-pre-line text-foreground">
                  {item.description || "—"}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">Ảnh đính kèm</dt>
                <dd className="col-span-2">
                  {imageHref ? (
                    <a
                      href={imageHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs font-medium"
                    >
                      <span>Xem hình ảnh</span>
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">Nguồn / Nhà cung cấp</dt>
                <dd className="col-span-2">
                  {sourceHref ? (
                    <a
                      href={sourceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs font-medium"
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
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base font-semibold">
              Hồ sơ quản lý & Hạn dùng
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Chi tiết bảo quản, an toàn và theo dõi hạn sử dụng
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            {profile ? (
              <dl className="divide-y divide-border/60 text-sm">
                <div className="grid grid-cols-3 py-2.5">
                  <dt className="text-xs font-medium text-muted-foreground">Loại vật tư</dt>
                  <dd className="col-span-2 font-medium text-foreground">
                    <Badge variant="secondary">
                      {MATERIAL_KIND_LABELS[profile.kind]}
                    </Badge>
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-2.5">
                  <dt className="text-xs font-medium text-muted-foreground">Theo dõi hạn dùng</dt>
                  <dd className="col-span-2">
                    <Badge
                      variant={profile.requiresExpiryTracking ? "info" : "outline"}
                    >
                      {profile.requiresExpiryTracking
                        ? "Bắt buộc theo dõi hạn"
                        : "Không theo dõi hạn"}
                    </Badge>
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-2.5">
                  <dt className="text-xs font-medium text-muted-foreground">Cảnh báo trước hạn</dt>
                  <dd className="col-span-2 text-foreground font-medium">
                    {profile.expiryWarningDays} ngày
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-2.5">
                  <dt className="text-xs font-medium text-muted-foreground">Hạn dùng tiêu chuẩn</dt>
                  <dd className="col-span-2 text-foreground">
                    {profile.defaultShelfLifeDays
                      ? `${profile.defaultShelfLifeDays} ngày`
                      : "—"}
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-2.5">
                  <dt className="text-xs font-medium text-muted-foreground">Hướng dẫn bảo quản</dt>
                  <dd className="col-span-2 whitespace-pre-line text-foreground">
                    {profile.storageInstructions || "—"}
                  </dd>
                </div>

                <div className="grid grid-cols-3 py-2.5">
                  <dt className="text-xs font-medium text-muted-foreground">Lưu ý an toàn</dt>
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
      <Card className="px-5 py-3 text-xs text-muted-foreground bg-muted/20">
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
      </Card>
    </div>
  );
}
