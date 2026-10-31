import assert from "node:assert/strict";
import { test } from "node:test";
import { isNavigationItemVisible, primaryNavigationSections } from "./navigation.ts";
import { isBackOfficePath } from "./protected-routes.ts";

test("history uses the protected dashboard routes and existing staff navigation gate", () => {
  assert.equal(isBackOfficePath("/history"), true);
  assert.equal(isBackOfficePath("/history/"), true);
  assert.equal(isBackOfficePath("/history-public"), false);
  const item = primaryNavigationSections.flatMap(({ items }) => items).find(({ href }) => href === "/history");
  assert.ok(item);
  assert.equal(item.label, "Lịch sử thay đổi");
  for (const staff of [true, false]) {
    assert.equal(isNavigationItemVisible(item, {
      canManageFarm: false,
      canManageStore: false,
      canAccessFarmArea: true,
      canViewHistory: staff,
      isStoreFarm: false,
    }), staff);
  }
});
