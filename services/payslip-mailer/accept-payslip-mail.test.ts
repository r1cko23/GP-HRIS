import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptPayslipMail } from "./accept-payslip-mail";

describe("acceptPayslipMail", () => {
  const good = {
    to: "ana@greenpasture.ph",
    name: "Reyes, Ana",
    period_label: "2026-09-01 – 2026-09-15",
    cutoff_period_id: "cut-1",
    line_id: "line-1",
    filename: "payslip_GP-001_2026-09-01_2026-09-15.pdf",
    pdf_base64: Buffer.from("%PDF-1.4 test").toString("base64"),
  };

  it("accepts a payslip email with a PDF attachment", () => {
    const plan = acceptPayslipMail(good);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.to, "ana@greenpasture.ph");
    assert.equal(plan.filename, good.filename);
    assert.equal(plan.pdfBytes.length > 0, true);
    assert.match(plan.subject, /payslip/i);
    assert.match(plan.subject, /2026-09-01/);
  });

  it("refuses a missing or unusable email address", () => {
    const plan = acceptPayslipMail({ ...good, to: "not-an-email" });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.match(plan.error, /email/i);
  });

  it("refuses a request with no PDF", () => {
    const plan = acceptPayslipMail({ ...good, pdf_base64: "" });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.match(plan.error, /pdf/i);
  });

  it("refuses a filename that is not a PDF", () => {
    const plan = acceptPayslipMail({ ...good, filename: "payslip.txt" });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.match(plan.error, /pdf/i);
  });
});
