import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { soaSheet } from "../outputs";
import { wrapBillingSoa } from "../compute";
import {
  aldexBodyValues,
  plkBodyValues,
  soaBodyHeadersForPack,
  usesMainRateHoursBody,
} from "../soa-body-main";

const line = {
  employee_code: "202309-00023",
  last_name: "Aban",
  first_name: "Claire",
  department: "Ops",
  position: "Packer",
  billing_daily_rate: 600,
  billing_hourly_rate: 75,
  hours: {
    hours_work: 96,
    overtime_hours: 8,
    night_diff_hours: 0,
  },
  amounts: { allowance: 100 },
  labor: 8260,
  mandatories: 0,
  billable: 8260,
};

describe("MAIN ALDEX/PLK SOA body", () => {
  it("uses Rate×Hours headers for aldex and plk only", () => {
    assert.equal(usesMainRateHoursBody("generic"), false);
    assert.equal(usesMainRateHoursBody("aldex"), true);
    assert.equal(usesMainRateHoursBody("plk"), true);
    assert.ok(soaBodyHeadersForPack("aldex").includes("CoverUp OT hours"));
    assert.ok(soaBodyHeadersForPack("plk").includes("LH hours 2"));
    assert.ok(soaBodyHeadersForPack("plk").includes("Tardiness hours"));
  });

  it("maps Reg/OT hours and zeros CoverUp / missing combo buckets (ALDEX)", () => {
    const headers = soaBodyHeadersForPack("aldex");
    const values = aldexBodyValues(line);
    assert.equal(headers.length, values.length);
    assert.equal(values[headers.indexOf("Reg hours")], 96);
    assert.equal(values[headers.indexOf("Reg rate")], 75);
    assert.equal(values[headers.indexOf("Reg OT hours")], 8);
    assert.equal(values[headers.indexOf("Reg OT rate")], 93.75); // 75 × 1.25
    assert.equal(values[headers.indexOf("CoverUp OT hours")], 0);
    assert.equal(values[headers.indexOf("LH OT ND hours")], 0);
    assert.equal(values[headers.indexOf("Daily rate billing")], 600);
    assert.equal(values[headers.indexOf("Employee name")], "Aban, Claire");
  });

  it("zeros PLK-only LH2/SH2 and keeps mapped Reg hours", () => {
    const headers = soaBodyHeadersForPack("plk");
    const values = plkBodyValues(line);
    assert.equal(headers.length, values.length);
    assert.equal(values[headers.indexOf("Reg hours")], 96);
    assert.equal(values[headers.indexOf("LH hours 2")], 0);
    assert.equal(values[headers.indexOf("SH hours 2")], 0);
    assert.equal(values[headers.indexOf("WDO RD ND OT hours")], 0);
  });

  it("soaSheet switches body columns by pack", () => {
    const wrap = wrapBillingSoa({
      labor: 8260,
      mandatories: 0,
      admin_fee: 0.055,
      vat: 0.12,
      ewt: 0.02,
    });
    const aldex = soaSheet({
      pack: "aldex",
      client_name: "Client",
      site: "Site",
      period_start: "2026-09-16",
      period_end: "2026-09-30",
      billing_reference: "BILL-1",
      billing_date: "2026-09-08",
      lines: [line],
      totals: wrap,
    });
    assert.ok(aldex.headers.includes("CoverUp OT hours"));
    assert.equal(aldex.rows[0][aldex.headers.indexOf("Reg hours")], 96);

    const generic = soaSheet({
      pack: "generic",
      client_name: "Client",
      site: "Site",
      period_start: "2026-09-16",
      period_end: "2026-09-30",
      billing_reference: "BILL-1",
      billing_date: "2026-09-08",
      lines: [line],
      totals: wrap,
    });
    assert.ok(generic.headers.includes("Reg amount"));
    assert.ok(!generic.headers.includes("CoverUp OT hours"));
  });
});
