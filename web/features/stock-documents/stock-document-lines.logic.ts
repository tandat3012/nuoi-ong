export type LineDocumentKind = "stock-transfers" | "stock-counts";

export interface EditableLine {
  itemId: string;
  trackingMode: "QUANTITY" | "LOT" | "ASSET" | null;
  lotId: string | null;
  quantity: string;
  note: string | null;
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
    if (line.trackingMode === "ASSET")
      return `${row}: tài sản được xử lý từ hồ sơ tài sản, không qua phiếu này.`;
    if (line.trackingMode === "LOT" && !line.lotId) return `${row}: chưa chọn lô.`;
    const quantity = line.quantity.trim();
    if (!QUANTITY.test(quantity))
      return `${row}: số lượng tối đa 15 chữ số nguyên và 3 chữ số thập phân.`;
    if (kind === "stock-transfers" && !/[1-9]/.test(quantity))
      return `${row}: số lượng chuyển phải lớn hơn 0.`;
    const key = `${line.itemId}\u0000${line.lotId ?? ""}`;
    if (seen.has(key)) return `${row}: vật tư và lô này đã có trong phiếu.`;
    seen.add(key);
  }
  return null;
}

export function documentLinesPayload(
  kind: LineDocumentKind,
  lines: EditableLine[],
) {
  return lines.map((line) => ({
    itemId: line.itemId,
    lotId: line.trackingMode === "LOT" ? line.lotId : undefined,
    [kind === "stock-counts" ? "actualQuantity" : "quantity"]:
      line.quantity.trim(),
    note: line.note,
  }));
}
