import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HUBS,
  grantedHubTabs,
  headerTitleForPath,
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
