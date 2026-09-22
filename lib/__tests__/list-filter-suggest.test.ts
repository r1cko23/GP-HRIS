import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchListSuggestOption,
  suggestListOptions,
  type ListSuggestOption,
} from "../list-filter-suggest";

const options: ListSuggestOption[] = [
  {
    id: "1",
    primary: "Manalo, Jesse",
    secondary: "GP-001 · Cashier",
    value: "Manalo",
    matchText: "GP-001 Jesse Edward",
  },
  {
    id: "2",
    primary: "Dela Cruz, Margoe",
    secondary: "GP-002 · Branch A",
    value: "Dela Cruz",
    matchText: "GP-002 Margoe",
  },
  {
    id: "3",
    primary: "Perez, Ana",
    secondary: "GP-010",
    value: "Perez",
  },
];

describe("matchListSuggestOption", () => {
  it("matches empty query against every option", () => {
    assert.equal(matchListSuggestOption("", options[0]!), true);
  });

  it("matches primary, secondary, value, and matchText case-insensitively", () => {
    assert.equal(matchListSuggestOption("manalo", options[0]!), true);
    assert.equal(matchListSuggestOption("gp-002", options[1]!), true);
    assert.equal(matchListSuggestOption("cashier", options[0]!), true);
    assert.equal(matchListSuggestOption("edward", options[0]!), true);
    assert.equal(matchListSuggestOption("zzz", options[0]!), false);
  });
});

describe("suggestListOptions", () => {
  it("returns no suggestions below minChars (default 1)", () => {
    assert.deepEqual(suggestListOptions(options, ""), []);
    assert.deepEqual(suggestListOptions(options, "  "), []);
  });

  it("respects explicit minChars for remote-style queries", () => {
    assert.deepEqual(
      suggestListOptions(options, "m", { minChars: 2 }),
      []
    );
    const hits = suggestListOptions(options, "mana", { minChars: 2 });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.id, "1");
  });

  it("caps matches and prefers early list hits", () => {
    const hits = suggestListOptions(options, "gp-", { limit: 2 });
    assert.equal(hits.length, 2);
    assert.equal(hits[0]?.id, "1");
    assert.equal(hits[1]?.id, "2");
  });
});
