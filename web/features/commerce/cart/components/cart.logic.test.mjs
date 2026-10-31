import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileCartItems } from "./cart.logic.ts";

const item = (patch = {}) => ({
  id: "product__variant",
  productId: "product",
  productSlug: "honey",
  productName: "Old product",
  variantId: "variant",
  variantName: "Small",
  unitPrice: 100,
  quantity: 2,
  inStock: true,
  isPriceChanged: false,
  isUnavailable: false,
  verification: "pending",
  ...patch,
});

const detail = (patch = {}) => ({
  id: "product",
  slug: "honey",
  name: "Honey",
  category: { id: "category", name: "Honey", slug: "honey" },
  price: 125,
  inStock: true,
  description: "Honey",
  variants: [{ id: "variant", name: "Small jar", price: 125, inStock: true }],
  ...patch,
});

test("cart reconciliation returns current price and flags explicit price changes", () => {
  const reconciled = reconcileCartItems([item()], new Map([["honey", detail()]]));
  assert.equal(reconciled[0].unitPrice, 125);
  assert.equal(reconciled[0].variantName, "Small jar");
  assert.equal(reconciled[0].isPriceChanged, true);
  assert.equal(reconciled[0].verification, "verified");
});

test("unavailable variants cannot be submitted and catalog failures remain unverified", () => {
  const unavailable = reconcileCartItems(
    [item()],
    new Map([["honey", detail({ variants: [{ id: "variant", name: "Small jar", price: 125, inStock: false }] })]]),
  )[0];
  const failed = reconcileCartItems([item()], new Map([["honey", "error"]]))[0];
  assert.equal(unavailable.inStock, false);
  assert.equal(unavailable.verification, "verified");
  assert.equal(failed.verification, "error");
});
