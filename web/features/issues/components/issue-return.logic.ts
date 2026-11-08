import type { IssueDetail, IssueLine } from "../types/issue";

export interface IssueReturnRow {
  issueItemId: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  rejectionReason: string;
}

const RETURNABLE_TYPES = ["CONSUMPTION", "OTHER", "MAINTENANCE"];
const QUANTITY = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/;
// shortcut: thousandths as JS numbers, exact below 9e12 units; the API re-checks exactly.
const milli = (value: string) => Math.round(Number(value) * 1000);

/** What each QUANTITY/LOT line can still take back (assets return as themselves). */
export function remainingReturn(line: IssueLine) {
  if (line.assetId) return 0;
  const left = milli(line.quantity) - milli(line.returnedQuantity ?? "0");
  return left > 0 ? left : 0;
}

/** Mirrors the API: confirmed CONSUMPTION/OTHER/MAINTENANCE issues, not order or warranty linked. */
export function returnableLines(detail: IssueDetail) {
  const { issue } = detail;
  if (
    issue.status !== "CONFIRMED" ||
    issue.orderId ||
    issue.warrantyRequestId ||
    !RETURNABLE_TYPES.includes(issue.issueType)
  )
    return [];
  return detail.items.filter((line) => remainingReturn(line) > 0);
}

export function formatMilli(value: number) {
  return String(value / 1000);
}

/** Validates the filled rows; empty rows are skipped. Returns an error or the payload. */
export function issueReturnPayload(
  lines: readonly IssueLine[],
  rows: readonly IssueReturnRow[],
): { error: string } | { items: IssueReturnRow[] } {
  const items: IssueReturnRow[] = [];
  for (const row of rows) {
    const accepted = row.acceptedQuantity.trim() || "0";
    const rejected = row.rejectedQuantity.trim() || "0";
    if (!QUANTITY.test(accepted) || !QUANTITY.test(rejected))
      return { error: "Số lượng phải là số không âm, tối đa 3 chữ số thập phân." };
    const total = milli(accepted) + milli(rejected);
    if (total === 0) continue;
    const line = lines.find((candidate) => candidate.id === row.issueItemId);
    if (!line) return { error: "Dòng hàng không còn trên phiếu xuất." };
    const name = line.itemName ?? line.itemCode ?? line.itemId;
    if (total > remainingReturn(line))
      return { error: `${name}: tổng trả vượt lượng còn lại (${formatMilli(remainingReturn(line))}).` };
    const reason = row.rejectionReason.trim();
    if (milli(rejected) > 0 && !reason)
      return { error: `${name}: ghi lý do / tình trạng cho lượng không đạt.` };
    items.push({
      issueItemId: row.issueItemId,
      acceptedQuantity: accepted,
      rejectedQuantity: rejected,
      rejectionReason: milli(rejected) > 0 ? reason : "",
    });
  }
  if (!items.length) return { error: "Nhập số lượng trả cho ít nhất một dòng." };
  return { items };
}
