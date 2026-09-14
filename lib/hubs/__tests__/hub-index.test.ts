import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HUBS,
  grantedHubTabs,
  headerTitleForPath,
  peopleEmployeeHirePath,
  peopleEmployeeOnboardPath,
  peopleEmployeePath,
} from "../../hubs";

describe("hub index tabs", () => {
  const benefits = HUBS.find((hub) => hub.id === "benefits");
  const time = HUBS.find((hub) => hub.id === "time");
  const reports = HUBS.find((hub) => hub.id === "reports");

  it("lists granted benefits tabs with a one-line job, hiding loans without permission", () => {
    assert.ok(benefits);
    const tabs = grantedHubTabs(benefits, (module) => module === "employees");
    assert.deepEqual(
      tabs.map((tab) => tab.name),
      ["Statutory IDs"]
    );
    assert.match(tabs[0]?.description ?? "", /201/);
  });

  it("lists every time section when those modules are granted", () => {
    assert.ok(time);
    const tabs = grantedHubTabs(time, () => true);
    assert.deepEqual(
      tabs.map((tab) => tab.name),
      [
        "Attendance",
        "Entries",
        "Leave",
        "OT",
        "Failure to log",
        "Schedules",
        "Enrollment",
      ]
    );
    assert.ok(tabs.every((tab) => (tab.description ?? "").length > 0));
  });

  it("hides clock enrollment when the viewer cannot open People", () => {
    assert.ok(time);
    const tabs = grantedHubTabs(time, () => true, { hideEmployees: true });
    assert.equal(
      tabs.some((tab) => tab.href === "/time/enrollment"),
      false
    );
  });

  it("treats /reports as the index, not Overview", () => {
    assert.ok(reports);
    const overview = reports.tabs.find((tab) => tab.name === "Overview");
    assert.equal(overview?.href, "/reports/overview");
    assert.equal(headerTitleForPath("/reports"), "Reports");
    assert.equal(headerTitleForPath("/reports/overview"), "Overview");
  });
});

describe("employee hire wizard", () => {
  const clientId = "40dfe61e-25d0-499b-85e6-d615dc981d11";
  const employeeId = "c45e19cb-088e-473b-9876-f07b0a6c5e55";

  it("Add employee opens a wizard, not the 201 file", () => {
    const hire = peopleEmployeeHirePath(clientId);
    assert.equal(hire, `/people/c/${clientId}/new`);
    assert.equal(headerTitleForPath(hire), "Add employee");
    assert.notEqual(headerTitleForPath(hire), "201 file");
    assert.notEqual(headerTitleForPath(hire), "Employee roster");
  });

  it("keeps UUID 201 files labeled 201 file", () => {
    assert.equal(
      headerTitleForPath(`/people/c/${clientId}/${employeeId}`),
      "201 file"
    );
  });

  it("labels the Department catalog, not a 201 file", () => {
    assert.equal(
      headerTitleForPath(`/people/c/${clientId}/departments`),
      "Departments"
    );
  });

  it("after identity, hire continues on onboard steps instead of the 201", () => {
    assert.equal(
      peopleEmployeeOnboardPath(clientId, employeeId, "assignment"),
      `/people/c/${clientId}/${employeeId}/onboard?step=assignment`
    );
    assert.notEqual(
      peopleEmployeeOnboardPath(clientId, employeeId),
      peopleEmployeePath(clientId, employeeId)
    );
  });
});
