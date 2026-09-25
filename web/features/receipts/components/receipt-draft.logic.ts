import type {
  CreateReceiptInput,
  ReceiptDetail,
  ReceiptItemReference,
  ReceiptLine,
} from '../types/receipt';

const ASSET_QUANTITY = /^1(?:\.0{1,3})?$/;

export function validateReceiptDraft(input: CreateReceiptInput): string | null {
  if (!input.warehouseId) return 'Vui lòng chọn kho nhập.';
  if (!input.receiptCode.trim() || input.receiptCode.trim().length > 50)
    return 'Mã phiếu phải có từ 1 đến 50 ký tự.';
  if ((input.note?.length ?? 0) > 4000)
    return 'Ghi chú không được quá 4.000 ký tự.';
  if (input.receiptDate) {
    const date = new Date(`${input.receiptDate}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.receiptDate) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== input.receiptDate
    )
      return 'Ngày nhập không hợp lệ.';
  }
  if (!input.items.length) return 'Vui lòng thêm ít nhất một vật tư.';
  const seenLots = new Set<string>();
  const seenAssets = new Set<string>();
  const seenSerials = new Set<string>();
  for (const [index, line] of input.items.entries()) {
    if (!line.itemId) return `Dòng ${index + 1}: chưa chọn vật tư.`;
    if (
      !/^(0|[1-9]\d{0,14})(\.\d{1,3})?$/.test(line.quantity) ||
      !/[1-9]/.test(line.quantity)
    )
      return `Dòng ${index + 1}: số lượng phải lớn hơn 0, tối đa 15 chữ số nguyên và 3 chữ số thập phân.`;
    if (
      line.unitPrice !== undefined &&
      !/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/.test(line.unitPrice)
    )
      return `Dòng ${index + 1}: đơn giá phải không âm, tối đa 16 chữ số nguyên và 2 chữ số thập phân.`;
    if ((line.note?.length ?? 0) > 4000)
      return `Dòng ${index + 1}: ghi chú không được quá 4.000 ký tự.`;
    if (line.lotNumber !== undefined) {
      if (!line.lotNumber.trim() || line.lotNumber.trim().length > 100)
        return `Dòng ${index + 1}: số lô phải có từ 1 đến 100 ký tự.`;
      const key = `${line.itemId}\u0000${line.lotNumber.trim()}`;
      if (seenLots.has(key))
        return `Dòng ${index + 1}: vật tư đã có số lô này trong phiếu.`;
      seenLots.add(key);
      for (const value of [line.manufacturedDate, line.expiryDate]) {
        if (value && !isValidDate(value))
          return `Dòng ${index + 1}: ngày của lô không hợp lệ.`;
      }
      if (
        line.manufacturedDate &&
        line.expiryDate &&
        line.expiryDate < line.manufacturedDate
      )
        return `Dòng ${index + 1}: hạn sử dụng phải từ ngày sản xuất trở đi.`;
    } else if (line.manufacturedDate || line.expiryDate) {
      return `Dòng ${index + 1}: cần có số lô khi nhập ngày của lô.`;
    }
    if (line.assetCode !== undefined) {
      const assetCode = line.assetCode.trim();
      if (!assetCode || assetCode.length > 100)
        return `Dòng ${index + 1}: mã tài sản phải có từ 1 đến 100 ký tự.`;
      if (!ASSET_QUANTITY.test(line.quantity))
        return `Dòng ${index + 1}: tài sản phải có số lượng bằng 1.`;
      if (seenAssets.has(assetCode))
        return `Dòng ${index + 1}: mã tài sản bị trùng trong phiếu.`;
      seenAssets.add(assetCode);
    }
    if (line.serialNumber) {
      if (line.serialNumber.length > 255)
        return `Dòng ${index + 1}: số serial không được quá 255 ký tự.`;
      if (seenSerials.has(line.serialNumber))
        return `Dòng ${index + 1}: số serial bị trùng trong phiếu.`;
      seenSerials.add(line.serialNumber);
    }
  }
  return null;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function supportsQuantityDraftEdit(
  detail: ReceiptDetail,
  references: Record<string, ReceiptItemReference> | undefined,
) {
  return (
    detail.receipt.status === 'DRAFT' &&
    detail.items.length > 0 &&
    detail.items.every((line) => supportedLine(line, references, false))
  );
}

export function supportsQuantityDraftConfirm(
  detail: ReceiptDetail,
  references: Record<string, ReceiptItemReference> | undefined,
) {
  return (
    detail.receipt.status === 'DRAFT' &&
    detail.items.length > 0 &&
    detail.items.every((line) => supportedLine(line, references, true))
  );
}

function supportedLine(
  line: ReceiptLine,
  references: Record<string, ReceiptItemReference> | undefined,
  requireLotNumber: boolean,
) {
  const mode = references?.[line.itemId]?.item.trackingMode;
  if (
    !mode ||
    line.assetId ||
    line.lotId
  )
    return false;
  if (mode === 'QUANTITY')
    return (
      !line.lotNumber &&
      !line.manufacturedDate &&
      !line.expiryDate &&
      !line.assetCode &&
      !line.serialNumber &&
      !line.locationId
    );
  if (mode === 'ASSET')
    return Boolean(
      line.assetCode?.trim() &&
        ASSET_QUANTITY.test(line.quantity) &&
        !line.lotNumber &&
        !line.manufacturedDate &&
        !line.expiryDate &&
        (line.serialNumber?.length ?? 0) <= 255,
    );
  return Boolean(
    (!line.assetCode && !line.serialNumber && !line.locationId) &&
      (!requireLotNumber || line.lotNumber?.trim()) &&
      (!line.manufacturedDate || isValidDate(line.manufacturedDate)) &&
      (!line.expiryDate || isValidDate(line.expiryDate)) &&
      (!line.manufacturedDate ||
        !line.expiryDate ||
        line.expiryDate >= line.manufacturedDate),
  );
}
