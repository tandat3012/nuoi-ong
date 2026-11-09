import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mergeSavedSplitItems,
  partitionCartByVariantGroup,
  reconcileCartItems,
} from "./cart.logic.ts";
import {
  buildProductsHref,
  parseAndValidateProductsQuery,
} from "../../products/components/products-page.logic.ts";

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

test("partitionCartByVariantGroup splits cart into kept and deferred groups", () => {
  const lines = [
    item({ id: "p1__v1", productId: "p1", variantId: "v1", productName: "Mật ong" }),
    item({ id: "p2__v2", productId: "p2", variantId: "v2", productName: "Thùng nuôi" }),
    item({ id: "p3__v3", productId: "p3", variantId: "v3", productName: "Áo bảo hộ" }),
  ];
  const { keptItems, deferredItems } = partitionCartByVariantGroup(lines, [
    "v1",
    "v3",
  ]);
  assert.deepEqual(
    keptItems.map((i) => i.variantId),
    ["v1", "v3"],
  );
  assert.deepEqual(
    deferredItems.map((i) => i.variantId),
    ["v2"],
  );

  const merged = mergeSavedSplitItems(
    [item({ id: "p2__v2", productId: "p2", variantId: "v2", quantity: 1 })],
    deferredItems,
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].quantity, 3);
});

test("products query parser and URL builder support inStock filter", () => {
  const valid = parseAndValidateProductsQuery({
    q: "mật ong",
    inStock: "true",
    sort: "price_asc",
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.criteria.inStock, true);
  assert.equal(
    buildProductsHref(valid.criteria),
    "/products?q=m%E1%BA%ADt+ong&sort=price_asc&inStock=true",
  );
  assert.equal(
    buildProductsHref(valid.criteria, { inStock: undefined }),
    "/products?q=m%E1%BA%ADt+ong&sort=price_asc",
  );

  const invalid = parseAndValidateProductsQuery({ inStock: "invalid" });
  assert.equal(invalid.isValid, false);
});
