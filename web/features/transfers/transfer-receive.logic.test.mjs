import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canReceiveTransfer,
  canResolveTransfer,
  receiveErrorMessage,
  receivePayload,
} from "./transfer-receive.logic.ts";

const lines = [
  { id: "a", quantity: "5.000" },
  { id: "b", quantity: "2.500" },
];

test("only warehouse managers receive, and only dispatched transfers", () => {
  assert.equal(canReceiveTransfer(["WAREHOUSE_MANAGER"], { status: "IN_TRANSIT" }), true);
  assert.equal(canReceiveTransfer(["WAREHOUSE_MANAGER"], { status: "PENDING_APPROVAL" }), false);
  assert.equal(canReceiveTransfer(["EMPLOYEE"], { status: "IN_TRANSIT" }), false);
});

test("sends only short lines; empty or full lines arrived in full", () => {
  assert.deepEqual(receivePayload(lines, {}), { items: [] });
  assert.deepEqual(
    receivePayload(lines, {
      a: { receivedQuantity: "5", discrepancyReason: "" },
      b: { receivedQuantity: " 2.4 ", discrepancyReason: " vỡ 1 " },
    }),
    { items: [{ id: "b", receivedQuantity: "2.4", discrepancyReason: "vỡ 1" }] },
  );
  // Losing everything is allowed, with a reason.
  assert.deepEqual(
    receivePayload(lines, { a: { receivedQuantity: "0", discrepancyReason: "mất" } }).items,
    [{ id: "a", receivedQuantity: "0", discrepancyReason: "mất" }],
  );
});

test("refuses more than dispatched, bad numbers and a short line without reason", () => {
  assert.throws(
    () => receivePayload(lines, { a: { receivedQuantity: "5.001", discrepancyReason: "" } }),
    /vượt số đã xuất/,
  );
  assert.throws(
    () => receivePayload(lines, { a: { receivedQuantity: "-1", discrepancyReason: "x" } }),
    /không âm/,
  );
  assert.throws(
    () => receivePayload(lines, { a: { receivedQuantity: "4", discrepancyReason: " " } }),
    /lý do/,
  );
});

test("translates the API's receive errors", () => {
  assert.match(
    receiveErrorMessage("Stock warehouse access is limited to assigned warehouses"),
    /kho đích/,
  );
  assert.equal(receiveErrorMessage("something else"), "something else");
});

test("only the owner or admin settles a short receipt", () => {
  assert.equal(canResolveTransfer(["FARM_OWNER"], { status: "DISCREPANCY" }), true);
  assert.equal(canResolveTransfer(["ADMIN"], { status: "DISCREPANCY" }), true);
  assert.equal(canResolveTransfer(["WAREHOUSE_MANAGER"], { status: "DISCREPANCY" }), false);
  assert.equal(canResolveTransfer(["FARM_OWNER"], { status: "CONFIRMED" }), false);
});
