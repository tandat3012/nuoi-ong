import assert from "node:assert/strict";
import { test } from "node:test";
import {
  beginOrderAttempt,
  canCompleteOrder,
  canCustomerCancel,
  canEditShippingFee,
  canShipOrder,
  canStaffCancel,
  canStaffCancelDetail,
  isDefiniteOrderFailure,
  canonicalOrderPayload,
  formatOrderMoney,
  loadOrderAttempt,
  orderErrorMessage,
  parseOrderAttemptPayload,
  updateOrderAttempt,
} from "./order.logic.ts";

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

const order = (patch = {}) => ({
  status: "PENDING",
  paymentStatus: "UNPAID",
  paymentMethod: "COD",
  ...patch,
});

test("order cancellation and shipping fee rules match V1 transitions", () => {
  assert.equal(canCustomerCancel(order()), true);
  assert.equal(canCustomerCancel(order({ status: "CONFIRMED" })), false);
  assert.equal(canCustomerCancel(order({ paymentStatus: "PAID" })), false);
  assert.equal(canStaffCancel(order({ status: "CONFIRMED" })), true);
  assert.equal(canStaffCancel(order({ status: "SHIPPING" })), false);
  assert.equal(canStaffCancel(order({ paymentStatus: "PAID" })), false);
  assert.equal(canEditShippingFee(order()), true);
  assert.equal(canEditShippingFee(order({ status: "CONFIRMED" })), false);
});

test("only paid bank transfers can complete; COD completion remains available", () => {
  const detail = (patch = {}) => ({
    order: order({ status: "SHIPPING", ...patch }),
  });
  assert.equal(canCompleteOrder(detail()), true);
  assert.equal(
    canCompleteOrder(detail({ paymentMethod: "BANK_TRANSFER" })),
    false,
  );
  assert.equal(
    canCompleteOrder(
      detail({ paymentMethod: "BANK_TRANSFER", paymentStatus: "PAID" }),
    ),
    true,
  );
});

test("shipping and staff cancellation wait for linked issue state", () => {
  const detail = (issueStatus) => ({
    order: order({ status: "CONFIRMED" }),
    stockIssue: issueStatus ? { status: issueStatus } : null,
  });
  assert.equal(canShipOrder(detail("DRAFT")), false);
  assert.equal(canShipOrder(detail("CONFIRMED")), true);
  assert.equal(canStaffCancelDetail(detail("CONFIRMED")), false);
  assert.equal(canStaffCancelDetail(detail("DRAFT")), true);
});

test("money formatting keeps whole-VND aggregates exact beyond Number safe range", () => {
  assert.match(
    formatOrderMoney("9007199254740993"),
    /9\.007\.199\.254\.740\.993/,
  );
  assert.equal(formatOrderMoney("1.5"), "—");
});

test("only definite domain responses release an uncertain idempotency attempt", () => {
  for (const status of [400, 404, 409, 422])
    assert.equal(isDefiniteOrderFailure(status), true);
  for (const status of [0, 401, 403, 408, 429, 500, 503])
    assert.equal(isDefiniteOrderFailure(status), false);
});

test("canonical payload ignores whitespace and item order", () => {
  const one = canonicalOrderPayload({
    recipientName: " Mai ",
    phone: " 0912 ",
    address: " A ",
    paymentMethod: "COD",
    items: [
      { variantId: "b", quantity: 2, expectedUnitPrice: "200" },
      { variantId: "a", quantity: 1, expectedUnitPrice: "100" },
    ],
  });
  const two = canonicalOrderPayload({
    recipientName: "Mai",
    phone: "0912",
    address: "A",
    paymentMethod: "COD",
    items: [
      { variantId: "a", quantity: 1, expectedUnitPrice: "100" },
      { variantId: "b", quantity: 2, expectedUnitPrice: "200" },
    ],
  });
  assert.equal(one, two);
});

test("saved payloads are validated before restoring or retrying", () => {
  const payload = canonicalOrderPayload({
    recipientName: "Mai",
    phone: "0912",
    address: "A",
    paymentMethod: "COD",
    items: [{ variantId: "variant", quantity: 1, expectedUnitPrice: "0" }],
  });
  assert.equal(parseOrderAttemptPayload(payload)?.items[0].quantity, 1);
  assert.equal(parseOrderAttemptPayload('{"items":[{"quantity":1}]}'), null);
});

test("the same pending payload reuses its key; uncertain changed payloads are blocked", () => {
  const storage = memoryStorage();
  const first = beginOrderAttempt(
    storage,
    "user-1",
    "payload-a",
    () => "key-1",
  );
  const retry = beginOrderAttempt(
    storage,
    "user-1",
    "payload-a",
    () => "key-2",
  );
  assert.equal(retry.key, first.key);
  assert.throws(
    () => beginOrderAttempt(storage, "user-1", "payload-b", () => "key-3"),
    { code: "UNRESOLVED_ATTEMPT" },
  );
  updateOrderAttempt(storage, "user-1", first, "failed");
  assert.equal(
    beginOrderAttempt(storage, "user-1", "payload-b", () => "key-3").key,
    "key-3",
  );
  assert.equal(loadOrderAttempt(storage, "user-1")?.payload, "payload-b");
  const succeeded = beginOrderAttempt(
    storage,
    "user-1",
    "payload-b",
    () => "key-4",
  );
  updateOrderAttempt(storage, "user-1", succeeded, "succeeded", "order-1");
  assert.equal(
    beginOrderAttempt(storage, "user-1", "payload-b", () => "key-5").key,
    "key-5",
  );
});

test("explains server validation errors per field instead of a generic message", () => {
  const badRequest = (message) => ({
    status: 400,
    details: { statusCode: 400, message, error: "Bad Request" },
  });
  const phone = orderErrorMessage(
    badRequest(["phone must match /^\\+?[\\d ()-]+$/ regular expression"]),
  );
  assert.match(phone, /Số điện thoại/);
  const both = orderErrorMessage(
    badRequest([
      "address must be longer than or equal to 5 characters",
      "items.0.quantity must not be greater than 10000",
    ]),
  );
  assert.match(both, /Địa chỉ/);
  assert.match(both, /Giỏ hàng/);
  assert.match(orderErrorMessage(badRequest("Duplicate variant")), /bị lặp/);
  assert.match(
    orderErrorMessage(badRequest(["property foo should not exist"])),
    /Yêu cầu chưa được chấp nhận/,
  );
});

test("tells farm staff why they cannot check out", () => {
  assert.match(
    orderErrorMessage({
      status: 403,
      message: "Only customer accounts can place storefront orders",
    }),
    /nhân viên trang trại không thể đặt hàng/,
  );
  assert.match(
    orderErrorMessage({ status: 403, message: "Forbidden resource" }),
    /không có quyền/,
  );
});
