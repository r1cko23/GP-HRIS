import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAgedSuperseded,
  emptySoftRefs,
  lastEntryDate,
  softRefBlockReasons,
} from "../purge-aged-superseded";

describe("lastEntryDate", () => {
  it("prefers last payroll, then resign, then hire", () => {
    assert.equal(
      lastEntryDate({
        last_payroll_end: "2018-06-15",
        resign_date: "2019-01-01",
        hire_date: "2015-01-01",
      }),
      "2018-06-15"
    );
    assert.equal(
      lastEntryDate({
        last_payroll_end: null,
        resign_date: "2019-01-01",
        hire_date: "2015-01-01",
      }),
      "2019-01-01"
    );
    assert.equal(
      lastEntryDate({
        hire_date: "1900-01-01",
        created_at: "2016-03-01T00:00:00.000Z",
      }),
      "2016-03-01"
    );
  });
});

describe("classifyAgedSuperseded", () => {
  const asOf = new Date("2026-09-23T00:00:00.000Z");

  it("marks 5y+ parked extras with no hard refs as eligible", () => {
    const report = classifyAgedSuperseded(
      [
        {
          id: "extra-old",
          organization_id: "org",
          superseded_by: "master",
          employee_code: "2015-1",
          last_name: "Santos",
          first_name: "Juan",
          status: "inactive",
          hire_date: "2015-01-01",
          resign_date: "2016-06-01",
          last_payroll_end: "2016-06-15",
          created_at: "2015-01-01T00:00:00.000Z",
        },
      ],
      new Map([["extra-old", emptySoftRefs()]]),
      { asOf, retentionYears: 5 }
    );
    assert.equal(report.aged.length, 1);
    assert.equal(report.eligible.length, 1);
    assert.equal(report.eligible[0]?.id, "extra-old");
    assert.equal(report.eligible[0]?.last_entry, "2016-06-15");
  });

  it("blocks extras that still own cutoff hours or loans", () => {
    const refs = emptySoftRefs();
    refs.cutoff_hours = 3;
    refs.employee_loans = 1;
    const report = classifyAgedSuperseded(
      [
        {
          id: "extra-linked",
          organization_id: "org",
          superseded_by: "master",
          status: "inactive",
          hire_date: "2014-01-01",
          resign_date: null,
          last_payroll_end: "2015-01-01",
          created_at: null,
        },
      ],
      new Map([["extra-linked", refs]]),
      { asOf, retentionYears: 5 }
    );
    assert.equal(report.eligible.length, 0);
    assert.equal(report.blocked.length, 1);
    assert.ok(
      softRefBlockReasons(refs).some((r) => r.startsWith("cutoff_hours"))
    );
  });

  it("skips rows newer than the retention floor", () => {
    const report = classifyAgedSuperseded(
      [
        {
          id: "extra-new",
          organization_id: "org",
          superseded_by: "master",
          status: "inactive",
          hire_date: "2024-01-01",
          resign_date: null,
          last_payroll_end: "2024-06-01",
          created_at: null,
        },
      ],
      new Map(),
      { asOf, retentionYears: 5 }
    );
    assert.equal(report.aged.length, 0);
    assert.equal(report.too_recent, 1);
  });

  it("blocks aged rows with no superseded_by master", () => {
    const report = classifyAgedSuperseded(
      [
        {
          id: "orphan",
          organization_id: "org",
          superseded_by: null,
          status: "inactive",
          hire_date: "2014-01-01",
          resign_date: "2015-01-01",
          last_payroll_end: null,
          created_at: null,
        },
      ],
      new Map([["orphan", emptySoftRefs()]]),
      { asOf, retentionYears: 5 }
    );
    assert.equal(report.blocked.length, 1);
    assert.ok(report.blocked[0]?.block_reasons.includes("missing_superseded_by"));
  });
});
