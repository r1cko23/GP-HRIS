import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cutoffPersonSearchFilter } from "../cutoff-person-search";

describe("cutoffPersonSearchFilter", () => {
  it("returns null for blank q", () => {
    assert.equal(cutoffPersonSearchFilter(""), null);
    assert.equal(cutoffPersonSearchFilter("   "), null);
  });

  it("matches a single token across name, code, and outlet", () => {
    const filter = cutoffPersonSearchFilter("Abas");
    assert.equal(
      filter,
      "last_name.ilike.%abas%,first_name.ilike.%abas%,employee_code.ilike.%abas%,outlet.ilike.%abas%"
    );
  });

  it("handles Last, First paste without breaking PostgREST commas", () => {
    const filter = cutoffPersonSearchFilter("Abas, Ibrahim Tabang");
    assert.ok(filter);
    assert.match(filter!, /^and\(/);
    assert.doesNotMatch(filter!, /Abas,/);
    assert.match(filter!, /%abas%/);
    assert.match(filter!, /%ibrahim%/);
    assert.match(filter!, /%tabang%/);
  });

  it("omits outlet when columns exclude it", () => {
    const filter = cutoffPersonSearchFilter("Abas", [
      "last_name",
      "first_name",
      "employee_code",
    ]);
    assert.equal(
      filter,
      "last_name.ilike.%abas%,first_name.ilike.%abas%,employee_code.ilike.%abas%"
    );
  });

  it("matches employee codes with hyphens as digit tokens", () => {
    const filter = cutoffPersonSearchFilter("202606-00234");
    assert.match(filter ?? "", /^and\(/);
    assert.match(filter ?? "", /employee_code\.ilike\.%202606%/);
    assert.match(filter ?? "", /employee_code\.ilike\.%00234%/);
  });
});
