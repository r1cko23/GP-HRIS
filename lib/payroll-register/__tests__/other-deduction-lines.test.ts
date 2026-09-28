import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OTHER_DEDUCTION_KEYS,
  OTHER_DEDUCTION_LABELS,
  buildOtherDeductionLines,
  isOtherDeductionKey,
  otherDeductionKeysForScope,
  otherDeductionParticular,
  otherDeductionScopeFromOrgName,
  sumOtherDeductionLines,
} from "../other-deduction-lines";
import { buildRegisterLine } from "../compute";
import { buildOtherDeductionRows } from "../cutoff-report-pack";
import type { CutoffHoursRow } from "@/lib/ph-payroll/premiums";

describe("other deduction catalog", () => {
  it("lists the six remittance particulars", () => {
    assert.deepEqual(OTHER_DEDUCTION_KEYS, [
      "personal_accident",
      "bdo_insurance",
      "hmo",
      "uniform",
      "nameplate",
      "id_card",
    ]);
    assert.equal(OTHER_DEDUCTION_LABELS.personal_accident, "Personal Accident");
    assert.equal(OTHER_DEDUCTION_LABELS.bdo_insurance, "BDO Insurance");
    assert.equal(OTHER_DEDUCTION_LABELS.hmo, "HMO");
    assert.equal(OTHER_DEDUCTION_LABELS.uniform, "Uniform");
    assert.equal(OTHER_DEDUCTION_LABELS.nameplate, "Nameplate");
    assert.equal(OTHER_DEDUCTION_LABELS.id_card, "ID");
    assert.equal(isOtherDeductionKey("hmo"), true);
    assert.equal(isOtherDeductionKey("vale"), false);
  });

  it("scopes Organic to PA / BDO / HMO and Deployed to all six", () => {
    assert.deepEqual([...otherDeductionKeysForScope("organic")], [
      "personal_accident",
      "bdo_insurance",
      "hmo",
    ]);
    assert.deepEqual([...otherDeductionKeysForScope("deployed")], [
      ...OTHER_DEDUCTION_KEYS,
    ]);
    assert.equal(otherDeductionScopeFromOrgName("Organic"), "organic");
    assert.equal(otherDeductionScopeFromOrgName("Deployed"), "deployed");
    assert.equal(otherDeductionScopeFromOrgName("GP Deployed Sites"), "deployed");
  });
});

describe("buildOtherDeductionLines", () => {
  it("skips zero / unknown and labels particulars", () => {
    const lines = buildOtherDeductionLines({
      personal_accident: 50,
      bdo_insurance: 0,
      hmo: 200,
      uniform: 100,
      nameplate: -1,
      id_card: 25,
      junk: 999,
    } as Record<string, number>);
    assert.deepEqual(
      lines.map((l) => ({ key: l.key, particular: l.particular, amount: l.amount })),
      [
        { key: "personal_accident", particular: "Personal Accident", amount: 50 },
        { key: "hmo", particular: "HMO", amount: 200 },
        { key: "uniform", particular: "Uniform", amount: 100 },
        { key: "id_card", particular: "ID", amount: 25 },
      ]
    );
    assert.equal(sumOtherDeductionLines(lines), 375);
    assert.equal(otherDeductionParticular("nameplate"), "Nameplate");
  });

  it("aggregates itemized lines across people in catalog order", async () => {
    const {
      aggregateOtherDeductionLinesByKey,
      presentOtherDeductionKeys,
    } = await import("../other-deduction-lines");
    const aggregated = aggregateOtherDeductionLinesByKey([
      {
        other_deduction_lines: [
          { key: "hmo", particular: "HMO", amount: 100 },
          { key: "personal_accident", particular: "Personal Accident", amount: 50 },
        ],
      },
      {
        other_deduction_lines: [
          { key: "hmo", particular: "HMO", amount: 50 },
          { key: "uniform", particular: "Uniform", amount: 20 },
        ],
      },
    ]);
    assert.deepEqual(
      aggregated.map((r) => ({ key: r.key, amount: r.amount })),
      [
        { key: "personal_accident", amount: 50 },
        { key: "hmo", amount: 150 },
        { key: "uniform", amount: 20 },
      ]
    );
    assert.deepEqual(presentOtherDeductionKeys([
      { other_deduction_lines: aggregated },
    ]), ["personal_accident", "hmo", "uniform"]);
  });
});

const hoursRow: CutoffHoursRow = {
  id: "h1",
  directory_employee_id: "d1",
  office_employee_id: "o1",
  employee_code: "E1",
  last_name: "Cruz",
  first_name: "Ben",
  daily_rate_payroll: 800,
  actual_regular_hours: 80,
};

describe("buildRegisterLine other_deduction_lines", () => {
  it("sums itemized lines into deductions.other and persists lines", () => {
    const lines = buildOtherDeductionLines({
      personal_accident: 50,
      hmo: 150,
      uniform: 80,
    });
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      otherDeductionLines: lines,
      statutory: { sss: false, philhealth: false, pagibig: false, wtax: false },
    });
    assert.equal(line.deductions.other, 280);
    assert.equal(line.other_deduction_lines.length, 3);
    assert.equal(line.other_deduction_lines[0].particular, "Personal Accident");
  });

  it("explodes itemized lines on the other-deductions CSV pack", () => {
    const lines = buildOtherDeductionLines({
      bdo_insurance: 35,
      nameplate: 40,
    });
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      otherDeductionLines: lines,
      statutory: { sss: false, philhealth: false, pagibig: false, wtax: false },
    });
    const rows = buildOtherDeductionRows([line]);
    const particulars = rows.map((r) => r.particular);
    assert.ok(particulars.includes("BDO Insurance"));
    assert.ok(particulars.includes("Nameplate"));
    assert.equal(
      particulars.includes("Other Deduction"),
      false,
      "itemized lines should not also emit lump Other Deduction"
    );
  });
});
