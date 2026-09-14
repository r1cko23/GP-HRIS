import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachCutoffRunBy,
  catalogPostedByName,
} from "../cutoff-run-by";

describe("catalogPostedByName", () => {
  it("returns the MAIN operator when every posted line was created by one person", () => {
    assert.equal(
      catalogPostedByName([
        { pcreatedby: "Jayann" },
        { pcreatedby: " Jayann " },
      ]),
      "Jayann"
    );
  });

  it("returns null when MAIN did not store who created the summary", () => {
    assert.equal(catalogPostedByName([]), null);
    assert.equal(catalogPostedByName([{ pcreatedby: "  " }]), null);
  });

  it("joins distinct MAIN operators when one cutoff has more than one", () => {
    assert.equal(
      catalogPostedByName([
        { pcreatedby: "Pat" },
        { pcreatedby: "Jayann" },
        { pcreatedby: "Pat" },
      ]),
      "Jayann, Pat"
    );
  });

  it("collapses the same MAIN login when casing differs", () => {
    assert.equal(
      catalogPostedByName([
        { pcreatedby: "Cheryl" },
        { pcreatedby: "cheryl" },
        { pcreatedby: "CHERYL" },
      ]),
      "Cheryl"
    );
  });
});

describe("attachCutoffRunBy", () => {
  it("shows the catalog MAIN operator on a posted cutoff", () => {
    const [row] = attachCutoffRunBy(
      [{ id: "melco-macapagal" }],
      [
        {
          cutoff_period_id: "melco-macapagal",
          posted_by: null,
          posted_by_name: "Jayann",
        },
      ]
    );
    assert.equal(row.run_by, "Jayann");
  });

  it("shows the GP user who posted Organic payroll when no snapshot name is stored", () => {
    const [row] = attachCutoffRunBy(
      [{ id: "organic-jul" }],
      [
        {
          cutoff_period_id: "organic-jul",
          posted_by: "user-1",
          posted_by_name: null,
        },
      ],
      [{ id: "user-1", full_name: "ANA CRUZ" }]
    );
    assert.equal(row.run_by, "Ana Cruz");
  });

  it("prefers the stored run-by name over the current user row", () => {
    const [row] = attachCutoffRunBy(
      [{ id: "c1" }],
      [
        {
          cutoff_period_id: "c1",
          posted_by: "user-1",
          posted_by_name: "Jayann",
        },
      ],
      [{ id: "user-1", full_name: "Jericko Razal" }]
    );
    assert.equal(row.run_by, "Jayann");
  });

  it("leaves run_by empty when the cutoff has no posted register", () => {
    const [row] = attachCutoffRunBy([{ id: "draft" }], [], []);
    assert.equal(row.run_by, null);
  });
});
