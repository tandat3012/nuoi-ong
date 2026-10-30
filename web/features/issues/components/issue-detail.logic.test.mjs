import assert from "node:assert/strict";
import { test } from "node:test";
import { formatIssueQuantity } from "./issue-detail.logic.ts";

test("issue quantities omit trailing fractional zeros without losing precision", () => {
  for (const [quantity, expected] of [
    ["0.500", "0.5"],
    ["1.000", "1"],
    ["1.250", "1.25"],
    ["0.005", "0.005"],
    ["0.000", "0"],
    ["100", "100"],
    ["100.000", "100"],
    ["999999999999999.999", "999999999999999.999"],
    ["999999999999999.990", "999999999999999.99"],
  ]) {
    assert.equal(formatIssueQuantity(quantity), expected, quantity);
  }
});
