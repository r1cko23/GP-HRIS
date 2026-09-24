import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPersonKey,
  isLegacy201VerificationPassed,
  isLegacyForRelease,
  mapLegacyEmployeeStatus,
} from "../legacy-status";

describe("isLegacyForRelease", () => {
  it("matches Release and For Release only", () => {
    assert.equal(isLegacyForRelease("Release"), true);
    assert.equal(isLegacyForRelease("For Release"), true);
  });

  it("does not match Unrelease (prior ETL bug)", () => {
    assert.equal(isLegacyForRelease("Unrelease"), false);
    assert.equal(isLegacyForRelease("unrelease"), false);
  });
});

describe("isLegacy201VerificationPassed", () => {
  it("allows blank and Verified (MAIN payroll gate)", () => {
    assert.equal(isLegacy201VerificationPassed(null), true);
    assert.equal(isLegacy201VerificationPassed(""), true);
    assert.equal(isLegacy201VerificationPassed("  "), true);
    assert.equal(isLegacy201VerificationPassed("Verified"), true);
    assert.equal(isLegacy201VerificationPassed("verified"), true);
  });

  it("blocks Pending so ETL cannot pull unverified 201s", () => {
    assert.equal(isLegacy201VerificationPassed("Pending"), false);
    assert.equal(isLegacy201VerificationPassed("pending"), false);
  });
});

describe("mapLegacyEmployeeStatus", () => {
  const barred = new Set<number>();

  it("maps Unrelease + Active to active", () => {
    const r = mapLegacyEmployeeStatus(
      { status: "Active", finalpaystatus: "Unrelease" },
      barred
    );
    assert.equal(r.status, "active");
  });

  it("maps Release + Active to for_release", () => {
    const r = mapLegacyEmployeeStatus(
      { status: "Active", finalpaystatus: "Release" },
      barred
    );
    assert.equal(r.status, "for_release");
  });

  it("maps Claimed to inactive", () => {
    const r = mapLegacyEmployeeStatus(
      { status: "Active", finalpaystatus: "Claimed" },
      barred
    );
    assert.equal(r.status, "inactive");
  });

  it("maps Active + verificationstatus Pending to for_verification (Delima loophole)", () => {
    // GREENHRISMAIN keeps status=Active while 201 docs are Pending.
    // Payroll/search exclude these; Directory must not treat them as Active
    // or CSM can link an unverified 201 (Employee_id 29743).
    const r = mapLegacyEmployeeStatus(
      {
        Employee_id: 29743,
        status: "Active",
        employee_status: "Probationary",
        verificationstatus: "Pending",
        verifiedforverification: null,
        finalpaystatus: "",
      },
      barred
    );
    assert.equal(r.status, "for_verification");
  });

  it("maps verifiedforverification=Y to for_verification even when verificationstatus is blank", () => {
    const r = mapLegacyEmployeeStatus(
      {
        status: "Active",
        verificationstatus: null,
        verifiedforverification: "Y",
      },
      barred
    );
    assert.equal(r.status, "for_verification");
  });

  it("keeps Verified + Active as active", () => {
    const r = mapLegacyEmployeeStatus(
      {
        status: "Active",
        verificationstatus: "Verified",
        verifiedforverification: null,
      },
      barred
    );
    assert.equal(r.status, "active");
  });
});

describe("buildPersonKey", () => {
  it("prefers SSS+TIN+DOB", () => {
    const key = buildPersonKey({
      legacy_id: 99,
      sss_number: "12-3456789-0",
      tin: "123-456-789",
      birth_date: "1990-01-01",
      last_name: "A",
      first_name: "B",
    });
    assert.ok(key.startsWith("STB:"));
  });
});
