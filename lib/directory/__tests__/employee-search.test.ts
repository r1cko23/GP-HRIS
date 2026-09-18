import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  directoryEmployeeSearchFilter,
  directoryEmployeeSearchOrClauses,
  escapeIlikePattern,
  phSssSearchForms,
  phTinSearchForms,
} from "../employee-search";

describe("phSssSearchForms", () => {
  it("tries digits-only and dashed PH SSS for either input shape", () => {
    assert.deepEqual(phSssSearchForms("0249513659"), [
      "0249513659",
      "02-4951365-9",
    ]);
    assert.deepEqual(phSssSearchForms("02-4951365-9"), [
      "02-4951365-9",
      "0249513659",
    ]);
  });
});

describe("phTinSearchForms", () => {
  it("tries digits-only and dashed TIN for 9-digit ids", () => {
    assert.deepEqual(phTinSearchForms("759868551"), [
      "759868551",
      "759-868-551",
    ]);
  });
});

describe("escapeIlikePattern", () => {
  it("escapes ILIKE wildcards", () => {
    assert.equal(escapeIlikePattern("100%_ready"), "100\\%\\_ready");
  });
});

describe("directoryEmployeeSearchFilter", () => {
  it("searches middle_name as well as last and first", () => {
    const filter = directoryEmployeeSearchFilter("Adriano");
    assert.match(filter ?? "", /middle_name\.ilike\.%adriano%/);
  });

  it("requires every name token for multi-word / Last First paste", () => {
    const filter = directoryEmployeeSearchFilter("Dela Cruz, Margoe");
    assert.match(filter ?? "", /^and\(/);
    assert.match(filter ?? "", /%dela%/);
    assert.match(filter ?? "", /%cruz%/);
    assert.match(filter ?? "", /%margoe%/);
  });

  it("matches dashed or plain SSS without requiring a name token", () => {
    const filter = directoryEmployeeSearchFilter("02-4951365-9");
    assert.match(filter ?? "", /sss_number\.ilike\.%02-4951365-9%/);
    assert.match(filter ?? "", /sss_number\.ilike\.%0249513659%/);
    assert.equal((filter ?? "").startsWith("and("), false);
  });

  it("ORs employee_code alias ids with the name match", () => {
    const filter = directoryEmployeeSearchFilter("margoe", ["abc-1"]);
    assert.match(filter ?? "", /first_name\.ilike\.%margoe%/);
    assert.match(filter ?? "", /id\.in\.\(abc-1\)/);
  });
});

describe("directoryEmployeeSearchOrClauses", () => {
  it("exposes one OR clause per name token for assertions", () => {
    const clauses = directoryEmployeeSearchOrClauses("Dela Cruz, Margoe");
    assert.ok(clauses.length >= 2);
    assert.ok(clauses.some((c) => c.includes("%dela%")));
    assert.ok(clauses.some((c) => c.includes("%margoe%")));
  });
});
