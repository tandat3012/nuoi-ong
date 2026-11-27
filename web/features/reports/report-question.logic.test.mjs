import assert from "node:assert/strict";
import { test } from "node:test";
import { answerLines, matchByName, missingFilters, parseReportLink, reportLinkQuery } from "./report-question.logic.ts";
import { stockReportView } from "./stock-report.logic.ts";

const warehouses = [
  { id: "w1", code: "KHO-CP", name: "Kho Cà Phê" },
  { id: "w2", code: "KHO-NHAN", name: "Kho Nhãn" },
  { id: "w3", code: "KHO-CP2", name: "Kho Cà Phê Đắk Lắk" },
];
const label = ({ code, name }) => ({ code, name });

test("an exact warehouse name wins over phrase matches, with or without 'kho' and diacritics", () => {
  assert.deepEqual(matchByName(warehouses, "kho Cà Phê", label).map((w) => w.id), ["w1"]);
  assert.deepEqual(matchByName(warehouses, "ca phe", label).map((w) => w.id), ["w1"]);
  assert.deepEqual(matchByName(warehouses, "kho-nhan", label).map((w) => w.id), ["w2"]);
});

test("a partial name returns every match so the user can choose", () => {
  assert.deepEqual(matchByName(warehouses, "Cà Phê Đắk", label).map((w) => w.id), ["w3"]);
  const items = [
    { code: "MO-CP", name: "Mật ong hoa cà phê" },
    { code: "MO-NHAN", name: "Mật ong hoa nhãn" },
    { code: "SAP", name: "Sáp ong" },
  ];
  assert.deepEqual(matchByName(items, "mật ong", label).map((i) => i.code), ["MO-CP", "MO-NHAN"]);
  assert.deepEqual(matchByName(items, "keo ong", label), []);
  assert.deepEqual(matchByName(items, "  ", label), []);
});

test("missing item or period is asked back; out of scope is said", () => {
  const base = { metric: "STOCK_MOVEMENT", warehouse: null, item: "mật ong", dateFrom: "2026-11-01", dateTo: "2026-11-27" };
  assert.equal(missingFilters(base), null);
  assert.match(missingFilters({ ...base, item: null }), /mặt hàng/);
  assert.match(missingFilters({ ...base, dateFrom: null, dateTo: null }), /kỳ/);
  assert.match(missingFilters({ ...base, metric: "UNSUPPORTED" }), /Bản đầu/);
});

const zero = { quantity: "0", value: "0" };
const row = {
  warehouseId: "w1",
  warehouseCode: "KHO-CP",
  warehouseName: "Kho Cà Phê",
  itemId: "i1",
  itemCode: "MO-CP",
  itemName: "Mật ong hoa cà phê",
  itemType: "MATERIAL",
  trackingMode: "LOT",
  unit: "kg",
  opening: { quantity: "24", value: "0" },
  closing: { quantity: "45", value: "0" },
  moves: {
    receipt: { quantity: "56", value: "0" },
    transferIn: { quantity: "5", value: "0" },
    adjustmentIn: zero,
    issue: { quantity: "30", value: "0" },
    transferOut: { quantity: "10", value: "0" },
    adjustmentOut: zero,
    assetAssign: zero,
    assetReturn: zero,
    maintenanceOut: zero,
    maintenanceReturn: zero,
  },
  unpriced: false,
};

test("the answer shows every non-zero move with the report labels, so the closing adds up", () => {
  const lines = answerLines(row);
  assert.deepEqual(lines, [
    { label: "Tồn đầu kỳ", quantity: 24 },
    { label: "Nhập kho", quantity: 56 },
    { label: "Chuyển đến", quantity: 5 },
    { label: "Xuất kho", quantity: 30 },
    { label: "Chuyển đi", quantity: 10 },
    { label: "Tồn cuối kỳ", quantity: 45 },
  ]);
  assert.equal(24 + 56 + 5 - 30 - 10, 45);
});

const W = "11111111-1111-4111-8111-111111111111";
const I = "22222222-2222-4222-8222-222222222222";

test("the report link round-trips and rejects bad or partial links", () => {
  const link = { dateFrom: "2026-11-01", dateTo: "2026-11-27", warehouseId: W, itemId: I };
  assert.deepEqual(parseReportLink(new URLSearchParams(reportLinkQuery(link))), link);
  const bad = (overrides) => parseReportLink(new URLSearchParams({ tab: "stock", ...link, ...overrides }));
  assert.equal(bad({ dateTo: "2026-02-30" }), null);
  assert.equal(bad({ dateFrom: "2026-11-28" }), null);
  assert.equal(bad({ dateFrom: "2025-01-01" }), null);
  assert.equal(bad({ warehouseId: "x" }), null);
  assert.equal(bad({ tab: "charts" }), null);
  assert.equal(parseReportLink(new URLSearchParams("")), null);
});

test("the item filter keeps only the answered row, even when search would match several", () => {
  const other = { ...row, itemId: "i2", itemCode: "MO-NHAN", itemName: "Mật ong hoa nhãn" };
  const view = stockReportView([row, other], { search: "", itemType: "", itemId: "i1" });
  assert.deepEqual(view.groups.flatMap((g) => g.lines.map((l) => l.row.itemId)), ["i1"]);
  assert.equal(stockReportView([row, other], { search: "mật ong", itemType: "" }).groups[0].lines.length, 2);
});
