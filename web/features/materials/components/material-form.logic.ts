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

const MATERIAL_KINDS: MaterialKind[] = [
  "FEED",
  "TREATMENT",
  "PACKAGING",
  "MAINTENANCE_SUPPLY",
  "CONSUMABLE",
  "OTHER",
];

const MATERIAL_TRACKING_MODES: MaterialTrackingMode[] = ["QUANTITY", "LOT"];

const RECORD_STATUSES: RecordStatus[] = ["ACTIVE", "INACTIVE"];

export type MaterialFormValues = {
  code: string;
  name: string;
  categoryId: string;
  unitId: string;
  kind: MaterialKind;
  trackingMode: MaterialTrackingMode;
  minStockLevel: string;
  barcode: string;
  description: string;
  imageUrl: string;
  sourceUrl: string;
  status: RecordStatus;
  requiresExpiryTracking: boolean;
  expiryWarningDays: string;
  defaultShelfLifeDays: string;
  storageInstructions: string;
  safetyNotes: string;
};

export type MaterialFormErrorField =
  | "form"
  | "code"
  | "name"
  | "categoryId"
  | "unitId"
  | "kind"
  | "trackingMode"
  | "minStockLevel"
  | "barcode"
  | "description"
  | "imageUrl"
  | "sourceUrl"
  | "status"
  | "expiryWarningDays"
  | "defaultShelfLifeDays"
  | "storageInstructions"
  | "safetyNotes";

export type MaterialFormErrors = Partial<
  Record<MaterialFormErrorField, string>
>;

export type MaterialFormWarnings = Partial<
  Record<"categoryId" | "unitId", string>
>;

export interface MaterialFormContext {
  mode: "create" | "edit";
  initialMaterial?: MaterialDetail | null;
  categories: CategoryReference[];
  units: UnitReference[];
}

export interface MaterialFormValidation {
  errors: MaterialFormErrors;
  warnings: MaterialFormWarnings;
}

const DECIMAL_PATTERN = /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/;
const INTEGER_PATTERN = /^\d+$/;

const nullableText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed || null;
};

const integerValue = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed || !INTEGER_PATTERN.test(trimmed)) return undefined;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const validUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
};

export function getMaterialFormInitialValues(
  initialMaterial: MaterialDetail | null | undefined,
  categories: CategoryReference[],
  units: UnitReference[],
): MaterialFormValues {
  const item = initialMaterial?.item;
  const profile = initialMaterial?.profile;

  return {
    code: item?.code ?? "",
    name: item?.name ?? "",
    categoryId:
      item?.categoryId ??
      categories.find((category) => category.status === "ACTIVE")?.id ??
      "",
    unitId:
      item?.unitId ?? units.find((unit) => unit.status === "ACTIVE")?.id ?? "",
    kind: profile?.kind ?? "CONSUMABLE",
    trackingMode: item?.trackingMode ?? "QUANTITY",
    minStockLevel: item?.minStockLevel ?? "0",
    barcode: item?.barcode ?? "",
    description: item?.description ?? "",
    imageUrl: item?.imageUrl ?? "",
    sourceUrl: item?.sourceUrl ?? "",
    status: item?.status ?? "ACTIVE",
    requiresExpiryTracking: profile?.requiresExpiryTracking ?? false,
    expiryWarningDays: String(profile?.expiryWarningDays ?? 30),
    defaultShelfLifeDays:
      profile?.defaultShelfLifeDays == null
        ? ""
        : String(profile.defaultShelfLifeDays),
    storageInstructions: profile?.storageInstructions ?? "",
    safetyNotes: profile?.safetyNotes ?? "",
  };
}

export function getMaterialReferenceWarnings(
  context: MaterialFormContext,
  values: Pick<MaterialFormValues, "categoryId" | "unitId">,
): MaterialFormWarnings {
  if (context.mode !== "edit" || !context.initialMaterial) return {};

  const warnings: MaterialFormWarnings = {};
  const currentItem = context.initialMaterial.item;
  const category = context.categories.find(
    (reference) => reference.id === values.categoryId,
  );
  const unit = context.units.find(
    (reference) => reference.id === values.unitId,
  );

  if (
    values.categoryId === currentItem.categoryId &&
    category?.status === "INACTIVE"
  ) {
    warnings.categoryId =
      "Danh mục hiện tại đã ngừng hoạt động; được giữ nguyên vì vật tư đang tham chiếu danh mục này.";
  }

  if (values.unitId === currentItem.unitId && unit?.status === "INACTIVE") {
    warnings.unitId =
      "Đơn vị hiện tại đã ngừng hoạt động; được giữ nguyên vì vật tư đang tham chiếu đơn vị này.";
  }

  return warnings;
}

