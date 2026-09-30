import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApproveSilRun,
  canCreateSilDraftForPeriod,
  canPostSilRun,
  canRebuildSilRun,
  canVoidSilRun,
} from "../sil-run-lifecycle";
import { buildSilMonthlyRow } from "../sil-monthly-run";

describe("SIL run transitions", () => {
  it("allows rebuild only on draft", () => {
    assert.equal(canRebuildSilRun("draft"), true);
    assert.equal(canRebuildSilRun("approved"), false);
    assert.equal(canRebuildSilRun("posted"), false);
    assert.equal(canRebuildSilRun("void"), false);
  });

  it("approves only from draft", () => {
    assert.deepEqual(canApproveSilRun("draft"), { ok: true, next: "approved" });
    assert.equal(canApproveSilRun("approved").ok, false);
    assert.equal(canApproveSilRun("posted").ok, false);
    assert.equal(canApproveSilRun("void").ok, false);
  });

  it("posts only from approved — not draft", () => {
    assert.deepEqual(canPostSilRun("approved"), { ok: true, next: "posted" });
    assert.equal(canPostSilRun("draft").ok, false);
    assert.match(canPostSilRun("draft").error ?? "", /Approve/);
    assert.equal(canPostSilRun("posted").ok, false);
  });

  it("voids draft or approved only — not posted", () => {
    assert.deepEqual(canVoidSilRun("draft"), { ok: true, next: "void" });
    assert.deepEqual(canVoidSilRun("approved"), { ok: true, next: "void" });
    assert.equal(canVoidSilRun("posted").ok, false);
    assert.equal(canVoidSilRun("void").ok, false);
  });

  it("blocks second draft when period is approved or posted", () => {
    assert.deepEqual(canCreateSilDraftForPeriod(null), { ok: true });
    assert.deepEqual(canCreateSilDraftForPeriod("draft"), { ok: true });
    assert.deepEqual(canCreateSilDraftForPeriod("void"), { ok: true });
    assert.equal(canCreateSilDraftForPeriod("approved").ok, false);
    assert.equal(canCreateSilDraftForPeriod("posted").ok, false);
    assert.match(
      canCreateSilDraftForPeriod("posted").error ?? "",
      /already posted/i
    );
  });
});

describe("SIL snapshot row freeze", () => {
  it("keeps Ana Lamar amounts for persisted lines", () => {
    const row = buildSilMonthlyRow({
      directory_employee_id: "e1",
      last_name: "Lamar",
      first_name: "Ana",
      hire_date: "2024-03-14",
      status: "active",
      daily_rate: 695,
      days_worked: 302.06,
    });
    assert.equal(row.days_entitlement, 4.84);
    assert.equal(row.amount, 3363.8);
  });
});
