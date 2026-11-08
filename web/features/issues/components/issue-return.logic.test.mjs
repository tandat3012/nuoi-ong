import assert from "node:assert/strict";
import test from "node:test";
import {
  issueReturnPayload,
  remainingReturn,
  returnableLines,
} from "./issue-return.logic.ts";

const line = (overrides = {}) => ({
  id: "l1",
  itemId: "i1",
  itemName: "Cám",
  quantity: "10.000",
  returnedQuantity: "0",
  assetId: null,
  ...overrides,
});
const detail = (issue = {}, items = [line()]) => ({
  issue: { status: "CONFIRMED", issueType: "CONSUMPTION", orderId: null, ...issue },
  items,
});
const row = (overrides = {}) => ({
  issueItemId: "l1",
  acceptedQuantity: "",
  rejectedQuantity: "",
  rejectionReason: "",
  ...overrides,
});

test("only confirmed own-use issues with something left are returnable", () => {
  assert.equal(returnableLines(detail()).length, 1);
  assert.equal(returnableLines(detail({ status: "DRAFT" })).length, 0);
  assert.equal(returnableLines(detail({ issueType: "DAMAGE" })).length, 0);
  assert.equal(returnableLines(detail({ orderId: "o1" })).length, 0);
  assert.equal(returnableLines(detail({ issueType: "OTHER", warrantyRequestId: "w1" })).length, 0);
  assert.equal(returnableLines(detail({}, [line({ assetId: "a1", quantity: "1" })])).length, 0);
  assert.equal(returnableLines(detail({}, [line({ returnedQuantity: "10.000" })])).length, 0);
  assert.equal(remainingReturn(line({ returnedQuantity: "2.5" })), 7500);
});

test("8 accepted + 2 rejected needs a reason; 0 accepted is a valid return", () => {
  const lines = [line()];
  assert.match(
    issueReturnPayload(lines, [row({ acceptedQuantity: "8", rejectedQuantity: "2" })]).error,
    /lý do/,
  );
  assert.deepEqual(
    issueReturnPayload(lines, [
      row({ acceptedQuantity: "8", rejectedQuantity: "2", rejectionReason: " rách " }),
    ]),
    { items: [{ issueItemId: "l1", acceptedQuantity: "8", rejectedQuantity: "2", rejectionReason: "rách" }] },
  );
  assert.deepEqual(
    issueReturnPayload(lines, [row({ rejectedQuantity: "10", rejectionReason: "hỏng" })]).items[0]
      .acceptedQuantity,
    "0",
  );
});

test("refuses more than what is left, bad numbers and an empty form", () => {
  const lines = [line({ returnedQuantity: "4" })];
  assert.match(issueReturnPayload(lines, [row({ acceptedQuantity: "7" })]).error, /vượt/);
  assert.match(issueReturnPayload(lines, [row({ acceptedQuantity: "-1" })]).error, /không âm/);
  assert.match(issueReturnPayload(lines, [row()]).error, /ít nhất một dòng/);
});
