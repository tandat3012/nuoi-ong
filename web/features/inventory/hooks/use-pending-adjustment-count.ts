"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { getInventoryAdjustments } from "../api/inventory.api";

/** Number of adjustments waiting for approval; null while loading or when the count is unavailable. */
export function usePendingAdjustmentCount(
  farmId: string,
  refreshToken: number,
  enabled: boolean,
) {
  const request = useAuthenticatedRequest();
  const [result, setResult] = useState<{ key: string; count: number } | null>(
    null,
  );
  const key = `${farmId}:${refreshToken}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // pageSize 1: only page.totalItems is needed.
    getInventoryAdjustments(request, farmId, {
      status: "PENDING_APPROVAL",
      page: 1,
      pageSize: 1,
    })
      .then((response) => {
        if (!cancelled) setResult({ key, count: response.page.totalItems });
      })
      .catch(() => {
        // The badge is a hint; the adjustments tab shows the real error.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, farmId, key, request]);

  return enabled && result?.key === key ? result.count : null;
}
