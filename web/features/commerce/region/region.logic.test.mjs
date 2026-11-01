import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availabilityLabel,
  parseStoreRegion,
  splitOrderSuggestions,
} from "./region.logic.ts";

test("only known regions come back from the cookie", () => {
  assert.equal(parseStoreRegion("SOUTH"), "SOUTH");
  assert.equal(parseStoreRegion("south"), null);
  assert.equal(parseStoreRegion("toString"), null);
  assert.equal(parseStoreRegion(undefined), null);
});

test("labels never show stock numbers and fall back to inStock", () => {
  assert.equal(
    availabilityLabel({ inStock: true, availability: "OUT_IN_REGION" }),
    "Tạm hết hàng tại khu vực",
  );
  assert.equal(availabilityLabel({ inStock: false }), "Hết hàng");
});

test("split suggestions name each line of a group", () => {
  const items = [
    { variantId: "a", productName: "Mật ong", variantName: "500ml" },
    { variantId: "b", productName: "Thùng ong" },
  ];
  assert.deepEqual(splitOrderSuggestions([["a"], ["b", "x"]], items), [
    "Đơn 1: Mật ong (500ml)",
    "Đơn 2: Thùng ong, Sản phẩm khác",
  ]);
});