export function validateMaterialForm(
  values: MaterialFormValues,
  context: MaterialFormContext,
): MaterialFormValidation {
  const errors: MaterialFormErrors = {};
  const warnings = getMaterialReferenceWarnings(context, values);
  const initialItem = context.initialMaterial?.item;
  const isEdit = context.mode === "edit" && Boolean(initialItem);
  const categoryChanged =
    !isEdit || values.categoryId !== initialItem?.categoryId;
  const unitChanged = !isEdit || values.unitId !== initialItem?.unitId;
  const referencesChanged = categoryChanged || unitChanged;

  const code = values.code.trim();
  if (!code) errors.code = "Mã vật tư là bắt buộc";
  else if (code.length > 50)
    errors.code = "Mã vật tư không được vượt quá 50 ký tự";

  const name = values.name.trim();
  if (!name) errors.name = "Tên vật tư là bắt buộc";
  else if (name.length > 255)
    errors.name = "Tên vật tư không được vượt quá 255 ký tự";

  const category = context.categories.find(
    (reference) => reference.id === values.categoryId,
  );
  if (!values.categoryId) {
    errors.categoryId = context.categories.some(
      (reference) => reference.status === "ACTIVE",
    )
      ? "Vui lòng chọn danh mục"
      : "Chưa có danh mục đang hoạt động; cần quản trị viên bổ sung.";
  } else if (!category) {
    errors.categoryId = "Danh mục không tồn tại hoặc chưa tải được";
  } else if (referencesChanged && category.status !== "ACTIVE") {
    errors.categoryId =
      "Danh mục được chọn phải đang hoạt động. Hãy chọn danh mục khác.";
  }

  const unit = context.units.find(
    (reference) => reference.id === values.unitId,
  );
  if (!values.unitId) {
    errors.unitId = context.units.some(
      (reference) => reference.status === "ACTIVE",
    )
      ? "Vui lòng chọn đơn vị tính"
      : "Chưa có đơn vị đang hoạt động; cần quản trị viên bổ sung.";
  } else if (!unit) {
    errors.unitId = "Đơn vị tính không tồn tại hoặc chưa tải được";
  } else if (referencesChanged && unit.status !== "ACTIVE") {
    errors.unitId =
      "Đơn vị được chọn phải đang hoạt động. Hãy chọn đơn vị khác.";
  }

  if (!MATERIAL_KINDS.includes(values.kind)) {
    errors.kind = "Phân loại vật tư không hợp lệ";
  }

  if (!MATERIAL_TRACKING_MODES.includes(values.trackingMode)) {
    errors.trackingMode = "Phương thức theo dõi không hợp lệ";
  } else if (values.requiresExpiryTracking && values.trackingMode !== "LOT") {
    errors.trackingMode =
      "Khi bật theo dõi hạn sử dụng, phương thức theo dõi bắt buộc phải là Theo lô (LOT)";
  }

  const minStockLevel = values.minStockLevel.trim();
  if (minStockLevel && !DECIMAL_PATTERN.test(minStockLevel)) {
    errors.minStockLevel =
      "Ngưỡng tồn phải là số không âm (tối đa 15 chữ số phần nguyên và 3 số thập phân)";
  }

  const barcode = values.barcode.trim();
  if (barcode.length > 255) {
    errors.barcode = "Mã vạch không được vượt quá 255 ký tự";
  }

  const description = values.description.trim();
  if (description.length > 4000) {
    errors.description = "Mô tả không được vượt quá 4.000 ký tự";
  }

  for (const [field, value, label] of [
    ["imageUrl", values.imageUrl, "URL ảnh"],
    ["sourceUrl", values.sourceUrl, "URL nguồn"],
  ] as const) {
    const trimmed = value.trim();
    if (trimmed.length > 2000) {
      errors[field] = `${label} không được vượt quá 2.000 ký tự`;
    } else if (trimmed && !validUrl(trimmed)) {
      errors[field] = `${label} phải là URL http:// hoặc https:// hợp lệ`;
    }
  }

  if (isEdit && !RECORD_STATUSES.includes(values.status)) {
    errors.status = "Trạng thái vật tư không hợp lệ";
  }

  const expiryWarningDays = values.expiryWarningDays.trim();
  if (!expiryWarningDays && isEdit && context.initialMaterial?.profile) {
    errors.expiryWarningDays =
      "Hãy nhập số ngày cảnh báo từ 1 đến 3.650 hoặc giữ nguyên giá trị hiện tại";
  } else if (expiryWarningDays) {
    const parsed = integerValue(expiryWarningDays);
    if (parsed === undefined || parsed < 1 || parsed > 3650) {
      errors.expiryWarningDays =
        "Số ngày cảnh báo phải là số nguyên từ 1 đến 3.650";
    }
  }

  const defaultShelfLifeDays = values.defaultShelfLifeDays.trim();
  if (defaultShelfLifeDays) {
    const parsed = integerValue(defaultShelfLifeDays);
    if (parsed === undefined || parsed < 1 || parsed > 36500) {
      errors.defaultShelfLifeDays =
        "Hạn sử dụng tiêu chuẩn phải là số nguyên từ 1 đến 36.500";
    }
  }

  if (values.storageInstructions.trim().length > 4000) {
    errors.storageInstructions =
      "Hướng dẫn bảo quản không được vượt quá 4.000 ký tự";
  }

  if (values.safetyNotes.trim().length > 4000) {
    errors.safetyNotes = "Lưu ý an toàn không được vượt quá 4.000 ký tự";
  }

  return { errors, warnings };
}

