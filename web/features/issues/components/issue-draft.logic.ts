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
): string | null {
  if (!input.warehouseId) return "Vui lòng chọn kho xuất.";
  if (!input.issueCode.trim() || input.issueCode.trim().length > 50)
    return "Mã phiếu phải có từ 1 đến 50 ký tự.";
  if (
    !["CONSUMPTION", "DAMAGE", "DISPOSAL", "OTHER", "MAINTENANCE"].includes(
      input.issueType,
    )
  )
    return "Loại phiếu chưa được hỗ trợ trong form này.";
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
  return (
    detail.issue.status === "DRAFT" &&
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
      if (line.trackingMode === "LOT") return noAsset && Boolean(line.lotId);
      if (
        line.trackingMode !== "ASSET" ||
        !line.assetId ||
        line.lotId != null ||
        line.lotNumber != null ||
        line.lotExpiryDate != null ||
        !/^1(?:\.0{1,3})?$/.test(line.quantity) ||
        assetIds.has(line.assetId)
      )
        return false;
      assetIds.add(line.assetId);
      return true;
    })
  );
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
