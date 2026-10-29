"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { getWarehouseById } from "@/features/warehouses/api/warehouses.api";
import { ApiError } from "@/shared/api/client";
import { getReceiptById, getReceiptSupplier } from "../api/receipts.api";
import type { ReceiptDetail } from "../types/receipt";

export function useReceiptDetail(farmId: string, id: string) {
  const request = useAuthenticatedRequest();

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    farmId: string;
    id: string;
    attempt: number;
    detail?: ReceiptDetail;
    warehouse?: string;
    supplier?: string;
    warning?: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: detail } = await getReceiptById(request, farmId, id);

        if (cancelled) return;

        const [warehouseResult, supplierResult] =
          await Promise.all([
            Promise.allSettled([
              getWarehouseById(request, detail.receipt.warehouseId, farmId).then(
                ({ data }) => `${data.code} — ${data.name}`,
              ),
            ]).then(([result]) => result),
            Promise.allSettled([
              detail.receipt.supplierId
                ? getReceiptSupplier(
                    request,
                    farmId,
                    detail.receipt.supplierId,
                  ).then(({ data }) => `${data.code} — ${data.name}`)
                : Promise.resolve(undefined),
            ]).then(([result]) => result),
          ]);

        if (cancelled) return;
        // Authentication/permission failures must not be presented as missing labels.
        const lookups = [warehouseResult, supplierResult];
        for (const lookup of lookups) {
          if (
            lookup.status === "rejected" &&
            lookup.reason instanceof ApiError &&
            [401, 403].includes(lookup.reason.status)
          )
            throw lookup.reason;
        }
        setResult({
          farmId,
          id,
          attempt,
          detail,
          supplier:
            supplierResult.status === "fulfilled"
              ? supplierResult.value
              : undefined,
          warehouse:
            warehouseResult.status === "fulfilled" &&
            typeof warehouseResult.value === "string"
              ? warehouseResult.value
              : undefined,
          warning: lookups.some((lookup) => lookup.status === "rejected"),
        });
      } catch (error: unknown) {
        if (cancelled) return;
        const message =
          error instanceof ApiError && error.status === 404
            ? "Phiếu nhập không tồn tại hoặc không thuộc trang trại này."
            : error instanceof ApiError && error.status === 403
              ? "Bạn không có quyền xem chi tiết phiếu nhập này."
              : error instanceof ApiError && error.status === 401
                ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
                : "Không thể tải chi tiết phiếu nhập. Vui lòng thử lại.";
        setResult({ farmId, id, attempt, error: message });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [request, farmId, id, attempt]);

  const current =
    result?.farmId === farmId && result.id === id && result.attempt === attempt
      ? result
      : null;
  return {
    ...current,
    revision: attempt,
    isLoading: !current,
    reload: () => setAttempt((previous) => previous + 1),
  };
}
