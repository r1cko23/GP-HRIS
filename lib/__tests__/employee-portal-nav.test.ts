import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPLOYEE_PORTAL_BUNDY_HREF,
  filterEmployeePortalNavItems,
  shouldShowEmployeePortalBundy,
} from "../employee-portal-nav";

describe("shouldShowEmployeePortalBundy", () => {
  it("hides bundy when the employee has a biometric login map", () => {
    assert.equal(shouldShowEmployeePortalBundy(true), false);
  });

  it("shows bundy when there is no biometric map", () => {
    assert.equal(shouldShowEmployeePortalBundy(false), true);
  });
});

describe("filterEmployeePortalNavItems", () => {
  const items = [
    { name: "Home", href: "/employee-portal" },
    { name: "Bundy clock", href: EMPLOYEE_PORTAL_BUNDY_HREF },
    { name: "Leave", href: "/employee-portal/leave-request" },
  ];

  it("removes the bundy link when biometricMapped", () => {
    const filtered = filterEmployeePortalNavItems(items, {
      biometricMapped: true,
    });
    assert.deepEqual(
      filtered.map((i) => i.href),
      ["/employee-portal", "/employee-portal/leave-request"]
    );
  });

  it("keeps bundy when not mapped", () => {
    const filtered = filterEmployeePortalNavItems(items, {
      biometricMapped: false,
    });
    assert.equal(filtered.length, 3);
    assert.equal(filtered[1]?.href, EMPLOYEE_PORTAL_BUNDY_HREF);
  });

  it("treats zero mapped rows as no map (cardinality)", () => {
    assert.equal(shouldShowEmployeePortalBundy(false), true);
  });
});
