import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOperlogUsers } from "../zkteco-operlog";

describe("parseOperlogUsers", () => {
  it("parses USER PIN= Name= tab lines from OPERLOG", () => {
    const body =
      "USER PIN=11\tName=Juan Dela Cruz\tPri=0\tPasswd=\tCard=\tGrp=1\n" +
      "USER PIN=12\tName=Maria Santos\tPri=0\tPasswd=\n";
    const rows = parseOperlogUsers(body);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].deviceUserId, "11");
    assert.equal(rows[0].displayName, "Juan Dela Cruz");
    assert.equal(rows[1].deviceUserId, "12");
    assert.equal(rows[1].displayName, "Maria Santos");
  });

  it("parses USERINFO-style PIN= without USER prefix", () => {
    const rows = parseOperlogUsers(
      "PIN=11\tName=Alice\tPrivilege=0\tCard=\tPassword=\n"
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].deviceUserId, "11");
    assert.equal(rows[0].displayName, "Alice");
  });

  it("skips OPLOG rows without PIN", () => {
    assert.deepEqual(
      parseOperlogUsers("OPLOG 0\t0\t2026-09-18 10:00:00\t0\t0\t0\t0\n"),
      []
    );
  });

  it("keeps first name when PIN repeats", () => {
    const rows = parseOperlogUsers(
      "USER PIN=11\tName=First\nUSER PIN=11\tName=Second\n"
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].displayName, "First");
  });
});
