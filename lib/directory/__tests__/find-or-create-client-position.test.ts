import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findOrCreateClientPosition,
  matchPositionByTitle,
} from "../find-or-create-client-position";

describe("matchPositionByTitle", () => {
  const cards = [
    { id: "1", job_title: "Room Attendant" },
    { id: "2", job_title: "Aircon Tech" },
  ];

  it("matches case-insensitively", () => {
    assert.equal(matchPositionByTitle(cards, "room attendant")?.id, "1");
    assert.equal(matchPositionByTitle(cards, "AIRCON TECH")?.id, "2");
  });

  it("returns null when empty or unknown", () => {
    assert.equal(matchPositionByTitle(cards, "  "), null);
    assert.equal(matchPositionByTitle(cards, "Chef")?.id, undefined);
  });
});

describe("findOrCreateClientPosition", () => {
  it("clears assignment when title is blank", async () => {
    const result = await findOrCreateClientPosition(
      {
        listByClient: async () => [{ id: "1", job_title: "Cashier" }],
        insert: async () => {
          throw new Error("should not insert");
        },
      },
      "   "
    );
    assert.deepEqual(result, {
      ok: true,
      position_id: null,
      created: false,
    });
  });

  it("reuses an existing title without inserting", async () => {
    let inserts = 0;
    const result = await findOrCreateClientPosition(
      {
        listByClient: async () => [{ id: "pos-1", job_title: "Cashier" }],
        insert: async () => {
          inserts += 1;
          return { id: "new" };
        },
      },
      "cashier"
    );
    assert.equal(inserts, 0);
    assert.deepEqual(result, {
      ok: true,
      position_id: "pos-1",
      created: false,
    });
  });

  it("creates a card for a new free-text title", async () => {
    const result = await findOrCreateClientPosition(
      {
        listByClient: async () => [{ id: "pos-1", job_title: "Cashier" }],
        insert: async (jobTitle) => {
          assert.equal(jobTitle, "Front Desk");
          return { id: "pos-new" };
        },
      },
      "Front Desk"
    );
    assert.deepEqual(result, {
      ok: true,
      position_id: "pos-new",
      created: true,
    });
  });
});
