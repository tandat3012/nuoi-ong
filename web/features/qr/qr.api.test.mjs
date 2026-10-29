import assert from "node:assert/strict";
import { test } from "node:test";
import { getBalanceQr, getItemQr, qrErrorMessage } from "./qr.api.ts";

test("QR lookups call the farm-scoped item and balance endpoints", async () => {
  const calls = [];
  const request = async (path, options) => {
    calls.push([path, options]);
    return { data: {} };
  };
  await getItemQr(request, "farm-a", "item-1");
  await getBalanceQr(request, "farm-b", "balance-1");
  assert.deepEqual(calls, [
    ["/items/item-1/qr", { params: { farmId: "farm-a" } }],
    ["/inventory/balance-1/qr", { params: { farmId: "farm-b" } }],
  ]);
});

test("QR errors explain a label from another farm, missing access and expired sessions", () => {
  const failure = (status) => Object.assign(new Error("x"), { status });
  assert.equal(qrErrorMessage(failure(404), "not here"), "not here");
  assert.match(qrErrorMessage(failure(403), "not here"), /không có quyền/);
  assert.match(qrErrorMessage(failure(401), "not here"), /đăng nhập/);
  for (const error of [failure(500), new Error("network"), null])
    assert.match(qrErrorMessage(error, "not here"), /Thử lại/i);
});
