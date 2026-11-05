import type { Granularity, TimeseriesPeriod } from "./types/reports";

export const REPORT_MAX_DAYS = 366;

export const REPORT_PRESETS = [
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "3m", label: "3 tháng" },
  { key: "12m", label: "12 tháng" },
] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number]["key"];

const DAY = 86_400_000;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);

/** Today in Vietnam as YYYY-MM-DD. */
export function vietnamToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

/** 7/30 days and 3 months are rolling (day and week bars); 12 months starts on the 1st (12 month bars). */
export function presetRange(preset: ReportPreset, today: string) {
  if (preset === "12m") {
    const [year, month] = today.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 12, 1)).toISOString().slice(0, 10);
    return { dateFrom: start, dateTo: today };
  }
  const days = { "7d": 7, "30d": 30, "3m": 92 }[preset];
  return { dateFrom: addDays(today, 1 - days), dateTo: today };
}

/** Error message for a custom range, or null. Mirrors the API limits. */
export function rangeError(dateFrom: string, dateTo: string) {
  if (!dateFrom || !dateTo) return "Chọn đủ từ ngày và đến ngày.";
  if (dateFrom > dateTo) return "Từ ngày phải trước hoặc bằng đến ngày.";
  if ((Date.parse(dateTo) - Date.parse(dateFrom)) / DAY + 1 > REPORT_MAX_DAYS)
    return `Khoảng thời gian tối đa ${REPORT_MAX_DAYS} ngày.`;
  return null;
}

export function periodLabel(period: string, granularity: Granularity) {
  const [year, month, day] = period.split("-");
  if (granularity === "month") return `${month}/${year}`;
  return granularity === "week" ? `Tuần ${day}/${month}` : `${day}/${month}`;
}

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "theo ngày",
  week: "theo tuần (bắt đầu thứ Hai)",
  month: "theo tháng",
};

export type StockMode = "value" | "documents";

export function stockSeries(periods: TimeseriesPeriod[], mode: StockMode) {
  return mode === "value"
    ? {
        inbound: periods.map((p) => Number(p.inboundValue)),
        outbound: periods.map((p) => Number(p.outboundValue)),
      }
    : {
        inbound: periods.map((p) => p.inboundDocuments),
        outbound: periods.map((p) => p.outboundDocuments),
      };
}

export function costSeries(periods: TimeseriesPeriod[]) {
  return {
    purchase: periods.map((p) => Number(p.purchaseCost)),
    labor: periods.map((p) => Number(p.maintenanceLaborCost)),
    material: periods.map((p) => Number(p.maintenanceMaterialCost)),
    other: periods.map((p) => Number(p.maintenanceOtherCost)),
  };
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function reportTotals(periods: TimeseriesPeriod[]) {
  const stock = stockSeries(periods, "value");
  const documents = stockSeries(periods, "documents");
  const cost = costSeries(periods);
  const maintenance = sum(cost.labor) + sum(cost.material) + sum(cost.other);
  return {
    inboundValue: sum(stock.inbound),
    outboundValue: sum(stock.outbound),
    inboundDocuments: sum(documents.inbound),
    outboundDocuments: sum(documents.outbound),
    purchaseCost: sum(cost.purchase),
    maintenanceCost: maintenance,
    totalCost: sum(cost.purchase) + maintenance,
  };
}

export function reportErrorMessage(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  if (status === 403) return "Chỉ quản trị viên, chủ trại hoặc quản lý kho mới xem được thống kê.";
  if (status === 404) return "Kho đã chọn không còn thuộc trang trại này.";
  if (status === 400) return "Khoảng thời gian không hợp lệ.";
  return "Không tải được thống kê. Vui lòng thử lại.";
}

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
export const formatVnd = (value: number) => vnd.format(value);

/** Short axis ticks: 1,2 tr / 350 N. */
export function formatCompactVnd(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${+(value / 1e9).toFixed(1)} tỷ`;
  if (abs >= 1e6) return `${+(value / 1e6).toFixed(1)} tr`;
  if (abs >= 1e3) return `${+(value / 1e3).toFixed(0)} N`;
  return String(value);
}
