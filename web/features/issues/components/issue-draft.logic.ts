import type {
  CreateIssueInput,
  IssueDetail,
  IssueDraftTrackingMode,
  IssueLotSuggestion,
  IssueAssetReference,
} from "../types/issue";

export function validateIssueDraft(
  input: CreateIssueInput,
  trackingModes?: readonly IssueDraftTrackingMode[],
  linkedSale = false,
): string | null {
  if (!input.warehouseId) return "Vui lòng chọn kho xuất.";
  if (input.issueType === "SALE" && !linkedSale)
    return "Phiếu bán hàng chỉ được chỉnh sửa từ đơn hàng liên kết.";
  if (
    !["CONSUMPTION", "DAMAGE", "DISPOSAL", "OTHER", "MAINTENANCE"].includes(input.issueType) &&
    !(linkedSale && input.issueType === "SALE")
  )
    return "Loại phiếu chưa được hỗ trợ trong form này.";
  if (linkedSale !== (input.issueType === "SALE"))
    return "Phiếu bán hàng chỉ được chỉnh sửa từ đơn hàng liên kết.";
  if (input.issueType === "MAINTENANCE") {
    if (
      typeof input.maintenanceRecordId !== "string" ||
      !input.maintenanceRecordId.trim()
    )
      return "Vui lòng chọn hồ sơ bảo trì.";
  } else if (input.maintenanceRecordId != null) {
    return "Chỉ phiếu xuất bảo trì được liên kết hồ sơ bảo trì.";
  }
  if ((input.reason?.length ?? 0) > 4000 || (input.note?.length ?? 0) > 4000)
    return "Lý do và ghi chú không được quá 4.000 ký tự.";
  if (input.issueDate && !isValidIsoDate(input.issueDate))
    return "Ngày xuất không hợp lệ.";
  if (!input.items.length) return "Vui lòng thêm ít nhất một vật tư.";
  const modes = trackingModes ?? input.items.map(() => "QUANTITY" as const);
  if (modes.length !== input.items.length)
    return "Vui lòng tải lại danh sách vật tư trong phiếu.";
  const assetIds = new Set<string>();
  for (const [index, line] of input.items.entries()) {
    const mode = modes[index];
    if (!line.itemId) return `Dòng ${index + 1}: chưa chọn vật tư.`;
    if (mode !== "QUANTITY" && mode !== "LOT" && mode !== "ASSET")
      return `Dòng ${index + 1}: kiểu theo dõi chưa được hỗ trợ.`;
    if (
      typeof line.quantity !== "string" ||
      !/^(?=.*[1-9])(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/.test(line.quantity)
    )
      return `Dòng ${index + 1}: số lượng phải lớn hơn 0, tối đa 15 chữ số nguyên và 3 chữ số thập phân.`;
    if (mode === "LOT") {
      if (typeof line.lotId !== "string" || !line.lotId.trim())
        return `Dòng ${index + 1}: vui lòng chọn lô.`;
      if (line.assetId)
        return `Dòng ${index + 1}: vật tư theo lô không được có tài sản.`;
    } else if (mode === "ASSET") {
      if (input.issueType === "DAMAGE" || input.issueType === "MAINTENANCE")
        return `Dòng ${index + 1}: báo hỏng và bảo trì tài sản tại hồ sơ tài sản. Phiếu xuất loại này chỉ dùng vật tư theo số lượng hoặc lô.`;
      if (typeof line.assetId !== "string" || !line.assetId.trim())
        return `Dòng ${index + 1}: vui lòng chọn tài sản.`;
      if (line.lotId || !/^1(?:\.0{1,3})?$/.test(line.quantity))
        return `Dòng ${index + 1}: tài sản phải có số lượng 1 và không được có lô.`;
      if (assetIds.has(line.assetId))
        return `Dòng ${index + 1}: tài sản đã được chọn ở dòng khác.`;
      assetIds.add(line.assetId);
    } else if (line.lotId || line.assetId) {
      return `Dòng ${index + 1}: vật tư theo số lượng không được có lô hoặc tài sản.`;
    }
    if ((line.note?.length ?? 0) > 4000)
      return `Dòng ${index + 1}: ghi chú không được quá 4.000 ký tự.`;
  }
  return null;
}

export function supportsIssueDraftEdit(detail: IssueDetail): boolean {
  const assetIds = new Set<string>();
  const linkedSale = detail.issue.issueType === "SALE" && Boolean(detail.issue.orderId);
  return (
    detail.issue.status === "DRAFT" &&
    (detail.issue.issueType === "SALE" ? linkedSale : detail.issue.orderId == null) &&
    (detail.issue.issueType === "MAINTENANCE"
      ? Boolean(detail.issue.maintenanceRecordId?.trim())
      : detail.issue.maintenanceRecordId == null) &&
    detail.items.length > 0 &&
    detail.items.every((line) => {
      const noAsset =
        line.assetId == null &&
        line.assetCode == null &&
        line.serialNumber == null;
      if (line.trackingMode === "QUANTITY")
        return (
          noAsset &&
          line.lotId == null &&
          line.lotNumber == null &&
          line.lotExpiryDate == null
        );
      if (line.trackingMode === "LOT") return noAsset && (linkedSale || Boolean(line.lotId));
      if (
        line.trackingMode !== "ASSET" ||
        line.lotId != null ||
        line.lotNumber != null ||
        line.lotExpiryDate != null ||
        !/^1(?:\.0{1,3})?$/.test(line.quantity) ||
        (line.assetId != null && assetIds.has(line.assetId)) ||
        (!linkedSale && !line.assetId)
      )
        return false;
      if (line.assetId) assetIds.add(line.assetId);
      return true;
    })
  );
}

export function splitIssueQuantity(total: string, split: string): [string, string] | null {
  const totalUnits = issueQuantityUnits(total);
  const splitUnits = issueQuantityUnits(split);
  if (
    totalUnits === null ||
    splitUnits === null ||
    splitUnits <= BigInt(0) ||
    splitUnits >= totalUnits
  )
    return null;
  return [formatIssueQuantity(totalUnits - splitUnits), formatIssueQuantity(splitUnits)];
}

export function preservesIssueItemTotals(
  original: readonly { itemId: string; quantity: string }[],
  updated: readonly { itemId: string; quantity: string }[],
) {
  const totals = (lines: readonly { itemId: string; quantity: string }[]) => {
    const result = new Map<string, bigint>();
    for (const line of lines) {
      const quantity = issueQuantityUnits(line.quantity);
      if (!line.itemId || quantity === null) return null;
      result.set(line.itemId, (result.get(line.itemId) ?? BigInt(0)) + quantity);
    }
    return result;
  };
  const before = totals(original);
  const after = totals(updated);
  if (!before || !after || before.size !== after.size) return false;
  return [...before].every(([itemId, quantity]) => after.get(itemId) === quantity);
}

function issueQuantityUnits(value: string) {
  if (!/^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(1000) + BigInt(fraction.padEnd(3, "0"));
}

function formatIssueQuantity(units: bigint) {
  const scale = BigInt(1000);
  const whole = units / scale;
  const fraction = String(units % scale).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function isIssueAssetAvailable(
  reference: IssueAssetReference,
  farmId: string,
  warehouseId: string,
  itemId: string,
): boolean {
  return (
    reference.asset.farmId === farmId &&
    reference.asset.itemId === itemId &&
    reference.asset.status === "AVAILABLE" &&
    Boolean(reference.asset.currentLocationId) &&
    reference.locationWarehouseId === warehouseId
  );
}

export function selectableIssueLotSuggestions(
  suggestions: IssueLotSuggestion[],
  farmId: string,
  warehouseId: string,
  itemId: string,
  today = new Date().toISOString().slice(0, 10),
): IssueLotSuggestion[] {
  return suggestions.filter(({ lot, balance }) => {
    const expiryDate = lot.expiryDate;
    const unexpired =
      expiryDate === null ||
      (isValidIsoDate(expiryDate) && expiryDate >= today);
    return (
      lot.farmId === farmId &&
      lot.itemId === itemId &&
      balance.farmId === farmId &&
      balance.warehouseId === warehouseId &&
      balance.itemId === itemId &&
      balance.lotId === lot.id &&
      typeof balance.quantityOnHand === "string" &&
      /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(balance.quantityOnHand) &&
      /[1-9]/.test(balance.quantityOnHand) &&
      unexpired
    );
  });
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
