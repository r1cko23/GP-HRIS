import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveReportClientId } from "../bootstrap-clients";
import { pickFirstClientAlphabetically } from "../default-client";

describe("resolveReportClientId", () => {
  const clients = [
    { id: "a", name: "Aldex" },
    { id: "n", name: "Nabati" },
  ];

  it("keeps a client that still belongs to the org", () => {
    const resolved = resolveReportClientId(
      clients,
      "n",
      pickFirstClientAlphabetically
    );
    assert.deepEqual(resolved, { clientId: "n", shouldReplaceUrl: false });
  });

  it("replaces a client from another org with the first alphabetical", () => {
    const resolved = resolveReportClientId(
      clients,
      "organic-only-id",
      pickFirstClientAlphabetically
    );
    assert.equal(resolved.shouldReplaceUrl, true);
    assert.equal(resolved.clientId, "a");
  });

  it("replaces empty selection with the first alphabetical", () => {
    const resolved = resolveReportClientId(
      clients,
      "",
      pickFirstClientAlphabetically
    );
    assert.equal(resolved.shouldReplaceUrl, true);
    assert.equal(resolved.clientId, "a");
  });
});
