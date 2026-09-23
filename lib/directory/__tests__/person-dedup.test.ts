import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDuplicateGroups,
  collapseFromRequestedMaster,
  collapsePlansForRows,
  aliasConflictAction,
  matchExistingPersonForHire,
  planCollapseSplitCurrent,
  type DedupPersonRow,
} from "../person-dedup";

function row(partial: Partial<DedupPersonRow> & Pick<DedupPersonRow, "id">): DedupPersonRow {
  return {
    person_key: "STB:0249513659|686507450|2003-10-27",
    employee_code: partial.id,
    last_name: "Baldo",
    first_name: "Norielyn",
    status: "inactive",
    is_current_engagement: true,
    ...partial,
  };
}

describe("planCollapseSplitCurrent", () => {
  it("keeps the original person UUID and parks the extra 201 when both are current", () => {
    const original = row({
      id: "uuid-26262",
      employee_code: "202508-00164",
      status: "inactive",
      hire_date: "2025-08-26",
      first_hire_date: "2025-08-26",
      last_payroll_end: "2026-02-15",
      legacy_id: 26262,
      client_id: "old-client",
      daily_rate: 540,
    });
    const extra = row({
      id: "uuid-29531",
      employee_code: "29531",
      status: "active",
      hire_date: "2026-08-28",
      first_hire_date: "2026-08-28",
      last_payroll_end: null,
      legacy_id: 29531,
      client_id: "new-client",
      branch_id: "batangas",
      position_id: "utility",
      daily_rate: 580,
    });

    const plan = planCollapseSplitCurrent([original, extra]);
    assert.equal(plan.action, "collapse");
    if (plan.action !== "collapse") return;
    assert.equal(plan.masterId, "uuid-26262");
    assert.equal(plan.keep_employee_code, "202508-00164");
    assert.equal(plan.masterPatch.status, "active");
    assert.equal(plan.masterPatch.hire_date, "2026-08-28");
    assert.equal(plan.masterPatch.first_hire_date, "2025-08-26");
    assert.equal(plan.masterPatch.client_id, "new-client");
    assert.equal(plan.masterPatch.daily_rate, 580);
    assert.equal(plan.masterPatch.is_current_engagement, true);
    assert.equal("billing_daily_rate" in plan.masterPatch, false);
    assert.deepEqual(plan.loserPatches, [
      {
        id: "uuid-29531",
        is_current_engagement: false,
        superseded_by: "uuid-26262",
      },
    ]);
    assert.equal(plan.aliases[0]?.alias_code, "29531");
    assert.equal(plan.aliases[0]?.legacy_id, 29531);
  });

  it("does not delete or rewrite codes when the group is already one current engagement", () => {
    const plan = planCollapseSplitCurrent([
      row({
        id: "live",
        is_current_engagement: true,
        status: "active",
        hire_date: "2026-08-28",
      }),
      row({
        id: "old",
        is_current_engagement: false,
        superseded_by: "live",
        status: "inactive",
        hire_date: "2025-08-26",
      }),
    ]);
    assert.equal(plan.action, "noop");
  });

  it("is a no-op for a single file or an empty group", () => {
    assert.equal(planCollapseSplitCurrent([]).action, "noop");
    assert.equal(
      planCollapseSplitCurrent([
        row({ id: "only", is_current_engagement: true, status: "active" }),
      ]).action,
      "noop"
    );
  });

  it("ignores SQL Server empty hire 1900-01-01 when picking the original 201", () => {
    const real = row({
      id: "uuid-2023",
      employee_code: "202309-00088",
      status: "inactive",
      hire_date: "2023-09-11",
      first_hire_date: "2023-09-11",
      last_payroll_end: "2024-06-15",
      legacy_id: 88,
    });
    const placeholder = row({
      id: "uuid-1900",
      employee_code: "202608-02922",
      status: "for_release",
      hire_date: "1900-01-01",
      first_hire_date: "1900-01-01",
      last_payroll_end: null,
      legacy_id: 2922,
    });

    const plan = planCollapseSplitCurrent([placeholder, real]);
    assert.equal(plan.action, "collapse");
    if (plan.action !== "collapse") return;
    assert.equal(plan.masterId, "uuid-2023");
    assert.equal(plan.keep_employee_code, "202309-00088");
    assert.equal(plan.masterPatch.status, "inactive");
    assert.equal(plan.masterPatch.hire_date, "2023-09-11");
    assert.equal(plan.masterPatch.first_hire_date, "2023-09-11");
    assert.deepEqual(plan.loserPatches, [
      {
        id: "uuid-1900",
        is_current_engagement: false,
        superseded_by: "uuid-2023",
      },
    ]);
  });

  it("keeps barred (last payout > 3 years, unclaimed) over a for_release extra with no payroll", () => {
    const paid = row({
      id: "uuid-243",
      employee_code: "202204-00243",
      last_name: "Cruz",
      first_name: "Alvin Joseph",
      status: "barred",
      hire_date: "2022-04-29",
      first_hire_date: "2022-04-29",
      last_payroll_end: "2022-07-25",
      legacy_id: 243,
      client_id: "manila",
    });
    const unpaidRelease = row({
      id: "uuid-265",
      employee_code: "202204-00265",
      last_name: "Cruz",
      first_name: "Alvin Joseph",
      status: "for_release",
      hire_date: "2022-04-29",
      first_hire_date: "2022-04-29",
      last_payroll_end: null,
      legacy_id: 265,
      client_id: "manila",
    });

    const plan = planCollapseSplitCurrent([unpaidRelease, paid], {
      asOf: new Date("2026-09-11T00:00:00Z"),
    });
    assert.equal(plan.action, "collapse");
    if (plan.action !== "collapse") return;
    assert.equal(plan.masterId, "uuid-243");
    assert.equal(plan.keep_employee_code, "202204-00243");
    assert.equal(plan.liveSourceId, "uuid-243");
    assert.equal(plan.masterPatch.status, "barred");
    assert.deepEqual(plan.loserPatches, [
      {
        id: "uuid-265",
        is_current_engagement: false,
        superseded_by: "uuid-243",
      },
    ]);
  });

  it("ages a for_release file whose last payout is older than 3 years to barred", () => {
    const agedRelease = row({
      id: "uuid-243",
      employee_code: "202204-00243",
      last_name: "Cruz",
      first_name: "Alvin Joseph",
      status: "for_release",
      hire_date: "2022-04-29",
      first_hire_date: "2022-04-29",
      last_payroll_end: "2022-07-25",
      legacy_id: 243,
    });
    const unpaidRelease = row({
      id: "uuid-265",
      employee_code: "202204-00265",
      last_name: "Cruz",
      first_name: "Alvin Joseph",
      status: "for_release",
      hire_date: "2022-04-29",
      first_hire_date: "2022-04-29",
      last_payroll_end: null,
      legacy_id: 265,
    });

    const plan = planCollapseSplitCurrent([agedRelease, unpaidRelease], {
      asOf: new Date("2026-09-11T00:00:00Z"),
    });
    assert.equal(plan.action, "collapse");
    if (plan.action !== "collapse") return;
    assert.equal(plan.liveSourceId, "uuid-243");
    assert.equal(plan.masterPatch.status, "barred");
  });

  it("parks the extra current file onto the existing master, not a already-superseded row", () => {
    const plan = planCollapseSplitCurrent([
      row({
        id: "oldest",
        employee_code: "22922",
        status: "inactive",
        is_current_engagement: false,
        superseded_by: "middle",
        hire_date: "2024-08-14",
        first_hire_date: "2024-08-14",
        last_payroll_end: "2025-08-31",
        legacy_id: 22922,
      }),
      row({
        id: "middle",
        employee_code: "202408-00231",
        status: "inactive",
        is_current_engagement: true,
        hire_date: "2025-11-11",
        first_hire_date: "2024-08-14",
        last_payroll_end: "2026-06-30",
        legacy_id: 26917,
        daily_rate: 500,
      }),
      row({
        id: "newest",
        employee_code: "29566",
        status: "active",
        is_current_engagement: true,
        hire_date: "2026-09-01",
        first_hire_date: "2026-09-01",
        last_payroll_end: null,
        legacy_id: 29566,
        client_id: "nabati",
        daily_rate: 620,
      }),
    ]);
    assert.equal(plan.action, "collapse");
    if (plan.action !== "collapse") return;
    assert.equal(plan.masterId, "middle");
    assert.equal(plan.keep_employee_code, "202408-00231");
    assert.equal(plan.masterPatch.status, "active");
    assert.equal(plan.masterPatch.hire_date, "2026-09-01");
    assert.equal(plan.masterPatch.first_hire_date, "2024-08-14");
    assert.deepEqual(
      plan.loserPatches.map((p) => p.id),
      ["newest"]
    );
    assert.equal(plan.loserPatches[0]?.superseded_by, "middle");
    assert.equal(plan.aliases[0]?.alias_code, "29566");
  });
});

