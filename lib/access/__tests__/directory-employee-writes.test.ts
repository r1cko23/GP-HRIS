import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateDirectoryEmployee,
  canPatchDirectoryEmployee,
} from "../directory-employee-writes";

const ENCODER = [
  "page:people.employees",
  "fn:employees.create",
  "fn:employees.section.core",
] as const;

const UPDATER = [...ENCODER, "fn:employees.update"] as const;

describe("canCreateDirectoryEmployee", () => {
  it("allows create grant", () => {
    assert.equal(canCreateDirectoryEmployee(ENCODER), true);
  });

  it("denies view-only grants", () => {
    assert.equal(
      canCreateDirectoryEmployee([
        "page:people.employees",
        "fn:employees.section.core",
      ]),
      false
    );
  });

  it("allows fn:admin.system", () => {
    assert.equal(canCreateDirectoryEmployee(["fn:admin.system"]), true);
  });
});

describe("canPatchDirectoryEmployee", () => {
  it("create-only may encode for_verification", () => {
    assert.equal(
      canPatchDirectoryEmployee({
        capabilityKeys: ENCODER,
        employeeStatus: "for_verification",
      }),
      true
    );
  });

  it("create-only cannot patch active employees", () => {
    assert.equal(
      canPatchDirectoryEmployee({
        capabilityKeys: ENCODER,
        employeeStatus: "active",
      }),
      false
    );
  });

  it("create-only cannot patch inactive or for_release", () => {
    assert.equal(
      canPatchDirectoryEmployee({
        capabilityKeys: ENCODER,
        employeeStatus: "inactive",
      }),
      false
    );
    assert.equal(
      canPatchDirectoryEmployee({
        capabilityKeys: ENCODER,
        employeeStatus: "for_release",
      }),
      false
    );
  });

  it("update grant may patch any status", () => {
    assert.equal(
      canPatchDirectoryEmployee({
        capabilityKeys: UPDATER,
        employeeStatus: "active",
      }),
      true
    );
  });

  it("view-only cannot patch even for_verification", () => {
    assert.equal(
      canPatchDirectoryEmployee({
        capabilityKeys: ["page:people.employees", "fn:employees.section.core"],
        employeeStatus: "for_verification",
      }),
      false
    );
  });

  it("admin.system bypasses", () => {
    assert.equal(
      canPatchDirectoryEmployee({
        capabilityKeys: ["fn:admin.system"],
        employeeStatus: "active",
      }),
      true
    );
  });
});
