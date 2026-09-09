import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HUBS, headerTitleForPath } from "../../hubs";

describe("payroll hub nav", () => {
  const payroll = HUBS.find((hub) => hub.id === "payroll");

  it("does not list a separate Payslips tab; cutoffs own payslips", () => {
    assert.ok(payroll);
    assert.equal(payroll.href, "/payroll");
    assert.equal(
      payroll.tabs.some((tab) => tab.href === "/payroll/payslips"),
      false
    );
  });

  it("has no payroll subnav once Payslips is folded into the cutoff hub", () => {
    assert.ok(payroll);
    assert.equal(payroll.tabs.length, 0);
  });

  it("labels the dual-run weekly generator as Office payslips, not a hub tab", () => {
    assert.equal(headerTitleForPath("/payroll/payslips"), "Office payslips");
    assert.equal(
      headerTitleForPath("/payroll/payslips?employee=1"),
      "Office payslips"
    );
  });
});
