import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NAV_GROUPS,
  HUBS,
  isNavGroupActive,
  navGroupHasLinks,
  navGroupMenuSections,
} from "../hubs";
import {
  PAGE_PEOPLE_CLIENTS,
  PAGE_PEOPLE_EMPLOYEES,
} from "@/lib/access/people-pages";
import {
  getDefaultPermissionsForRole,
  MODULES,
  type ModuleName,
} from "@/lib/hooks/usePermissions";
import { resolvePermissionsFromRoleAndGrants } from "@/lib/access/apply-hris-grants";

const MODULE_KEYS = Object.values(MODULES) as ModuleName[];

function canReadFromKeys(keys: string[]) {
  const resolved = resolvePermissionsFromRoleAndGrants({
    roleDefaults: getDefaultPermissionsForRole("viewer"),
    capabilityKeys: keys,
    moduleKeys: MODULE_KEYS,
  });
  return (m: ModuleName) => resolved[m]?.read === true;
}

describe("NAV_GROUPS", () => {
  it("groups hubs into HR / Operations / Payroll / Admin", () => {
    assert.deepEqual(
      NAV_GROUPS.map((g) => g.id),
      ["hr", "operations", "payroll", "admin"]
    );
    assert.deepEqual(NAV_GROUPS.find((g) => g.id === "hr")?.hubIds, [
      "people",
      "benefits",
    ]);
    assert.deepEqual(NAV_GROUPS.find((g) => g.id === "operations")?.hubIds, [
      "time",
    ]);
    assert.deepEqual(NAV_GROUPS.find((g) => g.id === "payroll")?.hubIds, [
      "payroll",
      "bdo",
      "reports",
    ]);
    assert.deepEqual(NAV_GROUPS.find((g) => g.id === "admin")?.hubIds, [
      "admin",
    ]);
    const assigned = new Set(NAV_GROUPS.flatMap((g) => g.hubIds));
    for (const hub of HUBS) {
      assert.ok(assigned.has(hub.id), `hub ${hub.id} must be in a nav group`);
    }
  });

  it("HR menu shows Clients for clients-only pack, not Benefits tabs", () => {
    const hr = NAV_GROUPS.find((g) => g.id === "hr")!;
    const sections = navGroupMenuSections(
      hr,
      canReadFromKeys([PAGE_PEOPLE_CLIENTS]),
      { capabilityKeys: [PAGE_PEOPLE_CLIENTS] }
    );
    assert.equal(navGroupHasLinks(sections), true);
    const labels = sections.flatMap((s) => s.links.map((l) => l.label));
    assert.ok(labels.includes("Clients"));
    assert.equal(labels.includes("Employees"), false);
    assert.equal(labels.includes("Loans"), false);
    assert.equal(labels.includes("Statutory IDs"), false);
    assert.equal(
      sections.some((s) => s.label === "Benefits"),
      false
    );
  });

  it("Employees page still opens Statutory IDs", () => {
    const hr = NAV_GROUPS.find((g) => g.id === "hr")!;
    const sections = navGroupMenuSections(
      hr,
      canReadFromKeys([PAGE_PEOPLE_EMPLOYEES]),
      { capabilityKeys: [PAGE_PEOPLE_EMPLOYEES] }
    );
    const labels = sections.flatMap((s) => s.links.map((l) => l.label));
    assert.ok(labels.includes("Statutory IDs"));
  });

  it("marks Payroll group active on debit-memo and report paths", () => {
    const payroll = NAV_GROUPS.find((g) => g.id === "payroll")!;
    assert.equal(isNavGroupActive("/bdo-queue", payroll), true);
    assert.equal(isNavGroupActive("/reports/sil", payroll), true);
    assert.equal(isNavGroupActive("/payroll", payroll), true);
    assert.equal(isNavGroupActive("/people/clients", payroll), false);
  });

  it("HR group active for people employees when granted", () => {
    const hr = NAV_GROUPS.find((g) => g.id === "hr")!;
    assert.equal(isNavGroupActive("/people/employees", hr), true);
    const sections = navGroupMenuSections(
      hr,
      canReadFromKeys([PAGE_PEOPLE_EMPLOYEES]),
      { capabilityKeys: [PAGE_PEOPLE_EMPLOYEES] }
    );
    assert.ok(
      sections.flatMap((s) => s.links.map((l) => l.href)).includes("/people/employees")
    );
  });
});
