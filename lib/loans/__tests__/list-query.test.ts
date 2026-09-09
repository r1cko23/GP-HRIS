import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLoanListQuery } from "../list-query";

describe("parseLoanListQuery", () => {
  it("requires a client", () => {
    const parsed = parseLoanListQuery({ client_id: "", q: "aban" });
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.match(parsed.error, /client_id/i);
  });

  it("caps limit and keeps search, type, and status", () => {
    const parsed = parseLoanListQuery({
      client_id: "nabati",
      q: "  Aban  ",
      loan_type: "pagibig",
      status: "active",
      limit: "999",
      offset: "-4",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.value, {
      client_id: "nabati",
      q: "Aban",
      loan_type: "pagibig",
      status: "active",
      limit: 200,
      offset: 0,
    });
  });

  it("rejects an unknown loan type or status", () => {
    assert.equal(
      parseLoanListQuery({ client_id: "c1", loan_type: "mortgage" }).ok,
      false
    );
    assert.equal(
      parseLoanListQuery({ client_id: "c1", status: "paid" }).ok,
      false
    );
  });
});
