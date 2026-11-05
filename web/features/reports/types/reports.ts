export type Granularity = "day" | "week" | "month";

/** Whole VND amounts come as strings; `period` is the first day of the bucket. */
export type TimeseriesPeriod = {
  period: string;
  inboundValue: string;
  outboundValue: string;
  inboundDocuments: number;
  outboundDocuments: number;
  purchaseCost: string;
  maintenanceLaborCost: string;
  maintenanceMaterialCost: string;
  maintenanceOtherCost: string;
};

export type StockTimeseries = {
  granularity: Granularity;
  periods: TimeseriesPeriod[];
  unpricedMovements: number;
};

export const MOVE_KINDS = [
  "receipt",
  "transferIn",
  "adjustmentIn",
  "issue",
  "transferOut",
  "adjustmentOut",
  "assetAssign",
  "assetReturn",
  "maintenanceOut",
  "maintenanceReturn",
] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

export type ItemType = "EQUIPMENT" | "TOOL" | "MATERIAL";

/** Decimal quantity and whole VND, both as strings. */
export type StockAmount = { quantity: string; value: string };

/** One item in one warehouse; amounts per kind are unsigned. */
export type StockReportRow = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: ItemType;
  trackingMode: "QUANTITY" | "LOT" | "ASSET";
  unit: string;
  opening: StockAmount;
  closing: StockAmount;
  moves: Record<MoveKind, StockAmount>;
  unpriced: boolean;
};

export type StockReport = { rows: StockReportRow[] };
