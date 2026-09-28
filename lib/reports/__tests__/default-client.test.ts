import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickFirstClientAlphabetically,
  sortClientsAlphabetically,
} from "../default-client";

describe("pickFirstClientAlphabetically", () => {
  it("returns null for empty", () => {
    assert.equal(pickFirstClientAlphabetically([]), null);
  });

  it("picks first by name ignoring case", () => {
    const first = pickFirstClientAlphabetically([
      { id: "2", name: "Nabati Food" },
      { id: "1", name: "Aldex Realty" },
      { id: "3", name: "chicha hut" },
    ]);
    assert.equal(first?.id, "1");
    assert.equal(first?.name, "Aldex Realty");
  });
});

describe("sortClientsAlphabetically", () => {
  it("sorts by name", () => {
    assert.deepEqual(
      sortClientsAlphabetically([
        { id: "b", name: "Beta" },
        { id: "a", name: "Alpha" },
      ]).map((c) => c.id),
      ["a", "b"]
    );
  });
});