describe("classifyDuplicateGroups", () => {
  it("flags same person_key with two current files as auto-collapse", () => {
    const groups = classifyDuplicateGroups([
      row({ id: "a", is_current_engagement: true, status: "active" }),
      row({ id: "b", is_current_engagement: true, status: "inactive" }),
    ]);
    assert.equal(groups.split_current.length, 1);
    assert.equal(groups.split_current[0]?.confidence, "auto");
    assert.equal(groups.split_current[0]?.member_ids.length, 2);
    assert.equal(groups.same_sss.length, 0);
  });

  it("auto-parks same SSS files when the current names match", () => {
    const members = [
      row({
        id: "one",
        organization_id: "org-d",
        person_key: "SSS:0249513659",
        employee_code: "202508-00164",
        sss_number: "02-4951365-9",
        last_name: "Baldo",
        first_name: "Norielyn",
        is_current_engagement: true,
        status: "inactive",
        hire_date: "2025-08-26",
        first_hire_date: "2025-08-26",
        last_payroll_end: "2026-02-15",
        legacy_id: 26262,
      }),
      row({
        id: "two",
        organization_id: "org-d",
        person_key: "STB:0249513659|111|2000-01-01",
        employee_code: "29531",
        sss_number: "0249513659",
        last_name: "BALDO",
        first_name: "NORIELYN",
        is_current_engagement: true,
        status: "active",
        hire_date: "2026-08-28",
        first_hire_date: "2026-08-28",
        legacy_id: 29531,
      }),
    ];
    const groups = classifyDuplicateGroups(members);
    assert.equal(groups.split_current.length, 0);
    assert.equal(groups.same_sss.length, 1);
    assert.equal(groups.same_sss[0]?.confidence, "auto");
    const plans = collapsePlansForRows(members);
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.masterId, "one");
    assert.equal(plans[0]?.keep_employee_code, "202508-00164");
  });

  it("leaves same SSS with different names for HR review", () => {
    const members = [
      row({
        id: "one",
        organization_id: "org-d",
        person_key: "SSS:111",
        sss_number: "3399999999",
        last_name: "Santos",
        first_name: "Juan",
        is_current_engagement: true,
        status: "active",
      }),
      row({
        id: "two",
        organization_id: "org-d",
        person_key: "SSS:222",
        sss_number: "3399999999",
        last_name: "Reyes",
        first_name: "Maria",
        is_current_engagement: true,
        status: "inactive",
      }),
    ];
    const groups = classifyDuplicateGroups(members);
    assert.equal(groups.same_sss.length, 1);
    assert.equal(groups.same_sss[0]?.confidence, "review");
    assert.equal(collapsePlansForRows(members).length, 0);
  });

  it("does not queue a parked extra with its live master as a same-SSS review", () => {
    const groups = classifyDuplicateGroups([
      row({
        id: "master",
        organization_id: "org-d",
        person_key: "SSS:master",
        sss_number: "34-6045142-9",
        last_name: "Villapana",
        first_name: "Khin",
        is_current_engagement: true,
        status: "inactive",
      }),
      row({
        id: "extra",
        organization_id: "org-d",
        person_key: "STB:3460451429|1|2000-01-01",
        sss_number: "3460451429",
        last_name: "Villapana",
        first_name: "Khin",
        is_current_engagement: false,
        superseded_by: "master",
        status: "inactive",
      }),
    ]);
    assert.equal(groups.same_sss.length, 0);
  });

  it("does not auto-park a same-SSS group when one current file has a different name", () => {
    const members = [
      row({
        id: "a",
        organization_id: "org-d",
        person_key: "SSS:a",
        sss_number: "3398888888",
        last_name: "Santos",
        first_name: "Juan",
        is_current_engagement: true,
        status: "active",
      }),
      row({
        id: "b",
        organization_id: "org-d",
        person_key: "SSS:b",
        sss_number: "3398888888",
        last_name: "Santos",
        first_name: "Juan",
        is_current_engagement: true,
        status: "inactive",
      }),
      row({
        id: "c",
        organization_id: "org-d",
        person_key: "SSS:c",
        sss_number: "3398888888",
        last_name: "Cruz",
        first_name: "Pedro",
        is_current_engagement: true,
        status: "inactive",
      }),
    ];
    const groups = classifyDuplicateGroups(members);
    assert.equal(groups.same_sss[0]?.confidence, "review");
    assert.equal(collapsePlansForRows(members).length, 0);
  });

  it("queues same name+DOB with different SSS for review when both lack payroll evidence", () => {
    const members = [
      row({
        id: "a",
        person_key: "SSS:111",
        sss_number: "1111111111",
        last_name: "Santos",
        first_name: "Juan",
        birth_date: "1990-01-02",
        is_current_engagement: true,
        status: "active",
      }),
      row({
        id: "b",
        person_key: "SSS:222",
        sss_number: "2222222222",
        last_name: "Santos",
        first_name: "Juan",
        birth_date: "1990-01-02",
        is_current_engagement: true,
        status: "inactive",
      }),
    ];
    const groups = classifyDuplicateGroups(members);
    assert.equal(groups.name_dob.length, 1);
    assert.equal(groups.name_dob[0]?.confidence, "review");
    assert.equal(collapsePlansForRows(members, { kinds: ["name_dob"] }).length, 0);
  });

  it("auto-parks same name+DOB extras when only one current file has a last payout", () => {
    const members = [
      row({
        id: "paid",
        organization_id: "org-d",
        person_key: "STB:paid",
        employee_code: "202204-00243",
        last_name: "Cruz",
        first_name: "Alvin Joseph",
        birth_date: "1999-07-22",
        sss_number: "3474839765",
        status: "barred",
        hire_date: "2022-04-29",
        first_hire_date: "2022-04-29",
        last_payroll_end: "2022-07-25",
        is_current_engagement: true,
      }),
      row({
        id: "unpaid",
        organization_id: "org-d",
        person_key: "SSS:unpaid",
        employee_code: "202204-00265",
        last_name: "Cruz",
        first_name: "Alvin Joseph",
        birth_date: "1999-07-22",
        sss_number: null,
        status: "for_release",
        hire_date: "2022-04-29",
        first_hire_date: "2022-04-29",
        last_payroll_end: null,
        is_current_engagement: true,
      }),
    ];
    const groups = classifyDuplicateGroups(members);
    assert.equal(groups.name_dob.length, 1);
    assert.equal(groups.name_dob[0]?.confidence, "auto");
    const plans = collapsePlansForRows(members, { kinds: ["name_dob"] });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.masterId, "paid");
    assert.equal(plans[0]?.liveSourceId, "paid");
    assert.equal(plans[0]?.loserPatches[0]?.id, "unpaid");
  });

  it("leaves same name+DOB for HR when two current files both have last payout", () => {
    const groups = classifyDuplicateGroups([
      row({
        id: "a",
        organization_id: "org-d",
        person_key: "SSS:a",
        last_name: "Santos",
        first_name: "Juan",
        birth_date: "1990-01-02",
        last_payroll_end: "2024-01-15",
        is_current_engagement: true,
        status: "inactive",
      }),
      row({
        id: "b",
        organization_id: "org-d",
        person_key: "SSS:b",
        last_name: "Santos",
        first_name: "Juan",
        birth_date: "1990-01-02",
        last_payroll_end: "2026-08-15",
        is_current_engagement: true,
        status: "active",
      }),
    ]);
    assert.equal(groups.name_dob[0]?.confidence, "review");
    assert.equal(collapsePlansForRows(groups.name_dob[0]?.members ?? [], { kinds: ["name_dob"] }).length, 0);
  });

  it("does not mix people from two organizations who happen to share an SSS", () => {
    const groups = classifyDuplicateGroups([
      row({
        id: "deployed",
        organization_id: "org-deployed",
        person_key: "SSS:0249513659",
        sss_number: "0249513659",
        is_current_engagement: true,
        status: "active",
      }),
      row({
        id: "organic",
        organization_id: "org-organic",
        person_key: "SSS:0249513659",
        sss_number: "0249513659",
        last_name: "Other",
        first_name: "Person",
        is_current_engagement: true,
        status: "active",
      }),
    ]);
    assert.equal(groups.same_sss.length, 0);
    assert.equal(groups.split_current.length, 0);
  });

  it("does not treat a unique SSS or a placeholder SSS as a duplicate", () => {
    const groups = classifyDuplicateGroups([
      row({
        id: "only",
        person_key: "SSS:0249513659",
        sss_number: "0249513659",
        is_current_engagement: true,
        status: "active",
      }),
      row({
        id: "zero-a",
        person_key: "LEG:1",
        sss_number: "0000000000",
        last_name: "A",
        first_name: "B",
        is_current_engagement: true,
        status: "active",
      }),
      row({
        id: "zero-b",
        person_key: "LEG:2",
        sss_number: "000-00-0000",
        last_name: "C",
        first_name: "D",
        is_current_engagement: true,
        status: "active",
      }),
    ]);
    assert.equal(groups.same_sss.length, 0);
    assert.equal(groups.split_current.length, 0);
  });

  it("auto-parks same TIN files when current names match", () => {
    const members = [
      row({
        id: "tin-a",
        organization_id: "org-d",
        person_key: "LEG:1",
        tin: "123-456-789-000",
        sss_number: null,
        last_name: "Santos",
        first_name: "Juan",
        is_current_engagement: true,
        status: "inactive",
        hire_date: "2024-01-10",
        legacy_id: 1,
      }),
      row({
        id: "tin-b",
        organization_id: "org-d",
        person_key: "LEG:2",
        tin: "123456789000",
        sss_number: null,
        last_name: "SANTOS",
        first_name: "JUAN",
        is_current_engagement: true,
        status: "active",
        hire_date: "2026-01-10",
        legacy_id: 2,
      }),
    ];
    const groups = classifyDuplicateGroups(members);
    assert.equal(groups.same_tin.length, 1);
    assert.equal(groups.same_tin[0]?.confidence, "auto");
    const plans = collapsePlansForRows(members, { kinds: ["same_tin"] });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.masterId, "tin-a");
  });

  it("auto-parks same PhilHealth / Pag-IBIG when names match", () => {
    const ph = classifyDuplicateGroups([
      row({
        id: "ph-a",
        organization_id: "org-d",
        person_key: "LEG:ph1",
        philhealth_number: "12-345678901-2",
        last_name: "Cruz",
        first_name: "Ana",
        is_current_engagement: true,
        status: "inactive",
        hire_date: "2023-01-01",
        legacy_id: 10,
      }),
      row({
        id: "ph-b",
        organization_id: "org-d",
        person_key: "LEG:ph2",
        philhealth_number: "123456789012",
        last_name: "Cruz",
        first_name: "Ana",
        is_current_engagement: true,
        status: "active",
        hire_date: "2025-01-01",
        legacy_id: 11,
      }),
    ]);
    assert.equal(ph.same_philhealth.length, 1);
    assert.equal(ph.same_philhealth[0]?.confidence, "auto");

    const hdmf = classifyDuplicateGroups([
      row({
        id: "hd-a",
        organization_id: "org-d",
        person_key: "LEG:hd1",
        pagibig_number: "1210-1234-5678",
        last_name: "Cruz",
        first_name: "Ana",
        is_current_engagement: true,
        status: "inactive",
        hire_date: "2023-01-01",
        legacy_id: 20,
      }),
      row({
        id: "hd-b",
        organization_id: "org-d",
        person_key: "LEG:hd2",
        pagibig_number: "121012345678",
        last_name: "Cruz",
        first_name: "Ana",
        is_current_engagement: true,
        status: "active",
        hire_date: "2025-01-01",
        legacy_id: 21,
      }),
    ]);
    assert.equal(hdmf.same_pagibig.length, 1);
    assert.equal(hdmf.same_pagibig[0]?.confidence, "auto");
  });

  it("queues same bank account for review only, never auto", () => {
    const members = [
      row({
        id: "bank-a",
        organization_id: "org-d",
        person_key: "LEG:ba",
        bank_account_no: "002112345678",
        last_name: "Santos",
        first_name: "Juan",
        is_current_engagement: true,
        status: "active",
      }),
      row({
        id: "bank-b",
        organization_id: "org-d",
        person_key: "LEG:bb",
        bank_account_no: "0021-1234-5678",
        last_name: "Santos",
        first_name: "Juan",
        is_current_engagement: true,
        status: "inactive",
      }),
    ];
    const groups = classifyDuplicateGroups(members);
    assert.equal(groups.same_bank.length, 1);
    assert.equal(groups.same_bank[0]?.confidence, "review");
    assert.equal(
      collapsePlansForRows(members, { kinds: ["same_bank"] }).length,
      0
    );
  });

  it("bridges a no-SSS row onto an SSS peer via shared PhilHealth", () => {
    const members = [
      row({
        id: "with-sss",
        organization_id: "org-d",
        person_key: "SSS:0249513659",
        sss_number: "0249513659",
        philhealth_number: "080123456789",
        last_name: "Baldo",
        first_name: "Norielyn",
        is_current_engagement: true,
        status: "inactive",
        hire_date: "2024-01-01",
        legacy_id: 100,
      }),
      row({
        id: "no-sss",
        organization_id: "org-d",
        person_key: "ND:BALDO|NORIELYN|2000-01-01",
        sss_number: null,
        philhealth_number: "08-0123456789",
        last_name: "Baldo",
        first_name: "Norielyn",
        is_current_engagement: true,
        status: "active",
        hire_date: "2026-01-01",
        legacy_id: 101,
      }),
    ];
    const groups = classifyDuplicateGroups(members);
    assert.equal(groups.same_philhealth.length, 1);
    assert.equal(groups.same_philhealth[0]?.confidence, "auto");
    const plans = collapsePlansForRows(members, {
      kinds: ["same_philhealth"],
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.masterId, "with-sss");
  });
});

