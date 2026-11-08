import assert from "node:assert/strict";
import { test } from "node:test";
import { lineAssets, nextSteps, warrantyCoverage, warrantyErrorMessage } from "./warranty.logic.ts";

const actions = (request) => nextSteps(request).map((step) => step.action);
const base = { kind: "WARRANTY", customerApproved: null, exchangeIssue: null };

test("a paid repair cannot start before the customer agreed (AC23)", () => {
  assert.ok(actions({ ...base, status: "AT_PARTNER" }).includes("start-repair"));
  const paid = { ...base, kind: "PAID_REPAIR", status: "AT_PARTNER" };
  assert.ok(!actions(paid).includes("start-repair"));
  assert.ok(!actions({ ...paid, customerApproved: false }).includes("start-repair"));
  assert.ok(actions({ ...paid, customerApproved: true }).includes("start-repair"));
  assert.ok(!actions({ ...base, status: "AWAITING_CUSTOMER" }).includes("start-repair"));
});

test("an exchange closes only once the warehouse issued the replacement (AC24)", () => {
  const exchanging = (status) => ({ ...base, status: "EXCHANGING", exchangeIssue: { id: "i", issueCode: null, status } });
  assert.deepEqual(actions(exchanging("DRAFT")), []);
  assert.deepEqual(actions(exchanging("CONFIRMED")), ["close"]);
  assert.deepEqual(actions(exchanging("REJECTED")), ["exchange"]);
  assert.deepEqual(actions({ ...base, status: "CLOSED" }), []);
});

test("coverage counts from delivery and keeps the months sold", () => {
  const now = new Date("2026-11-06T00:00:00Z");
  assert.equal(warrantyCoverage("2026-01-10T00:00:00Z", 12, now).inWarranty, true);
  assert.equal(warrantyCoverage("2024-01-10T00:00:00Z", 12, now).inWarranty, false);
  assert.equal(warrantyCoverage("2026-01-10T00:00:00Z", 0, now).inWarranty, false);
  assert.match(warrantyCoverage("2026-01-10T00:00:00Z", null, now).label, /nhân viên quyết định/);
});

test("explains API codes in Vietnamese", () => {
  assert.match(warrantyErrorMessage({ details: { code: "CUSTOMER_CONSENT_REQUIRED" } }), /khách đồng ý/);
  assert.equal(warrantyErrorMessage({ details: { message: "x" } }), "x");
});

test("an asset line claims one of its own delivered units", () => {
  const delivered = [
    { id: "a", itemId: "tool" },
    { id: "b", itemId: "other" },
  ];
  assert.deepEqual(lineAssets(delivered, { itemId: "tool" }).map((a) => a.id), ["a"]);
  assert.deepEqual(lineAssets(delivered, undefined), []);
  assert.deepEqual(lineAssets(undefined, { itemId: "tool" }), []);
  assert.equal(
    warrantyErrorMessage({ details: { code: "WARRANTY_ASSET_OPEN" } }),
    "Tài sản này đang có yêu cầu bảo hành chưa đóng.",
  );
});

test("the same request can be re-quoted or sent round again (P1-10)", () => {
  assert.ok(actions({ ...base, status: "AWAITING_CUSTOMER" }).includes("quote"));
  assert.ok(actions({ ...base, status: "IN_REPAIR" }).includes("quote"));
  assert.ok(actions({ ...base, status: "BACK_FROM_PARTNER" }).includes("send"));
  assert.ok(!actions({ ...base, status: "BACK_FROM_PARTNER" }).includes("close"));
});
