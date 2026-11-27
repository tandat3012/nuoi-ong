import { matchesSearch, normalizeSearch } from "../../shared/lib/search.ts";
import { rangeError } from "./reports.logic.ts";
import { MOVE_KIND_LABELS } from "./stock-report.logic.ts";
import { MOVE_KINDS, type StockReportRow } from "./types/reports.ts";

/** What POST /assistant/report-filters returns: the user's own words, not ids. */
export type ReportFilters = {
  metric: "STOCK_MOVEMENT" | "UNSUPPORTED";
  warehouse: string | null;
  item: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

const name = (value: string) => normalizeSearch(value).replace(/^kho\s+/, "");

/**
 * Candidates for the words the user typed: an exact code or name (no case or diacritics) wins,
 * otherwise every candidate whose code or name contains all the words.
 */
export function matchByName<T>(candidates: T[], text: string, label: (candidate: T) => { code: string; name: string }) {
  const wanted = name(text);
  if (!wanted) return { exact: false, matches: [] };
  const exact = candidates.filter((candidate) => {
    const { code, name: candidateName } = label(candidate);
    return name(code) === wanted || name(candidateName) === wanted;
  });
  if (exact.length) return { exact: true, matches: exact };
  const matches = candidates.filter((candidate) => {
    const { code, name: candidateName } = label(candidate);
    return matchesSearch(`${code} ${candidateName}`, wanted);
  });
  return { exact: false, matches };
}

/**
 * Answer without asking only for one exact match on words the user really typed. A partial match
 * may be a different item (the report leaves out rows without stock or moves), and a name that is
 * not in the question came from the model, not the user.
 */
export function pickedWithoutAsking<T>(match: { exact: boolean; matches: T[] }, text: string, question: string) {
  return match.exact && match.matches.length === 1 && normalizeSearch(question).includes(name(text)) ? match.matches[0] : null;
}

/** Why the question cannot be answered yet; null when the item and the period are there. */
export function missingFilters(filters: ReportFilters) {
  if (filters.metric === "UNSUPPORTED")
    return "Bản đầu chỉ trả lời nhập – xuất – tồn của một mặt hàng tại một kho trong một kỳ.";
  const missing = [!filters.item && "mặt hàng", !filters.dateFrom && "kỳ (từ ngày nào đến ngày nào, tối đa 366 ngày)"].filter(Boolean);
  return missing.length ? `Câu hỏi chưa rõ ${missing.join(" và ")}. Bổ sung rồi hỏi lại.` : null;
}

/** Opening, every non-zero move with the report's own labels, closing. */
export function answerLines(row: StockReportRow) {
  return [
    { label: "Tồn đầu kỳ", quantity: Number(row.opening.quantity) },
    ...MOVE_KINDS.filter((kind) => Number(row.moves[kind].quantity) !== 0).map((kind) => ({
      label: MOVE_KIND_LABELS[kind],
      quantity: Number(row.moves[kind].quantity),
    })),
    { label: "Tồn cuối kỳ", quantity: Number(row.closing.quantity) },
  ];
}

/** `farmId` keeps a link from applying the warehouse of another farm after a farm switch. */
export type ReportLink = { farmId: string; dateFrom: string; dateTo: string; warehouseId: string; itemId: string };

/** The report filtered to the answered row. */
export function reportLinkQuery(link: ReportLink) {
  return `?${new URLSearchParams({ tab: "stock", ...link })}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A link back into the report; null unless the whole link is valid, so a bad URL keeps the default report. */
export function parseReportLink(params: URLSearchParams, farmId: string): ReportLink | null {
  const link = {
    farmId: params.get("farmId") ?? "",
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    warehouseId: params.get("warehouseId") ?? "",
    itemId: params.get("itemId") ?? "",
  };
  const realDay = (day: string) => {
    const time = DAY.test(day) ? Date.parse(`${day}T00:00:00Z`) : NaN;
    return !Number.isNaN(time) && new Date(time).toISOString().startsWith(day);
  };
  if (params.get("tab") !== "stock" || link.farmId !== farmId || !realDay(link.dateFrom) || !realDay(link.dateTo)) return null;
  if (rangeError(link.dateFrom, link.dateTo) || !UUID.test(link.warehouseId) || !UUID.test(link.itemId)) return null;
  return link;
}

export function questionErrorMessage(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  if (status === 403) return "Chỉ quản trị viên, chủ trại hoặc quản lý kho mới hỏi được dữ liệu kho.";
  if (status === 400) return "Câu hỏi trống hoặc dài quá 300 ký tự.";
  if (status === 429) return "Bạn hỏi hơi nhanh: tối đa 10 câu mỗi phút. Chờ một chút rồi hỏi lại.";
  if (status === 503) return "Trợ lý tạm thời không phản hồi. Thử lại sau ít phút, hoặc xem báo cáo bên dưới.";
  return "Không gửi được câu hỏi. Vui lòng thử lại.";
}
