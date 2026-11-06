import type { AuthenticatedRequest } from "@/features/warehouses";
import type { StockReport, StockTimeseries } from "../types/reports";

type ReportParams = { farmId: string; dateFrom: string; dateTo: string; warehouseId?: string };
const params = (query: ReportParams) => ({ ...query, warehouseId: query.warehouseId || undefined });

export function getStockTimeseries(request: AuthenticatedRequest, query: ReportParams) {
  return request<{ data: StockTimeseries }>("/dashboard/timeseries", { params: params(query) });
}

export function getStockReport(request: AuthenticatedRequest, query: ReportParams) {
  return request<{ data: StockReport }>("/dashboard/stock-report", { params: params(query) });
}
