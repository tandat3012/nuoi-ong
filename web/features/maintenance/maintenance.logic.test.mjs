import assert from "node:assert/strict";
import { test } from "node:test";
import {
  maintenanceActions,
  maintenanceNextStep,
  maintenanceDate,
  maintenanceCountdown,
  formatMaintenanceCost,
  maintenanceCostValue,
} from "./maintenance.logic.ts";
test("formatted maintenance costs retain the exact API value", () => {
  for (const [input, display, api] of [
    ["120000", "120.000", "120000"],
    ["9007199254740993,01", "9.007.199.254.740.993,01", "9007199254740993.01"],
    ["123,", "123,", "123."],
    ["", "", ""],
  ]) {
    assert.equal(formatMaintenanceCost(input), display);
    assert.equal(maintenanceCostValue(display), api);
  }
});
const scheduled = { status: "SCHEDULED", returnStatus: null };
test("maintenance controls reflect each role and stage", () => {
  assert.deepEqual(maintenanceActions(scheduled, ["MAINTENANCE_STAFF"]), [
    "start",
    "cancel",
  ]);
  assert.deepEqual(maintenanceActions(scheduled, ["WAREHOUSE_MANAGER"]), [
    "cancel",
  ]);
  assert.deepEqual(maintenanceActions(scheduled, ["EMPLOYEE"]), []);
  assert.deepEqual(
    maintenanceActions({ ...scheduled, status: "IN_PROGRESS" }, [
      "MAINTENANCE_STAFF",
    ]),
    ["receive"],
  );
  assert.deepEqual(
    maintenanceActions({ ...scheduled, status: "RECEIVED" }, [
      "MAINTENANCE_STAFF",
    ]),
    ["complete"],
  );
  const pending = {
    status: "COMPLETED",
    returnStatus: "PENDING_APPROVAL",
    receivedAt: "2026-11-01T00:00:00Z",
  };
  assert.deepEqual(maintenanceActions(pending, ["MAINTENANCE_STAFF"]), []);
  assert.deepEqual(maintenanceActions(pending, ["WAREHOUSE_MANAGER"]), [
    "return-receipt/approve",
    "return-receipt/reject",
  ]);
});
test("legacy history and approved receipts have no unusable return actions", () => {
  for (const status of ["COMPLETED", "FAILED"]) {
    assert.deepEqual(
      maintenanceActions({ status, returnStatus: null }, ["MAINTENANCE_STAFF"]),
      [],
    );
    assert.deepEqual(
      maintenanceActions(
        { status, returnStatus: null, receivedAt: "2026-11-01T00:00:00Z" },
        ["MAINTENANCE_STAFF"],
      ),
      ["return-receipt"],
    );
    assert.deepEqual(
      maintenanceActions(
        {
          status,
          returnStatus: "CONFIRMED",
          receivedAt: "2026-11-01T00:00:00Z",
        },
        ["MAINTENANCE_STAFF"],
      ),
      [],
    );
  }
  assert.equal(
    maintenanceNextStep({ status: "COMPLETED", returnStatus: null }, []),
    "Hồ sơ lịch sử bảo trì.",
  );
  assert.match(
    maintenanceNextStep(scheduled, ["WAREHOUSE_MANAGER"]),
    /Chờ nhân viên bảo trì/,
  );
  assert.match(
    maintenanceNextStep({ status: "FAILED", returnStatus: "CONFIRMED" }, []),
    /chưa được phép sử dụng/,
  );
});
test("dates and countdown use Vietnam calendar boundaries", () => {
  assert.equal(maintenanceDate("2026-11-01T17:30:00Z", false), "02/11/2026");
  assert.equal(maintenanceDate(null), "Chưa đặt lịch");
  const now = Date.parse("2026-11-02T12:00:00+07:00");
  assert.equal(maintenanceCountdown("2026-11-01", now), "Quá hạn 1 ngày");
  assert.equal(maintenanceCountdown("2026-11-02", now), "Đến hạn hôm nay");
  assert.equal(maintenanceCountdown("2026-11-05", now), "Còn 3 ngày");
});
