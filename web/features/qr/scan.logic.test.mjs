import assert from "node:assert/strict";
import { test } from "node:test";
import { parseScan, scanPath } from "./scan.logic.ts";

const origin = "https://farm.example";
const uuid = "00000000-0000-4000-8000-000000000001";

test("QR accepts bare asset codes and same-origin asset scan URLs", () => {
  assert.deepEqual(parseScan(" AST-001 ", origin), { kind: "asset", id: "AST-001" });
  assert.deepEqual(parseScan(`${origin}/scan/A%2FB`, origin), { kind: "asset", id: "A/B" });
  assert.deepEqual(parseScan("/scan/T%C3%80I-001", origin), { kind: "asset", id: "TÀI-001" });
  assert.deepEqual(parseScan(uuid, origin), { kind: "asset", id: uuid });
  assert.deepEqual(parseScan("🐝".repeat(100), origin), { kind: "asset", id: "🐝".repeat(100) });
  // An asset may be coded "item"; only the two-segment paths are typed labels.
  assert.deepEqual(parseScan(`${origin}/scan/item`, origin), { kind: "asset", id: "item" });
});

test("QR reads item and inventory labels as lower-cased UUIDs", () => {
  assert.deepEqual(parseScan(`${origin}/scan/item/${uuid.toUpperCase()}`, origin), { kind: "item", id: uuid });
  assert.deepEqual(parseScan(`/scan/inventory/${uuid}`, origin), { kind: "inventory", id: uuid });
});

test("QR rejects foreign, malformed and non-label values", () => {
  for (const value of [
    "",
    "x".repeat(101),
    "https://evil.test/scan/AST-1",
    `https://evil.test/scan/item/${uuid}`,
    "//evil.test/scan/AST-1",
    "/assets/x",
    "/scan/%xx",
    "/scan/x?farmId=foreign",
    "/scan/x#fragment",
    "A\nB",
    "/scan/item/not-a-uuid",
    `/scan/inventory/${uuid}/extra`,
    `/scan/lot/${uuid}`,
    `/scan/item/${uuid}?warehouseId=${uuid}`,
  ])
    assert.equal(parseScan(value, origin), null, value);
});

test("scanPath round-trips every label kind", () => {
  for (const value of ["A/B", `/scan/item/${uuid}`, `/scan/inventory/${uuid}`]) {
    const target = parseScan(value, origin);
    assert.deepEqual(parseScan(scanPath(target), origin), target);
  }
  assert.equal(scanPath({ kind: "asset", id: "A/B" }), "/scan/A%2FB");
});
