import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changeHistoryFilters, HISTORY_ACTION_LABELS, HISTORY_ENTITY_LABELS,
  historyActorLabel, historyChanges, historyEntityIdError, historyErrorMessage,
  historyHref, parseHistoryQuery,
} from "./history.logic.ts";

const entityId = "123e4567-e89b-42d3-a456-426614174000";
const defaults = { entityType: "", action: "", entityId: "", page: 1 };

test("history query parsing uses safe defaults and bounds server pagination", () => {
  assert.deepEqual(parseHistoryQuery(new URLSearchParams()), defaults);
  for (const page of ["", "0", "-1", "01", "1.2", "2oops", "1e6", "Infinity", " 2 ", "9007199254740991"]) {
    assert.equal(parseHistoryQuery(new URLSearchParams({ page })).page, 1, page);
  }
  const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / 20);
  assert.equal(parseHistoryQuery(new URLSearchParams({ page: String(maxPage) })).page, maxPage);
  assert.equal(parseHistoryQuery(new URLSearchParams({ page: String(maxPage + 1) })).page, 1);
  assert.deepEqual(parseHistoryQuery(new URLSearchParams({ entityType: " stock_receipt ", action: "confirm", entityId: ` ${entityId} `, page: "3" })),
    { entityType: "STOCK_RECEIPT", action: "CONFIRM", entityId, page: 3 });
  for (const invalid of ["unknown", "__proto__", "constructor", "toString"]) {
    assert.deepEqual(parseHistoryQuery(new URLSearchParams({ entityType: invalid, action: invalid })), defaults);
  }
});

test("UUID validation accepts optional UUIDs and rejects malformed nonempty filters", () => {
  for (const valid of ["", "  ", entityId, entityId.toUpperCase(), ` ${entityId} `, "019368b0-1e10-7000-a000-000000000001"]) {
    assert.equal(historyEntityIdError(valid), null, valid);
  }
  for (const invalid of ["abc", "../assets", `${entityId}&page=2`, "123e4567-e89b-02d3-a456-426614174000", "123e4567-e89b-42d3-7456-426614174000"]) {
    assert.equal(historyEntityIdError(invalid), "Mã đối tượng phải là UUID hợp lệ.", invalid);
    assert.equal(parseHistoryQuery(new URLSearchParams({ entityId: invalid })).entityId, invalid);
  }
});

test("history filters reset page one and URL pagination preserves every server filter", () => {
  const query = { entityType: "STOCK_COUNT", action: "REJECT", entityId, page: 7 };
  const next = changeHistoryFilters(query, { entityType: "ASSET", action: "ASSET_CREATED", entityId: "" });
  assert.deepEqual(next, { entityType: "ASSET", action: "ASSET_CREATED", entityId: "", page: 1 });
  assert.equal(query.page, 7);
  const url = new URL(historyHref(query), "https://example.test");
  assert.equal(url.pathname, "/history");
  assert.deepEqual(parseHistoryQuery(url.searchParams), query);
  const paged = new URL(historyHref({ ...query, page: 8 }), url);
  assert.deepEqual(parseHistoryQuery(paged.searchParams), { ...query, page: 8 });
  const cleared = new URL(historyHref(defaults), url);
  assert.deepEqual([...cleared.searchParams], [["page", "1"]]);
});

