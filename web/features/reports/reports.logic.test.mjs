import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCompactVnd,
  periodLabel,
  presetRange,
  rangeError,
  reportTotals,
  stockSeries,
  vietnamToday,
} from "./reports.logic.ts";
import { maintenanceScopeNote } from "./reports.logic.ts";

test("presets give day, week and month sized ranges ending today", () => {
  assert.deepEqual(presetRange("7d", "2026-11-05"), { dateFrom: "2026-10-30", dateTo: "2026-11-05" });
  assert.deepEqual(presetRange("30d", "2026-11-05"), { dateFrom: "2026-10-07", dateTo: "2026-11-05" });
  // 92 days: the API's largest week-bucket range.
  assert.deepEqual(presetRange("3m", "2026-11-05"), { dateFrom: "2026-08-06", dateTo: "2026-11-05" });
  // 12 whole months, crossing the year.
  assert.deepEqual(presetRange("12m", "2026-11-05"), { dateFrom: "2025-12-01", dateTo: "2026-11-05" });
  assert.deepEqual(presetRange("12m", "2026-01-31"), { dateFrom: "2025-02-01", dateTo: "2026-01-31" });
});

test("today follows Vietnam time", () => {
  assert.equal(vietnamToday(new Date("2026-11-04T17:30:00Z")), "2026-11-05");
});

test("custom ranges need both dates, in order, within 366 days", () => {
  assert.match(rangeError("", "2026-11-05"), /Chọn đủ/);
  assert.match(rangeError("2026-11-06", "2026-11-05"), /trước/);
  assert.equal(rangeError("2025-11-05", "2026-11-05"), null);
  assert.match(rangeError("2025-11-04", "2026-11-05"), /366/);
});

test("labels and series follow the granularity and mode", () => {
  assert.equal(periodLabel("2026-10-05", "day"), "05/10");
  assert.equal(periodLabel("2026-10-05", "week"), "Tuần 05/10");
  assert.equal(periodLabel("2026-10-01", "month"), "10/2026");

  const periods = [
    { period: "2026-10-01", inboundValue: "10000", outboundValue: "4000", inboundDocuments: 2, outboundDocuments: 1, purchaseCost: "10000", maintenanceLaborCost: "100", maintenanceMaterialCost: "50", maintenanceOtherCost: "0" },
    { period: "2026-11-01", inboundValue: "0", outboundValue: "2000", inboundDocuments: 0, outboundDocuments: 1, purchaseCost: "0", maintenanceLaborCost: "0", maintenanceMaterialCost: "0", maintenanceOtherCost: "25" },
  ];
  assert.deepEqual(stockSeries(periods, "value"), { inbound: [10000, 0], outbound: [4000, 2000] });
  assert.deepEqual(stockSeries(periods, "documents"), { inbound: [2, 0], outbound: [1, 1] });
  assert.deepEqual(reportTotals(periods), {
    inboundValue: 10000,
    outboundValue: 6000,
    inboundDocuments: 2,
    outboundDocuments: 2,
    purchaseCost: 10000,
    maintenanceCost: 175,
    totalCost: 10175,
  });
});

test("axis ticks are short", () => {
  assert.equal(formatCompactVnd(1_250_000), "1.3 tr");
  assert.equal(formatCompactVnd(350_000), "350 N");
  assert.equal(formatCompactVnd(2_000_000_000), "2 tỷ");
  assert.equal(formatCompactVnd(0), "0");
});

test("maintenance cost note states its real scope (NV09-F02)", () => {
  assert.equal(maintenanceScopeNote("FARM", false), "Bảo trì tính theo ngày hoàn thành, cho toàn trang trại.");
  assert.match(maintenanceScopeNote("FARM", true), /toàn trang trại \(không lọc theo kho đã chọn\)/);
  assert.match(maintenanceScopeNote("ASSIGNED_WAREHOUSES", true), /các kho bạn được phân công \(không lọc/);
});
