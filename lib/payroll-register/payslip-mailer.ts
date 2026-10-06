export async function deliverPayslip(input: {
  to: string;
  name: string;
  periodLabel: string;
  cutoffPeriodId: string;
  lineId: string;
  filename: string;
  pdfBytes: Buffer | Uint8Array;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.PAYSLIP_MAILER_URL?.trim();
  if (!url) {
    return { ok: false, error: "Payslip mailer is not configured." };
  }

  const { buildPayslipMailPayload } = await import(
    "@/lib/payroll-register/payslip-mail-payload"
  );
  const payload = buildPayslipMailPayload(input);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const key = process.env.PAYSLIP_MAILER_KEY?.trim();
  if (key) headers["x-payslip-mailer-key"] = key;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: json.error || `Mailer returned ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the payslip mailer." };
  }
}
