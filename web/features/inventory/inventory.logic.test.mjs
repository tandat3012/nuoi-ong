import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adjustmentIncreaseBlocked,
  sumInventoryByItem,
} from "./inventory.logic.ts";

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
  assert.equal(totals.get("a"), "0.3");
  assert.equal(totals.get("b"), "12");
  assert.equal(totals.get("c"), "-0.5");
  assert.equal(totals.get("d"), "999999999999999.999");
});
