import assert from "node:assert/strict";
import { test } from "node:test";
import {
  issueReceiptAction,
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

test("only the recipient, or a manager for them, acknowledges a confirmed issue once", () => {
  const issue = { status: "CONFIRMED", recipientMemberId: "m1", receivedAt: null };
  assert.equal(issueReceiptAction({ roles: ["EMPLOYEE"], memberId: "m1" }, issue), "self");
  assert.equal(
    issueReceiptAction({ roles: ["WAREHOUSE_MANAGER"], memberId: "m2" }, issue),
    "onBehalf",
  );
  assert.equal(issueReceiptAction({ roles: ["EMPLOYEE"], memberId: "m2" }, issue), null);
  for (const other of [
    { ...issue, status: "PENDING_APPROVAL" },
    { ...issue, recipientMemberId: null },
    { ...issue, receivedAt: "2026-11-08T00:00:00Z" },
  ])
    assert.equal(issueReceiptAction({ roles: ["ADMIN"], memberId: "m1" }, other), null);
});
