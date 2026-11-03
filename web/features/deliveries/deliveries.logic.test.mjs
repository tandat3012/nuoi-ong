import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canMarkDelivered,
  cashToCollect,
  deliveryErrorMessage,
} from "./deliveries.logic.ts";

test("COD can always be delivered; bank transfers only once paid", () => {
  assert.equal(canMarkDelivered({ paymentMethod: "COD", paymentStatus: "UNPAID" }), true);
  assert.equal(canMarkDelivered({ paymentMethod: "BANK_TRANSFER", paymentStatus: "UNPAID" }), false);
  assert.equal(canMarkDelivered({ paymentMethod: "BANK_TRANSFER", paymentStatus: "PAID" }), true);
});

test("the shipper collects the total only for unpaid COD", () => {
  const order = { paymentMethod: "COD", paymentStatus: "UNPAID", total: "585000" };
  assert.equal(cashToCollect(order), "585000");
  assert.equal(cashToCollect({ ...order, paymentStatus: "PAID" }), null);
  assert.equal(cashToCollect({ ...order, paymentMethod: "BANK_TRANSFER" }), null);
});

test("API refusals become Vietnamese messages", () => {
  assert.match(
    deliveryErrorMessage({ status: 403, message: "Only the shipper of this order or a store manager can do this" }),
    /người đang giao/,
  );
  assert.match(deliveryErrorMessage({ status: 409, message: "Only CONFIRMED orders can be shipped" }), /đã có người nhận/);
  assert.match(deliveryErrorMessage({ status: 403, message: "Delivery permission is required" }), /không có quyền/);
});
