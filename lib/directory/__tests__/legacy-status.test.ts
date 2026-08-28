import { describe, expect, it } from "vitest";
import {
  buildPersonKey,
  isLegacyForRelease,
  mapLegacyEmployeeStatus,
} from "../legacy-status";

describe("isLegacyForRelease", () => {
  it("matches Release and For Release only", () => {
    expect(isLegacyForRelease("Release")).toBe(true);
    expect(isLegacyForRelease("For Release")).toBe(true);
  });

  it("does not match Unrelease (prior ETL bug)", () => {
    expect(isLegacyForRelease("Unrelease")).toBe(false);
    expect(isLegacyForRelease("unrelease")).toBe(false);
  });
});

describe("mapLegacyEmployeeStatus", () => {
  const barred = new Set<number>();

  it("maps Unrelease + Active to active", () => {
    const r = mapLegacyEmployeeStatus(
      { status: "Active", finalpaystatus: "Unrelease" },
      barred
    );
    expect(r.status).toBe("active");
  });

  it("maps Release + Active to for_release", () => {
    const r = mapLegacyEmployeeStatus(
      { status: "Active", finalpaystatus: "Release" },
      barred
    );
    expect(r.status).toBe("for_release");
  });

  it("maps Claimed to inactive", () => {
    const r = mapLegacyEmployeeStatus(
      { status: "Active", finalpaystatus: "Claimed" },
      barred
    );
    expect(r.status).toBe("inactive");
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
    expect(key.startsWith("STB:")).toBe(true);
  });
});
