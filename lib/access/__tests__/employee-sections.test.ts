import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allEmployeeSections,
  canEmployeeSection,
  emptyEmployeeSections,
  filterEmployeePatchBySections,
  firstAllowed201Tab,
  hasAnyEmployeeSection,
  parseEmployeeSectionsOverride,
  redactEmployeeFilePayload,
  redactEmployeeRecord,
  resolveEmployeeSectionAccess,
  sectionForChildSheet,
  tabAllowed,
} from "../employee-sections";

describe("resolveEmployeeSectionAccess", () => {
  it("gives full sections and salary when fullAccess", () => {
    const access = resolveEmployeeSectionAccess({
      employeesRead: false,
      fullAccess: true,
    });
    assert.equal(hasAnyEmployeeSection(access.sections), true);
    assert.equal(access.salary, true);
    assert.equal(canEmployeeSection(access.sections, "medical"), true);
  });

  it("with employeesRead and no keys, grants all sections (backward compatible)", () => {
    const access = resolveEmployeeSectionAccess({
      employeesRead: true,
      capabilityKeys: ["page:employees"],
    });
    assert.deepEqual(access.sections, allEmployeeSections());
    assert.equal(access.salary, false);
  });

  it("uses sparse section capability keys when present", () => {
    const access = resolveEmployeeSectionAccess({
      employeesRead: true,
      capabilityKeys: [
        "page:employees",
        "fn:employees.section.government_ids",
        "fn:employees.section.documents",
      ],
    });
    assert.equal(canEmployeeSection(access.sections, "core"), false);
    assert.equal(canEmployeeSection(access.sections, "government_ids"), true);
    assert.equal(canEmployeeSection(access.sections, "documents"), true);
    assert.equal(canEmployeeSection(access.sections, "pay_channel"), false);
  });

  it("honors salary grant separately from pay_channel", () => {
    const access = resolveEmployeeSectionAccess({
      employeesRead: true,
      capabilityKeys: [
        "fn:employees.section.core",
        "fn:salary.read",
      ],
    });
    assert.equal(access.salary, true);
    assert.equal(canEmployeeSection(access.sections, "pay_channel"), false);
  });

  it("zero sections when no people read and no keys", () => {
    const access = resolveEmployeeSectionAccess({
      employeesRead: false,
      capabilityKeys: [],
    });
    assert.deepEqual(access.sections, emptyEmployeeSections());
  });

  it("applies permissions.employee_sections override when no capability keys", () => {
    const override = emptyEmployeeSections();
    override.core = true;
    override.history = true;
    const access = resolveEmployeeSectionAccess({
      employeesRead: true,
      sectionsOverride: override,
    });
    assert.equal(canEmployeeSection(access.sections, "core"), true);
    assert.equal(canEmployeeSection(access.sections, "history"), true);
    assert.equal(canEmployeeSection(access.sections, "documents"), false);
  });
});

describe("parseEmployeeSectionsOverride", () => {
  it("returns null when employee_sections is absent", () => {
    assert.equal(parseEmployeeSectionsOverride({ employees: { read: true } }), null);
  });

  it("parses boolean map", () => {
    const map = parseEmployeeSectionsOverride({
      employee_sections: { core: true, documents: false, medical: true },
    });
    assert.ok(map);
    assert.equal(map!.core, true);
    assert.equal(map!.documents, false);
    assert.equal(map!.medical, true);
    assert.equal(map!.family, false);
  });
});

