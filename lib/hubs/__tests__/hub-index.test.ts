import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HUBS,
  NAV_GROUPS,
  grantedHubTabs,
  headerTitleForPath,
  hubVisible,
  navGroupHasLinks,
  navGroupMenuSections,
  peopleEmployeeHirePath,
  peopleEmployeeOnboardPath,
  peopleEmployeePath,
} from "../../hubs";

describe("hub index tabs", () => {
  const benefits = HUBS.find((hub) => hub.id === "benefits");
  const time = HUBS.find((hub) => hub.id === "time");
  const reports = HUBS.find((hub) => hub.id === "reports");
  const admin = HUBS.find((hub) => hub.id === "admin");

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
      ["Attendance", "Leave", "OT", "Failure to log", "Schedules"]
    );
    assert.ok(tabs.every((tab) => (tab.description ?? "").length > 0));
  });

  it("keeps attendance available to punch reviewers who do not have the timesheet page", () => {
    assert.ok(time);
    const tabs = grantedHubTabs(time, (module) => module === "time_entries");
    assert.equal(
      tabs.some((tab) => tab.href === "/time/attendance"),
      true
    );
    assert.equal(
      tabs.some((tab) => tab.href === "/time/entries"),
      false
    );
  });

  it("hides the Admin hub unless the viewer is an admin", () => {
    assert.ok(admin);
    const canReadAll = () => true;
    assert.equal(hubVisible(admin, canReadAll), false);
    assert.equal(hubVisible(admin, canReadAll, { isAdmin: false }), false);
    assert.equal(grantedHubTabs(admin, canReadAll).length, 0);
    assert.equal(hubVisible(admin, canReadAll, { isAdmin: true }), true);
    assert.equal(hubVisible(admin, () => false, { isAdmin: true }), false);

    const adminGroup = NAV_GROUPS.find((group) => group.id === "admin");
    assert.ok(adminGroup);
    assert.equal(
      navGroupHasLinks(navGroupMenuSections(adminGroup, canReadAll)),
      false
    );
    assert.equal(
      navGroupHasLinks(
        navGroupMenuSections(adminGroup, canReadAll, { isAdmin: true })
      ),
      true
    );

    const people = HUBS.find((hub) => hub.id === "people");
    assert.ok(people);
    assert.equal(
      hubVisible(people, (module) => module === "employees", { isAdmin: false }),
      true
    );
  });

  it("hides clock enrollment when the viewer cannot open People", () => {
    assert.ok(admin);
    const tabs = grantedHubTabs(admin, () => true, {
      isAdmin: true,
      hideEmployees: true,
    });
    assert.equal(
      tabs.some((tab) => tab.href === "/admin/enrollment"),
      false
    );
  });

  it("puts remittance reports under Reports; Benefits keeps entry pages", () => {
    assert.ok(benefits);
    assert.ok(admin);
    assert.ok(reports);
    assert.deepEqual(
      grantedHubTabs(benefits, () => true).map((tab) => tab.name),
      [
        "Loans",
        "Allowances",
        "Deductions",
        "Refunds",
        "Statutory IDs",
      ]
    );
    assert.equal(
      benefits.tabs.find((tab) => tab.name === "Refunds")?.href,
      "/benefits/refunds"
    );
    assert.deepEqual(
      grantedHubTabs(reports, () => true).map((tab) => tab.name),
      [
        "Loans",
        "Cash advance",
        "Alphalist",
        "13th month",
        "SIL",
        "13th Final Pay",
      ]
    );
    assert.equal(
      reports.tabs.find((tab) => tab.name === "Loans")?.href,
      "/reports/loans"
    );
    assert.equal(
      reports.tabs.find((tab) => tab.name === "Cash advance")?.href,
      "/reports/cash-advance"
    );
    assert.equal(
      reports.tabs.find((tab) => tab.name === "Alphalist")?.href,
      "/reports/alphalist"
    );
    assert.equal(
      reports.tabs.find((tab) => tab.name === "13th month")?.href,
      "/reports/thirteenth-month"
    );
    assert.equal(
      reports.tabs.find((tab) => tab.name === "13th Final Pay")?.href,
      "/reports/thirteenth-month-final-pay"
    );
    assert.deepEqual(
      grantedHubTabs(admin, () => true, { isAdmin: true }).map((tab) => tab.name),
      [
        "Overview",
        "Register",
        "BIR",
        "Audit log",
        "Devices",
        "Enrollment",
        "Biometric",
        "Cutoff parity",
        "Payroll audit",
        "Incentive audit",
      ]
    );
    assert.equal(
      admin.tabs.find((tab) => tab.name === "Enrollment")?.href,
      "/admin/enrollment"
    );
    assert.equal(
      admin.tabs.find((tab) => tab.name === "Biometric")?.href,
      "/admin/biometric"
    );
    assert.equal(headerTitleForPath("/admin/enrollment"), "Enrollment");
    assert.equal(headerTitleForPath("/admin/biometric"), "Biometric");
    assert.equal(headerTitleForPath("/admin"), "Admin");
    assert.equal(headerTitleForPath("/benefits/refunds"), "Refunds");
    assert.equal(headerTitleForPath("/reports/loans"), "Loans");
    assert.equal(headerTitleForPath("/reports/cash-advance"), "Cash advance");
    assert.equal(headerTitleForPath("/reports/alphalist"), "Alphalist");
    assert.equal(headerTitleForPath("/reports/thirteenth-month"), "13th month");
    assert.equal(
      headerTitleForPath("/reports/thirteenth-month-final-pay"),
      "13th Final Pay"
    );
  });
});

describe("employee hire wizard", () => {
  const clientId = "40dfe61e-25d0-499b-85e6-d615dc981d11";
  const employeeId = "c45e19cb-088e-473b-9876-f07b0a6c5e55";

  it("Add employee opens the hub wizard, not the 201 file", () => {
    const hire = peopleEmployeeHirePath(clientId);
    assert.equal(hire, `/people/employees/new?client_id=${clientId}`);
    assert.equal(headerTitleForPath("/people/employees/new"), "Add employee");
    assert.notEqual(headerTitleForPath("/people/employees/new"), "201 file");
    assert.notEqual(headerTitleForPath("/people/employees/new"), "Employees");
  });

  it("hub hire accepts name and branch prefills from 201 alerts", () => {
    const hire = peopleEmployeeHirePath(clientId, {
      branchId: "b1",
      name: "Reyes, Ana",
    });
    assert.equal(
      hire,
      `/people/employees/new?client_id=${clientId}&branch_id=b1&name=Reyes%2C+Ana`
    );
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

  it("labels the Position catalog, not a 201 file", () => {
    assert.equal(
      headerTitleForPath(`/people/c/${clientId}/positions`),
      "Positions"
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
