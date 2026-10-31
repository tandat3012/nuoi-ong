import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adjustmentIncreaseBlocked,
  formatInventoryMovement,
  formatInventoryQuantity,
  sumInventoryByItem,
} from "./inventory.logic.ts";

test("quantities drop trailing zeros and use Vietnamese separators without losing precision", () => {
  for (const [quantity, expected] of [
    ["95.000", "95"],
    ["35.125", "35,125"],
    ["0.500", "0,5"],
    ["1.250", "1,25"],
    ["0.005", "0,005"],
    ["0.000", "0"],
    ["100", "100"],
    ["1234.500", "1.234,5"],
    ["-1234.500", "-1.234,5"],
    ["999999999999999.990", "999.999.999.999.999,99"],
  ]) {
    assert.equal(formatInventoryQuantity(quantity), expected, quantity);
  }
  assert.equal(formatInventoryMovement("2.500"), "+2,5");
  assert.equal(formatInventoryMovement("-2.500"), "-2,5");
  assert.equal(formatInventoryMovement("0.000"), "0");
});

test("adjustmentIncreaseBlocked only blocks increases on inactive items or expired lots", () => {
  const today = "2026-10-26";
  const active = { itemInactive: false };
  assert.equal(adjustmentIncreaseBlocked("5", active, today), null);
  assert.match(
    adjustmentIncreaseBlocked("5", { itemInactive: true }, today),
    /ngừng hoạt động/,
  );
  assert.equal(
    adjustmentIncreaseBlocked("-5", { itemInactive: true }, today),
    null,
  );
  const expired = { itemInactive: false, lotExpiryDate: "2026-10-25" };
  assert.match(adjustmentIncreaseBlocked("+1", expired, today), /hết hạn/);
  assert.equal(adjustmentIncreaseBlocked("-1", expired, today), null);
  const expiresToday = { itemInactive: false, lotExpiryDate: today };
  assert.equal(adjustmentIncreaseBlocked("1", expiresToday, today), null);
});

test("sumInventoryByItem adds lots per item without float drift", () => {
  const totals = sumInventoryByItem([
    { quantityOnHand: "0.100", item: { id: "a" } },
    { quantityOnHand: "0.200", item: { id: "a" } },
    { quantityOnHand: "12", item: { id: "b" } },
    { quantityOnHand: "-0.5", item: { id: "c" } },
    { quantityOnHand: "999999999999999.999", item: { id: "d" } },
  ]);
  assert.equal(totals.get("a"), "0,3");
  assert.equal(totals.get("b"), "12");
  assert.equal(totals.get("c"), "-0,5");
  assert.equal(totals.get("d"), "999.999.999.999.999,999");
});
