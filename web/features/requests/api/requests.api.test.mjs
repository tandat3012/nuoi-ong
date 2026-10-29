import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approveMaintenanceRequest, approveTransferRequest, createMaintenanceRequest,
  createTransferRequest, getRequestById, getRequests, rejectRequest,
} from "./requests.api.ts";

test("request lists send farm, status, asset filter and pagination to each endpoint", async () => {
  const calls = [];
  const response = { data: [], page: { number: 3, size: 20, totalItems: 50, totalPages: 3 } };
  const request = async (path, options) => { calls.push({ path, options }); return response; };
  for (const [type, path] of [["maintenance", "/maintenance-requests"], ["transfer", "/asset-transfer-requests"]]) {
    assert.equal(await getRequests(request, "farm-a", type, { page: 3, status: "PENDING_APPROVAL", assetId: "asset-a" }), response);
    assert.deepEqual(calls.at(-1), { path, options: { params: {
      farmId: "farm-a", assetId: "asset-a", status: "PENDING_APPROVAL", page: 3, pageSize: 20,
    } } });
    await getRequests(request, "farm-a", type, { page: 1, status: "ALL" });
    assert.equal(calls.at(-1).options.params.status, undefined);
  }
});

test("detail requests encode IDs and use the selected farm", async () => {
  for (const [type, path] of [["maintenance", "/maintenance-requests"], ["transfer", "/asset-transfer-requests"]]) {
    const response = { data: { id: "request/a" } };
    assert.equal(await getRequestById(async (url, options) => {
      assert.equal(url, `${path}/request%2Fa`);
      assert.deepEqual(options, { params: { farmId: "farm-b" } });
      return response;
    }, "farm-b", type, "request/a"), response);
  }
});

test("send functions preserve maintenance and transfer DTO bodies", async () => {
  const calls = [];
  const request = async (path, options) => { calls.push({ path, options }); return { data: {} }; };
  const maintenance = { assetId: "asset-a", maintenanceType: "INSPECTION", description: "Kiểm tra máy" };
  const transfer = { assetId: "asset-a", warehouseId: "warehouse-b", locationId: "location-b", note: "Chuyển kho" };
  await createMaintenanceRequest(request, "farm-a", maintenance);
  await createTransferRequest(request, "farm-a", transfer);
  assert.deepEqual(calls, [
    { path: "/maintenance-requests", options: { method: "POST", params: { farmId: "farm-a" }, data: maintenance } },
    { path: "/asset-transfer-requests", options: { method: "POST", params: { farmId: "farm-a" }, data: transfer } },
  ]);
});

test("approve and reject functions use dedicated paths and exact DTOs", async () => {
  const calls = [];
  const request = async (path, options) => { calls.push({ path, options }); return { data: {} }; };
  const scheduledAt = "2026-11-02T02:30:00.000Z";
  await approveMaintenanceRequest(request, "farm-a", "request/a", scheduledAt);
  await approveTransferRequest(request, "farm-a", "request/a");
  await rejectRequest(request, "farm-a", "maintenance", "request/a", "Cần bổ sung");
  await rejectRequest(request, "farm-a", "transfer", "request/a", "Kho đang đầy");
  assert.deepEqual(calls, [
    { path: "/maintenance-requests/request%2Fa/approve", options: { method: "POST", params: { farmId: "farm-a" }, data: { scheduledAt } } },
    { path: "/asset-transfer-requests/request%2Fa/approve", options: { method: "POST", params: { farmId: "farm-a" } } },
    { path: "/maintenance-requests/request%2Fa/reject", options: { method: "POST", params: { farmId: "farm-a" }, data: { rejectionReason: "Cần bổ sung" } } },
    { path: "/asset-transfer-requests/request%2Fa/reject", options: { method: "POST", params: { farmId: "farm-a" }, data: { rejectionReason: "Kho đang đầy" } } },
  ]);
});
