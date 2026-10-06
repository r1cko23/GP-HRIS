import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPayslipMailPayload } from "../payslip-mail-payload";

describe("buildPayslipMailPayload", () => {
  it("packs the employee, period, and PDF for the office mailer", () => {
    const payload = buildPayslipMailPayload({
      to: "ana@greenpasture.ph",
      name: "Reyes, Ana",
      periodLabel: "2026-09-01 – 2026-09-15",
      cutoffPeriodId: "cut-1",
      lineId: "line-1",
      filename: "payslip_GP-001_2026-09-01_2026-09-15.pdf",
      pdfBytes: Buffer.from("%PDF-1.4"),
    });
    assert.equal(payload.to, "ana@greenpasture.ph");
    assert.equal(payload.name, "Reyes, Ana");
    assert.equal(payload.period_label, "2026-09-01 – 2026-09-15");
    assert.equal(payload.cutoff_period_id, "cut-1");
    assert.equal(payload.line_id, "line-1");
    assert.equal(payload.filename, "payslip_GP-001_2026-09-01_2026-09-15.pdf");
    assert.equal(payload.pdf_base64, Buffer.from("%PDF-1.4").toString("base64"));
  });
});
