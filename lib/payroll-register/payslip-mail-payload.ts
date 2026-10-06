export type PayslipMailPayload = {
  to: string;
  name: string;
  period_label: string;
  cutoff_period_id: string;
  line_id: string;
  filename: string;
  pdf_base64: string;
};

export function buildPayslipMailPayload(input: {
  to: string;
  name: string;
  periodLabel: string;
  cutoffPeriodId: string;
  lineId: string;
  filename: string;
  pdfBytes: Buffer | Uint8Array;
}): PayslipMailPayload {
  return {
    to: input.to,
    name: input.name,
    period_label: input.periodLabel,
    cutoff_period_id: input.cutoffPeriodId,
    line_id: input.lineId,
    filename: input.filename,
    pdf_base64: Buffer.from(input.pdfBytes).toString("base64"),
  };
}
