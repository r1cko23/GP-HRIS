import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickDirectoryEmployeePatch } from "../employee-patch";

describe("pickDirectoryEmployeePatch identity dates", () => {
  it("accepts birth_date and sex so completeness chips can be filled", () => {
    const picked = pickDirectoryEmployeePatch({
      birth_date: "1990-05-01",
      sex: "F",
    });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.equal(picked.patch.birth_date, "1990-05-01");
    assert.equal(picked.patch.sex, "F");
  });

  it("clears birth_date when blank", () => {
    const picked = pickDirectoryEmployeePatch({ birth_date: "  " });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.equal(picked.patch.birth_date, null);
  });

  it("rejects a birth_date that is not YYYY-MM-DD", () => {
    const picked = pickDirectoryEmployeePatch({ birth_date: "May 1 1990" });
    assert.equal(picked.ok, false);
    if (picked.ok) return;
    assert.match(picked.error, /birth_date/i);
  });

  it("accepts hire_date for the assignment step", () => {
    const picked = pickDirectoryEmployeePatch({ hire_date: "2026-09-01" });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.equal(picked.patch.hire_date, "2026-09-01");
  });
});
