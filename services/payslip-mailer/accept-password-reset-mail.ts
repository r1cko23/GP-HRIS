const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PasswordResetMailBody = {
  kind?: unknown;
  to?: unknown;
  name?: unknown;
  subject?: unknown;
  text?: unknown;
};

export type AcceptedPasswordResetMail =
  | {
      ok: true;
      kind: "password_reset";
      to: string;
      name: string;
      subject: string;
      text: string;
      pdfBytes: null;
    }
  | { ok: false; error: string };

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function acceptPasswordResetMail(
  body: PasswordResetMailBody
): AcceptedPasswordResetMail {
  const to = asTrimmedString(body.to);
  const name = asTrimmedString(body.name) || "there";
  const subject = asTrimmedString(body.subject);
  const text = asTrimmedString(body.text);

  if (!EMAIL.test(to)) {
    return { ok: false, error: "A usable email address is required." };
  }
  if (!subject) {
    return { ok: false, error: "Subject is required." };
  }
  if (!text) {
    return { ok: false, error: "Message body is required." };
  }

  return {
    ok: true,
    kind: "password_reset",
    to,
    name,
    subject,
    text,
    pdfBytes: null,
  };
}
