import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickDirectoryEmployeePatch } from "../employee-patch";

describe("pickDirectoryEmployeePatch name parts", () => {
  it("accepts last, first, and middle separately like GREENHRISMAIN lname/fname/mname", () => {
    const picked = pickDirectoryEmployeePatch({
      last_name: "santos jr",
      first_name: "juan",
      middle_name: "dela cruz",
    });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.deepEqual(picked.patch, {
      last_name: "Santos Jr",
      first_name: "Juan",
      middle_name: "Dela Cruz",
    });
  });

  it("lets HR patch a single name part without sending the others", () => {
    const picked = pickDirectoryEmployeePatch({ last_name: "Santos Jr" });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.deepEqual(picked.patch, { last_name: "Santos Jr" });
  });

  it("clears middle name when blank (GREENHRISMAIN mname is optional)", () => {
    const picked = pickDirectoryEmployeePatch({ middle_name: "   " });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.deepEqual(picked.patch, { middle_name: null });
  });

  it("rejects a blank last name (GREENHRISMAIN lname is required)", () => {
    const picked = pickDirectoryEmployeePatch({ last_name: "" });
    assert.equal(picked.ok, false);
    if (picked.ok) return;
    assert.match(picked.error, /last_name is required/i);
  });

  it("rejects a blank first name", () => {
    const picked = pickDirectoryEmployeePatch({ first_name: null });
    assert.equal(picked.ok, false);
    if (picked.ok) return;
    assert.match(picked.error, /first_name is required/i);
  });

  it("keeps Jr on last name instead of inventing a suffix column", () => {
    const picked = pickDirectoryEmployeePatch({
      last_name: "DELA CRUZ JR",
      suffix: "Jr",
    });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.equal(picked.patch.last_name, "Dela Cruz Jr");
    assert.equal("suffix" in picked.patch, false);
  });
});