describe("matchExistingPersonForHire", () => {
  it("blocks Add employee when SSS already belongs to a Directory person", () => {
    const existing = row({
      id: "uuid-26262",
      employee_code: "202508-00164",
      sss_number: "02-4951365-9",
      status: "inactive",
      is_current_engagement: true,
    });
    const match = matchExistingPersonForHire(
      {
        last_name: "Baldo",
        first_name: "Norielyn",
        sss_number: "0249513659",
      },
      [existing]
    );
    assert.equal(match.action, "conflict");
    if (match.action !== "conflict") return;
    assert.equal(match.reason, "sss");
    assert.equal(match.existing.id, "uuid-26262");
  });

  it("lets Add employee proceed when SSS is new or force_create is set", () => {
    const existing = row({
      id: "uuid-26262",
      sss_number: "0249513659",
      is_current_engagement: true,
      status: "inactive",
    });
    assert.equal(
      matchExistingPersonForHire(
        { last_name: "New", first_name: "Hire", sss_number: "3399999999" },
        [existing]
      ).action,
      "create"
    );
    assert.equal(
      matchExistingPersonForHire(
        {
          last_name: "Baldo",
          first_name: "Norielyn",
          sss_number: "0249513659",
          force_create: true,
        },
        [existing]
      ).action,
      "create"
    );
    assert.equal(
      matchExistingPersonForHire(
        { last_name: "No", first_name: "Sss" },
        [existing]
      ).action,
      "create"
    );
  });
});

