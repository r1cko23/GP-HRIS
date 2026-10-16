/**
 * Names-only ETL treats punctuation as a real change (Ma. → Ma).
 * Mirrors foldNamePart in scripts/etl-greenhrismain-directory.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function foldNamePart(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

describe("directory name fold (names-only ETL)", () => {
  it("treats Ma. vs Ma as a spelling change that should sync", () => {
    assert.notEqual(
      foldNamePart("Ma. Regelyn Miel"),
      foldNamePart("Ma Regelyn Miel")
    );
  });

  it("ignores case-only differences", () => {
    assert.equal(
      foldNamePart("MA. REGELYN MIEL"),
      foldNamePart("Ma. Regelyn Miel")
    );
  });
});
