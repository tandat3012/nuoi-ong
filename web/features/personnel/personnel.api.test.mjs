import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addExistingPersonnel,
  createPersonnel,
  getMember,
  getMemberRecords,
  getPersonnel,
  updateMember,
} from "./personnel.api.ts";

test("personnel calls preserve selected farm, encoded member IDs, and explicit operations", async () => {
  const calls = [];
  const response = { data: [] };
  const request = async (path, options) => {
    calls.push({ path, ...options });
    return response;
  };
  await getPersonnel(request, "selected", {
    page: 3,
    pageSize: 20,
    search: "  An  ",
    farmId: "foreign",
  });
  await getMember(request, "selected", "M/1");
  const payload = {
    requestId: "same-request",
    email: "an@example.test",
    initialPassword: "private secret",
    roleCodes: ["EMPLOYEE"],
    warehouseIds: [],
  };
  await createPersonnel(request, "selected", payload);
  await createPersonnel(request, "selected", payload);
  await addExistingPersonnel(request, "selected", {
    email: "existing@example.test",
    roleCodes: ["GUEST"],
    warehouseIds: [],
  });
  await updateMember(request, "selected", "M/1", "roles", {
    roleCodes: ["GUEST"],
  });
  await updateMember(request, "selected", "M/1", "status", {
    status: "INACTIVE",
  });
  await getMemberRecords(request, "selected", "M/1", "history", 4);
  assert.ok(calls.every((call) => call.params.farmId === "selected"));
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      "/personnel",
      "/personnel/M%2F1",
      "/personnel/accounts",
      "/personnel/accounts",
      "/personnel/existing-accounts",
      "/personnel/M%2F1/roles",
      "/personnel/M%2F1/status",
      "/personnel/M%2F1/history",
    ],
  );
  assert.equal(calls[0].params.search, "An");
  assert.equal(calls[2].data, calls[3].data);
  assert.equal(calls[4].data.initialPassword, undefined);
  assert.equal(calls[5].method, "PUT");
  assert.equal(calls[6].method, "PATCH");
  assert.equal(calls[7].params.page, 4);
});
test("account creation makes one attempt; callers control retries using the same request ID", async () => {
  let attempts = 0;
  await assert.rejects(
    createPersonnel(
      async () => {
        attempts++;
        throw Error("timeout");
      },
      "farm",
      { requestId: "same" },
    ),
    /timeout/,
  );
  assert.equal(attempts, 1);
});
