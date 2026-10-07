import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptPasswordResetMail } from "./accept-password-reset-mail";

describe("acceptPasswordResetMail", () => {
  const good = {
    kind: "password_reset",
    to: "ana@greenpasture.ph",
    name: "Reyes, Ana",
    subject: "Password reset · Green Pasture HRIS",
    text: [
      "Hello Reyes, Ana,",
      "",
      "Reset your password:",
      "https://hris.example/reset-password?code=abc",
    ].join("\n"),
  };

  it("accepts a text-only password reset email", () => {
    const plan = acceptPasswordResetMail(good);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.to, "ana@greenpasture.ph");
    assert.equal(plan.name, "Reyes, Ana");
    assert.equal(plan.subject, good.subject);
    assert.match(plan.text, /reset-password\?code=abc/);
    assert.equal(plan.pdfBytes, null);
  });

  it("refuses a missing or unusable email address", () => {
    const plan = acceptPasswordResetMail({ ...good, to: "nope" });
    assert.equal(plan.ok, false);
    if (plan.ok) return;
    assert.match(plan.error, /email/i);
  });

  it("refuses when subject or body is missing", () => {
    const noSubject = acceptPasswordResetMail({ ...good, subject: "" });
    assert.equal(noSubject.ok, false);
    const noText = acceptPasswordResetMail({ ...good, text: "" });
    assert.equal(noText.ok, false);
  });
});