test("audit errors explain auth, missing farm data, validation and conflict reasons", () => {
  assert.equal(historyErrorMessage(401, "Unauthorized"), "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  assert.equal(historyErrorMessage(403, "Forbidden"), "Bạn không có quyền xem lịch sử thay đổi.");
  assert.match(historyErrorMessage(404, "Not found"), /không tồn tại hoặc không thuộc trang trại/);
  assert.equal(historyErrorMessage(409, "Phiếu đã được xử lý"), "Trạng thái đã thay đổi: Phiếu đã được xử lý");
  assert.equal(historyErrorMessage(400, "UUID sai"), "Dữ liệu không hợp lệ: UUID sai");
  for (const status of [null, 0, 500]) assert.match(historyErrorMessage(status, "Internal error"), /Vui lòng thử lại/);
});

test("history actors prefer name, then email, then the system label", () => {
  assert.equal(historyActorLabel({ name: "Nguyễn An", email: "an@example.test" }), "Nguyễn An");
  assert.equal(historyActorLabel({ name: " ", email: "an@example.test" }), "an@example.test");
  assert.equal(historyActorLabel({ name: null, email: null }), "Hệ thống");
  assert.equal(historyActorLabel(null), "Hệ thống");
});

test("unchanged values including reordered nested JSON are hidden", () => {
  const oldData = { status: "DRAFT", amount: 0, note: null, active: false, json: { a: 1, nested: { x: 2, y: 3 } }, items: [{ item: "A", quantity: 1 }] };
  const newData = { ...oldData, json: { nested: { y: 3, x: 2 }, a: 1 }, items: [{ quantity: 1, item: "A" }] };
  assert.deepEqual(historyChanges({ action: "UPDATE", oldData, newData }), []);
});

test("changed nested values and arrays are written out without raw JSON", () => {
  assert.deepEqual(historyChanges({ action: "UPDATE",
    oldData: { settings: { z: 1, a: { enabled: true } }, items: [1, 2] },
    newData: { settings: { a: { enabled: false }, z: 1 }, items: [2, 1] },
  }), [
    { key: "settings", before: "z: 1 · a: enabled: Có", after: "a: enabled: Không · z: 1" },
    { key: "items", before: "1, 2", after: "2, 1" },
  ]);
});

test("ids become names from references and document lines read as one line each", () => {
  const ids = {
    warehouse: "ae1fd411-1173-4f25-ae92-fb14c3409b73",
    member: "0174a038-ed2c-4608-9f07-d8cff711a227",
    item: "297ef4ae-f4f0-4a32-956c-169ca8c5a218",
    lot: "c1ea900a-0659-4f05-840a-a1e7f41de843",
    gone: "11111111-2222-4333-8444-555555555555",
  };
  const format = {
    references: { [ids.warehouse]: "KHO-01 — Kho chính", [ids.member]: "Dat", [ids.item]: "MAT-01 — Sáp ong", [ids.lot]: "L-2026" },
    label: (key, value) => (key === "issueType" && value === "CONSUMPTION" ? "Xuất sử dụng" : value),
  };
  const changes = historyChanges({ action: "CREATE", oldData: null, newData: {
    warehouseId: ids.warehouse,
    createdByMemberId: ids.member,
    issueType: "CONSUMPTION",
    supplierId: ids.gone,
    items: [
      { itemId: ids.item, lotId: ids.lot, quantity: "999" },
      { itemId: ids.item, lotId: null, actualQuantity: "65", systemQuantity: "68.000" },
    ],
  } }, format);
  assert.deepEqual(Object.fromEntries(changes.map(({ key, after }) => [key, after])), {
    warehouseId: "KHO-01 — Kho chính",
    createdByMemberId: "Dat",
    issueType: "Xuất sử dụng",
    supplierId: "Không xác định",
    items: "MAT-01 — Sáp ong · Lô L-2026 · Số lượng: 999\nMAT-01 — Sáp ong · Số lượng thực tế: 65 · Số lượng sổ sách: 68.000",
  });
  for (const { before, after } of changes)
    for (const value of [before, after]) assert.doesNotMatch(value, /[0-9a-f]{8}-[0-9a-f]{4}-|[{}"]/i);
});

test("CREATE with null oldData shows every initial value including null, zero and false", () => {
  const newData = { status: "DRAFT", note: null, quantity: 0, active: false, extraField: "", items: [{ quantity: 1 }] };
  const expected = [
    { key: "status", before: "—", after: "DRAFT" },
    { key: "note", before: "—", after: "—" },
    { key: "quantity", before: "—", after: "0" },
    { key: "active", before: "—", after: "Không" },
    { key: "extraField", before: "—", after: "(Trống)" },
    { key: "items", before: "—", after: "Số lượng: 1" },
  ];
  for (const action of ["CREATE", "ASSET_CREATED", "PERSONNEL_ADDED"]) {
    assert.deepEqual(historyChanges({ action, oldData: null, newData }), expected);
  }
  assert.deepEqual(historyChanges({ action: "CREATE", oldData: newData, newData }), expected);
  assert.deepEqual(historyChanges({ action: "CREATE", oldData: null, newData: null }), []);
});

test("updates include added and removed keys while retaining scalar distinctions", () => {
  assert.deepEqual(historyChanges({ action: "UPDATE",
    oldData: { status: "DRAFT", note: "Cũ", quantity: 1, unchanged: true },
    newData: { status: "PENDING_APPROVAL", quantity: "1", unchanged: true, rejectionReason: "Bổ sung" },
  }), [
    { key: "status", before: "DRAFT", after: "PENDING_APPROVAL" },
    { key: "note", before: "Cũ", after: "—" },
    { key: "quantity", before: "1", after: "1" },
    { key: "rejectionReason", before: "—", after: "Bổ sung" },
  ]);
});

test("history filters cover all current document, request, asset and personnel writers", () => {
  assert.equal(Object.keys(HISTORY_ENTITY_LABELS).length, 8);
  for (const entityType of Object.keys(HISTORY_ENTITY_LABELS)) {
    assert.equal(parseHistoryQuery(new URLSearchParams({ entityType })).entityType, entityType);
  }
  for (const action of ["CREATE", "UPDATE", "CANCEL", "SUBMIT", "CONFIRM", "REJECT", "ASSET_RETURNED", "ASSET_INCIDENT_STATUS", "ASSET_MAINTENANCE_COMPLETED", "PERSONNEL_STATUS_CHANGED"]) {
    assert.ok(HISTORY_ACTION_LABELS[action]);
    assert.equal(parseHistoryQuery(new URLSearchParams({ action })).action, action);
  }
});
