"use client";

import React from "react";
import type { MaterialDetail } from "../types/material";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_TRACKING_MODE_LABELS,
  RECORD_STATUS_LABELS,
} from "../types/material";

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
      {/* Action Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2"
            aria-label="Quay lại danh sách vật tư"
          >
            <span aria-hidden="true">←</span>
            <span>Quay lại</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {item.name}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  item.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                    : "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20"
                }`}
              >
                {RECORD_STATUS_LABELS[item.status]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Mã vật tư:{" "}
              <span className="font-mono font-medium text-foreground">
                {item.code}
              </span>
            </p>
          </div>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:ring-2"
          >
            <span aria-hidden="true">✎</span>
            <span>Chỉnh sửa</span>
          </button>
        )}
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Danh mục
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {categoryName || "—"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Đơn vị tính
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {unitName ? `${unitName} (${unitSymbol ?? "—"})` : "—"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Theo dõi
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {MATERIAL_TRACKING_MODE_LABELS[item.trackingMode]}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ngưỡng tồn tối thiểu
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {item.minStockLevel
              ? `${item.minStockLevel} ${unitSymbol ?? ""}`
              : "0"}
          </p>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Basic Information Card */}
        <section
          aria-labelledby="basic-info-heading"
          className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="border-b pb-3">
            <h3
              id="basic-info-heading"
              className="text-base font-semibold text-foreground"
            >
              Thông tin cơ bản
            </h3>
            <p className="text-xs text-muted-foreground">
              Nhận diện và phân loại của vật tư trong nông trại
            </p>
          </div>

          <dl className="mt-4 divide-y divide-border/60 text-sm">
            <div className="grid grid-cols-3 py-3">
              <dt className="text-muted-foreground">Mã vật tư</dt>
              <dd className="col-span-2 font-mono font-medium text-foreground">
                {item.code}
              </dd>
            </div>

            <div className="grid grid-cols-3 py-3">
              <dt className="text-muted-foreground">Tên vật tư</dt>
              <dd className="col-span-2 font-medium text-foreground">
                {item.name}
              </dd>
            </div>

            <div className="grid grid-cols-3 py-3">
              <dt className="text-muted-foreground">Mã vạch (Barcode)</dt>
              <dd className="col-span-2 font-mono text-foreground">
                {item.barcode || "—"}
              </dd>
            </div>

            <div className="grid grid-cols-3 py-3">
              <dt className="text-muted-foreground">Trạng thái</dt>
              <dd className="col-span-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    item.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {RECORD_STATUS_LABELS[item.status]}
                </span>
              </dd>
            </div>

            <div className="grid grid-cols-3 py-3">
              <dt className="text-muted-foreground">Mô tả</dt>
              <dd className="col-span-2 whitespace-pre-line text-foreground">
                {item.description || "—"}
              </dd>
            </div>

            <div className="grid grid-cols-3 py-3">
              <dt className="text-muted-foreground">Ảnh đính kèm</dt>
              <dd className="col-span-2">
                {imageHref ? (
                  <a
                    href={imageHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <span>Xem hình ảnh</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>

            <div className="grid grid-cols-3 py-3">
              <dt className="text-muted-foreground">Nguồn / Nhà cung cấp</dt>
              <dd className="col-span-2">
                {sourceHref ? (
                  <a
                    href={sourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <span>Mở liên kết nguồn</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* Profile & Shelf Life Card */}
        <section
          aria-labelledby="profile-info-heading"
          className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
        >
          <div className="border-b pb-3">
            <h3
              id="profile-info-heading"
              className="text-base font-semibold text-foreground"
            >
              Hồ sơ quản lý & Hạn dùng
            </h3>
            <p className="text-xs text-muted-foreground">
              Chi tiết bảo quản, an toàn và theo dõi hạn sử dụng
            </p>
          </div>

          {profile ? (
            <dl className="mt-4 divide-y divide-border/60 text-sm">
              <div className="grid grid-cols-3 py-3">
                <dt className="text-muted-foreground">Loại vật tư</dt>
                <dd className="col-span-2 font-medium text-foreground">
                  {MATERIAL_KIND_LABELS[profile.kind]}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="text-muted-foreground">Theo dõi hạn dùng</dt>
                <dd className="col-span-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      profile.requiresExpiryTracking
                        ? "bg-blue-50 text-blue-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {profile.requiresExpiryTracking
                      ? "Bắt buộc theo dõi hạn"
                      : "Không theo dõi hạn"}
                  </span>
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="text-muted-foreground">Cảnh báo trước hạn</dt>
                <dd className="col-span-2 text-foreground">
                  {profile.expiryWarningDays} ngày
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="text-muted-foreground">Hạn dùng tiêu chuẩn</dt>
                <dd className="col-span-2 text-foreground">
                  {profile.defaultShelfLifeDays
                    ? `${profile.defaultShelfLifeDays} ngày`
                    : "—"}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="text-muted-foreground">Hướng dẫn bảo quản</dt>
                <dd className="col-span-2 whitespace-pre-line text-foreground">
                  {profile.storageInstructions || "—"}
                </dd>
              </div>

              <div className="grid grid-cols-3 py-3">
                <dt className="text-muted-foreground">Lưu ý an toàn</dt>
                <dd className="col-span-2 whitespace-pre-line text-foreground">
                  {profile.safetyNotes || "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Chưa có hồ sơ bổ sung
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vật tư này hiện chưa được thiết lập thông tin bảo quản và theo
                dõi hạn sử dụng.
              </p>
              {canWrite && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <span>+ Thiết lập hồ sơ vật tư</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Metadata Audit Card */}
      <div className="rounded-xl border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Ngày tạo:{" "}
            <span className="font-medium text-foreground">
              {formatDate(item.createdAt)}
            </span>
          </span>
          <span>
            Cập nhật lần cuối:{" "}
            <span className="font-medium text-foreground">
              {formatDate(item.updatedAt)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
