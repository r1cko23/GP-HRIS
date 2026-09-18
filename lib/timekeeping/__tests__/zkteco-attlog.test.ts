import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decidePunchAction,
  isStaleAttlogPunch,
  manilaLocalToIso,
  parseAttlogBody,
} from "../zkteco-attlog";

describe("parseAttlogBody", () => {
  it("parses tab-separated ATTLOG with check-in and check-out", () => {
    const body =
      "1001\t2026-09-18 08:05:00\t0\t1\t0\t0\t0\n" +
      "1001\t2026-09-18 17:10:00\t1\t1\t0\t0\t0\n";
    const rows = parseAttlogBody(body);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].deviceUserId, "1001");
    assert.equal(rows[0].punchedAtLocal, "2026-09-18 08:05:00");
    assert.equal(rows[0].statusCode, 0);
    assert.equal(rows[1].statusCode, 1);
  });

  it("parses space-separated date/time fields", () => {
    const rows = parseAttlogBody("42 2026-09-18 09:00:00 0");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].deviceUserId, "42");
    assert.equal(rows[0].punchedAtLocal, "2026-09-18 09:00:00");
    assert.equal(rows[0].statusCode, 0);
  });

  it("skips blank and garbage lines", () => {
    assert.deepEqual(parseAttlogBody("\n\nbadline\n"), []);
  });
});

describe("decidePunchAction", () => {
  it("uses explicit OUT status code", () => {
    assert.equal(decidePunchAction(1, true), "clock_out");
    assert.equal(decidePunchAction(1, false), "clock_out");
  });

  it("pairs status 0 as OUT when an open entry already exists", () => {
    assert.equal(decidePunchAction(0, false), "clock_in");
    assert.equal(decidePunchAction(0, true), "clock_out");
  });

  it("pairs verify-only punches on open entry", () => {
    assert.equal(decidePunchAction(null, false), "clock_in");
    assert.equal(decidePunchAction(null, true), "clock_out");
    assert.equal(decidePunchAction(255, false), "clock_in");
    assert.equal(decidePunchAction(255, true), "clock_out");
  });
});

describe("manilaLocalToIso", () => {
  it("converts Manila wall clock to UTC ISO", () => {
    // 08:05 Manila = 00:05 UTC
    assert.equal(
      manilaLocalToIso("2026-09-18 08:05:00"),
      "2026-09-18T00:05:00.000Z"
    );
  });

  it("rejects bad input", () => {
    assert.equal(manilaLocalToIso("nope"), null);
  });
});

describe("isStaleAttlogPunch", () => {
  const now = Date.parse("2026-09-18T07:00:00.000Z");

  it("flags 2024/2025 buffer", () => {
    assert.equal(
      isStaleAttlogPunch("2024-11-15T09:02:15.000Z", now),
      true
    );
    assert.equal(
      isStaleAttlogPunch("2025-06-01T01:00:00.000Z", now),
      true
    );
  });

  it("allows any 2026 punch (whole year)", () => {
    assert.equal(
      isStaleAttlogPunch("2026-01-05T00:00:00.000Z", now),
      false
    );
    assert.equal(
      isStaleAttlogPunch("2026-09-18T06:50:00.000Z", now),
      false
    );
  });
});
