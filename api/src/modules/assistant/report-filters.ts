import { parseDateRange } from '../../common/date-range';
import { TIMESERIES_MAX_DAYS } from '../dashboard/dashboard.service';

/** What the model may answer; the API never trusts it beyond this shape. */
export const REPORT_FILTER_SCHEMA = {
  type: 'object',
  properties: {
    metric: { type: 'string', enum: ['STOCK_MOVEMENT', 'UNSUPPORTED'] },
    warehouse: { type: ['string', 'null'] },
    item: { type: ['string', 'null'] },
    dateFrom: { type: ['string', 'null'] },
    dateTo: { type: ['string', 'null'] },
  },
  required: ['metric', 'warehouse', 'item', 'dateFrom', 'dateTo'],
};

export type ReportFilters = {
  metric: 'STOCK_MOVEMENT' | 'UNSUPPORTED';
  /** Words the user typed for the warehouse / item, unresolved; the web matches them. */
  warehouse: string | null;
  item: string | null;
  /** Both set or both null; null = no period or an invalid one. */
  dateFrom: string | null;
  dateTo: string | null;
};

export function reportFilterInstruction(today: string) {
  return [
    `Hôm nay là ${today} (giờ Việt Nam).`,
    'Bạn chuyển câu hỏi tiếng Việt về kho của trang trại nuôi ong thành bộ lọc báo cáo nhập – xuất – tồn.',
    'metric = STOCK_MOVEMENT khi hỏi nhập, xuất, chuyển kho, điều chỉnh hoặc tồn của một mặt hàng trong một kỳ; mọi câu khác là UNSUPPORTED.',
    'warehouse và item: chép nguyên cụm từ người dùng gõ cho kho và mặt hàng, bỏ chữ "kho" đứng đầu; không đoán, không thêm; không nhắc đến thì null.',
    'dateFrom, dateTo: YYYY-MM-DD, tính từ hôm nay; "hôm nay" là hôm nay đến hôm nay; "tháng này"/"từ đầu tháng" là ngày 1 tháng này đến hôm nay; "tháng trước" là trọn tháng trước; "N ngày qua" kết thúc hôm nay. Không nói kỳ thì null.',
  ].join('\n');
}

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : null;

/** The model's JSON as filters; null when it is not the agreed shape. Bad or too long periods become null. */
export function parseReportFilters(raw: string): ReportFilters | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (data.metric !== 'STOCK_MOVEMENT' && data.metric !== 'UNSUPPORTED')
    return null;
  let dateFrom = text(data.dateFrom);
  let dateTo = text(data.dateTo);
  try {
    parseDateRange(dateFrom ?? undefined, dateTo ?? undefined);
  } catch {
    dateFrom = dateTo = null;
  }
  if (
    !dateFrom ||
    !dateTo ||
    (Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000 + 1 >
      TIMESERIES_MAX_DAYS
  )
    dateFrom = dateTo = null;
  return {
    metric: data.metric,
    warehouse: text(data.warehouse),
    item: text(data.item),
    dateFrom,
    dateTo,
  };
}
