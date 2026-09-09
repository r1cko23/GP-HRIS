import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collidingSiteLabels,
  formatSiteLabel,
  gpClientNameKey,
  planLinkedSiteLabels,
  planSiteLabel,
} from "../site-label";

const NABATI = "Nabati Food Philippines Inc.";
const HILTON =
  "Deluxe Hotels And Recreation Inc-Manila Hilton Hotel";
const EPICUREAN = "Epicurean Partners Exchange Inc";
const GOLDILOCKS = "Goldilocks Bakeshop Inc.";
const PLK = "Plk Phils. Inc";
const CONVERGE = "Converge Info And Communications Tech Solutions Inc";
const LEVELWEAR = "Levelwear Inc";
const VOUNO = "Vouno Trade & Marketing Services, Corp.";

describe("formatSiteLabel", () => {
  it("is the Directory employer when there is no qualifier", () => {
    assert.equal(formatSiteLabel(LEVELWEAR, null), LEVELWEAR);
    assert.equal(formatSiteLabel(LEVELWEAR, ""), LEVELWEAR);
    assert.equal(formatSiteLabel("  ", "Manila"), "");
  });

  it("joins employer and branch the way billing is printed", () => {
    assert.equal(
      formatSiteLabel(NABATI, "Batangas"),
      "Nabati Food Philippines Inc. - Batangas"
    );
  });

  it("does not repeat a qualifier already inside the employer name", () => {
    assert.equal(formatSiteLabel(HILTON, "Hilton"), HILTON);
    assert.equal(
      formatSiteLabel(
        "Melco Resorts Leisure (Php) Corp- City Of Dreams",
        "City Of Dreams"
      ),
      "Melco Resorts Leisure (Php) Corp- City Of Dreams"
    );
  });
});

describe("planSiteLabel", () => {
  it("prints Directory registered name with the branch (Nabati Batangas)", () => {
    const plan = planSiteLabel({
      clientName: NABATI,
      branchName: "Batangas",
      localName: "Nabati Batangas",
      sitesOnSameBranch: 1,
    });
    assert.deepEqual(plan, {
      label: "Nabati Food Philippines Inc. - Batangas",
      qualifier: "Batangas",
      reason: "unique_branch",
    });
  });

  it("uses Directory Title Case even when GP-Client is ALL CAPS", () => {
    const plan = planSiteLabel({
      clientName: NABATI,
      branchName: "Las Piñas",
      localName: "NABATI FOOD PHILIPPINES INC.-EDD LAS PINAS",
      sitesOnSameBranch: 1,
    });
    assert.equal(plan.label, "Nabati Food Philippines Inc. - Las Piñas");
    assert.equal(plan.qualifier, "Las Piñas");
  });

  it("prefers the Directory branch over a broken local Ñ (PiÑAs)", () => {
    const plan = planSiteLabel({
      clientName: NABATI,
      branchName: "Las Piñas",
      localName: "Nabati Las PiÑAs",
      sitesOnSameBranch: 1,
    });
    assert.equal(plan.label, "Nabati Food Philippines Inc. - Las Piñas");
  });

  it("appends a unique branch that is not already in the legal name", () => {
    const plan = planSiteLabel({
      clientName: HILTON,
      branchName: "Pasay",
      localName: "Hilton Manila",
      sitesOnSameBranch: 1,
    });
    assert.equal(
      plan.label,
      "Deluxe Hotels And Recreation Inc-Manila Hilton Hotel - Pasay"
    );
    assert.equal(plan.reason, "unique_branch");
  });

  it("keeps the store tail when many sites share one branch (Kenny Rogers)", () => {
    const plan = planSiteLabel({
      clientName: EPICUREAN,
      branchName: "Manila",
      localName: "Kenny Rogers SM Moa",
      sitesOnSameBranch: 40,
    });
    assert.deepEqual(plan, {
      label: "Epicurean Partners Exchange Inc - SM Moa",
      qualifier: "SM Moa",
      reason: "shared_branch_local",
    });
  });

  it("keeps Popeyes / Goldilocks / Converge tails on a shared Manila branch", () => {
    assert.equal(
      planSiteLabel({
        clientName: PLK,
        branchName: "Manila",
        localName: "Popeyes Arcovia",
        sitesOnSameBranch: 12,
      }).label,
      "Plk Phils. Inc - Arcovia"
    );
    assert.equal(
      planSiteLabel({
        clientName: GOLDILOCKS,
        branchName: "Manila",
        localName: "Goldilocks Bread Plant",
        sitesOnSameBranch: 5,
      }).label,
      "Goldilocks Bakeshop Inc. - Bread Plant"
    );
    assert.equal(
      planSiteLabel({
        clientName: CONVERGE,
        branchName: "Manila",
        localName:
          "CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC-Immediate Head: ARLAN REA",
        sitesOnSameBranch: 22,
      }).label,
      "Converge Info And Communications Tech Solutions Inc - Immediate Head: ARLAN REA"
    );
  });

  it("is the employer alone when there is no branch", () => {
    const plan = planSiteLabel({
      clientName: "Pico De Loro Beach And Country Club Inc.",
      branchName: null,
      localName: "Pico De Loro",
      sitesOnSameBranch: 0,
    });
    assert.equal(plan.label, "Pico De Loro Beach And Country Club Inc.");
    assert.equal(plan.qualifier, null);
    assert.equal(plan.reason, "client_only");
  });

  it("is empty when Directory has no employer name", () => {
    const plan = planSiteLabel({
      clientName: "",
      branchName: "Batangas",
      localName: "Nabati Batangas",
      sitesOnSameBranch: 1,
    });
    assert.equal(plan.label, "");
    assert.equal(plan.reason, "client_only");
  });
});

