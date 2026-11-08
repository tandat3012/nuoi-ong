export type LineDocumentKind = "stock-transfers" | "stock-counts";

export interface EditableLine {
  itemId: string;
  trackingMode: "QUANTITY" | "LOT" | "ASSET" | null;
  lotId: string | null;
  quantity: string;
  note: string | null;
  /** Count lines of ASSET items (P1-12): one asset, 1 found or 0 missing. */
  assetId?: string | null;
  assetCondition?: "GOOD" | "DAMAGED" | null;
  foundLocationId?: string | null;
}

const QUANTITY = /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/;

/** Mirrors the API DTOs: transfers move a positive quantity, counts record any non-negative count. */
export function validateDocumentLines(
  kind: LineDocumentKind,
  lines: EditableLine[],
): string | null {
  if (!lines.length) return "Phiếu phải có ít nhất một dòng hàng.";
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const row = `Dòng ${index + 1}`;
    if (!line.itemId) return `${row}: chưa chọn vật tư.`;
    if (line.trackingMode === "ASSET" && (kind !== "stock-counts" || !line.assetId))
      return `${row}: tài sản được xử lý từ hồ sơ tài sản, không qua phiếu này.`;
    if (line.trackingMode === "ASSET" && !["0", "1"].includes(line.quantity.trim()))
      return `${row}: tài sản kiểm kê ghi 1 (có) hoặc 0 (thiếu).`;
    if (line.trackingMode === "LOT" && !line.lotId) return `${row}: chưa chọn lô.`;
    const quantity = line.quantity.trim();
    if (!QUANTITY.test(quantity))
      return `${row}: số lượng tối đa 15 chữ số nguyên và 3 chữ số thập phân.`;
    if (kind === "stock-transfers" && !/[1-9]/.test(quantity))
      return `${row}: số lượng chuyển phải lớn hơn 0.`;
    const key = `${line.itemId}\u0000${line.lotId ?? ""}\u0000${line.assetId ?? ""}`;
    if (seen.has(key)) return `${row}: vật tư và lô này đã có trong phiếu.`;
    seen.add(key);
  }
  return null;
}

export function documentLinesPayload(
  kind: LineDocumentKind,
  lines: EditableLine[],
) {
  return lines.map((line) => {
    const found = line.quantity.trim() !== "0";
    return {
      itemId: line.itemId,
      lotId: line.trackingMode === "LOT" ? line.lotId : undefined,
      [kind === "stock-counts" ? "actualQuantity" : "quantity"]:
        line.quantity.trim(),
      note: line.note,
      // A missing asset carries no condition or found location.
      ...(kind === "stock-counts" && line.assetId
        ? {
            assetId: line.assetId,
            assetCondition: found ? (line.assetCondition ?? "GOOD") : undefined,
            foundLocationId: found ? (line.foundLocationId ?? undefined) : undefined,
          }
        : {}),
    };
  });
}
