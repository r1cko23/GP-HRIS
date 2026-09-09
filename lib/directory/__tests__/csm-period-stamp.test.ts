import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planPeriodDirectoryStamps } from "../csm-period-stamp";

const CADACIO = "947a284f-deb3-4ccd-8396-f8f4cb2644f5";
const ANONUEVO = "3ea58948-d4a0-4f86-aabc-de8554bc3b96";
const RUBI = "0ae476a4-8bbf-4118-b15b-43cd5238e95c";
const ARIEL = "974aeede-aa9c-4f0f-a9d9-91719ff2bec3";
const KATTE = "b129f85e-8197-4493-a19f-fa5aad13bfe3";
const BABADILLA = "6b0ba62d-0d9c-4838-bb84-18035ef10c39";

const verified = [
  {
    employee_name: "CADACIO, RAYMOND LIRA",
    directory_employee_id: CADACIO,
  },
  {
    employee_name: "AÑONUEVO, CARLO MAGNO AGUILUCHO",
    directory_employee_id: ANONUEVO,
  },
  {
    employee_name: "RUBI, RENCE PAUL AMOR",
    directory_employee_id: RUBI,
  },
  {
    employee_name: "AVILA, ARIEL COMIA",
    directory_employee_id: ARIEL,
  },
  {
    employee_name: "AVILA, KATTE COMIA",
    directory_employee_id: KATTE,
  },
  {
    employee_name: "BABADILLA, ADRIAN VERGARA",
    directory_employee_id: BABADILLA,
  },
];

describe("planPeriodDirectoryStamps", () => {
  it("stamps a timesheet name that has no Directory id from unique CSM Verified", () => {
    const plans = planPeriodDirectoryStamps(
      [
        {
          id: "p-cadacio",
          full_name: "Cadacio, Raymond",
          directory_employee_id: null,
        },
        {
          id: "p-anonuevo",
          full_name: "Añonuevo, Carlo Magno",
          directory_employee_id: null,
        },
        {
          id: "p-rubi",
          full_name: "Rubi, Rence Paul",
          directory_employee_id: null,
        },
      ],
      verified
    );
    assert.deepEqual(
      plans.filter((p) => p.action === "stamp").map((p) => [
        p.id,
        p.directory_employee_id,
      ]),
      [
        ["p-cadacio", CADACIO],
        ["p-anonuevo", ANONUEVO],
        ["p-rubi", RUBI],
      ]
    );
  });

  it("keeps a timesheet row already stamped with the CSM Verified id", () => {
    const [plan] = planPeriodDirectoryStamps(
      [
        {
          id: "p-babadilla",
          full_name: "Babadilla, Adrian",
          directory_employee_id: BABADILLA,
        },
      ],
      verified
    );
    assert.deepEqual(plan, {
      action: "keep",
      id: "p-babadilla",
      directory_employee_id: BABADILLA,
    });
  });

  it("picks Ariel not Katte when two Verified people share a last name", () => {
    const [plan] = planPeriodDirectoryStamps(
      [
        {
          id: "p-ariel",
          full_name: "Avila, Ariel",
          directory_employee_id: null,
        },
      ],
      verified
    );
    assert.equal(plan.action, "stamp");
    if (plan.action !== "stamp") return;
    assert.equal(plan.directory_employee_id, ARIEL);
  });

  it("skips a timesheet name with no unique Verified person", () => {
    const [plan] = planPeriodDirectoryStamps(
      [
        {
          id: "p-ghost",
          full_name: "Nobody, Here",
          directory_employee_id: null,
        },
      ],
      verified
    );
    assert.equal(plan.action, "skip");
    if (plan.action !== "skip") return;
    assert.equal(plan.reason, "no_verified_match");
  });

  it("does not give two timesheet rows the same Directory person", () => {
    const plans = planPeriodDirectoryStamps(
      [
        {
          id: "p-1",
          full_name: "Cadacio, Raymond",
          directory_employee_id: null,
        },
        {
          id: "p-2",
          full_name: "Cadacio, Raymund",
          directory_employee_id: null,
        },
      ],
      verified
    );
    const stamps = plans.filter((p) => p.action === "stamp");
    assert.equal(stamps.length, 1);
    assert.equal(plans.filter((p) => p.action === "skip").length, 1);
  });
});
