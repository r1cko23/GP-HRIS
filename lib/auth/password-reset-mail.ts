export type PasswordResetMailPayload = {
  kind: "password_reset";
  to: string;
  name: string;
  subject: string;
  text: string;
};

export function buildPasswordResetMailPayload(input: {
  to: string;
  name?: string;
  resetUrl: string;
}): PasswordResetMailPayload {
  const name = input.name?.trim() || "there";
  const resetUrl = input.resetUrl.trim();
  return {
    kind: "password_reset",
    to: input.to.trim(),
    name,
    subject: "Password reset · Green Pasture HRIS",
    text: [
      `Hello ${name},`,
      "",
      "We received a request to reset your Green Pasture HRIS password.",
      "Open this link to choose a new password:",
      "",
      resetUrl,
      "",
      "This link expires soon. If you did not ask for a reset, you can ignore this email.",
      "",
      "Green Pasture People Management Inc.",
    ].join("\n"),
  };
}

type DeliverResult = { ok: true } | { ok: false; error: string };

export async function deliverPasswordResetMail(
  input: { to: string; name?: string; resetUrl: string },
  deps?: {
    fetchImpl?: typeof fetch;
  }
): Promise<DeliverResult> {
  const url = process.env.PAYSLIP_MAILER_URL?.trim();
  if (!url) {
    return { ok: false, error: "Payslip mailer is not configured." };
  }

  const payload = buildPasswordResetMailPayload(input);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const key = process.env.PAYSLIP_MAILER_KEY?.trim();
  if (key) headers["x-payslip-mailer-key"] = key;

  const fetchImpl = deps?.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(url, {
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
