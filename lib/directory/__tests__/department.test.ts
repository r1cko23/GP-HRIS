import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  csmDirectoryDepartmentLink,
  mapLegacyDepartment,
  matchDirectoryDepartment,
  planEmployeeDepartmentId,
} from "../department";

describe("mapLegacyDepartment", () => {
  it("maps GREENHRISMAIN dbo.Department to a Directory store CSM can bind", () => {
    const mapped = mapLegacyDepartment({
      iddepartment: 412,
      idclient: 15,
      Department_desc: "krr_ bacoor junction",
      departmenttagdelete: "N",
      preparedbydepartment: "ana cruz",
    });
    assert.equal(mapped.ok, true);
    if (!mapped.ok) return;
    assert.deepEqual(mapped.payload, {
      legacy_id: 412,
      client_legacy_id: 15,
      name: "Krr_ Bacoor Junction",
      is_active: true,
      prepared_by: "Ana Cruz",
    });
  });

  it("skips a deleted Department so CSM does not bind a retired store", () => {
    const mapped = mapLegacyDepartment({
      iddepartment: 1,
      idclient: 15,
      Department_desc: "Old Store",
      departmenttagdelete: "Y",
    });
    assert.equal(mapped.ok, false);
    if (mapped.ok) return;
    assert.equal(mapped.reason, "deleted");
  });

  it("rejects a Department with no store name", () => {
    const mapped = mapLegacyDepartment({
      iddepartment: 2,
      idclient: 15,
      Department_desc: "   ",
    });
    assert.equal(mapped.ok, false);
    if (mapped.ok) return;
    assert.equal(mapped.reason, "missing_name");
  });

  it("rejects a Department with no iddepartment (CSM cannot key a UUID later)", () => {
    const mapped = mapLegacyDepartment({
      idclient: 15,
      Department_desc: "Batangas",
    });
    assert.equal(mapped.ok, false);
    if (mapped.ok) return;
    assert.equal(mapped.reason, "missing_id");
  });

  it("rejects a Department with no client so it cannot attach to the wrong employer", () => {
    const mapped = mapLegacyDepartment({
      iddepartment: 3,
      Department_desc: "Batangas",
    });
    assert.equal(mapped.ok, false);
    if (mapped.ok) return;
    assert.equal(mapped.reason, "missing_client");
  });
});

describe("csmDirectoryDepartmentLink", () => {
  it("gives CSM directory_department_id, not a payroll branch id", () => {
    assert.deepEqual(
      csmDirectoryDepartmentLink({
        id: "dept-uuid",
        client_id: "client-uuid",
      }),
      {
        directory_department_id: "dept-uuid",
        directory_client_id: "client-uuid",
      }
    );
  });
});

const NABATI = "client-nabati";
const BATANGAS = {
  id: "dept-batangas",
  client_id: NABATI,
  name: "Batangas",
};
const TAYTAY = {
  id: "dept-taytay",
  client_id: NABATI,
  name: "Taytay",
};
const OTHER_CLIENT_BATANGAS = {
  id: "dept-other-batangas",
  client_id: "client-other",
  name: "Batangas",
};

describe("matchDirectoryDepartment", () => {
  it("matches an outlet to the unique store name under that client", () => {
    const hit = matchDirectoryDepartment("Nabati Batangas", [BATANGAS, TAYTAY], {
      clientId: NABATI,
    });
    assert.equal(hit?.id, "dept-batangas");
  });

  it("returns no match when zero departments are on file", () => {
    assert.equal(matchDirectoryDepartment("Nabati Batangas", []), null);
  });

  it("does not guess when two stores on the same client share the name", () => {
    const hit = matchDirectoryDepartment(
      "Batangas",
      [
        BATANGAS,
        { id: "dept-batangas-2", client_id: NABATI, name: "Batangas" },
      ],
      { clientId: NABATI }
    );
    assert.equal(hit, null);
  });

  it("does not bind a store that belongs to another client", () => {
    const hit = matchDirectoryDepartment(
      "Nabati Batangas",
      [OTHER_CLIENT_BATANGAS, TAYTAY],
      { clientId: NABATI }
    );
    assert.equal(hit, null);
  });

  it("prefers an exact store name over a suffix of another store", () => {
    const hit = matchDirectoryDepartment(
      "Batangas",
      [BATANGAS, { id: "dept-plant", client_id: NABATI, name: "Batangas Plant" }],
      { clientId: NABATI }
    );
    assert.equal(hit?.id, "dept-batangas");
  });
});

const DEPTS = new Map([
  [
    49,
    { id: "uuid-abagatan", client_id: "client-abagatan", legacy_id: 49 },
  ],
  [
    324,
    { id: "uuid-service", client_id: "client-abagatan", legacy_id: 324 },
  ],
  [
    216,
    { id: "uuid-primea", client_id: "client-aldex", legacy_id: 216 },
  ],
]);

describe("planEmployeeDepartmentId", () => {
  it("attaches the GREENHRISMAIN store when it belongs to the person's client", () => {
    assert.equal(
      planEmployeeDepartmentId({
        departmentCode: 49,
        employeeClientId: "client-abagatan",
        departmentsByLegacy: DEPTS,
      }),
      "uuid-abagatan"
    );
  });

  it("does not attach a store from another client", () => {
    assert.equal(
      planEmployeeDepartmentId({
        departmentCode: 216,
        employeeClientId: "client-abagatan",
        departmentsByLegacy: DEPTS,
      }),
      null
    );
  });

  it("returns null when the 201 has no department_code", () => {
    assert.equal(
      planEmployeeDepartmentId({
        departmentCode: null,
        employeeClientId: "client-abagatan",
        departmentsByLegacy: DEPTS,
      }),
      null
    );
  });

  it("returns null when the department_code is not in Directory", () => {
    assert.equal(
      planEmployeeDepartmentId({
        departmentCode: 99999,
        employeeClientId: "client-abagatan",
        departmentsByLegacy: DEPTS,
      }),
      null
    );
  });
});
