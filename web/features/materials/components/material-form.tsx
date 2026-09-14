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
    <p id={id} role="alert" className="mt-1 text-xs text-destructive">
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

  // Profile fields
  const [requiresExpiryTracking, setRequiresExpiryTracking] = useState<boolean>(
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
    if (!checked) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next.trackingMode;
        return next;
      });
    }
  };

  const handleTrackingModeChange = (newMode: MaterialTrackingMode) => {
    if (newMode === "QUANTITY" && requiresExpiryTracking) {
      setClientErrors((prev) => ({
        ...prev,
        trackingMode:
          "Không thể chọn theo số lượng khi đang bật theo dõi hạn sử dụng",
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

    // useMaterials quản lý trạng thái lưu và chặn request trùng.
    await onSubmit(payload);
  };

  const handleCancel = () => {
    if (hasChanged) {
      const confirmed = window.confirm(
        "Bạn có thay đổi chưa được lưu. Bạn có chắc chắn muốn hủy bỏ?",
      );
      if (!confirmed) return;
    }
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {isEdit ? "Cập nhật vật tư" : "Thêm vật tư mới"}
            </h2>
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-0.5 text-xs font-medium text-secondary-foreground">
              {farmName}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {isEdit
              ? "Chỉnh sửa thông tin vật tư trong nông trại hiện tại."
              : "Điền thông tin và hồ sơ quản lý để đăng ký vật tư mới cho nông trại."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="rounded-xl border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:ring-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>{isEdit ? "Lưu thay đổi" : "Tạo vật tư"}</span>
            )}
          </button>
        </div>
      </div>

      {/* Global Server Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-semibold">Đã xảy ra lỗi khi lưu vật tư:</p>
          <p className="mt-0.5">{errorMessage}</p>
        </div>
      )}

      {clientErrors.form && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <FieldError id="material-form-error" message={clientErrors.form} />
        </div>
      )}

      {/* Form Body - Two Logical Groups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Basic Information Section */}
        <fieldset className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <legend className="px-2 text-base font-semibold text-foreground">
            Thông tin cơ bản
          </legend>
          <p className="mb-4 text-xs text-muted-foreground">
            Các trường đánh dấu{" "}
            <span className="text-destructive font-bold">*</span> là bắt buộc.
          </p>

          <div className="space-y-4">
            {/* Code & Barcode */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="material-code"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Mã vật tư <span className="text-destructive">*</span>
                </label>
                <input
                  id="material-code"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    markChanged();
                    setCode(e.target.value);
                  }}
                  aria-invalid={clientErrors.code ? true : undefined}
                  aria-describedby={
                    clientErrors.code ? "material-code-error" : undefined
                  }
                  placeholder="VD: VT-001"
                  maxLength={50}
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
                />
                <FieldError
                  id="material-code-error"
                  message={clientErrors.code}
                />
              </div>

              <div>
                <label
                  htmlFor="material-barcode"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Mã vạch (Barcode)
                </label>
                <input
                  id="material-barcode"
                  type="text"
                  value={barcode}
                  onChange={(e) => {
                    markChanged();
                    setBarcode(e.target.value);
                  }}
                  aria-invalid={clientErrors.barcode ? true : undefined}
                  aria-describedby={
                    clientErrors.barcode ? "material-barcode-error" : undefined
                  }
                  placeholder="VD: 8931234567890"
                  maxLength={255}
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
                />
                <FieldError
                  id="material-barcode-error"
                  message={clientErrors.barcode}
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="material-name"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Tên vật tư <span className="text-destructive">*</span>
              </label>
              <input
                id="material-name"
                type="text"
                value={name}
                onChange={(e) => {
                  markChanged();
                  setName(e.target.value);
                }}
                aria-invalid={clientErrors.name ? true : undefined}
                aria-describedby={
                  clientErrors.name ? "material-name-error" : undefined
                }
                placeholder="VD: Đường mía tinh luyện cho ong ăn vụ đông"
                maxLength={255}
                className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
              />
              <FieldError
                id="material-name-error"
                message={clientErrors.name}
              />
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="material-category"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Danh mục <span className="text-destructive">*</span>
                </label>
                <select
                  id="material-category"
                  value={categoryId}
                  onChange={(e) => {
                    markChanged();
                    setCategoryId(e.target.value);
                  }}
                  aria-invalid={clientErrors.categoryId ? true : undefined}
                  aria-describedby={categoryDescribedBy}
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2"
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.code})
                      {cat.status === "INACTIVE" ? " — Không hoạt động" : ""}
                    </option>
                  ))}
                </select>
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

              <div>
                <label
                  htmlFor="material-unit"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Đơn vị tính <span className="text-destructive">*</span>
                </label>
                <select
                  id="material-unit"
                  value={unitId}
                  onChange={(e) => {
                    markChanged();
                    setUnitId(e.target.value);
                  }}
                  aria-invalid={clientErrors.unitId ? true : undefined}
                  aria-describedby={unitDescribedBy}
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2"
                >
                  <option value="">Chọn đơn vị tính</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.symbol ? `(${u.symbol})` : ""}
                      {u.status === "INACTIVE" ? " — Không hoạt động" : ""}
                    </option>
                  ))}
                </select>
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
              <div>
                <label
                  htmlFor="material-kind"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Phân loại vật tư <span className="text-destructive">*</span>
                </label>
                <select
                  id="material-kind"
                  value={kind}
                  onChange={(e) => {
                    markChanged();
                    setKind(e.target.value as MaterialKind);
                  }}
                  aria-invalid={clientErrors.kind ? true : undefined}
                  aria-describedby={
                    clientErrors.kind ? "material-kind-error" : undefined
                  }
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2"
                >
                  {(Object.keys(MATERIAL_KIND_LABELS) as MaterialKind[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {MATERIAL_KIND_LABELS[k]}
                      </option>
                    ),
                  )}
                </select>
                <FieldError
                  id="material-kind-error"
                  message={clientErrors.kind}
                />
              </div>

              <div>
                <label
                  htmlFor="material-tracking-mode"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Phương thức theo dõi{" "}
                  <span className="text-destructive">*</span>
                </label>
                <select
                  id="material-tracking-mode"
                  value={trackingMode}
                  onChange={(e) =>
                    handleTrackingModeChange(
                      e.target.value as MaterialTrackingMode,
                    )
                  }
                  aria-invalid={clientErrors.trackingMode ? true : undefined}
                  aria-describedby={
                    clientErrors.trackingMode
                      ? "material-tracking-mode-error"
                      : undefined
                  }
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2"
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
                </select>
                <FieldError
                  id="material-tracking-mode-error"
                  message={clientErrors.trackingMode}
                />
              </div>
            </div>

            {/* Min Stock Level & Status (if edit) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="material-min-stock"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Ngưỡng tồn tối thiểu
                </label>
                <input
                  id="material-min-stock"
                  type="text"
                  value={minStockLevel}
                  onChange={(e) => {
                    markChanged();
                    setMinStockLevel(e.target.value);
                  }}
                  aria-invalid={clientErrors.minStockLevel ? true : undefined}
                  aria-describedby={
                    clientErrors.minStockLevel
                      ? "material-min-stock-error"
                      : undefined
                  }
                  placeholder="0"
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
                />
                <FieldError
                  id="material-min-stock-error"
                  message={clientErrors.minStockLevel}
                />
              </div>

              {isEdit && (
                <div>
                  <label
                    htmlFor="material-status"
                    className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Trạng thái hoạt động
                  </label>
                  <select
                    id="material-status"
                    value={status}
                    onChange={(e) => {
                      markChanged();
                      setStatus(e.target.value as RecordStatus);
                    }}
                    aria-invalid={clientErrors.status ? true : undefined}
                    aria-describedby={
                      clientErrors.status ? "material-status-error" : undefined
                    }
                    className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2"
                  >
                    {(Object.keys(RECORD_STATUS_LABELS) as RecordStatus[]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {RECORD_STATUS_LABELS[s]}
                        </option>
                      ),
                    )}
                  </select>
                  <FieldError
                    id="material-status-error"
                    message={clientErrors.status}
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="material-description"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Mô tả chi tiết
              </label>
              <textarea
                id="material-description"
                rows={3}
                value={description}
                onChange={(e) => {
                  markChanged();
                  setDescription(e.target.value);
                }}
                aria-invalid={clientErrors.description ? true : undefined}
                aria-describedby={
                  clientErrors.description
                    ? "material-description-error"
                    : undefined
                }
                placeholder="Ghi chú về nguồn gốc, quy cách đóng bao bì..."
                maxLength={4000}
                className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
              />
              <FieldError
                id="material-description-error"
                message={clientErrors.description}
              />
            </div>

            {/* Image & Source URLs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="material-image-url"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  URL Hình ảnh
                </label>
                <input
                  id="material-image-url"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    markChanged();
                    setImageUrl(e.target.value);
                  }}
                  aria-invalid={clientErrors.imageUrl ? true : undefined}
                  aria-describedby={
                    clientErrors.imageUrl
                      ? "material-image-url-error"
                      : undefined
                  }
                  placeholder="https://..."
                  maxLength={2000}
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
                />
                <FieldError
                  id="material-image-url-error"
                  message={clientErrors.imageUrl}
                />
              </div>

              <div>
                <label
                  htmlFor="material-source-url"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  URL Nguồn / Tài liệu
                </label>
                <input
                  id="material-source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => {
                    markChanged();
                    setSourceUrl(e.target.value);
                  }}
                  aria-invalid={clientErrors.sourceUrl ? true : undefined}
                  aria-describedby={
                    clientErrors.sourceUrl
                      ? "material-source-url-error"
                      : undefined
                  }
                  placeholder="https://..."
                  maxLength={2000}
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
                />
                <FieldError
                  id="material-source-url-error"
                  message={clientErrors.sourceUrl}
                />
              </div>
            </div>
          </div>
        </fieldset>

        {/* Profile & Expiry Section */}
        <fieldset className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <legend className="px-2 text-base font-semibold text-foreground">
            Hồ sơ quản lý & Hạn sử dụng
          </legend>
          <p className="mb-4 text-xs text-muted-foreground">
            Quy định về bảo quản an toàn và theo dõi hạn sử dụng theo từng lô.
          </p>

          <div className="space-y-4">
            {/* Expiry Tracking Toggle Card */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresExpiryTracking}
                  onChange={(e) => handleExpiryTrackingToggle(e.target.checked)}
                  aria-describedby="material-expiry-tracking-help"
                  className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-semibold text-foreground">
                    Theo dõi hạn sử dụng theo từng lô
                  </span>
                  <p
                    id="material-expiry-tracking-help"
                    className="mt-0.5 text-xs text-muted-foreground"
                  >
                    Khi bật, hệ thống sẽ yêu cầu ngày hết hạn khi nhập kho và tự
                    động yêu cầu bạn chọn &quot;Theo lô (Lot)&quot;.
                  </p>
                </div>
              </label>
            </div>

            {/* Expiry Warning & Shelf Life */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="material-expiry-warning"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Cảnh báo trước hạn (ngày)
                </label>
                <input
                  id="material-expiry-warning"
                  type="number"
                  min={1}
                  max={3650}
                  value={expiryWarningDays}
                  onChange={(e) => {
                    markChanged();
                    setExpiryWarningDays(e.target.value);
                  }}
                  aria-invalid={
                    clientErrors.expiryWarningDays ? true : undefined
                  }
                  aria-describedby={
                    clientErrors.expiryWarningDays
                      ? "material-expiry-warning-error"
                      : "material-expiry-warning-help"
                  }
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground focus-visible:ring-2"
                />
                <FieldError
                  id="material-expiry-warning-error"
                  message={clientErrors.expiryWarningDays}
                />
                <p
                  id="material-expiry-warning-help"
                  className="mt-1 text-[0.7rem] text-muted-foreground"
                >
                  Số ngày báo trước khi lô vật tư sắp hết hạn (mặc định 30 ngày)
                </p>
              </div>

              <div>
                <label
                  htmlFor="material-shelf-life"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Hạn sử dụng tiêu chuẩn (ngày)
                </label>
                <input
                  id="material-shelf-life"
                  type="number"
                  min={1}
                  max={36500}
                  value={defaultShelfLifeDays}
                  onChange={(e) => {
                    markChanged();
                    setDefaultShelfLifeDays(e.target.value);
                  }}
                  aria-invalid={
                    clientErrors.defaultShelfLifeDays ? true : undefined
                  }
                  aria-describedby={
                    clientErrors.defaultShelfLifeDays
                      ? "material-shelf-life-error"
                      : undefined
                  }
                  placeholder="Để trống nếu không cố định"
                  className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
                />
                <FieldError
                  id="material-shelf-life-error"
                  message={clientErrors.defaultShelfLifeDays}
                />
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  Số ngày sử dụng từ lúc sản xuất
                </p>
              </div>
            </div>

            {/* Storage Instructions */}
            <div>
              <label
                htmlFor="material-storage"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Hướng dẫn bảo quản
              </label>
              <textarea
                id="material-storage"
                rows={3}
                value={storageInstructions}
                onChange={(e) => {
                  markChanged();
                  setStorageInstructions(e.target.value);
                }}
                aria-invalid={
                  clientErrors.storageInstructions ? true : undefined
                }
                aria-describedby={
                  clientErrors.storageInstructions
                    ? "material-storage-error"
                    : undefined
                }
                placeholder="VD: Bảo quản nơi khô ráo, tránh ánh nắng trực tiếp, nhiệt độ dưới 25°C..."
                maxLength={4000}
                className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
              />
              <FieldError
                id="material-storage-error"
                message={clientErrors.storageInstructions}
              />
            </div>

            {/* Safety Notes */}
            <div>
              <label
                htmlFor="material-safety"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Lưu ý an toàn & Cảnh báo
              </label>
              <textarea
                id="material-safety"
                rows={3}
                value={safetyNotes}
                onChange={(e) => {
                  markChanged();
                  setSafetyNotes(e.target.value);
                }}
                aria-invalid={clientErrors.safetyNotes ? true : undefined}
                aria-describedby={
                  clientErrors.safetyNotes ? "material-safety-error" : undefined
                }
                placeholder="VD: Đeo găng tay và khẩu trang khi pha chế thuốc điều trị ve mạt..."
                maxLength={4000}
                className="mt-1.5 block w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
              />
              <FieldError
                id="material-safety-error"
                message={clientErrors.safetyNotes}
              />
            </div>
          </div>
        </fieldset>
      </div>
    </form>
  );
}
