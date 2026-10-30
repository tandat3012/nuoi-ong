'use client';

import { useEffect, useState } from 'react';

import { useAuthenticatedRequest } from '@/features/auth';
import { Select } from '@/shared/components/ui/select';
import { getInventoryBalances } from '../api/inventory.api';
import type { InventoryBalance } from '../types/inventory';
import { formatInventoryQuantity } from '../inventory.logic';

/** Lots of one item that have a balance row in the chosen warehouse, expired lots included. */
export function WarehouseLotSelect({
  farmId,
  warehouseId,
  itemId,
  value,
  onChange,
  inStockOnly = false,
}: {
  farmId: string;
  warehouseId: string;
  itemId: string;
  value: string;
  onChange: (lotId: string) => void;
  inStockOnly?: boolean;
}) {
  const request = useAuthenticatedRequest();
  const key = `${warehouseId}:${itemId}`;
  const [result, setResult] = useState<{ key: string; balances?: InventoryBalance[]; error?: boolean } | null>(null);

  useEffect(() => {
    if (!warehouseId || !itemId) return;
    let cancelled = false;
    // shortcut: first 100 balance rows only, and lots absent from this warehouse cannot be picked; add lot search when a warehouse holds more.
    void getInventoryBalances(request, farmId, { warehouseId, itemId, page: 1, pageSize: 100 })
      .then((response) => { if (!cancelled) setResult({ key, balances: response.data }); })
      .catch(() => { if (!cancelled) setResult({ key, error: true }); });
    return () => { cancelled = true; };
  }, [request, farmId, warehouseId, itemId, key]);

  const current = result?.key === key ? result : null;
  const lots = (current?.balances ?? []).filter(
    (balance): balance is InventoryBalance & { lot: NonNullable<InventoryBalance['lot']> } =>
      balance.lot !== null && (!inStockOnly || /[1-9]/.test(balance.quantityOnHand)),
  );
  const placeholder = !warehouseId
    ? 'Chọn kho trước'
    : !current
      ? 'Đang tải lô...'
      : current.error
        ? 'Không tải được danh sách lô'
        : lots.length === 0
          ? 'Kho không có lô của vật tư này'
          : 'Chọn lô';

  return (
    <Select aria-label="Lô" required value={value} disabled={!warehouseId || !lots.length} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {lots.map(({ lot, quantityOnHand }) => (
        <option key={lot.id} value={lot.id}>
          {lot.lotNumber} · HSD {lot.expiryDate ?? 'không có'} · Tồn {formatInventoryQuantity(quantityOnHand)}
        </option>
      ))}
    </Select>
  );
}
