const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PayslipMailBody = {
  to?: unknown;
  name?: unknown;
  period_label?: unknown;
  cutoff_period_id?: unknown;
  line_id?: unknown;
  filename?: unknown;
  pdf_base64?: unknown;
};

export type AcceptedPayslipMail =
  | {
      ok: true;
      to: string;
      name: string;
      periodLabel: string;
      cutoffPeriodId: string;
      lineId: string;
      filename: string;
      pdfBytes: Buffer;
      subject: string;
      text: string;
    }
  | { ok: false; error: string };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function acceptPayslipMail(body: PayslipMailBody): AcceptedPayslipMail {
  const to = asTrimmedString(body.to);
  const name = asTrimmedString(body.name) || "Employee";
  const periodLabel = asTrimmedString(body.period_label);
  const cutoffPeriodId = asTrimmedString(body.cutoff_period_id);
  const lineId = asTrimmedString(body.line_id);
  const filename = asTrimmedString(body.filename);
  const pdfBase64 = asTrimmedString(body.pdf_base64);

  if (!EMAIL.test(to)) {
    return { ok: false, error: "A usable email address is required." };
  }
  if (!periodLabel) {
    return { ok: false, error: "Period label is required." };
  }
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Payslip filename must be a PDF." };
  }
  if (!pdfBase64) {
    return { ok: false, error: "Payslip PDF is required." };
  }

  let pdfBytes: Buffer;
  try {
    pdfBytes = Buffer.from(pdfBase64, "base64");
  } catch {
    return { ok: false, error: "Payslip PDF is not valid base64." };
  }
  if (pdfBytes.length < 5) {
    return { ok: false, error: "Payslip PDF is required." };
  }

  return {
    ok: true,
    to,
    name,
    periodLabel,
    cutoffPeriodId,
    lineId,
    filename,
    pdfBytes,
    subject: `Your payslip · ${periodLabel}`,
    text: [
      `Hello ${name},`,
      "",
      `Your payslip for ${periodLabel} is attached.`,
      "",
      "You can also open it anytime in the employee portal.",
      "",
      "Green Pasture People Management Inc.",
    ].join("\n"),
  };
}
