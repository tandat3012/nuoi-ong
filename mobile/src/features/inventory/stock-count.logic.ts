export interface StockCountPayloadLineInput {
  itemId: string;
  lotId?: string | null;
  assetId?: string | null;
  actualQuantity: string | number;
  assetCondition?: 'GOOD' | 'DAMAGED' | null;
  foundLocationId?: string | null;
  note?: string | null;
}

export function isAssetCountLine(line: { assetId?: string | null }): boolean {
  return Boolean(line.assetId);
}

export function canEditStockCount(status: string): boolean {
  return status === 'DRAFT' || status === 'COUNTING';
}

/**
 * Serializes stock count lines for POST / PATCH /stock-counts.
 * For ASSET lines (P1-12, NV03):
 * - If present (actualQuantity > 0): actualQuantity = "1", assetCondition is mandatory (defaults to 'GOOD'), foundLocationId is preserved.
 * - If missing (actualQuantity <= 0): actualQuantity = "0", condition and foundLocationId MUST NOT be sent.
 */
export function serializeStockCountPayload(lines: StockCountPayloadLineInput[]) {
  return lines.map((line) => {
    if (line.assetId) {
      const numeric =
        typeof line.actualQuantity === 'number'
          ? line.actualQuantity
          : parseFloat(String(line.actualQuantity ?? 0));
      const isFound = numeric > 0;
      return {
        itemId: line.itemId,
        assetId: line.assetId,
        actualQuantity: isFound ? '1' : '0',
        assetCondition: isFound ? (line.assetCondition ?? 'GOOD') : undefined,
        foundLocationId: isFound ? (line.foundLocationId ?? undefined) : undefined,
        note: line.note?.trim() || null,
      };
    }
    return {
      itemId: line.itemId,
      ...(line.lotId ? { lotId: line.lotId } : {}),
      actualQuantity:
        typeof line.actualQuantity === 'number'
          ? String(line.actualQuantity)
          : String(line.actualQuantity ?? '0').trim().replace(',', '.'),
      note: line.note?.trim() || null,
    };
  });
}

export function validateStockCountLines(lines: StockCountPayloadLineInput[]): string | null {
  if (!lines.length) return 'Phiếu phải có ít nhất một dòng kiểm kê.';

  for (const [index, line] of lines.entries()) {
    const row = `Dòng ${index + 1}`;
    if (!line.itemId) return `${row}: Chưa chọn vật tư.`;

    if (line.assetId) {
      const numeric =
        typeof line.actualQuantity === 'number'
          ? line.actualQuantity
          : parseFloat(String(line.actualQuantity ?? 0));
      if (!Number.isFinite(numeric) || (numeric !== 0 && numeric !== 1)) {
        return `${row}: Tài sản kiểm kê chỉ ghi 1 (có mặt) hoặc 0 (thiếu).`;
      }
      if (numeric === 1 && !line.assetCondition) {
        return `${row}: Cần chọn tình trạng tài sản (Tốt hoặc Hỏng).`;
      }
    }
  }

  return null;
}
