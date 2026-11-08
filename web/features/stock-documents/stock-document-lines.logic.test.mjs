import assert from "node:assert/strict";
import { test } from "node:test";
import {
  documentLinesPayload,
  validateDocumentLines,
} from "./stock-document-lines.logic.ts";

const line = (patch = {}) => ({
  itemId: "item-a",
  trackingMode: "QUANTITY",
  lotId: null,
  quantity: "1",
  note: null,
  ...patch,
});

test("transfers need a positive quantity, counts accept zero", () => {
  assert.equal(validateDocumentLines("stock-transfers", [line()]), null);
  assert.ok(validateDocumentLines("stock-transfers", [line({ quantity: "0" })]));
  assert.equal(validateDocumentLines("stock-counts", [line({ quantity: "0" })]), null);
  for (const quantity of ["-1", "1.0001", "1e3", "", "01"])
    assert.ok(validateDocumentLines("stock-counts", [line({ quantity })]), quantity);
});

test("rejects empty documents, missing lots, ASSET lines and duplicate item+lot", () => {
  assert.ok(validateDocumentLines("stock-counts", []));
  assert.ok(validateDocumentLines("stock-counts", [line({ itemId: "" })]));
  assert.ok(validateDocumentLines("stock-counts", [line({ trackingMode: "LOT" })]));
  assert.ok(validateDocumentLines("stock-transfers", [line({ trackingMode: "ASSET" })]));
  assert.ok(validateDocumentLines("stock-counts", [line(), line()]));
  assert.equal(
    validateDocumentLines("stock-counts", [
      line({ trackingMode: "LOT", lotId: "lot-a" }),
      line({ trackingMode: "LOT", lotId: "lot-b" }),
    ]),
    null,
  );
});

test("builds the PATCH lines with the quantity field of each document", () => {
  assert.deepEqual(
    documentLinesPayload("stock-counts", [
      line({ trackingMode: "LOT", lotId: "lot-a", quantity: " 2.5 ", note: "x" }),
    ]),
    [{ itemId: "item-a", lotId: "lot-a", actualQuantity: "2.5", note: "x" }],
  );
  assert.deepEqual(documentLinesPayload("stock-transfers", [line({ lotId: "stale" })]), [
    { itemId: "item-a", lotId: undefined, quantity: "1", note: null },
  ]);
});

test("counts take one asset per line, found 1 or missing 0; transfers still refuse assets", () => {
  const asset = (extra) => line({ trackingMode: "ASSET", assetId: "asset-a", ...extra });
  assert.equal(validateDocumentLines("stock-counts", [asset({ quantity: "1" })]), null);
  assert.match(validateDocumentLines("stock-counts", [asset({ quantity: "2" })]), /1 \(có\) hoặc 0/);
  assert.match(validateDocumentLines("stock-counts", [asset({ assetId: null })]), /hồ sơ tài sản/);
  assert.match(validateDocumentLines("stock-transfers", [asset({ quantity: "1" })]), /hồ sơ tài sản/);
  assert.match(
    validateDocumentLines("stock-counts", [asset({ quantity: "1" }), asset({ quantity: "0" })]),
    /đã có trong phiếu/,
  );
  // Lines loaded from the API carry decimal strings.
  assert.equal(validateDocumentLines("stock-counts", [asset({ quantity: "1.000" })]), null);
  assert.equal(validateDocumentLines("stock-counts", [asset({ quantity: "0.000" })]), null);
  assert.deepEqual(
    documentLinesPayload("stock-counts", [asset({ quantity: "0.000", assetCondition: "GOOD" })])[0].assetCondition,
    undefined,
  );
  // Turning a found line into missing drops its condition and found location.
  assert.deepEqual(
    documentLinesPayload("stock-counts", [
      asset({ quantity: "0", assetCondition: "DAMAGED", foundLocationId: "loc" }),
      asset({ assetId: "asset-b", quantity: "1", assetCondition: "DAMAGED", foundLocationId: "loc" }),
    ]).map(({ assetId, assetCondition, foundLocationId, actualQuantity }) => ({
      assetId, assetCondition, foundLocationId, actualQuantity,
    })),
    [
      { assetId: "asset-a", assetCondition: undefined, foundLocationId: undefined, actualQuantity: "0" },
      { assetId: "asset-b", assetCondition: "DAMAGED", foundLocationId: "loc", actualQuantity: "1" },
    ],
  );
});
