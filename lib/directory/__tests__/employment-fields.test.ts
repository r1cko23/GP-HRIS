import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultContractType,
  employmentNeedsContractEnd,
  employmentNeedsRegularDate,
  legacyEncodeDate,
  mapLegacyEmployeeEncodeFields,
} from "../employment-fields";
import { pickDirectoryEmployeePatch } from "../employee-patch";

describe("mapLegacyEmployeeEncodeFields", () => {
  it("maps GREENHRISMAIN employee_status / typeofcontract / pstatus / contractend / dateregular", () => {
    const mapped = mapLegacyEmployeeEncodeFields({
      employee_status: "Probationary",
      typeofcontract: "Fixed Term",
      contractend: "2026-12-31",
      pstatus: "Single",
      dateregular: "2025-06-01",
    });
    assert.deepEqual(mapped, {
      employment_type: "Probationary",
      contract_type: "Fixed Term",
      contract_end_date: "2026-12-31",
      civil_status: "Single",
      regular_date: "2025-06-01",
    });
  });

  it("keeps On-Call and Contractual employment types as encoded in MAIN", () => {
    assert.equal(
      mapLegacyEmployeeEncodeFields({ employee_status: "On-Call" })
        .employment_type,
      "On-Call"
    );
    assert.equal(
      mapLegacyEmployeeEncodeFields({ employee_status: "Contractual" })
        .employment_type,
      "Contractual"
    );
  });

  it("nulls blank and sentinel 1900 dates on contract end", () => {
    assert.equal(
      mapLegacyEmployeeEncodeFields({ contractend: "1900-01-01" })
        .contract_end_date,
      null
    );
    assert.equal(
      mapLegacyEmployeeEncodeFields({ contractend: "   " }).contract_end_date,
      null
    );
    assert.equal(legacyEncodeDate(null), null);
  });

  it("nulls empty encode fields without inventing defaults", () => {
    assert.deepEqual(mapLegacyEmployeeEncodeFields({}), {
      employment_type: null,
      contract_type: null,
      contract_end_date: null,
      civil_status: null,
      regular_date: null,
    });
  });
});

describe("employment disclosure helpers", () => {
  it("needs contract end for Fixed Term / Contractual / Project Based / Seasonal / On-Call", () => {
    assert.equal(employmentNeedsContractEnd("Fixed Term"), true);
    assert.equal(employmentNeedsContractEnd("Contractual"), true);
    assert.equal(employmentNeedsContractEnd("Project Based"), true);
    assert.equal(employmentNeedsContractEnd("Seasonal"), true);
    assert.equal(employmentNeedsContractEnd("On-Call"), true);
    assert.equal(employmentNeedsContractEnd("Probationary"), false);
    assert.equal(employmentNeedsContractEnd("Regular"), false);
    assert.equal(employmentNeedsContractEnd(null), false);
  });

  it("needs regular date for Regular and Regular Casual", () => {
    assert.equal(employmentNeedsRegularDate("Regular"), true);
    assert.equal(employmentNeedsRegularDate("Regular Casual"), true);
    assert.equal(employmentNeedsRegularDate("Probationary"), false);
    assert.equal(employmentNeedsRegularDate(""), false);
  });

  it("defaults contract type from employment type when MAIN-paired", () => {
    assert.equal(defaultContractType("Probationary"), "Probationary");
    assert.equal(defaultContractType("Fixed Term"), "Fixed Term");
    assert.equal(defaultContractType("Regular Casual"), "Regular");
    assert.equal(defaultContractType("Backup"), null);
    assert.equal(defaultContractType(null), null);
  });
});

describe("pickDirectoryEmployeePatch employment encode fields", () => {
  it("accepts employment_type, contract_type, civil_status, regular_date, contract_end_date", () => {
    const picked = pickDirectoryEmployeePatch({
      employment_type: "Probationary",
      contract_type: "Fixed Term",
      civil_status: "Single",
      regular_date: "2025-06-01",
      contract_end_date: "2026-12-31",
    });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.deepEqual(picked.patch, {
      employment_type: "Probationary",
      contract_type: "Fixed Term",
      civil_status: "Single",
      regular_date: "2025-06-01",
      contract_end_date: "2026-12-31",
    });
  });

  it("clears employment encode fields when blank", () => {
    const picked = pickDirectoryEmployeePatch({
      employment_type: "",
      contract_end_date: "  ",
    });
    assert.equal(picked.ok, true);
    if (!picked.ok) return;
    assert.deepEqual(picked.patch, {
      employment_type: null,
      contract_end_date: null,
    });
  });
});
