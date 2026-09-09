import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateOrganicPayslipPDF,
  organicPayslipFilename,
  type OrganicPayslipLine,
} from "../generate-organic-payslip-pdf";

/** Claire Aban Aug 1–15 2026 register line as stored on payroll_register_lines. */
function claireLine(): OrganicPayslipLine {
  return {
    employee_code: null,
    last_name: "Aban",
    first_name: "Claire",
    daily_rate: 800,
    monthly_salary: 15600,
    gross_pay: 11160.11,
    total_deductions: 682.5,
    net_pay: 10477.61,
    bank_name: "Bdo",
    bank_account_no: "002114377489",
    hours: {
      actual_regular_hours: 104,
      hours_work: 104,
    },
    earnings: {
      allowance: 3360.11,
      basic: 7800,
      billing_daily_rate: 600,
      billing_gross_estimate: 7800,
      days_work: 13,
    },
    deductions: {
      sss: 387.5,
      philhealth: 195,
      pagibig: 100,
      withholding_tax: 0,
      loans: 0,
      other: 0,
      sss_regular: 387.5,
      sss_er: 775,
      sss_ecc: 15,
      pagibig_er: 100,
      philhealth_er: 195,
    },
  };
}

function pdfText(doc: ReturnType<typeof generateOrganicPayslipPDF>): string {
  return Buffer.from(doc.output("arraybuffer"))
    .toString("latin1")
    .replace(/\x00/g, "");
}

function textItems(pdf: string): Array<{ x: number; y: number; text: string }> {
  const items: Array<{ x: number; y: number; text: string }> = [];
  const re = /([0-9.]+) ([0-9.]+) Td\n\((.*?)\) Tj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pdf))) {
    items.push({ x: Number(m[1]), y: Number(m[2]), text: m[3] });
  }
  return items;
}

describe("generateOrganicPayslipPDF", () => {
  it("does not print billing internals, days-as-pesos, or employer shares on the employee slip", () => {
    const doc = generateOrganicPayslipPDF({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-15",
      payrollDate: "2026-08-20",
      line: claireLine(),
    });
    const text = pdfText(doc);

    assert.match(text, /Aban, Claire/);
    assert.match(text, /Allowance/);
    assert.match(text, /Basic pay/);
    assert.match(text, /3,360\.11/);
    assert.match(text, /7,800\.00/);
    assert.match(text, /387\.50/);
    assert.match(text, /Days worked: 13/);
    assert.match(text, /Regular hours/);

    assert.doesNotMatch(text, /Billing Daily/);
    assert.doesNotMatch(text, /Billing Gross/);
    assert.doesNotMatch(text, /Days Work/);
    assert.doesNotMatch(text, /Hours Work/);
    assert.doesNotMatch(text, /SSS Er/);
    assert.doesNotMatch(text, /SSS Ecc/);
    assert.doesNotMatch(text, /Pagibig Er/);
    assert.doesNotMatch(text, /Philhealth Er/);
  });

  it("prints PHP amounts in Helvetica, not the peso glyph that renders as plus-minus", () => {
    const text = pdfText(
      generateOrganicPayslipPDF({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-15",
        line: claireLine(),
      })
    );

    assert.equal(text.includes("\u20b1"), false);
    assert.equal(text.includes("\xB1"), false);
    assert.match(text, /PHP 11,160\.11/);
    assert.match(text, /PHP 10,477\.61/);
  });

  it("keeps deduction labels and amounts on the same row without overlapping", () => {
    const doc = generateOrganicPayslipPDF({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-15",
      line: claireLine(),
    });
    const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    assert.doesNotMatch(raw, /\x00/);
    const items = textItems(raw);
    const sss = items.find((i) => i.text === "SSS");
    const sssAmt = items.find((i) => i.text.includes("387.50"));
    assert.ok(sss);
    assert.ok(sssAmt);
    assert.equal(sss!.y, sssAmt!.y);
    assert.ok(
      sssAmt!.x - sss!.x > 80,
      `amount should sit well right of SSS (gap ${sssAmt!.x - sss!.x})`
    );
  });

  it("still lists a non-statutory extra deduction the employee actually paid", () => {
    const line = claireLine();
    line.deductions = { ...line.deductions, union_dues: 50 };
    const text = pdfText(
      generateOrganicPayslipPDF({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-15",
        line,
      })
    );
    assert.match(text, /Union Dues/);
    assert.match(text, /50\.00/);
  });

  it("names the file from the employee code when present", () => {
    assert.equal(
      organicPayslipFilename(
        { employee_code: "202608-00001" },
        "2026-08-01",
        "2026-08-15"
      ),
      "payslip_202608-00001_2026-08-01_2026-08-15.pdf"
    );
  });

  it("still lays out a slip with no earnings, hours, or deductions", () => {
    const text = pdfText(
      generateOrganicPayslipPDF({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-15",
        line: {
          last_name: "Empty",
          first_name: "Row",
          gross_pay: 0,
          total_deductions: 0,
          net_pay: 0,
        },
      })
    );
    assert.match(text, /Empty, Row/);
    assert.match(text, /No hour detail/);
    assert.match(text, /No deductions/);
    assert.match(text, /PHP 0\.00/);
    assert.doesNotMatch(text, /SSS Er/);
    assert.doesNotMatch(text, /Billing Daily/);
  });
});
