import { matchesSearch } from "../../shared/lib/search.ts";
import { formatDay } from "./reports.logic.ts";
import { MOVE_KINDS, type ItemType, type MoveKind, type StockAmount, type StockReportRow } from "./types/reports.ts";

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  EQUIPMENT: "Thiết bị",
  TOOL: "Dụng cụ",
  MATERIAL: "Vật tư",
};

export const MOVE_KIND_LABELS: Record<MoveKind, string> = {
  receipt: "Nhập kho",
  transferIn: "Chuyển đến",
  adjustmentIn: "Điều chỉnh tăng",
  issue: "Xuất kho",
  transferOut: "Chuyển đi",
  adjustmentOut: "Điều chỉnh giảm",
  assetAssign: "Cấp phát tài sản",
  assetReturn: "Thu hồi tài sản",
  maintenanceOut: "Mang đi bảo trì",
  maintenanceReturn: "Trả về sau bảo trì",
};

export const STOCK_COLUMNS = ["opening", "inbound", "outbound", "transfer", "asset", "closing"] as const;
export type StockColumn = (typeof STOCK_COLUMNS)[number];

export const STOCK_COLUMN_LABELS: Record<StockColumn, string> = {
  opening: "Tồn đầu",
  inbound: "Nhập",
  outbound: "Xuất",
  transfer: "Chuyển kho ±",
  asset: "Cấp phát/thu hồi ±",
  closing: "Tồn cuối",
};

type Amount = { quantity: number; value: number };
export type StockReportLine = { row: StockReportRow } & Record<StockColumn, Amount>;

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const amount = ({ quantity, value }: StockAmount): Amount => ({ quantity: Number(quantity), value: Number(value) });

/** Screen columns of one row; transfers and asset moves are net (+ in, − out). */
export function stockLine(row: StockReportRow): StockReportLine {
  const net = (plus: MoveKind[], minus: MoveKind[] = []) => {
    let quantity = 0;
    let value = 0;
    for (const [kinds, sign] of [[plus, 1], [minus, -1]] as const) {
      for (const kind of kinds) {
        quantity += sign * Number(row.moves[kind].quantity);
        value += sign * Number(row.moves[kind].value);
      }
    }
    return { quantity: round3(quantity), value };
  };
  return {
    row,
    opening: amount(row.opening),
    inbound: net(["receipt", "adjustmentIn"]),
    outbound: net(["issue", "adjustmentOut"]),
    transfer: net(["transferIn"], ["transferOut"]),
    asset: net(["assetReturn", "maintenanceReturn"], ["assetAssign", "maintenanceOut"]),
    closing: amount(row.closing),
  };
}

const zero = () => Object.fromEntries(STOCK_COLUMNS.map((column) => [column, 0])) as Record<StockColumn, number>;

export type StockReportFilters = { search: string; itemType: ItemType | "" };
export type StockReportGroup = {
  warehouseId: string;
  warehouseName: string;
  lines: StockReportLine[];
  /** VND per column; quantities of different units are not added. */
  subtotal: Record<StockColumn, number>;
};

/** Rows that pass the filters, grouped by warehouse in API order, with VND subtotals and a total. */
export function stockReportView(rows: StockReportRow[], filters: StockReportFilters) {
  const groups = new Map<string, StockReportGroup>();
  const total = zero();
  let unpriced = 0;
  for (const row of rows) {
    if (filters.itemType && row.itemType !== filters.itemType) continue;
    if (filters.search.trim() && !matchesSearch(`${row.itemCode} ${row.itemName}`, filters.search)) continue;
    let group = groups.get(row.warehouseId);
    if (!group) {
      group = { warehouseId: row.warehouseId, warehouseName: row.warehouseName, lines: [], subtotal: zero() };
      groups.set(row.warehouseId, group);
    }
    const line = stockLine(row);
    group.lines.push(line);
    for (const column of STOCK_COLUMNS) {
      group.subtotal[column] += line[column].value;
      total[column] += line[column].value;
    }
    if (row.unpriced) unpriced += 1;
  }
  return { groups: [...groups.values()], total, unpriced };
}
export type StockReportView = ReturnType<typeof stockReportView>;

/** Text cell: quoted when needed; a leading = + - @ is escaped so Excel never runs it as a formula. */
function csvText(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
/** Excel with Vietnamese regional settings reads "2,5" as a number. */
const csvQuantity = (quantity: string) => quantity.replace(".", ",");

export type StockReportCsvMeta = {
  farmName: string;
  warehouseName: string;
  dateFrom: string;
  dateTo: string;
  filters: string | null;
};

/** What is on screen as a CSV for Excel set to Vietnam: `;` between cells, UTF-8 with BOM. */
export function stockReportCsv(view: StockReportView, meta: StockReportCsvMeta) {
  const texts = (...cells: string[]) => cells.map(csvText);
  const lines = view.groups.flatMap((group) => group.lines);
  const kindTotal = (kind: MoveKind) =>
    String(lines.reduce((sum, line) => sum + Number(line.row.moves[kind].value), 0));
  const table: string[][] = [
    texts("Báo cáo nhập – xuất – tồn"),
    texts("Trang trại", meta.farmName),
    texts("Kho", meta.warehouseName),
    texts("Kỳ", `${formatDay(meta.dateFrom)} – ${formatDay(meta.dateTo)}`),
    texts("Giá trị", "VND, bình quân gia quyền di động theo từng kho"),
    ...(meta.filters ? [texts("Bộ lọc", meta.filters)] : []),
    [],
    texts(
      "Kho",
      "Mã vật tư",
      "Tên vật tư",
      "Loại",
      "Đơn vị",
      "Tồn đầu SL",
      "Tồn đầu (VND)",
      ...MOVE_KINDS.flatMap((kind) => [`${MOVE_KIND_LABELS[kind]} SL`, `${MOVE_KIND_LABELS[kind]} (VND)`]),
      "Tồn cuối SL",
      "Tồn cuối (VND)",
      "Ghi chú",
    ),
    ...lines.map(({ row }) => [
      ...texts(row.warehouseName, row.itemCode, row.itemName, ITEM_TYPE_LABELS[row.itemType], row.unit),
      csvQuantity(row.opening.quantity),
      row.opening.value,
      ...MOVE_KINDS.flatMap((kind) => [csvQuantity(row.moves[kind].quantity), row.moves[kind].value]),
      csvQuantity(row.closing.quantity),
      row.closing.value,
      row.unpriced ? csvText("Có hàng chưa có giá nhập (tính 0 đ)") : "",
    ]),
    [
      ...texts("Tổng cộng", "", "", "", ""),
      "",
      String(view.total.opening),
      ...MOVE_KINDS.flatMap((kind) => ["", kindTotal(kind)]),
      "",
      String(view.total.closing),
      "",
    ],
  ];
  return `﻿${table.map((cells) => cells.join(";")).join("\r\n")}\r\n`;
}

const quantityFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const signedFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3, signDisplay: "exceptZero" });
export const formatQuantity = (value: number) => quantityFormat.format(value);
export const formatSignedQuantity = (value: number) => signedFormat.format(value);
