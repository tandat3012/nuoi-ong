import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canManageStore,
  moveItem,
  slugify,
  storeAdminError,
  validateStoreImage,
} from "./store-admin.logic.ts";

test("slugify strips Vietnamese diacritics", () => {
  assert.equal(slugify("  Mật ong Hoa Nhãn 500ml! "), "mat-ong-hoa-nhan-500ml");
  assert.equal(slugify("Đường đỏ"), "duong-do");
});

test("validateStoreImage enforces type and size", () => {
  assert.equal(validateStoreImage({ type: "image/png", size: 10 }), null);
  assert.match(validateStoreImage({ type: "image/gif", size: 10 }), /JPEG/);
  assert.match(
    validateStoreImage({ type: "image/webp", size: 10 * 1024 * 1024 + 1 }),
    /10MB/,
  );
});

test("moveItem swaps neighbours and ignores out-of-range moves", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 1), ["a", "c", "b"]);
  assert.deepEqual(moveItem(["a", "b"], 0, -1), ["a", "b"]);
});

test("canManageStore and storeAdminError", () => {
  assert.equal(canManageStore(["FARM_OWNER"]), true);
  assert.equal(canManageStore(["STAFF"]), false);
  assert.match(storeAdminError({ status: 409, message: "x" }), /Slug/);
  assert.match(storeAdminError({ status: 400, message: "bad" }), /bad$/);
  assert.match(storeAdminError(new Error("x")), /thử lại/);
});
