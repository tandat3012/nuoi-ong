import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assetError,
  canReturnAsset,
  changeAssetFilters,
  formatAssetDate,
  formatAssetPrice,
  validAssetIdentity,
  canWriteAssets,
  assetActions,
} from "./asset.logic.ts";

test("filter changes reset pages and clear locations only when warehouse changes", () => {
  const filters = {
    page: 9,
    pageSize: 20,
    warehouseId: "w1",
    locationId: "l1",
  };
  assert.deepEqual(changeAssetFilters(filters, { warehouseId: "w2" }), {
    page: 1,
    pageSize: 20,
    warehouseId: "w2",
    locationId: undefined,
  });
  assert.equal(
    changeAssetFilters(filters, { search: "pump" }).locationId,
    "l1",
  );
  assert.equal(
    changeAssetFilters(filters, { locationId: undefined }).locationId,
    undefined,
  );
  assert.equal(changeAssetFilters(filters, { status: "IN_USE" }).page, 1);
});

test("return action requires both write role and eligible status", () => {
  for (const status of [
    "AVAILABLE",
    "ASSIGNED",
    "IN_USE",
    "MAINTENANCE",
    "LOST",
    "RETIRED",
  ]) {
    for (const role of ["ADMIN", "FARM_OWNER", "EMPLOYEE", "GUEST"]) {
      assert.equal(
        canReturnAsset([role], status),
        ["ADMIN", "FARM_OWNER"].includes(role) &&
          ["ASSIGNED", "IN_USE"].includes(status),
      );
    }
  }
});

test("prices remain exact at numeric(18,2) boundaries and dates do not shift timezones", () => {
  assert.equal(formatAssetPrice(null), "—");
  assert.equal(formatAssetPrice("0.00"), "0,00 ₫");
  assert.equal(
    formatAssetPrice("9999999999999999.99"),
    "9.999.999.999.999.999,99 ₫",
  );
  assert.equal(
    formatAssetPrice("9007199254740993.01"),
    "9.007.199.254.740.993,01 ₫",
  );
  assert.equal(formatAssetDate("2026-01-01"), "01/01/2026");
  assert.equal(formatAssetDate(null), "—");
});

test("invalid identifiers are rejected but UUID-looking asset codes stay codes", () => {
  assert.equal(validAssetIdentity("not-uuid", false), false);
  assert.equal(
    validAssetIdentity("00000000-0000-4000-8000-000000000001", false),
    true,
  );
  assert.equal(validAssetIdentity(" ", true), false);
  assert.equal(validAssetIdentity("x".repeat(101), true), false);
  assert.equal(validAssetIdentity("x".repeat(100), true), true);
  assert.equal(validAssetIdentity("🐝".repeat(100), true), true);
  assert.equal(validAssetIdentity("🐝".repeat(101), true), false);
  assert.equal(
    validAssetIdentity("00000000-0000-4000-8000-000000000001", true),
    true,
  );
});

test("uncertain writes and conflicts require a reload; reads remain retryable", () => {
  for (const status of [0, 403, 404, 409, 500, 503])
    assert.equal(assetError({ status }, true).reloadRequired, true);
  assert.equal(assetError({ status: 400 }, true).reloadRequired, false);
  assert.equal(assetError(new Error("network"), true).reloadRequired, true);
  assert.match(assetError({ status: 404 }).message, /trang trại đang chọn/);
  assert.equal(assetError({ status: 500 }).reloadRequired, false);
});

test("terminal assets expose only safe lifecycle actions and writer checks do not broaden roles", () => {
  assert.deepEqual(assetActions("RETIRED"), []);
  assert.deepEqual(assetActions("MAINTENANCE"), []);
  assert.deepEqual(assetActions("TRANSFER_PENDING"), []);
  assert.deepEqual(assetActions("LOST"), ["recover"]);
  assert.ok(assetActions("AVAILABLE").includes("transfer"));
  assert.ok(assetActions("AVAILABLE").includes("retire"));
  assert.ok(!assetActions("IN_USE").includes("retire"));
  assert.ok(assetActions("ASSIGNED").includes("start-use"));
  assert.ok(!assetActions("IN_USE").includes("start-use"));
  assert.equal(canWriteAssets(["GUEST", "EMPLOYEE"]), false);
  assert.equal(canWriteAssets(["FARM_OWNER"]), true);
  assert.equal(canWriteAssets(["ADMIN"]), true);
});
