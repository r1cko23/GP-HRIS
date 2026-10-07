import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { acceptPayslipMail } from "./accept-payslip-mail";
import { acceptPasswordResetMail } from "./accept-password-reset-mail";

type MailerMode = "file" | "smtp";

type OutboundMail = {
  to: string;
  name: string;
  subject: string;
  text: string;
  kind: "payslip" | "password_reset";
  filename?: string;
  pdfBytes?: Buffer | null;
  periodLabel?: string;
  cutoffPeriodId?: string;
  lineId?: string;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function mode(): MailerMode {
  const raw = env("MAILER_MODE").toLowerCase();
  return raw === "smtp" ? "smtp" : "file";
}

function authorized(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const expected = env("PAYSLIP_MAILER_KEY");
  if (!expected) return true;
  const given = String(req.headers["x-payslip-mailer-key"] ?? "").trim();
  return given === expected;
}

function acceptMail(body: Record<string, unknown>):
  | { ok: true; mail: OutboundMail }
  | { ok: false; error: string } {
  if (body.kind === "password_reset") {
    const plan = acceptPasswordResetMail(body);
    if (!plan.ok) return plan;
    return {
      ok: true,
      mail: {
        kind: "password_reset",
        to: plan.to,
        name: plan.name,
        subject: plan.subject,
        text: plan.text,
        pdfBytes: null,
      },
    };
  }

  const plan = acceptPayslipMail(body);
  if (!plan.ok) return plan;
  return {
    ok: true,
    mail: {
      kind: "payslip",
      to: plan.to,
      name: plan.name,
      subject: plan.subject,
      text: plan.text,
      filename: plan.filename,
      pdfBytes: plan.pdfBytes,
      periodLabel: plan.periodLabel,
      cutoffPeriodId: plan.cutoffPeriodId,
      lineId: plan.lineId,
    },
  };
}

async function deliverFile(mail: OutboundMail) {
  const outDir = env("MAILER_OUT_DIR") || path.join(process.cwd(), "outbox");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = mail.to.replace(/[^\w.@+-]+/g, "_");
  const tag = mail.kind === "password_reset" ? "password-reset" : mail.lineId || "line";
  const base = `${stamp}_${safeTo}_${tag}`;
  if (mail.pdfBytes && mail.pdfBytes.length > 0) {
    await writeFile(path.join(outDir, `${base}.pdf`), mail.pdfBytes);
  }
  await writeFile(
    path.join(outDir, `${base}.json`),
    JSON.stringify(
      {
        kind: mail.kind,
        to: mail.to,
        name: mail.name,
        subject: mail.subject,
        period_label: mail.periodLabel,
        cutoff_period_id: mail.cutoffPeriodId,
        line_id: mail.lineId,
        filename: mail.filename,
        text: mail.text,
      },
      null,
      2,
    ),
  );
}

async function deliverSmtp(mail: OutboundMail) {
  const nodemailer = await import("nodemailer");
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT") || "587");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const from = env("SMTP_FROM") || user;
  if (!host || !from) {
    throw new Error("SMTP_HOST and SMTP_FROM are required for smtp mode.");
  }
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
  await transporter.sendMail({
    from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    attachments:
      mail.pdfBytes && mail.filename
        ? [
            {
              filename: mail.filename,
              content: mail.pdfBytes,
              contentType: "application/pdf",
            },
          ]
        : undefined,
  });
}

async function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

const port = Number(env("PORT") || "8790");
const server = createServer(async (req, res) => {
  const send = (status: number, body: Record<string, unknown>) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") {
    return send(200, { ok: true, mode: mode() });
  }

  if (req.method !== "POST" || (req.url !== "/" && req.url !== "/send")) {
    return send(404, { error: "Not found" });
  }

  if (!authorized(req)) {
    return send(401, { error: "Unauthorized" });
  }

  const body = await readJson(req);
  if (!body || typeof body !== "object") {
    return send(400, { error: "JSON body is required." });
  }

  const plan = acceptMail(body as Record<string, unknown>);
  if (!plan.ok) {
    return send(400, { error: plan.error });
  }

  try {
    if (mode() === "smtp") await deliverSmtp(plan.mail);
    else await deliverFile(plan.mail);
    return send(200, {
      ok: true,
      mode: mode(),
      to: plan.mail.to,
      kind: plan.mail.kind,
    });
  } catch (err) {
    return send(502, {
      error: err instanceof Error ? err.message : "Mail delivery failed.",
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `Payslip mailer listening on http://127.0.0.1:${port} (mode=${mode()})`,
  );
});
