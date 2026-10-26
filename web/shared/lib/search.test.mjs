import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesSearch } from "./search.ts";

test("matchesSearch ignores diacritics, case and word order", () => {
  assert.equal(matchesSearch("VT-001 · Mật ong hoa nhãn", "mat ong"), true);
  assert.equal(matchesSearch("VT-001 · Mật ong hoa nhãn", "NHAN vt-001"), true);
  assert.equal(matchesSearch("Đá muối", "da"), true);
  assert.equal(matchesSearch("Mật ong hoa nhãn", "sáp"), false);
  assert.equal(matchesSearch("Mật ong", "  "), true);
});
