import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hireAlertsClearedByPick,
  parseHireAlertName,
} from "../hire-alert";

describe("parseHireAlertName", () => {
  it("rejects a blank name", () => {
    assert.equal(parseHireAlertName("   "), null);
    assert.equal(parseHireAlertName(""), null);
  });

  it("keeps the typed name", () => {
    assert.equal(parseHireAlertName("  Reyes, Ana  "), "Reyes, Ana");
  });
});

describe("hireAlertsClearedByPick", () => {
  const open = (id: string, personName: string) => ({
    id,
    personName,
    status: "open" as const,
  });

  it("clears nothing when the site has no alerts", () => {
    assert.deepEqual(
      hireAlertsClearedByPick({ alerts: [], pickedName: "Reyes, Ana" }),
      [],
    );
  });

  it("clears the open alert whose name is the person just picked", () => {
    assert.deepEqual(
      hireAlertsClearedByPick({
        alerts: [open("a1", "Reyes, Ana"), open("a2", "Cruz, Ben")],
        pickedName: "Ana Maria Reyes",
      }),
      ["a1"],
    );
  });

  it("does not clear a one-word alert against a longer name", () => {
    assert.deepEqual(
      hireAlertsClearedByPick({
        alerts: [open("a1", "Ana")],
        pickedName: "Ana Reyes",
      }),
      [],
    );
  });

  it("leaves a dismissed alert alone", () => {
    assert.deepEqual(
      hireAlertsClearedByPick({
        alerts: [
          { id: "a1", personName: "Reyes, Ana", status: "dismissed" },
        ],
        pickedName: "Reyes, Ana",
      }),
      [],
    );
  });
});
