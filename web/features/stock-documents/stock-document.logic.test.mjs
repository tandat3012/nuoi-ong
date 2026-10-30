import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canCreateStockDocuments,
  normalizeRejectionReason,
  shouldReloadAfterFailure,
  stockDocumentActions,
  stockDocumentErrorMessage,
  stockDocumentHref,
  stockDocumentQueryId,
} from "./stock-document.logic.ts";

const owner = { roles: ["FARM_OWNER"], memberId: "owner" };
const employee = { roles: ["EMPLOYEE"], memberId: "creator" };
const peer = { roles: ["EMPLOYEE"], memberId: "peer" };
const guest = { roles: ["GUEST"], memberId: "guest" };
const draft = { status: "DRAFT", createdByMemberId: "creator" };
const actions = (viewer, document) =>
  Object.entries(stockDocumentActions(viewer, document))
    .filter(([, allowed]) => allowed)
    .map(([name]) => name);

test("only approvers and employees create documents", () => {
  assert.equal(canCreateStockDocuments(["ADMIN"]), true);
  assert.equal(canCreateStockDocuments(["EMPLOYEE"]), true);
  assert.equal(canCreateStockDocuments(["GUEST"]), false);
  assert.equal(canCreateStockDocuments([]), false);
});

test("employees edit, cancel and submit only their own drafts", () => {
  assert.deepEqual(actions(employee, draft), ["edit", "cancel", "submit"]);
  assert.deepEqual(actions(peer, draft), []);
  assert.deepEqual(
    actions(guest, { ...draft, createdByMemberId: "guest" }),
    [],
  );
  assert.deepEqual(actions({ roles: ["EMPLOYEE"] }, draft), []);
});

test("approvers confirm drafts directly and review pending documents", () => {
  assert.deepEqual(actions(owner, draft), ["edit", "cancel", "confirm"]);
  assert.deepEqual(actions(owner, { ...draft, status: "COUNTING" }), [
    "edit",
    "cancel",
    "confirm",
  ]);
  assert.deepEqual(actions(owner, { ...draft, status: "PENDING_APPROVAL" }), [
    "confirm",
    "reject",
  ]);
});

test("submitted, final and order-linked documents lock the right actions", () => {
  for (const status of ["CONFIRMED", "REJECTED", "CANCELLED"]) {
    assert.deepEqual(actions(owner, { ...draft, status }), [], status);
    assert.deepEqual(actions(employee, { ...draft, status }), [], status);
  }
  // A submitted document cannot be withdrawn or edited by its creator.
  assert.deepEqual(
    actions(employee, { ...draft, status: "PENDING_APPROVAL" }),
    [],
  );
  const orderIssue = { ...draft, orderId: "order-1" };
  assert.deepEqual(actions(owner, orderIssue), ["edit", "confirm"]);
  assert.deepEqual(actions(employee, orderIssue), ["edit"]);
  assert.deepEqual(
    actions(owner, { ...orderIssue, status: "PENDING_APPROVAL" }),
    ["confirm"],
  );
});

test("API rejections become specific messages and decide whether to reload", () => {
  assert.match(
    stockDocumentErrorMessage(403, "Only your own documents can be changed"),
    /do chính mình tạo/,
  );
  assert.match(stockDocumentErrorMessage(403, "Forbidden"), /không có quyền/);
  assert.match(
    stockDocumentErrorMessage(409, "Only DRAFT receipts can be submitted"),
    /không gửi duyệt được/,
  );
  assert.match(
    stockDocumentErrorMessage(
      409,
      "Only PENDING_APPROVAL issues can be rejected",
    ),
    /không còn chờ duyệt/,
  );
  assert.match(
    stockDocumentErrorMessage(409, "Cancel the linked order instead"),
    /hủy đơn hàng/,
  );
  assert.match(
    stockDocumentErrorMessage(400, "Receipt must contain at least one item"),
    /chưa có dòng hàng/,
  );
  assert.match(stockDocumentErrorMessage(null, ""), /Chưa nhận được kết quả/);
  assert.equal(shouldReloadAfterFailure(409), true);
  assert.equal(shouldReloadAfterFailure(null), true);
  assert.equal(shouldReloadAfterFailure(401), false);
  assert.equal(shouldReloadAfterFailure(403), false);
});

test("rejection reasons are trimmed and bounded", () => {
  assert.deepEqual(normalizeRejectionReason("  Sai số lượng "), {
    reason: "Sai số lượng",
  });
  assert.ok(normalizeRejectionReason("   ").error);
  assert.ok(normalizeRejectionReason("x".repeat(4001)).error);
});

test("document query IDs accept UUIDs and ignore missing or invalid values", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(stockDocumentQueryId(new URLSearchParams({ id })), id);
  assert.equal(stockDocumentQueryId(new URLSearchParams({ id: id.toUpperCase() })), id.toUpperCase());
  assert.equal(stockDocumentQueryId(new URLSearchParams(`id=${encodeURIComponent(id)}`)), id);
  assert.equal(stockDocumentQueryId(new URLSearchParams(`id=${id}&id=invalid`)), id);
  for (const value of ["", "invalid", "../other", "id?x=1", ` ${id}`, `${id}/other`]) {
    assert.equal(stockDocumentQueryId(new URLSearchParams({ id: value })), null);
  }
  assert.equal(stockDocumentQueryId(new URLSearchParams()), null);
});

test("receipt, transfer and count URLs preserve filters when opening, replacing or closing a document", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  for (const path of ["/receipts", "/transfers", "/counts"]) {
    const params = new URLSearchParams("status=DRAFT&page=2&id=old&id=duplicate");
    assert.equal(stockDocumentHref(path, params, id), `${path}?status=DRAFT&page=2&id=${id}`);
    assert.equal(stockDocumentHref(path, params, null), `${path}?status=DRAFT&page=2`);
    assert.equal(params.toString(), "status=DRAFT&page=2&id=old&id=duplicate");
    assert.equal(stockDocumentHref(path, new URLSearchParams({ id }), null), path);
    assert.equal(stockDocumentHref(path, new URLSearchParams(), id), `${path}?id=${id}`);
  }
});

test("labels an uncoded draft by its short id and keeps a permanent code", async () => {
  const { documentCodeLabel } = await import("./stock-document.logic.ts");
  assert.equal(
    documentCodeLabel(null, "1a2b3c4d-0000-4000-8000-000000000000"),
    "Nháp #1a2b3c4d",
  );
  assert.equal(documentCodeLabel("PN-2026-000001", "1a2b3c4d"), "PN-2026-000001");
});
