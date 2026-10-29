import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assetRequestActions,
  normalizeRequestDescription,
  normalizeRequestReason,
  parseRequestsQuery,
  requestActions,
  requestErrorMessage,
  requestsHref,
  serializeScheduledAt,
  shouldReloadAfterFailure,
  transferDestination,
} from "./requests.logic.ts";

const id = "12345678-1234-4123-8123-123456789abc";

test("only approvers review pending requests; reviewed requests have no actions", () => {
  for (const roles of [[], ["GUEST"], ["EMPLOYEE"], ["ADMIN"], ["FARM_OWNER"], ["EMPLOYEE", "ADMIN"]]) {
    for (const status of ["PENDING_APPROVAL", "CONFIRMED", "REJECTED"]) {
      const allowed = status === "PENDING_APPROVAL" && roles.some((role) => ["ADMIN", "FARM_OWNER"].includes(role));
      assert.deepEqual(requestActions(roles, status), { approve: allowed, reject: allowed }, `${roles}: ${status}`);
    }
  }
});

test("only employee non-approvers create; transfers require an AVAILABLE asset", () => {
  for (const roles of [[], ["GUEST"], ["EMPLOYEE"], ["ADMIN"], ["FARM_OWNER"], ["EMPLOYEE", "ADMIN"], ["EMPLOYEE", "FARM_OWNER"], ["GUEST", "EMPLOYEE"]]) {
    for (const status of ["AVAILABLE", "ASSIGNED", "IN_USE", "MAINTENANCE", "TRANSFER_PENDING", "LOST", "RETIRED"]) {
      const employee = roles.includes("EMPLOYEE") && !roles.some((role) => ["ADMIN", "FARM_OWNER"].includes(role));
      assert.deepEqual(assetRequestActions(roles, status), {
        maintenance: employee, transfer: employee && status === "AVAILABLE",
      }, `${roles}: ${status}`);
    }
  }
});

test("rejection reasons are trimmed and must contain 3–1000 characters", () => {
  assert.deepEqual(normalizeRequestReason("  Không phù hợp \n"), { reason: "Không phù hợp" });
  for (const value of ["", "   ", " ab ", "x".repeat(1001)]) assert.ok(normalizeRequestReason(value).error);
  for (const value of ["abc", "x".repeat(1000)]) assert.equal(normalizeRequestReason(value).reason, value);
});

test("maintenance descriptions are trimmed and bounded to 3–4000 characters", () => {
  assert.deepEqual(normalizeRequestDescription("  Máy không chạy  "), { description: "Máy không chạy" });
  for (const value of ["", "   ", " ab ", "x".repeat(4001)]) assert.ok(normalizeRequestDescription(value).error);
  assert.equal(normalizeRequestDescription("abc").description, "abc");
  assert.equal(normalizeRequestDescription("x".repeat(4000)).description.length, 4000);
});