function normalizeValues(values: MaterialFormValues) {
  return {
    code: values.code.trim().toUpperCase(),

    name: values.name.trim(),
    categoryId: values.categoryId,
    unitId: values.unitId,
    kind: values.kind,
    trackingMode: values.trackingMode,
    minStockLevel: values.minStockLevel.trim() || "0",
    barcode: values.barcode.trim(),
    description: values.description.trim(),
    imageUrl: values.imageUrl.trim(),
    sourceUrl: values.sourceUrl.trim(),
    status: values.status,
    requiresExpiryTracking: values.requiresExpiryTracking,
    expiryWarningDays: integerValue(values.expiryWarningDays),
    defaultShelfLifeDays: integerValue(values.defaultShelfLifeDays) ?? null,
    storageInstructions: values.storageInstructions.trim(),
    safetyNotes: values.safetyNotes.trim(),
  };
}

export function buildMaterialPayload(
  values: MaterialFormValues,
  context: MaterialFormContext,
): CreateMaterialInput | UpdateMaterialInput | null {
  const normalized = normalizeValues(values);

  if (context.mode === "create") {
    const payload: CreateMaterialInput = {
      categoryId: normalized.categoryId,
      unitId: normalized.unitId,
      code: normalized.code,
      name: normalized.name,
      trackingMode: normalized.trackingMode,
      kind: normalized.kind,
      minStockLevel: normalized.minStockLevel,
    };

    if (normalized.barcode) payload.barcode = normalized.barcode;
    if (normalized.description) payload.description = normalized.description;
    if (normalized.imageUrl) payload.imageUrl = normalized.imageUrl;
    if (normalized.sourceUrl) payload.sourceUrl = normalized.sourceUrl;
    if (normalized.requiresExpiryTracking)
      payload.requiresExpiryTracking = true;
    if (normalized.expiryWarningDays !== undefined)
      payload.expiryWarningDays = normalized.expiryWarningDays;
    if (normalized.defaultShelfLifeDays !== null)
      payload.defaultShelfLifeDays = normalized.defaultShelfLifeDays;
    if (normalized.storageInstructions)
      payload.storageInstructions = normalized.storageInstructions;
    if (normalized.safetyNotes) payload.safetyNotes = normalized.safetyNotes;

    return payload;
  }

  const material = context.initialMaterial;
  if (!material) return null;

  const initial = normalizeValues(
    getMaterialFormInitialValues(material, [], []),
  );
  const payload: UpdateMaterialInput = {};

  if (normalized.categoryId !== initial.categoryId)
    payload.categoryId = normalized.categoryId;
  if (normalized.unitId !== initial.unitId) payload.unitId = normalized.unitId;
  if (normalized.code !== initial.code) payload.code = normalized.code;
  if (normalized.name !== initial.name) payload.name = normalized.name;
  if (
    nullableText(normalized.description) !== nullableText(initial.description)
  )
    payload.description = nullableText(normalized.description);
  if (normalized.trackingMode !== initial.trackingMode)
    payload.trackingMode = normalized.trackingMode;
  if (normalized.minStockLevel !== initial.minStockLevel)
    payload.minStockLevel = normalized.minStockLevel;
  if (nullableText(normalized.barcode) !== nullableText(initial.barcode))
    payload.barcode = nullableText(normalized.barcode);
  if (nullableText(normalized.imageUrl) !== nullableText(initial.imageUrl))
    payload.imageUrl = nullableText(normalized.imageUrl);
  if (nullableText(normalized.sourceUrl) !== nullableText(initial.sourceUrl))
    payload.sourceUrl = nullableText(normalized.sourceUrl);
  if (normalized.status !== initial.status) payload.status = normalized.status;
  if (normalized.kind !== initial.kind) payload.kind = normalized.kind;
  if (normalized.requiresExpiryTracking !== initial.requiresExpiryTracking) {
    payload.requiresExpiryTracking = normalized.requiresExpiryTracking;
  }
  if (
    normalized.expiryWarningDays !== undefined &&
    normalized.expiryWarningDays !== initial.expiryWarningDays
  ) {
    payload.expiryWarningDays = normalized.expiryWarningDays;
  }
  if (normalized.defaultShelfLifeDays !== initial.defaultShelfLifeDays) {
    payload.defaultShelfLifeDays = normalized.defaultShelfLifeDays;
  }
  if (
    nullableText(normalized.storageInstructions) !==
    nullableText(initial.storageInstructions)
  ) {
    payload.storageInstructions = nullableText(normalized.storageInstructions);
  }
  if (
    nullableText(normalized.safetyNotes) !== nullableText(initial.safetyNotes)
  ) {
    payload.safetyNotes = nullableText(normalized.safetyNotes);
  }

  return Object.keys(payload).length > 0 ? payload : null;
}
