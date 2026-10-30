import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/"))
      return nextResolve(
        new URL(`../../../${specifier.slice(2)}.ts`, import.meta.url).href,
        context,
      );
    return nextResolve(specifier, context);
  },
});
const {
  getAssets,
  getAsset,
  getAssetByCode,
  getAssetChoices,
  returnAsset,
  getAssetHolder,
  getAssetHistory,
  createAsset,
  updateAsset,
  assetAction,
  maintenanceAction,
  getAssetLabel,
} = await import("./assets.api.ts");

test("asset requests use relative routes, farm scope and unchanged envelopes", async () => {
  const calls = [];
  const response = {
    data: [],
    page: { number: 1, size: 20, totalItems: 0, totalPages: 0 },
  };
  const request = async (path, options) => {
    calls.push({ path, ...options });
    return response;
  };
  assert.equal(
    await getAssets(request, "selected", {
      page: 2,
      pageSize: 20,
      search: "  pump  ",
      status: "IN_USE",
      farmId: "foreign",
    }),
    response,
  );
  assert.equal(calls[0].params.farmId, "selected");
  assert.equal(calls[0].params.search, "pump");
  await getAsset(request, "selected", "asset-id");
  await getAssetByCode(request, "selected", "A/B #1");
  await getAssetByCode(
    request,
    "selected",
    "00000000-0000-4000-8000-000000000001",
  );
  await returnAsset(request, "selected", "asset-id", {
    warehouseId: "w",
    locationId: "l",
    note: null,
  });
  assert.deepEqual(
    calls.map((c) => c.path),
    [
      "/assets",
      "/assets/asset-id",
      "/assets/by-code/A%2FB%20%231",
      "/assets/by-code/00000000-0000-4000-8000-000000000001",
      "/assets/asset-id/return",
    ],
  );
  assert.ok(calls.every((c) => c.params.farmId === "selected"));
  assert.equal(calls[4].method, "POST");
  assert.deepEqual(calls[4].data, {
    warehouseId: "w",
    locationId: "l",
    note: null,
  });
});

test("lifecycle calls keep selected farm, encode identities, retain stale-write version and never retry mutations", async () => {
  const calls = [];
  const request = async (path, options) => {
    calls.push({ path, ...options });
    return {
      data: [],
      page: { number: 2, size: 10, totalItems: 11, totalPages: 2 },
    };
  };
  await getAssetHolder(request, "selected", "A/B");
  await getAssetHistory(request, "selected", "A/B", "assignments", 2);
  const metadata = {
    purchasePrice: "9999999999999999.99",
    purchaseDate: "2026-01-01",
    note: null,
  };
  await createAsset(request, "selected", {
    ...metadata,
    assetCode: "NEW",
    warehouseId: "w",
    locationId: "l",
    itemId: "i",
  });
  await updateAsset(
    request,
    "selected",
    { id: "A/B", updatedAt: "2026-01-01T01:00:00Z" },
    metadata,
  );
  await assetAction(request, "selected", "A/B", "assign", {
    assignedToMemberId: "m",
    locationId: "l",
  });
  await maintenanceAction(request, "selected", null, "create", {
    assetId: "A/B",
    maintenanceType: "PREVENTIVE",
  });
  await maintenanceAction(request, "selected", "M/1", "complete", {
    laborCost: "100.00",
    resultNote: "Done",
  });
  await getAssetLabel(request, "selected", "A/B");
  assert.ok(calls.every((call) => call.params.farmId === "selected"));
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      "/assets/A%2FB/holder",
      "/assets/A%2FB/history",
      "/assets",
      "/assets/A%2FB",
      "/assets/A%2FB/assign",
      "/maintenance-records",
      "/maintenance-records/M%2F1/complete",
      "/assets/A%2FB/label",
    ],
  );
  assert.equal(calls[1].params.kind, "assignments");
  assert.equal(calls[1].params.page, 2);
  assert.equal(calls[3].method, "PATCH");
  assert.equal(calls[3].data.updatedAt, "2026-01-01T01:00:00Z");
  assert.equal(calls[3].data.purchasePrice, metadata.purchasePrice);
  let attempts = 0;
  await assert.rejects(
    assetAction(
      async () => {
        attempts++;
        throw Error("timeout");
      },
      "selected",
      "asset",
      "retire",
      { note: "Reason" },
    ),
    /timeout/,
  );
  assert.equal(attempts, 1);
});

test("member lookup is paginated and uses the selected farm", async () => {
  let call;
  const result = await getAssetChoices(
    async (path, options) => {
      call = { path, ...options };
      return {
        data: [{ id: "m", name: "Nguyễn An", email: "an@example.test" }],
        page: { number: 12, size: 10, totalItems: 111, totalPages: 12 },
      };
    },
    "selected",
    "member",
    { search: " An ", page: 12 },
  );
  assert.equal(call.path, "/assets/members");
  assert.equal(call.params.farmId, "selected");
  assert.equal(call.params.search, "An");
  assert.equal(call.params.page, 12);
  assert.equal(result.data[0].label, "Nguyễn An");
});

test("lookups preserve paging beyond 100 and historical item filters; returns require active destinations", async () => {
  const calls = [];
  const request = async (path, options) => {
    calls.push({ path, ...options });
    return {
      data:
        path === "/items"
          ? [{ item: { id: "i", code: "I", name: "Item" } }]
          : [{ id: "w", code: "W", name: "Warehouse" }],
      page: { number: 11, size: 10, totalItems: 111, totalPages: 12 },
    };
  };
  const response = await getAssetChoices(request, "farm", "item", {
    page: 11,
    search: "",
  });
  assert.equal(response.page.totalItems, 111);
  assert.equal(response.data[0].id, "i");
  assert.equal(calls[0].params.page, 11);
  assert.equal(calls[0].params.status, undefined);
  assert.equal(calls[0].params.trackingMode, "ASSET");
  await getAssetChoices(request, "farm", "warehouse", {
    page: 1,
    search: "",
    activeOnly: true,
  });
  await getAssetChoices(request, "farm", "location", {
    page: 2,
    search: " zone ",
    warehouseId: "w",
    activeOnly: true,
  });
  assert.equal(calls[1].params.status, "ACTIVE");
  assert.equal(calls[2].params.status, "ACTIVE");
  assert.equal(calls[2].params.warehouseId, "w");
  assert.equal(calls[2].params.search, "zone");
});

test("uncertain return failures propagate once without automatically retrying POST", async () => {
  let count = 0;
  await assert.rejects(
    returnAsset(
      async () => {
        count++;
        throw new Error("timeout");
      },
      "farm",
      "asset",
      { warehouseId: "w", locationId: "l" },
    ),
    /timeout/,
  );
  assert.equal(count, 1);
});