describe("planLinkedSiteLabels", () => {
  const nabatiId = "nabati-client";
  const batangas = "branch-batangas";
  const baesa = "branch-baesa";
  const manila = "branch-manila";
  const epicureanId = "epicurean-client";
  const goldilocksId = "goldilocks-client";

  const directory = {
    clients: [
      { id: nabatiId, name: NABATI },
      { id: epicureanId, name: EPICUREAN },
      { id: goldilocksId, name: GOLDILOCKS },
      { id: "vouno", name: VOUNO },
    ],
    branches: [
      { id: batangas, client_id: nabatiId, name: "Batangas" },
      { id: baesa, client_id: nabatiId, name: "Baesa" },
      { id: manila, client_id: epicureanId, name: "Manila" },
      { id: "gold-manila", client_id: goldilocksId, name: "Manila" },
      { id: "vouno-ortigas", client_id: "vouno", name: "Ortigas" },
    ],
  };

  it("returns no changes for zero rows", () => {
    assert.deepEqual(planLinkedSiteLabels([], directory), []);
  });

  it("plans Nabati as registered name - branch per site", () => {
    const plans = planLinkedSiteLabels(
      [
        {
          id: "csm-batangas",
          app: "csm",
          localName: "Nabati Batangas",
          directoryClientId: nabatiId,
          directoryBranchId: batangas,
        },
        {
          id: "gp-batangas",
          app: "gp_client",
          localName: "NABATI FOOD PHILIPPINES INC.-EDD BATANGAS",
          directoryClientId: nabatiId,
          directoryBranchId: batangas,
        },
        {
          id: "gp-baesa",
          app: "gp_client",
          localName: "NABATI FOOD PHILIPPINES INC.-EDD BAESA",
          directoryClientId: nabatiId,
          directoryBranchId: baesa,
        },
        {
          id: "csm-aligned",
          app: "csm",
          localName: "Nabati Food Philippines Inc. — Baesa",
          directoryClientId: nabatiId,
          directoryBranchId: baesa,
        },
      ],
      directory
    );

    assert.equal(
      plans.find((row) => row.id === "csm-batangas")?.to,
      "Nabati Food Philippines Inc. - Batangas"
    );
    assert.equal(plans.find((row) => row.id === "csm-batangas")?.reason, "unique_branch");
    assert.equal(
      plans.find((row) => row.id === "gp-batangas")?.to,
      "Nabati Food Philippines Inc. - Batangas"
    );
    assert.equal(
      plans.find((row) => row.id === "gp-baesa")?.to,
      "Nabati Food Philippines Inc. - Baesa"
    );
    assert.equal(plans.find((row) => row.id === "csm-aligned")?.unchanged, false);
    assert.equal(
      plans.find((row) => row.id === "csm-aligned")?.to,
      "Nabati Food Philippines Inc. - Baesa"
    );
    assert.deepEqual(plans.find((row) => row.id === "csm-batangas")?.aliases, [
      "Nabati Batangas",
    ]);
    assert.deepEqual(plans.find((row) => row.id === "gp-batangas")?.aliases, [
      "NABATI FOOD PHILIPPINES INC.-EDD BATANGAS",
    ]);
    assert.deepEqual(plans.find((row) => row.id === "csm-aligned")?.aliases, [
      "Nabati Food Philippines Inc. — Baesa",
    ]);
  });

  it("keeps Kenny Rogers store tails because many rows share Manila", () => {
    const plans = planLinkedSiteLabels(
      [
        {
          id: "moa",
          app: "csm",
          localName: "Kenny Rogers SM Moa",
          directoryClientId: epicureanId,
          directoryBranchId: manila,
        },
        {
          id: "glori",
          app: "csm",
          localName: "Kenny Rogers Glorietta",
          directoryClientId: epicureanId,
          directoryBranchId: manila,
        },
      ],
      directory
    );
    assert.equal(
      plans.find((row) => row.id === "moa")?.to,
      "Epicurean Partners Exchange Inc - SM Moa"
    );
    assert.equal(
      plans.find((row) => row.id === "glori")?.to,
      "Epicurean Partners Exchange Inc - Glorietta"
    );
    assert.equal(plans[0]?.reason, "shared_branch_local");
  });

  it("skips rows with no Directory client", () => {
    const plans = planLinkedSiteLabels(
      [
        {
          id: "pico",
          app: "csm",
          localName: "Pico De Loro",
          directoryClientId: null,
          directoryBranchId: null,
        },
      ],
      directory
    );
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.to, "Pico De Loro");
    assert.equal(plans[0]?.unchanged, true);
    assert.equal(plans[0]?.reason, "unlinked");
  });

  it("keeps prior aliases and the old nickname when renaming", () => {
    const plans = planLinkedSiteLabels(
      [
        {
          id: "csm-batangas",
          app: "csm",
          localName: "Nabati Batangas",
          directoryClientId: nabatiId,
          directoryBranchId: batangas,
          existingAliases: ["NABATI FOOD PHILIPPINES INC.-EDD BATANGAS"],
        },
      ],
      directory
    );
    assert.deepEqual(plans[0]?.aliases.sort(), [
      "NABATI FOOD PHILIPPINES INC.-EDD BATANGAS",
      "Nabati Batangas",
    ]);
  });
});

describe("collidingSiteLabels", () => {
  it("returns none for zero or unique names", () => {
    assert.deepEqual(collidingSiteLabels([]), []);
    assert.deepEqual(
      collidingSiteLabels([
        { id: "a", to: "Nabati Food Philippines Inc. - Batangas" },
        { id: "b", to: "Nabati Food Philippines Inc. - Baesa" },
      ]),
      []
    );
  });

  it("groups GP-Client unique-key collisions (case and spaces)", () => {
    assert.equal(gpClientNameKey("  Goldilocks  Bakeshop Inc. "), "goldilocks bakeshop inc.");
    assert.deepEqual(
      collidingSiteLabels([
        { id: "a", to: "Goldilocks Bakeshop Inc." },
        { id: "b", to: "GOLDILOCKS BAKESHOP INC." },
        { id: "c", to: "Plk Phils. Inc - ARCOVIA" },
      ]),
      [{ key: "goldilocks bakeshop inc.", ids: ["a", "b"] }]
    );
  });
});