test("scheduledAt uses the viewer's local time and rejects invalid calendar dates", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    assert.deepEqual(serializeScheduledAt("2026-11-02T09:30"), { scheduledAt: "2026-11-02T02:30:00.000Z" });
    assert.deepEqual(serializeScheduledAt("2028-02-29T09:30"), { scheduledAt: "2028-02-29T02:30:00.000Z" });
    process.env.TZ = "UTC";
    assert.deepEqual(serializeScheduledAt("2026-11-02T09:30"), { scheduledAt: "2026-11-02T09:30:00.000Z" });
    for (const value of ["", "invalid", "2026-11-02", "2026-02-29T09:30", "2026-02-30T09:30", "2026-13-01T09:30", "2026-11-02T24:00", "2026-11-02T09:60"]) {
      assert.ok(serializeScheduledAt(value).error, value);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("query defaults depend on approver roles and preserve notification deep links", () => {
  for (const roles of [["ADMIN"], ["FARM_OWNER"], ["EMPLOYEE", "ADMIN"]]) {
    assert.deepEqual(parseRequestsQuery(new URLSearchParams(), roles), {
      type: "maintenance", status: "PENDING_APPROVAL", page: 1, id: undefined,
    });
  }
  for (const roles of [[], ["GUEST"], ["EMPLOYEE"]]) {
    assert.equal(parseRequestsQuery(new URLSearchParams(), roles).status, "ALL");
  }
  assert.deepEqual(parseRequestsQuery(new URLSearchParams(`type=transfer&status=REJECTED&page=3&id=${id}`), ["ADMIN"]), {
    type: "transfer", status: "REJECTED", page: 3, id,
  });
  assert.equal(parseRequestsQuery(new URLSearchParams("status=ALL"), ["ADMIN"]).status, "ALL");
  assert.equal(parseRequestsQuery(new URLSearchParams("status=CONFIRMED"), ["EMPLOYEE"]).status, "CONFIRMED");
});

test("invalid query values fall back safely without sending malformed IDs or pages", () => {
  for (const page of ["", "0", "-1", "1.5", "1e3", "Infinity", "9007199254740991", "abc", "01"]) {
    const params = new URLSearchParams({ type: "other", status: "DRAFT", page, id: "../../other" });
    assert.deepEqual(parseRequestsQuery(params, ["EMPLOYEE"]), {
      type: "maintenance", status: "ALL", page: 1, id: undefined,
    }, page);
  }
  assert.equal(parseRequestsQuery(new URLSearchParams("status=__proto__"), ["ADMIN"]).status, "PENDING_APPROVAL");
});

test("request links retain type, status, page and optional detail ID", () => {
  const query = { type: "transfer", status: "CONFIRMED", page: 2, id };
  const href = requestsHref(query);
  assert.equal(href, `/requests?type=transfer&status=CONFIRMED&page=2&id=${id}`);
  assert.deepEqual(parseRequestsQuery(new URL(href, "https://example.com").searchParams, []), query);
  assert.equal(requestsHref({ ...query, id: undefined }), "/requests?type=transfer&status=CONFIRMED&page=2");
});

test("API auth, not-found and validation failures have Vietnamese messages", () => {
  assert.match(requestErrorMessage(401, "Unauthorized"), /Phiên đăng nhập đã hết hạn/);
  assert.match(requestErrorMessage(403, "Forbidden"), /không có quyền/);
  assert.match(requestErrorMessage(403, "Only farm employees can request maintenance"), /Chỉ nhân viên/);
  for (const message of ["Maintenance request not found", "Asset transfer request not found"]) {
    assert.equal(requestErrorMessage(404, message), "Yêu cầu không tồn tại hoặc bạn không có quyền xem.");
  }
  assert.match(requestErrorMessage(404, "Asset not found"), /Tài sản.*không thuộc trang trại/);
  assert.match(requestErrorMessage(400, "rejectionReason must be longer than or equal to 3 characters"), /3 đến 1000/);
  assert.match(requestErrorMessage(400, "Description must have at least 3 characters"), /3 đến 4000/);
  assert.match(requestErrorMessage(400, "scheduledAt must be a valid ISO 8601 date string"), /ngày và giờ/);
  assert.match(requestErrorMessage(400, "assetId must be a UUID"), /Dữ liệu yêu cầu không hợp lệ/);
  assert.match(requestErrorMessage(null, "offline"), /Chưa nhận được kết quả/);
});

test("API conflicts explain pending requests, stale assets and inactive destinations", () => {
  const conflicts = [
    ["This asset already has a pending maintenance request", /bảo trì chờ duyệt/],
    ["This asset already has a pending transfer request", /yêu cầu chuyển chờ duyệt/],
    ["Asset has a pending transfer request; approve or reject it first", /Hãy xử lý yêu cầu chuyển trước/],
    ["Only PENDING_APPROVAL maintenance requests can be reviewed", /không còn chờ duyệt/],
    ["Only PENDING_APPROVAL transfer requests can be reviewed", /không còn chờ duyệt/],
    ["Only AVAILABLE assets can be requested for transfer", /không còn sẵn sàng/],
    ["Only AVAILABLE assets can be transferred", /Trạng thái hoặc vị trí tài sản đã thay đổi/],
    ["Asset changed during transfer; reload before retrying", /Trạng thái hoặc vị trí tài sản đã thay đổi/],
    ["Asset is not eligible for a maintenance request", /không thể gửi yêu cầu bảo trì/],
    ["Terminal assets cannot be scheduled for maintenance", /không thể lên lịch bảo trì/],
    ["Asset already has an active maintenance record", /đã có lịch bảo trì/],
    ["Asset has active maintenance", /đã có lịch bảo trì/],
    ["Receiving location must be ACTIVE and belong to the selected ACTIVE warehouse", /Kho hoặc vị trí nhận đã ngừng hoạt động/],
    ["Receiving location must belong to the selected warehouse", /thuộc kho đã chọn/],
    ["Receiving location must be active in the selected warehouse", /thuộc kho đã chọn/],
    ["Warehouse must exist and be active in this farm", /Kho nguồn hoặc kho nhận không còn hoạt động/],
    ["Location must be active in this farm", /Vị trí nguồn hoặc vị trí nhận không còn hoạt động/],
    ["Asset location must be active in this farm", /Vị trí nguồn hoặc vị trí nhận không còn hoạt động/],
    ["Asset item must remain active and ASSET tracked", /Vật tư của tài sản đã ngừng hoạt động/],
    ["Asset has no recorded source location", /chưa có vị trí nguồn/],
    ["Asset source location is not associated with a warehouse", /chưa thuộc kho nào/],
    ["Asset is already at this location", /đã ở vị trí nhận/],
    ["Asset is missing from source warehouse inventory", /tồn kho nguồn/],
    ["Receiving warehouse balance is unavailable", /Tồn kho nhận chưa sẵn sàng/],
  ];
  for (const [message, expected] of conflicts) assert.match(requestErrorMessage(409, message), expected, message);
  assert.match(requestErrorMessage(409, "Unknown conflict"), /dữ liệu liên quan đã thay đổi/);
});

test("reload decisions preserve the shared stock-document policy", () => {
  for (const status of [200, 400, 404, 409, 422, 500, 0, null]) assert.equal(shouldReloadAfterFailure(status), true, String(status));
  for (const status of [401, 403]) assert.equal(shouldReloadAfterFailure(status), false, String(status));
});

test("transfer destinations use joined names with code fallbacks", () => {
  assert.equal(transferDestination({ toWarehouseName: "Kho chính", toWarehouseCode: "K1", toLocationName: "Kệ A", toLocationCode: "A" }), "Kho chính — Kệ A");
  assert.equal(transferDestination({ toWarehouseName: null, toWarehouseCode: "K1", toLocationName: null, toLocationCode: "A" }), "K1 — A");
});
