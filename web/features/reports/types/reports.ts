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
