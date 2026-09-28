import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLegacyBdoHtFileBody } from "../rebuild-bdo-disbursement-file";

describe("isLegacyBdoHtFileBody", () => {
  it("detects H/T converter output vs tab sample", () => {
    assert.equal(
      isLegacyBdoHtFileBody("H1         2110254455D7I       20260926\n0021\t1.00"),
      true
    );
    assert.equal(
      isLegacyBdoHtFileBody("002114616785\t7465.00\r\n002114671670\t9221.18\r\n"),
      false
    );
    assert.equal(isLegacyBdoHtFileBody(""), false);
  });
});
