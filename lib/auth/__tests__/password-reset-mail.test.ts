import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildPasswordResetMailPayload,
  deliverPasswordResetMail,
} from "../password-reset-mail";
import { sendPasswordResetEmail } from "../send-password-reset-email";

const root = path.join(import.meta.dirname, "../../..");

describe("buildPasswordResetMailPayload", () => {
  it("packs a text-only password reset for the office mailer", () => {
    const payload = buildPasswordResetMailPayload({
      to: "ana@greenpasture.ph",
      name: "Reyes, Ana",
      resetUrl:
        "https://hris.greenpasture.ph/reset-password?token=abc&type=recovery",
    });

    assert.equal(payload.kind, "password_reset");
    assert.equal(payload.to, "ana@greenpasture.ph");
    assert.equal(payload.name, "Reyes, Ana");
    assert.match(payload.subject, /password reset/i);
    assert.match(
      payload.text,
      /https:\/\/hris\.greenpasture\.ph\/reset-password\?token=abc&type=recovery/
    );
    assert.equal("pdf_base64" in payload, false);
  });
});

describe("deliverPasswordResetMail", () => {
  it("posts the payload to the office mailer URL", async () => {
    const calls: Array<{ url: string; body: unknown; headers: HeadersInit }> =
      [];
    const prevUrl = process.env.PAYSLIP_MAILER_URL;
    const prevKey = process.env.PAYSLIP_MAILER_KEY;
    process.env.PAYSLIP_MAILER_URL = "http://mailer.test/send";
    process.env.PAYSLIP_MAILER_KEY = "secret-key";

    try {
      const result = await deliverPasswordResetMail(
        {
          to: "ana@greenpasture.ph",
          name: "Reyes, Ana",
          resetUrl: "https://hris.example/reset-password#token=1",
        },
        {
          fetchImpl: async (url, init) => {
            calls.push({
              url: String(url),
              body: JSON.parse(String(init?.body)),
              headers: init?.headers ?? {},
            });
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          },
        }
      );

      assert.equal(result.ok, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, "http://mailer.test/send");
      const body = calls[0]?.body as { kind?: string; to?: string };
      assert.equal(body.kind, "password_reset");
      assert.equal(body.to, "ana@greenpasture.ph");
      const headers = calls[0]?.headers as Record<string, string>;
      assert.equal(headers["x-payslip-mailer-key"], "secret-key");
    } finally {
      if (prevUrl === undefined) delete process.env.PAYSLIP_MAILER_URL;
      else process.env.PAYSLIP_MAILER_URL = prevUrl;
      if (prevKey === undefined) delete process.env.PAYSLIP_MAILER_KEY;
      else process.env.PAYSLIP_MAILER_KEY = prevKey;
    }
  });

  it("fails clearly when the office mailer is not configured", async () => {
    const prevUrl = process.env.PAYSLIP_MAILER_URL;
    delete process.env.PAYSLIP_MAILER_URL;
    try {
      const result = await deliverPasswordResetMail({
        to: "ana@greenpasture.ph",
        resetUrl: "https://hris.example/reset-password",
      });
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.match(result.error, /not configured/i);
    } finally {
      if (prevUrl === undefined) delete process.env.PAYSLIP_MAILER_URL;
      else process.env.PAYSLIP_MAILER_URL = prevUrl;
    }
  });
});

describe("sendPasswordResetEmail", () => {
  it("generates a recovery link then delivers it through the office mailer", async () => {
    const delivered: Array<{ to: string; resetUrl: string; name?: string }> =
      [];
    const result = await sendPasswordResetEmail(
      {
        email: "ana@greenpasture.ph",
        redirectTo: "https://hris.example/reset-password",
      },
      {
        generateRecoveryLink: async ({ email, redirectTo }) => {
          assert.equal(email, "ana@greenpasture.ph");
          assert.equal(redirectTo, "https://hris.example/reset-password");
          return {
            ok: true as const,
            actionLink:
              "https://auth.example/verify?token=abc&type=recovery&redirect_to=https%3A%2F%2Fhris.example%2Freset-password",
            name: "Reyes, Ana",
          };
        },
        deliver: async (input) => {
          delivered.push(input);
          return { ok: true as const };
        },
      }
    );

    assert.equal(result.ok, true);
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0]?.to, "ana@greenpasture.ph");
    assert.equal(delivered[0]?.name, "Reyes, Ana");
    assert.match(delivered[0]?.resetUrl ?? "", /token=abc/);
  });

  it("does not claim success when link generation fails", async () => {
    let deliverCalls = 0;
    const result = await sendPasswordResetEmail(
      {
        email: "missing@greenpasture.ph",
        redirectTo: "https://hris.example/reset-password",
      },
      {
        generateRecoveryLink: async () => ({
          ok: false as const,
          error: "User not found",
        }),
        deliver: async () => {
          deliverCalls += 1;
          return { ok: true as const };
        },
      }
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /not found/i);
    assert.equal(deliverCalls, 0);
  });

  it("does not claim success when the mailer fails after a link is generated", async () => {
    const result = await sendPasswordResetEmail(
      {
        email: "ana@greenpasture.ph",
        redirectTo: "https://hris.example/reset-password",
      },
      {
        generateRecoveryLink: async () => ({
          ok: true as const,
          actionLink: "https://auth.example/verify?token=abc&type=recovery",
        }),
        deliver: async () => ({
          ok: false as const,
          error: "SMTP refused",
        }),
      }
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /SMTP refused/);
  });
});

describe("forgot-password route wiring", () => {
  it("uses generateLink plus office mailer delivery, not Auth email send", () => {
    const route = readFileSync(
      path.join(root, "app/api/auth/reset-request/route.ts"),
      "utf8"
    );
    assert.match(route, /sendPasswordResetEmail/);
    assert.match(route, /generateLink/);
    assert.doesNotMatch(route, /resetPasswordForEmail/);
  });
});
