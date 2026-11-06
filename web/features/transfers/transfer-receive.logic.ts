import { canApproveStockDocuments } from "../stock-documents/stock-document.logic.ts";

export type ReceiveLine = { id: string; quantity: string };
export type ReceiveInput = { receivedQuantity: string; discrepancyReason: string };

const RECEIVED = /^(0|[1-9][0-9]{0,14})([.][0-9]{1,3})?$/;

// Exact compare of numeric(18,3) strings; doubles lose digits past 15.
const milli = (quantity: string) => {
  const [whole, fraction = ""] = quantity.split(".");
  return BigInt(whole + fraction.padEnd(3, "0"));
};

/** Destination managers count in a dispatched transfer; the API checks the warehouse. */
export function canReceiveTransfer(
  roles: readonly string[],
  transfer: { status: string },
) {
  return transfer.status === "IN_TRANSIT" && canApproveStockDocuments(roles);
}

/**
 * Lines that arrived short, for POST /receive. Lines left out arrived in full.
 * Throws a Vietnamese message the screen shows as is.
 */
export function receivePayload(
  lines: ReceiveLine[],
  inputs: Record<string, ReceiveInput | undefined>,
) {
  const items: { id: string; receivedQuantity: string; discrepancyReason?: string }[] = [];
  for (const line of lines) {
    const input = inputs[line.id];
    const received = input?.receivedQuantity.trim() ?? "";
    if (!received) continue;
    if (!RECEIVED.test(received))
      throw new Error("Số thực nhận phải là số không âm, tối đa 3 chữ số thập phân.");
    if (milli(received) > milli(line.quantity))
      throw new Error("Số thực nhận không được vượt số đã xuất.");
    if (milli(received) === milli(line.quantity)) continue;
    const reason = input?.discrepancyReason.trim() ?? "";
    if (!reason) throw new Error("Nhận thiếu thì phải ghi lý do (thất lạc, hỏng…).");
    items.push({ id: line.id, receivedQuantity: received, discrepancyReason: reason });
  }
  return { items };
}

const SERVER_MESSAGES: [RegExp, string][] = [
  [/cannot exceed the dispatched/, "Số thực nhận không được vượt số đã xuất."],
  [/needs a discrepancy reason/, "Nhận thiếu thì phải ghi lý do."],
  [/assigned warehouses/, "Chỉ quản lý của kho đích được xác nhận nhận hàng."],
  [/Only IN_TRANSIT/, "Phiếu không còn ở trạng thái đang chuyển."],
];

export function receiveErrorMessage(message: string) {
  return SERVER_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}
