import assert from "node:assert/strict";
import { test } from "node:test";
import {
  preservesIssueItemTotals,
  splitIssueQuantity,
  validateIssueDraft,
} from "./issue-draft.logic.ts";

const draft = (
  issueType,
  line = { itemId: "item", assetId: "asset", quantity: "1" },
) => ({
  warehouseId: "warehouse",
  issueType,
  maintenanceRecordId: issueType === "MAINTENANCE" ? "record" : null,
  items: [line],
});

test("asset damage and maintenance use the lifecycle screen instead of stock issues", () => {
  for (const issueType of ["DAMAGE", "MAINTENANCE"])
    assert.match(
      validateIssueDraft(draft(issueType), ["ASSET"]),
      /hồ sơ tài sản/,
    );
  for (const issueType of ["CONSUMPTION", "OTHER", "DISPOSAL"])
    assert.equal(validateIssueDraft(draft(issueType), ["ASSET"]), null);
});

test("damage and maintenance issues still accept quantity and lot materials", () => {
  for (const issueType of ["DAMAGE", "MAINTENANCE"]) {
    assert.equal(
      validateIssueDraft(
        draft(issueType, { itemId: "item", quantity: "2.125" }),
        ["QUANTITY"],
      ),
      null,
    );
    assert.equal(
      validateIssueDraft(
        draft(issueType, { itemId: "item", lotId: "lot", quantity: "0.125" }),
        ["LOT"],
      ),
      null,
    );
  }
});

test("SALE is only accepted for a linked order draft", () => {
  const sale = draft("SALE", { itemId: "item", quantity: "2.5" });
  assert.match(validateIssueDraft(sale, ["QUANTITY"]), /liên kết/);
  assert.equal(validateIssueDraft(sale, ["QUANTITY"], true), null);
});

test("linked lot splits retain exact per-item quantities", () => {
  assert.deepEqual(splitIssueQuantity("2.500", "1.25"), ["1.25", "1.25"]);
  assert.deepEqual(splitIssueQuantity("999999999999999.999", "0.001"), [
    "999999999999999.998",
    "0.001",
  ]);
  assert.equal(splitIssueQuantity("1", "1"), null);
  assert.equal(
    preservesIssueItemTotals(
      [{ itemId: "item", quantity: "2.500" }],
      [
        { itemId: "item", quantity: "1.25" },
        { itemId: "item", quantity: "1.25" },
      ],
    ),
    true,
  );
  assert.equal(
    preservesIssueItemTotals(
      [{ itemId: "item", quantity: "2.500" }],
      [{ itemId: "item", quantity: "2.499" }],
    ),
    false,
  );
});
