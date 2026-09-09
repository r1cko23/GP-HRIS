import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { siteFromJobTitle } from "../site-from-job-title";

describe("siteFromJobTitle", () => {
  it("reads the plant inside parentheses", () => {
    assert.equal(siteFromJobTitle("Tr-Ebo(Batangas 600)"), "Batangas");
    assert.equal(siteFromJobTitle("Motorist (Taytay 645)"), "Taytay");
    assert.equal(siteFromJobTitle("Tr-Ebo( Las Pinas 645)"), "Las Piñas");
    assert.equal(siteFromJobTitle("Tg-Ebo(Las Piñas)"), "Las Piñas");
    assert.equal(siteFromJobTitle("Tr-Ebo(Provincial 400)"), "Provincial");
    assert.equal(siteFromJobTitle("Delivery Assitant (Prov. 400)"), "Provincial");
    assert.equal(siteFromJobTitle("Sales Supervisor Edd_ Baesa"), "Baesa");
  });

  it("maps untitled HO jobs to Head Office", () => {
    assert.equal(siteFromJobTitle("Finance Assistant"), "Head Office");
    assert.equal(siteFromJobTitle("Sales Supervisor"), "Head Office");
    assert.equal(siteFromJobTitle("Hr Assistant (H.o)"), "Head Office");
  });

  it("returns null when the title has no site", () => {
    assert.equal(siteFromJobTitle(""), null);
    assert.equal(siteFromJobTitle("Unknown Role XYZ"), null);
  });
});
