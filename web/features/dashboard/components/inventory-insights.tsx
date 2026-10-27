"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest, useAuthContext } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";

type Warehouse = { id: string; code: string; name: string };
type ItemRow = {
  item: { id: string; code: string; name: string; status: string; minStockLevel: string };
  unitSymbol: string | null;
};
type Balance = { item: { id: string; code: string; name: string; unit: { symbol: string | null } }; warehouse: { id: string }; quantityOnHand: string };
type Transaction = { item: { id: string }; transactionType: string; quantityChange: string; createdAt: string };
type InsightData = { farmId: string; warehouseId: string; fetchedAt: number; items: ItemRow[]; balances: Balance[]; transactions: Transaction[] };

async function getAllPages<T>(request: ReturnType<typeof useAuthenticatedRequest>, path: string, params: Record<string, string | number | undefined>) {
  const first = await request<PaginatedResponse<T>>(path, { params: { ...params, page: 1, pageSize: 100 } });
  const rows = [...first.data];
  for (let page = 2; page <= first.page.totalPages; page += 1) {
    const next = await request<PaginatedResponse<T>>(path, { params: { ...params, page, pageSize: 100 } });
    rows.push(...next.data);
  }
  return rows;
}

export function InventoryInsights() {
  const request = useAuthenticatedRequest();
  const { selectedFarmId } = useAuthContext();
  const [warehouseResult, setWarehouseResult] = useState<{ farmId: string; data: Warehouse[] } | null>(null);
  const [warehouseSelection, setWarehouseSelection] = useState<{ farmId: string; id: string }>({ farmId: "", id: "" });
  const warehouseId = warehouseSelection.farmId === selectedFarmId ? warehouseSelection.id : "";
  const [data, setData] = useState<InsightData | null>(null);
  const [errors, setErrors] = useState<{ farmId: string; warehouseId: string; message: string } | null>(null);
  const warehouses = warehouseResult?.farmId === selectedFarmId ? warehouseResult.data : [];
  const currentData = data?.farmId === selectedFarmId && data.warehouseId === warehouseId ? data : null;
  const error = errors?.farmId === selectedFarmId && errors.warehouseId === warehouseId ? errors.message : null;

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    void request<PaginatedResponse<Warehouse>>("/warehouses", { params: { farmId: selectedFarmId, page: 1, pageSize: 100, status: "ACTIVE" } })
      .then((result) => { if (!cancelled) setWarehouseResult({ farmId: selectedFarmId, data: result.data }); })
      .catch(() => { if (!cancelled) setErrors({ farmId: selectedFarmId, warehouseId: "", message: "Không tải được danh sách kho." }); });
    return () => { cancelled = true; };
  }, [request, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    void Promise.all([
      getAllPages<ItemRow>(request, "/items", { farmId: selectedFarmId, status: "ACTIVE" }),
      getAllPages<Balance>(request, "/inventory", { farmId: selectedFarmId, warehouseId: warehouseId || undefined }),
      getAllPages<Transaction>(request, "/inventory/transactions", { farmId: selectedFarmId, warehouseId: warehouseId || undefined }),
    ]).then(([items, balances, transactions]) => {
      if (!cancelled) setData({ farmId: selectedFarmId, warehouseId, fetchedAt: Date.now(), items, balances, transactions });
    }).catch(() => { if (!cancelled) setErrors({ farmId: selectedFarmId, warehouseId, message: "Không tải được dữ liệu tồn kho. Vui lòng thử tải lại." }); });
    return () => { cancelled = true; };
  }, [request, selectedFarmId, warehouseId]);

  if (!selectedFarmId) return null;
  const balanceByItem = new Map<string, number>();
  for (const balance of currentData?.balances ?? []) {
    if (warehouseId && balance.warehouse.id !== warehouseId) continue;
    balanceByItem.set(balance.item.id, (balanceByItem.get(balance.item.id) ?? 0) + Number(balance.quantityOnHand));
  }
  const lowStock = (currentData?.items ?? []).flatMap(({ item, unitSymbol }) => {
    const threshold = Number(item.minStockLevel);
    const quantity = balanceByItem.get(item.id) ?? 0;
    return Number.isFinite(threshold) && threshold > 0 && quantity < threshold
      ? [{ item, unitSymbol, quantity, threshold }]
      : [];
  });
  const since = (currentData?.fetchedAt ?? 0) - 30 * 24 * 60 * 60 * 1000;
  const outflowTypes = new Set(["ISSUE", "MAINTENANCE_ISSUE", "TRANSFER_OUT", "ASSIGNMENT_OUT"]);
  const dailyUsage = new Map<string, number>();
  for (const transaction of currentData?.transactions ?? []) {
    if (Date.parse(transaction.createdAt) < since || !outflowTypes.has(transaction.transactionType)) continue;
    const change = Number(transaction.quantityChange);
    if (Number.isFinite(change) && change < 0) dailyUsage.set(transaction.item.id, (dailyUsage.get(transaction.item.id) ?? 0) + Math.abs(change) / 30);
  }
  const forecast = (data?.items ?? []).flatMap(({ item, unitSymbol }) => {
    const daily = dailyUsage.get(item.id) ?? 0;
    if (daily <= 0) return [];
    const quantity = balanceByItem.get(item.id) ?? 0;
    return [{ item, unitSymbol, quantity, daily, days: quantity / daily }];
  }).sort((a, b) => a.days - b.days).slice(0, 8);

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sức khỏe tồn kho</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cảnh báo theo kho đang chọn; dự báo sử dụng trung bình 30 ngày gần nhất.</p>
        </div>
        <label className="grid gap-1 text-sm font-medium">Kho
          <select value={warehouseId} onChange={(event) => setWarehouseSelection({ farmId: selectedFarmId, id: event.target.value })} className="min-h-10 rounded-lg border bg-background px-3 font-normal">
            <option value="">Tất cả kho trong farm</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
          </select>
        </label>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p> : !currentData ? <p role="status" className="text-sm text-muted-foreground">Đang tải phân tích tồn kho...</p> : (
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Tồn dưới định mức</h3><span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">{lowStock.length}</span></div>
            {lowStock.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Không có vật tư dưới định mức.</p> : <ul className="mt-3 max-h-64 divide-y overflow-y-auto">{lowStock.map(({ item, unitSymbol, quantity, threshold }) => <li key={item.id}><Link href={`/inventory?itemId=${item.id}${warehouseId ? `&warehouseId=${warehouseId}` : ""}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary"><span className="min-w-0"><span className="block truncate font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{item.code}</span></span><span className="shrink-0 text-right text-sm font-semibold text-destructive">{quantity} / {threshold} {unitSymbol ?? ""}</span></Link></li>)}</ul>}
          </div>
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Ước tính số ngày tồn</h3><Link href="/inventory" className="text-sm text-primary hover:underline">Xem biến động</Link></div>
            <p className="mt-1 text-xs text-muted-foreground">Tồn hiện tại chia mức xuất trung bình/ngày, tính trên 30 ngày.</p>
            {forecast.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Chưa đủ giao dịch xuất trong 30 ngày để dự báo.</p> : <ul className="mt-3 max-h-64 divide-y overflow-y-auto">{forecast.map(({ item, unitSymbol, quantity, days }) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block truncate font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{quantity} {unitSymbol ?? ""} hiện có</span></span><span className="shrink-0 text-sm font-semibold">{Number.isFinite(days) ? `${Math.floor(days)} ngày` : "—"}</span></li>)}</ul>}
          </div>
        </div>
      )}
    </section>
  );
}
