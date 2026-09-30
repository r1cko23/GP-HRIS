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
      created_by: null,
      limit: 200,
      offset: 0,
    });
  });

  it("accepts a creator id and rejects a label", () => {
    const parsed = parseLoanListQuery({
      client_id: "house",
      created_by: "97b8235a-d831-42f5-ae2c-e559ab8e0df1",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(
      parsed.value.created_by,
      "97b8235a-d831-42f5-ae2c-e559ab8e0df1"
    );
    assert.equal(
      parseLoanListQuery({ client_id: "house", created_by: "april" }).ok,
      false
    );
    const legacy = parseLoanListQuery({
      client_id: "house",
      review: "april",
    });
    assert.equal(legacy.ok, true);
    if (!legacy.ok) return;
    assert.equal(
      legacy.value.created_by,
      "f5b911d5-b6e8-4563-b693-ede30bfbcf5e"
    );
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
