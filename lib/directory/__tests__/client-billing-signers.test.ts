import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientRowToForm,
  emptyDirectoryClientForm,
  formToClientPayload,
} from "../client-form";

describe("billing signer fields", () => {
  it("round-trips prepared / noted by on the Client form", () => {
    const form = clientRowToForm({
      id: "c1",
      name: "Nabati",
      billing_prepared_by: "Ana Cruz",
      billing_prepared_by_role: "Billing Officer",
      billing_noted_by: "Ben Santos",
      billing_noted_by_role: "Account Manager",
    });
    assert.equal(form.billing_prepared_by, "Ana Cruz");
    assert.equal(form.billing_prepared_by_role, "Billing Officer");
    assert.equal(form.billing_noted_by, "Ben Santos");
    assert.equal(form.billing_noted_by_role, "Account Manager");
    const payload = formToClientPayload(form);
    assert.equal(payload.billing_prepared_by, "Ana Cruz");
    assert.equal(payload.billing_prepared_by_role, "Billing Officer");
    assert.equal(payload.billing_noted_by, "Ben Santos");
    assert.equal(payload.billing_noted_by_role, "Account Manager");
  });

  it("defaults empty signers on a new Client", () => {
    const empty = emptyDirectoryClientForm();
    assert.equal(empty.billing_prepared_by, "");
    assert.equal(empty.billing_noted_by, "");
    const payload = formToClientPayload(empty);
    assert.equal(payload.billing_prepared_by, null);
    assert.equal(payload.billing_noted_by, null);
  });
});
