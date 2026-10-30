import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canEditMember,
  canManagePersonnel,
  personnelError,
} from "./personnel.logic.ts";

test("personnel permissions preserve the farm role matrix", () => {
  for (const role of ["ADMIN", "FARM_OWNER", "EMPLOYEE", "GUEST"]) {
    assert.equal(
      canManagePersonnel([role]),
      ["ADMIN", "FARM_OWNER"].includes(role),
    );
    assert.equal(canEditMember([role], ["FARM_OWNER"]), role === "ADMIN");
    assert.equal(
      canEditMember([role], ["EMPLOYEE"]),
      ["ADMIN", "FARM_OWNER"].includes(role),
    );
  }
});
test("credential failures never display transport messages, bodies, or exception values", () => {
  for (const status of [0, 400, 403, 404, 409, 429, 500, 503]) {
    const error = {
      status,
      message: "initialPassword=private secret",
      details: { initialPassword: "private secret", request: "private secret" },
    };
    assert.doesNotMatch(
      personnelError(error).message,
      /private secret|initialPassword/,
    );
  }
  assert.equal(
    personnelError({ details: { code: "ACCOUNT_ALREADY_EXISTS" } }).code,
    "ACCOUNT_ALREADY_EXISTS",
  );
  assert.match(personnelError({ status: 429 }).message, /một phút/);
  for (const code of ["toString", "constructor", "__proto__"]) {
    assert.equal(
      typeof personnelError({ status: 503, details: { code } }).message,
      "string",
    );
  }
});
