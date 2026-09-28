import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCapabilityKeysToPermissions,
  emptyUserPermissions,
  resolvePermissionsFromRoleAndGrants,
} from "../apply-hris-grants";
import {
  getDefaultPermissionsForRole,
  MODULES,
  type ModuleName,
} from "@/lib/hooks/usePermissions";
import { hubVisible, HUBS } from "@/lib/hubs";

const MODULE_KEYS = Object.values(MODULES) as ModuleName[];

describe("resolvePermissionsFromRoleAndGrants", () => {
  it("keeps role defaults when the user has no grant rows (legacy)", () => {
    const roleDefaults = getDefaultPermissionsForRole("hr_admin");
    const resolved = resolvePermissionsFromRoleAndGrants({
      roleDefaults,
      capabilityKeys: [],
      moduleKeys: MODULE_KEYS,
    });
    assert.equal(resolved.payslips.read, true);
    assert.equal(resolved.employees.read, true);
  });

  it("Emman-style grants: People + Statutory only — not Payroll/Time/Reports/Settings", () => {
    const roleDefaults = getDefaultPermissionsForRole("hr_admin");
    // Symptom: role defaults alone open every hub.
    assert.equal(roleDefaults.payslips.read, true);
    assert.equal(roleDefaults.timesheet.read, true);
    assert.equal(roleDefaults.settings.read, true);

    const resolved = resolvePermissionsFromRoleAndGrants({
      roleDefaults,
      capabilityKeys: [
        "page:employees",
        "fn:employees.create",
        "fn:employees.update",
        "fn:employees.section.government_ids",
      ],
      moduleKeys: MODULE_KEYS,
    });

    assert.equal(resolved.employees.read, true);
    assert.equal(resolved.employees.create, true);
    assert.equal(resolved.employees.update, true);
    assert.equal(resolved.employees.delete, false);
    assert.equal(resolved.payslips.read, false);
    assert.equal(resolved.loans.read, false);
    assert.equal(resolved.timesheet.read, false);
    assert.equal(resolved.time_entries.read, false);
    assert.equal(resolved.reports.read, false);
    assert.equal(resolved.settings.read, false);
    assert.equal(resolved.dashboard.read, false);

    const canRead = (mod: ModuleName) => resolved[mod]?.read === true;
    assert.equal(
      hubVisible(HUBS.find((h) => h.id === "people")!, canRead),
      true
    );
    assert.equal(
      hubVisible(HUBS.find((h) => h.id === "benefits")!, canRead),
      true,
      "Benefits stays for Statutory IDs (employees module)"
    );
    assert.equal(
      hubVisible(HUBS.find((h) => h.id === "payroll")!, canRead),
      false
    );
    assert.equal(
      hubVisible(HUBS.find((h) => h.id === "time")!, canRead),
      false,
      "Time must not open just because employees is granted"
    );
    assert.equal(
      hubVisible(HUBS.find((h) => h.id === "reports")!, canRead),
      false
    );
  });

  it("Lea-style Time pack (admin label): People + Time, not Payroll/Reports/Settings", () => {
    const roleDefaults = getDefaultPermissionsForRole("admin");
    assert.equal(roleDefaults.payslips.read, true);
    assert.equal(roleDefaults.settings.read, true);

    const resolved = resolvePermissionsFromRoleAndGrants({
      roleDefaults,
      capabilityKeys: [
        "page:employees",
        "page:timesheet",
        "page:time_entries",
        "page:leave_approval",
        "page:overtime_approval",
        "page:failure_to_log",
        "page:schedules",
        "fn:employees.section.core",
        "fn:employees.section.government_ids",
        "fn:employees.section.documents",
        "fn:employees.section.family",
        "fn:employees.section.history",
        "fn:employees.section.medical",
        "fn:employees.section.pay_channel",
        "fn:employees.section.lifecycle",
        "fn:leave_approval.update",
        "fn:overtime_approval.update",
        "fn:failure_to_log.update",
      ],
      moduleKeys: MODULE_KEYS,
    });

    const canRead = (mod: ModuleName) => resolved[mod]?.read === true;
    assert.equal(hubVisible(HUBS.find((h) => h.id === "people")!, canRead), true);
    assert.equal(hubVisible(HUBS.find((h) => h.id === "time")!, canRead), true);
    assert.equal(hubVisible(HUBS.find((h) => h.id === "payroll")!, canRead), false);
    assert.equal(hubVisible(HUBS.find((h) => h.id === "reports")!, canRead), false);
    assert.equal(resolved.settings.read, false);
  });

  it("Dyan pack: Benefits + Time + BIR — not Payroll register or Settings", () => {
    const resolved = resolvePermissionsFromRoleAndGrants({
      roleDefaults: getDefaultPermissionsForRole("hr_admin"),
      capabilityKeys: [
        "page:loans",
        "page:payslips",
        "page:employees",
        "page:timesheet",
        "page:time_entries",
        "page:bir_reports",
        "fn:loans.create",
        "fn:payslips.create",
      ],
      moduleKeys: MODULE_KEYS,
    });
    const canRead = (mod: ModuleName) => resolved[mod]?.read === true;
    assert.equal(hubVisible(HUBS.find((h) => h.id === "benefits")!, canRead), true);
    assert.equal(hubVisible(HUBS.find((h) => h.id === "time")!, canRead), true);
    assert.equal(
      hubVisible(HUBS.find((h) => h.id === "admin")!, canRead),
      true,
      "BIR lives under Admin"
    );
    assert.equal(
      hubVisible(HUBS.find((h) => h.id === "reports")!, canRead),
      true,
      "Loans report opens Reports via loans grant"
    );
    assert.equal(hubVisible(HUBS.find((h) => h.id === "payroll")!, canRead), false);
    assert.equal(resolved.settings.read, false);
    assert.equal(resolved.employees.delete, false);
  });
});

describe("applyCapabilityKeysToPermissions", () => {
  it("maps page and fn keys onto CRUD flags", () => {
    const base = emptyUserPermissions(MODULE_KEYS);
    const next = applyCapabilityKeysToPermissions(base, [
      "page:loans",
      "fn:loans.create",
      "fn:employees.section.core",
    ]);
    assert.equal(next.loans.read, true);
    assert.equal(next.loans.create, true);
    assert.equal(next.employees.read, false);
  });
});
