import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actorHasCapability,
} from "@/lib/access/load-actor-capabilities";
import {
  canPeopleClients,
  canPeopleEmployees,
} from "@/lib/access/people-pages";
import {
  canApproveClientIndustry,
  canOpenEmployee201,
} from "@/lib/directory/position-approval";
import { assertAssignableApprovedPosition } from "@/lib/directory/apply-position-card-rates";

describe("client CMS access seams", () => {
  it("blocks wrong-industry AM approve", () => {
    assert.equal(
      canApproveClientIndustry({
        capabilityKeys: ["fn:positions.approve.hotel"],
        industry: "NON-HOTEL",
      }),
      false
    );
  });

  it("rejects hire/transfer without approved position", () => {
    const missing = assertAssignableApprovedPosition({
      position: null,
      destinationClientId: "c1",
    });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.status, 400);
  });

  it("applies approved card rates on assign", () => {
    const ok = assertAssignableApprovedPosition({
      position: {
        id: "p1",
        client_id: "c1",
        is_active: true,
        approval_status: "approved",
        payroll_daily_rate: 610,
        billing_daily_rate: 720,
      },
      destinationClientId: "c1",
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.rates.daily_rate, 610);
    assert.equal(ok.rates.billing_daily_rate, 720);
  });

  it("roster-only actors cannot open 201", () => {
    assert.equal(
      canOpenEmployee201({
        capabilityKeys: [
          "page:people.clients",
          "fn:clients.roster.view",
          "fn:positions.approve.hotel",
        ],
        hasAnyEmployeeSection: false,
      }),
      false
    );
  });

  it("clients-only page does not grant employees surface", () => {
    assert.equal(
      canPeopleClients(["page:people.clients", "fn:clients.roster.view"]),
      true
    );
    assert.equal(
      canPeopleEmployees(["page:people.clients", "fn:clients.roster.view"]),
      false
    );
  });

  it("capability helper treats admin.system as bypass", () => {
    assert.equal(
      actorHasCapability(["fn:admin.system"], "fn:clients.update"),
      true
    );
    assert.equal(
      actorHasCapability(["fn:clients.roster.view"], "fn:clients.update"),
      false
    );
  });
});
