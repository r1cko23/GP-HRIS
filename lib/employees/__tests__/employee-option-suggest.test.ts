import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchEmployeeOption,
  suggestEmployeeOptions,
  type EmployeeOption,
} from "../employee-option-suggest";

const roster: EmployeeOption[] = [
  {
    id: "u1",
    employee_id: "GP-001",
    full_name: "Jesse Edward Alvis Manalo",
    first_name: "Jesse",
    last_name: "Manalo",
  },
  {
    id: "u2",
    employee_id: "GP-002",
    full_name: "Margoe Adriano Dela Cruz",
    first_name: "Margoe",
    last_name: "Dela Cruz",
  },
  {
    id: "u3",
    employee_id: "GP-010",
    full_name: "Ana Perez",
    first_name: "Ana",
    last_name: "Perez",
  },
];

describe("matchEmployeeOption", () => {
  it("matches empty query against every employee", () => {
    assert.equal(matchEmployeeOption("", roster[0]!), true);
  });

  it("matches name parts and employee id case-insensitively", () => {
    assert.equal(matchEmployeeOption("manalo", roster[0]!), true);
    assert.equal(matchEmployeeOption("gp-002", roster[1]!), true);
    assert.equal(matchEmployeeOption("zzz", roster[0]!), false);
  });
});

describe("suggestEmployeeOptions", () => {
  it("returns no suggestions for an empty query by default", () => {
    assert.deepEqual(suggestEmployeeOptions(roster, ""), []);
    assert.deepEqual(suggestEmployeeOptions(roster, "  "), []);
  });

  it("caps matches and prefers early roster hits", () => {
    const hits = suggestEmployeeOptions(roster, "gp-", { limit: 2 });
    assert.equal(hits.length, 2);
    assert.equal(hits[0]?.id, "u1");
    assert.equal(hits[1]?.id, "u2");
  });

  it("can browse a capped list when empty query is allowed", () => {
    const hits = suggestEmployeeOptions(roster, "", {
      includeAllWhenEmpty: true,
      limit: 2,
    });
    assert.equal(hits.length, 2);
    assert.equal(hits[0]?.id, "u1");
  });
});
