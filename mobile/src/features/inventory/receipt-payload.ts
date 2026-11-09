export type ReceiptPayloadItem = {
  itemId: string;
  quantity: number | string;
  metadata?: string;
  lineId?: string;
  lotId?: string | null;
  supplierLotNumber?: string;
  manufacturedDate?: string;
  expiryDate?: string;
  assetCode?: string;
  serialNumber?: string;
  locationId?: string | null;
};

export function receiptItemsPayload(items: readonly ReceiptPayloadItem[]) {
  return items.map((item) => {
    const isNonAsset = item.metadata !== undefined && item.metadata !== 'ASSET';
    return {
      itemId: item.itemId,
      quantity: String(item.quantity),
      lineId: item.lineId,
      lotId: item.lotId || undefined,
      supplierLotNumber: item.lotId ? undefined : item.supplierLotNumber?.trim() || undefined,
      manufacturedDate: item.lotId ? undefined : item.manufacturedDate || undefined,
      expiryDate: item.lotId ? undefined : item.expiryDate || undefined,
      assetCode: item.assetCode?.trim() || undefined,
      serialNumber: item.serialNumber?.trim() || undefined,
      locationId: isNonAsset ? undefined : item.locationId?.trim() || undefined,
    };
  });
}