describe("redactEmployeeRecord / redactEmployeeFilePayload", () => {
  const full = {
    id: "e1",
    last_name: "Santos",
    first_name: "Ana",
    middle_name: "B",
    tin: "123",
    sss_number: "34",
    philhealth_number: "ph",
    pagibig_number: "pg",
    tax_status: "S",
    bank_name: "BDO",
    bank_account_no: "999",
    gcash: "09",
    pay_through: "atm",
    daily_rate: 610,
    billing_daily_rate: 700,
    ecola: 10,
    email: "a@x.com",
    mobile: "09",
  };

  it("core-only strips ids, bank, and salary", () => {
    const sections = emptyEmployeeSections();
    sections.core = true;
    const row = redactEmployeeRecord(full, { sections, salary: false });
    assert.equal(row.last_name, "Santos");
    assert.equal(row.tin, null);
    assert.equal(row.bank_account_no, null);
    assert.equal(row.daily_rate, null);
  });

  it("docs+ids-only keeps government numbers and clears personal core detail", () => {
    const sections = emptyEmployeeSections();
    sections.government_ids = true;
    sections.documents = true;
    const row = redactEmployeeRecord(full, { sections, salary: false });
    assert.equal(row.tin, "123");
    assert.equal(row.sss_number, "34");
    assert.equal(row.email, null);
    assert.equal(row.mobile, null);
    assert.equal(row.bank_account_no, null);
  });

  it("salary without pay_channel keeps rates, clears bank", () => {
    const sections = emptyEmployeeSections();
    sections.core = true;
    const row = redactEmployeeRecord(full, { sections, salary: true });
    assert.equal(row.daily_rate, 610);
    assert.equal(row.bank_account_no, null);
  });

  it("file payload clears children by section; medical without history", () => {
    const sections = emptyEmployeeSections();
    sections.medical = true;
    const payload = redactEmployeeFilePayload(
      {
        employee: { ...full },
        contacts: [{ id: "c1" }],
        dependents: [{ id: "d1" }],
        education: [{ id: "ed" }],
        job_history: [{ id: "jh" }],
        licenses: [{ id: "l" }],
        medical: [{ id: "m1" }],
        movements: [{ id: "mv" }],
        skills: [{ id: "sk" }],
        duplicate_peers: [{ id: "p" }],
        tenures: [{ id: "t", daily_rate: 100, billing_daily_rate: 110 }],
      },
      { sections, salary: false }
    );
    assert.deepEqual(payload.contacts, []);
    assert.deepEqual(payload.education, []);
    assert.deepEqual(payload.medical, [{ id: "m1" }]);
    assert.deepEqual(payload.duplicate_peers, []);
    assert.equal(
      (payload.tenures![0] as { daily_rate: unknown }).daily_rate,
      null
    );
  });
});

describe("filterEmployeePatchBySections", () => {
  it("rejects government field without grant", () => {
    const sections = emptyEmployeeSections();
    sections.core = true;
    const result = filterEmployeePatchBySections(
      { last_name: "X", tin: "1" },
      { sections, salary: false }
    );
    assert.equal(result.ok, false);
  });

  it("allows core fields only", () => {
    const sections = emptyEmployeeSections();
    sections.core = true;
    const result = filterEmployeePatchBySections(
      { last_name: "Santos", first_name: "Ana" },
      { sections, salary: false }
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.patch, {
        last_name: "Santos",
        first_name: "Ana",
      });
    }
  });

  it("requires salary grant for daily_rate", () => {
    const sections = allEmployeeSections();
    const denied = filterEmployeePatchBySections(
      { daily_rate: 500 },
      { sections, salary: false }
    );
    assert.equal(denied.ok, false);
    const allowed = filterEmployeePatchBySections(
      { daily_rate: 500 },
      { sections, salary: true }
    );
    assert.equal(allowed.ok, true);
  });
});

describe("201 tabs and sheets", () => {
  it("maps sheets to sections", () => {
    assert.equal(sectionForChildSheet("dependents"), "family");
    assert.equal(sectionForChildSheet("medical"), "medical");
    assert.equal(sectionForChildSheet("education"), "history");
    assert.equal(sectionForChildSheet("unknown"), null);
  });

  it("picks first allowed tab for docs-only", () => {
    const sections = emptyEmployeeSections();
    sections.documents = true;
    sections.government_ids = true;
    assert.equal(firstAllowed201Tab(sections), "documents");
    assert.equal(tabAllowed("overview", sections), false);
    assert.equal(tabAllowed("documents", sections), true);
  });

  it("returns null when zero sections", () => {
    assert.equal(firstAllowed201Tab(emptyEmployeeSections()), null);
  });
});