describe("collapseFromRequestedMaster", () => {
  const original = row({
    id: "uuid-26262",
    employee_code: "202508-00164",
    hire_date: "2025-08-26",
    first_hire_date: "2025-08-26",
    last_payroll_end: "2026-02-15",
    legacy_id: 26262,
    status: "inactive",
  });
  const extra = row({
    id: "uuid-29531",
    employee_code: "29531",
    hire_date: "2026-08-28",
    first_hire_date: "2026-08-28",
    legacy_id: 29531,
    status: "active",
  });

  it("parks extras when HR confirms from the original 201", () => {
    const result = collapseFromRequestedMaster([original, extra], "uuid-26262");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.plan.masterId, "uuid-26262");
    assert.equal(result.plan.loserPatches[0]?.id, "uuid-29531");
  });

  it("rejects parking from the extra 201 — keep the original UUID", () => {
    const result = collapseFromRequestedMaster([original, extra], "uuid-29531");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 409);
    assert.equal(result.keep_id, "uuid-26262");
    assert.equal(result.keep_employee_code, "202508-00164");
    assert.match(result.error, /original 201/);
  });

  it("rejects a group that is already one current engagement", () => {
    const result = collapseFromRequestedMaster(
      [original, { ...extra, is_current_engagement: false }],
      "uuid-26262"
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 409);
    assert.equal(result.keep_id, undefined);
  });
});

describe("aliasConflictAction", () => {
  it("retargets an extra 201 self-alias onto the person master", () => {
    assert.equal(
      aliasConflictAction("extra", "master", ["extra", "other-extra"]),
      "retarget"
    );
  });

  it("does not steal a code already owned by another person", () => {
    assert.equal(aliasConflictAction("third", "master", ["extra"]), "skip");
    assert.equal(aliasConflictAction("master", "master", ["extra"]), "skip");
  });
});
