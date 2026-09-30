import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPeopleClients,
  canPeopleEmployees,
  canPeopleHub,
  defaultPeopleSurface,
  employeesReadForSections,
  PAGE_EMPLOYEES_LEGACY,
  PAGE_PEOPLE_CLIENTS,
  PAGE_PEOPLE_EMPLOYEES,
  peoplePageOpensEmployeesModule,
} from "../people-pages";
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
import { hubVisible, HUBS, grantedHubTabs } from "@/lib/hubs";
import { resolveEmployeeSectionAccess } from "../employee-sections";
import { canViewClientRoster } from "@/lib/directory/position-approval";

const MODULE_KEYS = Object.values(MODULES) as ModuleName[];

function canReadFromKeys(keys: string[]) {
  const resolved = resolvePermissionsFromRoleAndGrants({
    roleDefaults: getDefaultPermissionsForRole("viewer"),
    capabilityKeys: keys,
    moduleKeys: MODULE_KEYS,
  });
  return (m: ModuleName) => resolved[m]?.read === true;
}

describe("people page grants", () => {
  it("clients-only pack opens hub + Clients, not Employees or 201 sections", () => {
    const keys = [
      PAGE_PEOPLE_CLIENTS,
      "fn:clients.roster.view",
      "fn:positions.approve.hotel",
    ];
    assert.equal(canPeopleHub(keys), true);
    assert.equal(canPeopleClients(keys), true);
    assert.equal(canPeopleEmployees(keys), false);
    assert.equal(defaultPeopleSurface(keys), "clients");
    assert.equal(
      employeesReadForSections({
        capabilityKeys: keys,
        moduleEmployeesRead: true,
      }),
      false
    );

    const sections = resolveEmployeeSectionAccess({
      employeesRead: employeesReadForSections({
        capabilityKeys: keys,
        moduleEmployeesRead: true,
      }),
      capabilityKeys: keys,
    });
    assert.equal(sections.sections.core, false);

    const resolved = resolvePermissionsFromRoleAndGrants({
      roleDefaults: getDefaultPermissionsForRole("viewer"),
      capabilityKeys: keys,
      moduleKeys: MODULE_KEYS,
    });
    assert.equal(resolved.employees.read, true);
    assert.equal(
      hubVisible(HUBS.find((h) => h.id === "people")!, (m) =>
        resolved[m]?.read === true
      ),
      true
    );
  });

  it("People hub exposes Clients and Employees tabs on separate routes", () => {
    const people = HUBS.find((h) => h.id === "people")!;
    assert.equal(people.tabs.length, 2);
    assert.equal(people.tabs[0]?.href, "/people/clients");
    assert.equal(people.tabs[1]?.href, "/people/employees");
    assert.equal(defaultPeopleSurface([PAGE_PEOPLE_EMPLOYEES]), "employees");
    assert.equal(defaultPeopleSurface([PAGE_PEOPLE_CLIENTS]), "clients");
  });

  it("clients-only pack sees only Clients tab; employees-only sees Employees", () => {
    const people = HUBS.find((h) => h.id === "people")!;
    const clientsOnly = grantedHubTabs(
      people,
      canReadFromKeys([PAGE_PEOPLE_CLIENTS]),
      { capabilityKeys: [PAGE_PEOPLE_CLIENTS] }
    );
    assert.deepEqual(
      clientsOnly.map((t) => t.href),
      ["/people/clients"]
    );

    const employeesOnly = grantedHubTabs(
      people,
      canReadFromKeys([PAGE_PEOPLE_EMPLOYEES]),
      { capabilityKeys: [PAGE_PEOPLE_EMPLOYEES] }
    );
    assert.deepEqual(
      employeesOnly.map((t) => t.href),
      ["/people/employees"]
    );
  });

  it("employees-only pack opens Employees surface and queues path", () => {
    const keys = [
      PAGE_PEOPLE_EMPLOYEES,
      "fn:employees.create",
      "fn:employees.section.core",
    ];
    assert.equal(canPeopleClients(keys), false);
    assert.equal(canPeopleEmployees(keys), true);
    assert.equal(defaultPeopleSurface(keys), "employees");
  });

  it("legacy page:employees aliases to both surfaces", () => {
    const keys = [PAGE_EMPLOYEES_LEGACY];
    assert.equal(canPeopleClients(keys), true);
    assert.equal(canPeopleEmployees(keys), true);
    assert.equal(defaultPeopleSurface(keys), "employees");
  });

  it("both pages default to Employees (HR daily path)", () => {
    assert.equal(
      defaultPeopleSurface([PAGE_PEOPLE_CLIENTS, PAGE_PEOPLE_EMPLOYEES]),
      "employees"
    );
  });

  it("maps dotted people pages onto employees module read", () => {
    assert.equal(peoplePageOpensEmployeesModule(PAGE_PEOPLE_CLIENTS), true);
    assert.equal(peoplePageOpensEmployeesModule(PAGE_PEOPLE_EMPLOYEES), true);
    const base = emptyUserPermissions(MODULE_KEYS);
    const next = applyCapabilityKeysToPermissions(base, [PAGE_PEOPLE_CLIENTS]);
    assert.equal(next.employees.read, true);
  });

  it("roster view accepts clients page without employees page", () => {
    assert.equal(canViewClientRoster([PAGE_PEOPLE_CLIENTS]), true);
    assert.equal(canViewClientRoster([PAGE_PEOPLE_EMPLOYEES]), false);
  });
});
