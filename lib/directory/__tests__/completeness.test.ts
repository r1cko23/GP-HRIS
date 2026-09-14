import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compute201Completeness } from "../completeness";

describe("compute201Completeness", () => {
  it("scores zero when nothing is on file", () => {
    const report = compute201Completeness({});
    assert.equal(report.score, 0);
    assert.equal(report.total, 13);
    assert.equal(report.ready_for_payroll, false);
  });

  it("treats birth date and sex as identity gaps that do not block payroll", () => {
    const report = compute201Completeness({
      last_name: "Santos",
      first_name: "Ana",
      hire_date: "2026-01-15",
      tin: "123-456-789",
      sss_number: "34-1234567-8",
      philhealth_number: "12-345678901-2",
      pagibig_number: "1234-5678-9012",
      client_id: "c1",
      position_id: "p1",
      daily_rate: 610,
      bank_account_no: "123456",
    });
    assert.equal(report.ready_for_payroll, true);
    assert.equal(
      report.missing.some((item) => item.key === "birth_date"),
      true
    );
    assert.equal(
      report.missing.some((item) => item.key === "sex"),
      true
    );
  });

  it("is not ready for payroll when SSS is blank", () => {
    const report = compute201Completeness({
      last_name: "Santos",
      first_name: "Ana",
      hire_date: "2026-01-15",
      tin: "123",
      sss_number: "  ",
      philhealth_number: "12",
      pagibig_number: "12",
      client_id: "c1",
      position_id: "p1",
      daily_rate: 610,
      gcash: "0917",
    });
    assert.equal(report.ready_for_payroll, false);
    assert.equal(
      report.missing.some((item) => item.key === "sss"),
      true
    );
  });
});
