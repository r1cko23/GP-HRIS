import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isGreenPastureAppHost,
  resolvePublicSupabaseUrl,
} from "../public-url";

describe("isGreenPastureAppHost", () => {
  it("accepts office .com and remote .ph app hosts", () => {
    assert.equal(isGreenPastureAppHost("hris.greenpasture.com"), true);
    assert.equal(isGreenPastureAppHost("csm.greenpasture.ph"), true);
    assert.equal(isGreenPastureAppHost("timekeep.greenpasture.ph"), true);
    assert.equal(isGreenPastureAppHost("payroll.greenpasture.ph"), true);
  });

  it("rejects other hosts", () => {
    assert.equal(isGreenPastureAppHost("localhost"), false);
    assert.equal(isGreenPastureAppHost("csm.greenpasture.ph.evil.com"), false);
    assert.equal(isGreenPastureAppHost("vercel.app"), false);
  });
});

describe("resolvePublicSupabaseUrl", () => {
  it("uses .ph host so AS/WFH hit same-origin Kong via tunnel", () => {
    assert.equal(
      resolvePublicSupabaseUrl({
        host: "csm.greenpasture.ph",
        proto: "https",
        envUrl: "https://csm.greenpasture.com",
      }),
      "https://csm.greenpasture.ph"
    );
  });

  it("uses .com host on office LAN", () => {
    assert.equal(
      resolvePublicSupabaseUrl({
        host: "hris.greenpasture.com",
        proto: "https",
        envUrl: "https://hris.greenpasture.com",
      }),
      "https://hris.greenpasture.com"
    );
  });

  it("falls back to env when host is not a GP app host", () => {
    assert.equal(
      resolvePublicSupabaseUrl({
        host: "localhost:3000",
        proto: "http",
        envUrl: "https://hris.greenpasture.com",
      }),
      "https://hris.greenpasture.com"
    );
  });

  it("strips trailing slash from env fallback", () => {
    assert.equal(
      resolvePublicSupabaseUrl({
        envUrl: "https://hris.greenpasture.com/",
      }),
      "https://hris.greenpasture.com"
    );
  });
});
