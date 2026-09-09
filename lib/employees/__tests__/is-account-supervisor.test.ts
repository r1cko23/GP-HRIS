import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAccountSupervisorPosition,
  isClientBasedAccountSupervisor,
} from "../is-account-supervisor";

describe("isAccountSupervisorPosition", () => {
  it("recognizes the portal's original title", () => {
    assert.equal(isAccountSupervisorPosition("ACCOUNT SUPERVISOR"), true);
    assert.equal(isAccountSupervisorPosition("Account Supervisor"), true);
  });

  it("recognizes live CSM/Directory AS titles with a rate in parentheses", () => {
    assert.equal(isAccountSupervisorPosition("As (18,070.00)"), true);
    assert.equal(isAccountSupervisorPosition("As (15,600)"), true);
    assert.equal(isAccountSupervisorPosition("As  (23,000)"), true);
    assert.equal(isAccountSupervisorPosition("AS"), true);
  });

  it("does not treat other titles as Account Supervisor", () => {
    assert.equal(isAccountSupervisorPosition("Assistant"), false);
    assert.equal(isAccountSupervisorPosition("Cashier"), false);
    assert.equal(isAccountSupervisorPosition("Apprentice"), false);
    assert.equal(isAccountSupervisorPosition(null), false);
    assert.equal(isAccountSupervisorPosition(""), false);
  });
});

describe("isClientBasedAccountSupervisor", () => {
  it("requires client-based plus an AS title", () => {
    assert.equal(
      isClientBasedAccountSupervisor("client-based", "As (18,070.00)"),
      true
    );
    assert.equal(
      isClientBasedAccountSupervisor("office-based", "ACCOUNT SUPERVISOR"),
      false
    );
    assert.equal(
      isClientBasedAccountSupervisor("client-based", "Cashier"),
      false
    );
  });
});
