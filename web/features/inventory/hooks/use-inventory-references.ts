"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import type { Warehouse } from "@/features/warehouses/types/warehouse";
import {
  getInventoryItems,
  getInventoryLots,
  getInventoryWarehouses,
} from "../api/inventory.api";
import type {
  InventoryItemOption,
  InventoryLotOption,
} from "../types/inventory";

function inventoryError(error: unknown, noun: string) {
  if (error instanceof ApiError && error.status === 403)
    return `Bạn không có quyền tải danh sách ${noun} của trang trại này.`;
  if (error instanceof ApiError && error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  return `Không thể tải danh sách ${noun}. Vui lòng thử lại.`;
}

export function useInventoryReferences(farmId: string, itemId?: string) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [lotAttempt, setLotAttempt] = useState(0);
  const [result, setResult] = useState<{
    farmId: string;
    attempt: number;
    items?: InventoryItemOption[];
    warehouses?: Warehouse[];
    error?: string;
  } | null>(null);
  const [lotResult, setLotResult] = useState<{
    farmId: string;
    itemId: string;
    attempt: number;
    lots?: InventoryLotOption[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getInventoryItems(request, farmId, 1),
      getInventoryWarehouses(request, farmId, 1),
    ])
      .then(async ([itemPage, warehousePage]) => {
        if (cancelled) return;
        // ponytail: load catalogs into selects; add paginated pickers if option lists grow too large.
        const items = [...itemPage.data];
        const warehouses = [...warehousePage.data];
        for (let page = 2; page <= itemPage.page.totalPages; page += 1) {
          if (cancelled) return;
          items.push(...(await getInventoryItems(request, farmId, page)).data);
        }
        for (let page = 2; page <= warehousePage.page.totalPages; page += 1) {
          if (cancelled) return;
          warehouses.push(
            ...(await getInventoryWarehouses(request, farmId, page)).data,
          );
        }
        if (!cancelled) setResult({ farmId, attempt, items, warehouses });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setResult({
            farmId,
            attempt,
            error: inventoryError(error, "vật tư và kho"),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, farmId, request]);

  const current =
    result?.farmId === farmId && result.attempt === attempt ? result : null;
  const selectedItem = current?.items?.find(({ item }) => item.id === itemId);
  const wantsLots = selectedItem?.item.trackingMode === "LOT";

  useEffect(() => {
    if (!wantsLots || !itemId || current?.error || !current) {
      return;
    }
    let cancelled = false;
    void getInventoryLots(request, farmId, itemId, 1)
      .then(async (firstPage) => {
        if (cancelled) return;
        const lots = [...firstPage.data];
        for (let page = 2; page <= firstPage.page.totalPages; page += 1) {
          if (cancelled) return;
          lots.push(
            ...(await getInventoryLots(request, farmId, itemId, page)).data,
          );
        }
        if (!cancelled)
          setLotResult({ farmId, itemId, attempt: lotAttempt, lots });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLotResult({
            farmId,
            itemId,
            attempt: lotAttempt,
            error: inventoryError(error, "lô"),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [current, farmId, itemId, lotAttempt, request, wantsLots]);

  const currentLots =
    lotResult?.farmId === farmId &&
    lotResult.itemId === itemId &&
    lotResult.attempt === lotAttempt
      ? lotResult
      : null;
  return {
    items: current?.items ?? [],
    warehouses: current?.warehouses ?? [],
    isLoading: Boolean(farmId) && !current,
    error: current?.error,
    reload: () => setAttempt((previous) => previous + 1),
    lots: wantsLots ? (currentLots?.lots ?? []) : [],
    lotsLoading: Boolean(wantsLots && !currentLots),
    lotsError: currentLots?.error,
    reloadLots: () => setLotAttempt((previous) => previous + 1),
    selectedItem,
  };
}
