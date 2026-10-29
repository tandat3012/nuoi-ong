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
