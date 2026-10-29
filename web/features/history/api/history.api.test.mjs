import assert from "node:assert/strict";
import { test } from "node:test";
import { getAuditLogs } from "./history.api.ts";

test("audit lists send selected farm, server filters and the panel/page pagination", async () => {
  const entityId = "123e4567-e89b-42d3-a456-426614174000";
  for (const pageSize of [10, 20]) {
    const filters = { entityType: "STOCK_RECEIPT", entityId, action: "CONFIRM", page: 3, pageSize };
    const response = { data: [{ id: "log-a" }], page: { number: 3, size: pageSize, totalItems: 45, totalPages: 5 } };
    let calls = 0;
    const result = await getAuditLogs(async (path, options) => {
      calls++;
      assert.equal(path, "/audit-logs");
      assert.deepEqual(options, { params: { farmId: "farm-b", ...filters } });
      return response;
    }, "farm-b", filters);
    assert.equal(result, response);
    assert.equal(calls, 1);
  }
});

test("audit lists omit empty filters rather than sending empty query values", async () => {
  for (const empty of [undefined, "", "   "]) {
    await getAuditLogs(async (path, options) => {
      assert.equal(path, "/audit-logs");
      assert.deepEqual(options.params, { farmId: "farm-a", page: 1, pageSize: 20 });
      return { data: [] };
    }, "farm-a", { entityType: empty, entityId: empty, action: empty, page: 1, pageSize: 20 });
  }
});

test("audit lists preserve server failures for the Vietnamese error mapper", async () => {
  for (const status of [401, 403, 404, 409, 400, 500]) {
    const failure = Object.assign(new Error("Server failure"), { status });
    await assert.rejects(getAuditLogs(async () => { throw failure; }, "farm-a", { page: 1, pageSize: 10 }),
      (error) => error === failure);
  }
});
