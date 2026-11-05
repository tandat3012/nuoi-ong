import type { AuthenticatedRequest } from "@/features/warehouses";
import type { StockTimeseries } from "../types/reports";

export function getStockTimeseries(
  request: AuthenticatedRequest,
  params: { farmId: string; dateFrom: string; dateTo: string; warehouseId?: string },
) {
  return request<{ data: StockTimeseries }>("/dashboard/timeseries", {
    params: { ...params, warehouseId: params.warehouseId || undefined },
  });
}
