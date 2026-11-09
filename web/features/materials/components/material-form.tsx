"use client";

import React, { useState } from "react";
import type {
  CategoryReference,
  CreateMaterialInput,
  MaterialDetail,
  MaterialKind,
  MaterialTrackingMode,
  RecordStatus,
  UnitReference,
  UpdateMaterialInput,
} from "../types/material";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_TRACKING_MODE_LABELS,
  RECORD_STATUS_LABELS,
} from "../types/material";
import {
  buildMaterialPayload,
  getMaterialFormInitialValues,
  getMaterialReferenceWarnings,
  validateMaterialForm,
  type MaterialFormErrors,
  type MaterialFormValues,
} from "./material-form.logic";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { Save, ArrowLeft, Boxes, CalendarClock, ShieldCheck, AlertTriangle } from "lucide-react";

interface MaterialFormProps {
  mode: "create" | "edit";
  farmName: string;
  initialMaterial?: MaterialDetail | null;
  categories: CategoryReference[];
  units: UnitReference[];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (
    data: CreateMaterialInput | UpdateMaterialInput,
  ) => void | Promise<void>;
  onCancel: () => void;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

function describedBy(...ids: Array<string | undefined>) {
  const present = ids.filter((id): id is string => Boolean(id));
  return present.length > 0 ? present.join(" ") : undefined;
}

export function MaterialForm({
  mode,
  farmName,
  initialMaterial,
  categories,
  units,
  isSubmitting = false,
  errorMessage = null,
  onSubmit,
  onCancel,
}: MaterialFormProps) {
  const isEdit = mode === "edit";
  const initialValues = getMaterialFormInitialValues(
    initialMaterial,
    categories,
    units,
  );

  // Form states initialized from initialMaterial if available
  const [code, setCode] = useState(initialValues.code);
  const [name, setName] = useState(initialValues.name);
  const [categoryId, setCategoryId] = useState(initialValues.categoryId);
  const [unitId, setUnitId] = useState(initialValues.unitId);
  const [kind, setKind] = useState<MaterialKind>(initialValues.kind);
  const [trackingMode, setTrackingMode] = useState<MaterialTrackingMode>(
    initialValues.trackingMode,
  );
  const [minStockLevel, setMinStockLevel] = useState(
    initialValues.minStockLevel,
  );
  const [barcode, setBarcode] = useState(initialValues.barcode);
  const [description, setDescription] = useState(initialValues.description);
  const [imageUrl, setImageUrl] = useState(initialValues.imageUrl);
  const [sourceUrl, setSourceUrl] = useState(initialValues.sourceUrl);
  const [status, setStatus] = useState<RecordStatus>(initialValues.status);
  const [requiresExpiryTracking, setRequiresExpiryTracking] = useState(
    initialValues.requiresExpiryTracking,
  );
  const [expiryWarningDays, setExpiryWarningDays] = useState(
    initialValues.expiryWarningDays,
  );
  const [defaultShelfLifeDays, setDefaultShelfLifeDays] = useState(
    initialValues.defaultShelfLifeDays,
  );
  const [storageInstructions, setStorageInstructions] = useState(
    initialValues.storageInstructions,
  );
  const [safetyNotes, setSafetyNotes] = useState(initialValues.safetyNotes);

  // Validation feedback state
  const [clientErrors, setClientErrors] = useState<MaterialFormErrors>({});
  const [hasChanged, setHasChanged] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const formValues: MaterialFormValues = {
    code,
    name,
    categoryId,
    unitId,
    kind,
    trackingMode,
    minStockLevel,
    barcode,
    description,
    imageUrl,
    sourceUrl,
    status,
    requiresExpiryTracking,
    expiryWarningDays,
    defaultShelfLifeDays,
    storageInstructions,
    safetyNotes,
  };

  const formContext = {
    mode,
    initialMaterial,
    categories,
    units,
  };
  const referenceWarnings = getMaterialReferenceWarnings(
    formContext,
    formValues,
  );
  const categoryDescribedBy = describedBy(
    clientErrors.categoryId ? "material-category-error" : undefined,
    referenceWarnings.categoryId ? "material-category-warning" : undefined,
  );
  const unitDescribedBy = describedBy(
    clientErrors.unitId ? "material-unit-error" : undefined,
    referenceWarnings.unitId ? "material-unit-warning" : undefined,
  );

  const markChanged = () => {
    if (!hasChanged) setHasChanged(true);
  };

  const handleExpiryTrackingToggle = (checked: boolean) => {
    markChanged();
    setRequiresExpiryTracking(checked);
    if (checked && trackingMode !== "LOT") {
      setTrackingMode("LOT");
      setClientErrors((prev) => {
        const copy = { ...prev };
        delete copy.trackingMode;
        return copy;
      });
    }
  };

  const handleTrackingModeChange = (newMode: MaterialTrackingMode) => {
    if (requiresExpiryTracking && newMode !== "LOT") {
      setClientErrors((prev) => ({
        ...prev,
        trackingMode:
          'Khi bật "Theo dõi hạn sử dụng theo từng lô", phương thức theo dõi bắt buộc phải là "Theo lô (Lot)".',
      }));
      return;
    }
    markChanged();
    setClientErrors((prev) => {
      const copy = { ...prev };
      delete copy.trackingMode;
      return copy;
    });
    setTrackingMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validation = validateMaterialForm(formValues, formContext);
    setClientErrors(validation.errors);
    if (Object.keys(validation.errors).length > 0) return;

    const payload = buildMaterialPayload(formValues, formContext);
    if (!payload) {
      setClientErrors({
        form: "Chưa có thay đổi nào để lưu.",
      });
      return;
    }

    await onSubmit(payload);
  };

  const handleCancelClick = () => {
    if (hasChanged) {
      setConfirmCancelOpen(true);
      return;
    }
    onCancel();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Action Card */}
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {isEdit ? "Cập nhật vật tư" : "Thêm vật tư mới"}
                </h2>
                <Badge variant="secondary" className="font-semibold text-xs">
                  {farmName}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {isEdit
                  ? "Chỉnh sửa thông tin và hồ sơ quản lý vật tư trong nông trại."
                  : "Điền thông tin và hồ sơ quản lý để đăng ký vật tư mới cho nông trại."}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelClick}
                disabled={isSubmitting}
                className="h-9 gap-1.5 text-xs font-medium"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Hủy bỏ</span>
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Save className="size-3.5" aria-hidden="true" />
                <span>{isEdit ? "Lưu thay đổi" : "Tạo vật tư"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Global Server Error Banner */}
        {errorMessage && (
          <ErrorAlert
            title="Đã xảy ra lỗi khi lưu vật tư:"
            message={errorMessage}
          />
        )}

