import assert from "node:assert/strict";
import { test } from "node:test";
import { requestErrorMessage, requestFailureStatus, runRequestAction } from "./requests.logic.ts";
import {
  approveMaintenanceRequest, approveTransferRequest, createMaintenanceRequest,
  createTransferRequest, rejectRequest,
} from "./api/requests.api.ts";

const actions = [
  ["send maintenance", (request) => createMaintenanceRequest(request, "farm-a", { assetId: "asset-a", maintenanceType: "CORRECTIVE", description: "Máy hỏng" })],
  ["send transfer", (request) => createTransferRequest(request, "farm-a", { assetId: "asset-a", warehouseId: "w", locationId: "l" })],
  ["approve maintenance", (request) => approveMaintenanceRequest(request, "farm-a", "request-a", "2026-11-02T02:30:00.000Z")],
  ["approve transfer", (request) => approveTransferRequest(request, "farm-a", "request-a")],
  ["reject maintenance", (request) => rejectRequest(request, "farm-a", "maintenance", "request-a", "Không phù hợp")],
  ["reject transfer", (request) => rejectRequest(request, "farm-a", "transfer", "request-a", "Không phù hợp")],
];

for (const [name, action] of actions) {
  test(`${name} reloads affected data on success`, async () => {
    const events = [];
    await runRequestAction(() => action(async () => {
      events.push("send"); return { data: {} };
    }), {
      onError: (failure) => { assert.equal(failure, null); events.push("clear error"); },
      onChanged: () => events.push("reload"),
    });
    assert.deepEqual(events, ["clear error", "send", "reload"]);
  });

  test(`${name} keeps answered failures visible through reload, except auth failures`, async () => {
    for (const status of [400, 404, 409, 500, 401, 403, 0, null]) {
      const events = [];
      const failure = Object.assign(new Error("Warehouse must exist and be active in this farm"), status === null ? {} : { status });
      let parentError = null;
      await assert.rejects(runRequestAction(() => action(async () => { throw failure; }), {
        onError: (error) => {
          parentError = error === null ? null : requestErrorMessage(requestFailureStatus(error), error.message);
          events.push(error === null ? "clear error" : "save error");
        },
        onChanged: () => { assert.ok(parentError); events.push("reload"); },
      }), (error) => error === failure);
      assert.deepEqual(events, status === 401 || status === 403
        ? ["clear error", "save error"] : ["clear error", "save error", "reload"], String(status));
      assert.ok(parentError);
      if (status === 409) assert.match(parentError, /không còn hoạt động/);
    }
  });
}
