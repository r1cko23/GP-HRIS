import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeJobTitle } from "../normalize-job-title";

describe("normalizeJobTitle", () => {
  it("strips a trailing numeric-only rate suffix", () => {
    assert.equal(normalizeJobTitle("Server (695)"), "Server");
    assert.equal(normalizeJobTitle("As (18,070.00)"), "Account Supervisor");
    assert.equal(normalizeJobTitle("As  (23,000)"), "Account Supervisor");
    assert.equal(normalizeJobTitle("Warehouse Helper (535.38)"), "Warehouse Helper");
  });

  it("keeps site or note parentheses", () => {
    assert.equal(normalizeJobTitle("Cashier (Batangas)"), "Cashier (Batangas)");
    assert.equal(normalizeJobTitle("Cashier (Batangas 600)"), "Cashier (Batangas 600)");
    assert.equal(
      normalizeJobTitle("Company Driver (Fixed-Term)"),
      "Company Driver (Fixed-Term)"
    );
    assert.equal(normalizeJobTitle("Accounting Clerk (20days)"), "Accounting Clerk (20days)");
  });

  it("expands a bare AS abbreviation to Account Supervisor", () => {
    assert.equal(normalizeJobTitle("AS"), "Account Supervisor");
    assert.equal(normalizeJobTitle("As"), "Account Supervisor");
    assert.equal(normalizeJobTitle("A.S."), "Account Supervisor");
    assert.equal(normalizeJobTitle("Account Supervisor"), "Account Supervisor");
  });

  it("does not expand titles that merely start with As", () => {
    assert.equal(normalizeJobTitle("Assistant"), "Assistant");
    assert.equal(normalizeJobTitle("Asst Cashier"), "Asst Cashier");
  });

  it("returns null/empty unchanged", () => {
    assert.equal(normalizeJobTitle(null), null);
    assert.equal(normalizeJobTitle(""), null);
    assert.equal(normalizeJobTitle("   "), null);
  });
});