        {clientErrors.form && (
          <ErrorAlert
            title="Không thể lưu biểu mẫu:"
            message={clientErrors.form}
          />
        )}

        {/* Form Body - Two Grouped Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Basic Information Section */}
          <Card className="rounded-xl border border-border bg-card shadow-2xs">
            <CardHeader className="border-b border-border bg-muted/20 px-5 py-4">
              <div className="flex items-center gap-2">
                <Boxes className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Thông tin cơ bản
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Các trường đánh dấu <span className="text-destructive font-bold">*</span> là bắt buộc.
              </p>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Code & Barcode */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="material-code"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Mã vật tư <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="material-code"
                    type="text"
                    value={code}
                    onChange={(e) => {
                      markChanged();
                      setCode(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.code)}
                    aria-describedby={
                      clientErrors.code ? "material-code-error" : undefined
                    }
                    placeholder="Ví dụ: VT-001"
                    maxLength={50}
                    className="h-9 font-mono text-xs"
                  />
                  <FieldError
                    id="material-code-error"
                    message={clientErrors.code}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="material-barcode"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Mã vạch (Barcode)
                  </label>
                  <Input
                    id="material-barcode"
                    type="text"
                    value={barcode}
                    onChange={(e) => {
                      markChanged();
                      setBarcode(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.barcode)}
                    aria-describedby={
                      clientErrors.barcode ? "material-barcode-error" : undefined
                    }
                    placeholder="Ví dụ: 8931234567890"
                    maxLength={255}
                    className="h-9 font-mono text-xs"
                  />
                  <FieldError
                    id="material-barcode-error"
                    message={clientErrors.barcode}
                  />
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="material-name"
                  className="block text-xs font-semibold text-foreground"
                >
                  Tên vật tư <span className="text-destructive">*</span>
                </label>
                <Input
                  id="material-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    markChanged();
                    setName(e.target.value);
                  }}
                  hasError={Boolean(clientErrors.name)}
                  aria-describedby={
                    clientErrors.name ? "material-name-error" : undefined
                  }
                  placeholder="Ví dụ: Đường mía tinh luyện cho ong ăn vụ đông"
                  maxLength={255}
                  className="h-9 text-xs"
                />
                <FieldError
                  id="material-name-error"
                  message={clientErrors.name}
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="material-category"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Danh mục <span className="text-destructive">*</span>
                  </label>
                  <Select
                    id="material-category"
                    className="h-9 text-xs font-medium"
                    value={categoryId}
                    onChange={(e) => {
                      markChanged();
                      setCategoryId(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.categoryId)}
                    aria-describedby={categoryDescribedBy}
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.code})
                        {cat.status === "INACTIVE" ? " — Không hoạt động" : ""}
                      </option>
                    ))}
                  </Select>
                  <FieldError
                    id="material-category-error"
                    message={clientErrors.categoryId}
                  />
                  {referenceWarnings.categoryId && (
                    <p
                      id="material-category-warning"
                      role="status"
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      {referenceWarnings.categoryId}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="material-unit"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Đơn vị tính <span className="text-destructive">*</span>
                  </label>
                  <Select
                    id="material-unit"
                    className="h-9 text-xs font-medium"
                    value={unitId}
                    onChange={(e) => {
                      markChanged();
                      setUnitId(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.unitId)}
                    aria-describedby={unitDescribedBy}
                  >
                    <option value="">Chọn đơn vị tính</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.symbol ? `(${u.symbol})` : ""}
                        {u.status === "INACTIVE" ? " — Không hoạt động" : ""}
                      </option>
                    ))}
                  </Select>
                  <FieldError
                    id="material-unit-error"
                    message={clientErrors.unitId}
                  />
                  {referenceWarnings.unitId && (
                    <p
                      id="material-unit-warning"
                      role="status"
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      {referenceWarnings.unitId}
                    </p>
                  )}
                </div>
              </div>

              {/* Kind & Tracking Mode */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="material-kind"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Phân loại vật tư <span className="text-destructive">*</span>
                  </label>
                  <Select
                    id="material-kind"
                    className="h-9 text-xs font-medium"
                    value={kind}
                    onChange={(e) => {
                      markChanged();
                      setKind(e.target.value as MaterialKind);
                    }}
                    hasError={Boolean(clientErrors.kind)}
                    aria-describedby={
                      clientErrors.kind ? "material-kind-error" : undefined
                    }
                  >
                    {(Object.keys(MATERIAL_KIND_LABELS) as MaterialKind[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {MATERIAL_KIND_LABELS[k]}
                        </option>
                      ),
                    )}
                  </Select>
                  <FieldError
                    id="material-kind-error"
                    message={clientErrors.kind}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="material-tracking-mode"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Phương thức theo dõi{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <Select
                    id="material-tracking-mode"
                    className="h-9 text-xs font-medium"
                    value={trackingMode}
                    onChange={(e) =>
                      handleTrackingModeChange(
                        e.target.value as MaterialTrackingMode,
                      )
                    }
                    hasError={Boolean(clientErrors.trackingMode)}
                    aria-describedby={
                      clientErrors.trackingMode
                        ? "material-tracking-mode-error"
                        : undefined
                    }
                  >
                    {(
                      Object.keys(
                        MATERIAL_TRACKING_MODE_LABELS,
                      ) as MaterialTrackingMode[]
                    ).map((m) => (
                      <option key={m} value={m}>
                        {MATERIAL_TRACKING_MODE_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                  <FieldError
                    id="material-tracking-mode-error"
                    message={clientErrors.trackingMode}
                  />
                </div>
              </div>

              {/* Min Stock Level & Status (if edit) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="material-min-stock"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Ngưỡng tồn tối thiểu
                  </label>
                  <Input
                    id="material-min-stock"
                    type="text"
                    value={minStockLevel}
                    onChange={(e) => {
                      markChanged();
                      setMinStockLevel(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.minStockLevel)}
                    aria-describedby={
                      clientErrors.minStockLevel
                        ? "material-min-stock-error"
                        : undefined
                    }
                    placeholder="0"
                    className="h-9 text-xs tabular-nums"
                  />
                  <FieldError
                    id="material-min-stock-error"
                    message={clientErrors.minStockLevel}
                  />
                </div>

                {isEdit && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="material-status"
                      className="block text-xs font-semibold text-foreground"
                    >
                      Trạng thái hoạt động
                    </label>
                    <Select
                      id="material-status"
                      className="h-9 text-xs font-medium"
                      value={status}
                      onChange={(e) => {
                        markChanged();
                        setStatus(e.target.value as RecordStatus);
                      }}
                      hasError={Boolean(clientErrors.status)}
                      aria-describedby={
                        clientErrors.status ? "material-status-error" : undefined
                      }
                    >
                      {(Object.keys(RECORD_STATUS_LABELS) as RecordStatus[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {RECORD_STATUS_LABELS[s]}
                          </option>
                        ),
                      )}
                    </Select>
                    <FieldError
                      id="material-status-error"
                      message={clientErrors.status}
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label
                  htmlFor="material-description"
                  className="block text-xs font-semibold text-foreground"
                >
                  Mô tả chi tiết
                </label>
                <Textarea
                  id="material-description"
                  rows={3}
                  value={description}
                  onChange={(e) => {
                    markChanged();
                    setDescription(e.target.value);
                  }}
                  hasError={Boolean(clientErrors.description)}
                  aria-describedby={
                    clientErrors.description
                      ? "material-description-error"
                      : undefined
                  }
                  placeholder="Ghi chú về nguồn gốc, quy cách đóng bao bì..."
                  maxLength={4000}
                  className="text-xs"
                />
                <FieldError
                  id="material-description-error"
                  message={clientErrors.description}
                />
              </div>

              {/* Image & Source URLs */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="material-image-url"
                    className="block text-xs font-semibold text-foreground"
                  >
                    URL Hình ảnh
                  </label>
                  <Input
                    id="material-image-url"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => {
                      markChanged();
                      setImageUrl(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.imageUrl)}
                    aria-describedby={
                      clientErrors.imageUrl
                        ? "material-image-url-error"
                        : undefined
                    }
                    placeholder="https://..."
                    maxLength={2000}
                    className="h-9 text-xs font-mono"
                  />
                  <FieldError
                    id="material-image-url-error"
                    message={clientErrors.imageUrl}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="material-source-url"
                    className="block text-xs font-semibold text-foreground"
                  >
                    URL Nguồn / Tài liệu
                  </label>
                  <Input
                    id="material-source-url"
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => {
                      markChanged();
                      setSourceUrl(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.sourceUrl)}
                    aria-describedby={
                      clientErrors.sourceUrl
                        ? "material-source-url-error"
                        : undefined
                    }
                    placeholder="https://..."
                    maxLength={2000}
                    className="h-9 text-xs font-mono"
                  />
                  <FieldError
                    id="material-source-url-error"
                    message={clientErrors.sourceUrl}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile & Expiry Section */}
          <Card className="rounded-xl border border-border bg-card shadow-2xs">
            <CardHeader className="border-b border-border bg-muted/20 px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Hồ sơ quản lý & Hạn sử dụng
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Quy định về bảo quản an toàn và theo dõi hạn sử dụng theo từng lô.
              </p>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Expiry Tracking Toggle Card */}
              <div
                className={`rounded-xl border p-4 transition-colors ${
                  requiresExpiryTracking
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresExpiryTracking}
                    onChange={(e) => handleExpiryTrackingToggle(e.target.checked)}
                    aria-describedby="material-expiry-tracking-help"
                    className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-foreground">
                      Theo dõi hạn sử dụng theo từng lô
                    </span>
                    <p
                      id="material-expiry-tracking-help"
                      className="mt-1 text-xs text-muted-foreground leading-relaxed"
                    >
                      Khi bật, hệ thống sẽ yêu cầu nhập ngày hết hạn khi lập phiếu nhập kho và tự động cố định phương thức &quot;Theo lô (Lot)&quot;.
                    </p>
                  </div>
                </label>
              </div>

              {/* Expiry Warning & Shelf Life */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="material-expiry-warning"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Cảnh báo trước hạn (ngày)
                  </label>
                  <Input
                    id="material-expiry-warning"
                    type="number"
                    min={1}
                    max={3650}
                    value={expiryWarningDays}
                    onChange={(e) => {
                      markChanged();
                      setExpiryWarningDays(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.expiryWarningDays)}
                    aria-describedby={
                      clientErrors.expiryWarningDays
                        ? "material-expiry-warning-error"
                        : "material-expiry-warning-help"
                    }
                    className="h-9 text-xs tabular-nums"
                  />
                  <FieldError
                    id="material-expiry-warning-error"
                    message={clientErrors.expiryWarningDays}
                  />
                  <p
                    id="material-expiry-warning-help"
                    className="text-[0.6875rem] text-muted-foreground"
                  >
                    Số ngày báo trước khi lô sắp hết hạn (mặc định 30 ngày)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="material-shelf-life"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Hạn sử dụng tiêu chuẩn (ngày)
                  </label>
                  <Input
                    id="material-shelf-life"
                    type="number"
                    min={1}
                    max={36500}
                    value={defaultShelfLifeDays}
                    onChange={(e) => {
                      markChanged();
                      setDefaultShelfLifeDays(e.target.value);
                    }}
                    hasError={Boolean(clientErrors.defaultShelfLifeDays)}
                    aria-describedby={
                      clientErrors.defaultShelfLifeDays
                        ? "material-shelf-life-error"
                        : undefined
                    }
                    placeholder="Để trống nếu không cố định"
                    className="h-9 text-xs tabular-nums"
                  />
                  <FieldError
                    id="material-shelf-life-error"
                    message={clientErrors.defaultShelfLifeDays}
                  />
                  <p className="text-[0.6875rem] text-muted-foreground">
                    Số ngày sử dụng tính từ ngày sản xuất
                  </p>
                </div>
              </div>

              {/* Storage Instructions */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <label
                    htmlFor="material-storage"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Hướng dẫn bảo quản
                  </label>
                </div>
                <Textarea
                  id="material-storage"
                  rows={3}
                  value={storageInstructions}
                  onChange={(e) => {
                    markChanged();
                    setStorageInstructions(e.target.value);
                  }}
                  hasError={Boolean(clientErrors.storageInstructions)}
                  aria-describedby={
                    clientErrors.storageInstructions
                      ? "material-storage-error"
                      : undefined
                  }
                  placeholder="Ví dụ: Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp, nhiệt độ dưới 25°C..."
                  maxLength={4000}
                  className="text-xs"
                />
                <FieldError
                  id="material-storage-error"
                  message={clientErrors.storageInstructions}
                />
              </div>

              {/* Safety Notes */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <label
                    htmlFor="material-safety"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Lưu ý an toàn & Cảnh báo
                  </label>
                </div>
                <Textarea
                  id="material-safety"
                  rows={3}
                  value={safetyNotes}
                  onChange={(e) => {
                    markChanged();
                    setSafetyNotes(e.target.value);
                  }}
                  hasError={Boolean(clientErrors.safetyNotes)}
                  aria-describedby={
                    clientErrors.safetyNotes ? "material-safety-error" : undefined
                  }
                  placeholder="Ví dụ: Đeo găng tay và khẩu trang khi pha chế thuốc điều trị ve mạt..."
                  maxLength={4000}
                  className="text-xs"
                />
                <FieldError
                  id="material-safety-error"
                  message={clientErrors.safetyNotes}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Actions Sticky / Anchored */}
        <div className="flex items-center justify-end gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelClick}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-medium"
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            className="h-9 px-5 gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Save className="size-3.5" aria-hidden="true" />
            <span>{isEdit ? "Lưu thay đổi" : "Tạo vật tư"}</span>
          </Button>
        </div>
      </form>

      {/* Accessible Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Hủy bỏ thay đổi"
        description="Bạn có thay đổi chưa được lưu. Mọi thông tin vừa chỉnh sửa sẽ bị mất nếu bạn rời khỏi biểu mẫu."
        confirmLabel="Rời khỏi biểu mẫu"
        cancelLabel="Tiếp tục chỉnh sửa"
        variant="destructive"
        onConfirm={() => {
          setConfirmCancelOpen(false);
          onCancel();
        }}
      />
    </>
  );
}
