import assert from "node:assert/strict";
import { test } from "node:test";
import { stockLine, stockReportCsv, stockReportView } from "./stock-report.logic.ts";

const KINDS = [
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
];

function row(overrides = {}, moves = {}) {
  return {
    warehouseId: "w1",
    warehouseCode: "K1",
    warehouseName: "Kho 1",
    itemId: "i1",
    itemCode: "MAT-ONG",
    itemName: "Mật ong",
    itemType: "MATERIAL",
    trackingMode: "QUANTITY",
    unit: "kg",
    opening: { quantity: "10", value: "200000" },
    closing: { quantity: "15", value: "337500" },
    moves: Object.fromEntries(KINDS.map((kind) => [kind, moves[kind] ?? { quantity: "0", value: "0" }])),
    unpriced: false,
    ...overrides,
  };
}

test("stockLine sums in/out and nets transfers and asset moves", () => {
  const line = stockLine(
    row({}, {
      receipt: { quantity: "10", value: "250000" },
      adjustmentIn: { quantity: "0.5", value: "11250" },
      issue: { quantity: "5", value: "112500" },
      transferIn: { quantity: "1", value: "20000" },
      transferOut: { quantity: "3", value: "60000" },
      assetAssign: { quantity: "2", value: "40000" },
      assetReturn: { quantity: "1", value: "20000" },
      maintenanceOut: { quantity: "1", value: "20000" },
    }),
  );
  assert.deepEqual(line.inbound, { quantity: 10.5, value: 261250 });
  assert.deepEqual(line.outbound, { quantity: 5, value: 112500 });
  assert.deepEqual(line.transfer, { quantity: -2, value: -40000 });
  assert.deepEqual(line.asset, { quantity: -2, value: -40000 });
  assert.deepEqual(line.opening, { quantity: 10, value: 200000 });
});

test("stockReportView filters, groups by warehouse and adds VND only", () => {
  const rows = [
    row(),
    row({ itemId: "i2", itemCode: "KHUNG", itemName: "Khung cầu", itemType: "EQUIPMENT", unpriced: true }),
    row({ warehouseId: "w2", warehouseCode: "K2", warehouseName: "Kho 2" }),
  ];
  const all = stockReportView(rows, { search: "", itemType: "" });
  assert.deepEqual(all.groups.map((g) => [g.warehouseName, g.lines.length]), [["Kho 1", 2], ["Kho 2", 1]]);
  assert.equal(all.groups[0].subtotal.closing, 675000);
  assert.equal(all.total.closing, 1012500);
  assert.equal(all.unpriced, 1);

  // Accent-free search and the item type filter.
  const honey = stockReportView(rows, { search: "mat ong", itemType: "" });
  assert.deepEqual(honey.groups.flatMap((g) => g.lines.map((l) => l.row.itemId)), ["i1", "i1"]);
  const equipment = stockReportView(rows, { search: "", itemType: "EQUIPMENT" });
  assert.deepEqual(equipment.groups.map((g) => g.warehouseName), ["Kho 1"]);
});

test("stockReportCsv writes Excel (Vietnam) friendly cells", () => {
  const rows = [
    row({}, { receipt: { quantity: "2.5", value: "56250" } }),
    row({ itemId: "i2", itemCode: "=CMD()", itemName: 'Khay "lớn"; 2 tầng', unpriced: true }),
  ];
  const csv = stockReportCsv(stockReportView(rows, { search: "", itemType: "" }), {
    farmName: "Trại ong",
    warehouseName: "Tất cả kho",
    dateFrom: "2026-10-01",
    dateTo: "2026-10-31",
    filters: null,
  });
  assert.ok(csv.startsWith("﻿Báo cáo nhập – xuất – tồn\r\n"));
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines[3], "Kỳ;01/10/2026 – 31/10/2026");
  const header = lines[6].split(";");
  assert.equal(header.length, 5 + 2 + KINDS.length * 2 + 2 + 1);
  assert.deepEqual(header.slice(7, 9), ["Nhập kho SL", "Nhập kho (VND)"]);

  const first = lines[7].split(";");
  assert.deepEqual(first.slice(0, 9), ["Kho 1", "MAT-ONG", "Mật ong", "Vật tư", "kg", "10", "200000", "2,5", "56250"]);
  assert.equal(first.length, header.length);
  // Formula-looking code is escaped; quotes and ; inside a name are quoted.
  assert.ok(lines[8].startsWith(`Kho 1;'=CMD();"Khay ""lớn""; 2 tầng";Vật tư;`));
  assert.ok(lines[8].endsWith(";Có hàng chưa có giá - giá trị chỉ gồm phần đã định giá"));

  const total = lines[9].split(";");
  assert.equal(total[0], "Tổng cộng");
  assert.equal(total[6], "400000");
  assert.equal(total[8], "56250");
  assert.equal(total.length, header.length);
});
