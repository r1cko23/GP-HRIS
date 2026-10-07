import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANDIDATE_STAGES,
  assessCandidateConversionReadiness,
  canTransitionCandidate,
  candidateSearchFilter,
  normalizeCandidateCreateInput,
  parseCandidateListParams,
} from "../candidates";

describe("candidate stages", () => {
  it("matches the persisted candidate lifecycle", () => {
    assert.deepEqual(CANDIDATE_STAGES, [
      "prospect",
      "applicant",
      "screening",
      "submitted",
      "selected",
      "placed",
      "withdrawn",
      "rejected",
      "archived",
    ]);
  });

  it("permits forward, return, and terminal paths", () => {
    assert.equal(canTransitionCandidate("prospect", "applicant"), true);
    assert.equal(canTransitionCandidate("submitted", "selected"), true);
    assert.equal(canTransitionCandidate("screening", "applicant"), true);
    assert.equal(canTransitionCandidate("rejected", "screening"), false);
    assert.equal(canTransitionCandidate("placed", "selected"), false);
  });
});

describe("candidate conversion readiness", () => {
  it("requires selection, consent, identity, and no existing person link", () => {
    assert.deepEqual(
      assessCandidateConversionReadiness({
        status: "selected",
        consent_status: "granted",
        first_name: " Ana ",
        last_name: " Reyes ",
        email: "ANA@EXAMPLE.COM ",
        mobile: null,
        employee_id: null,
      }),
      { ready: true, blockers: [] }
    );

    assert.deepEqual(
      assessCandidateConversionReadiness({
        status: "screening",
        consent_status: "pending",
        first_name: "",
        last_name: "Reyes",
        email: null,
        mobile: null,
        employee_id: "employee-1",
      }),
      {
        ready: false,
        blockers: [
          "candidate_not_selected",
          "consent_not_granted",
          "identity_incomplete",
          "already_converted",
        ],
      }
    );
  });
});

describe("candidate create normalization", () => {
  it("normalizes identity and records granted consent", () => {
    const recordedAt = "2026-10-07T04:00:00.000Z";
    assert.deepEqual(
      normalizeCandidateCreateInput(
        {
          first_name: "  ana marie ",
          middle_name: " de leon ",
          last_name: " REYES ",
          email: " ANA.REYES@Example.COM ",
          mobile: " +63 (917) 123-4567 ",
          source: " employee referral ",
          consent_status: "granted",
          available_from: "2026-10-15",
        },
        recordedAt
      ),
      {
        first_name: "Ana Marie",
        middle_name: "De Leon",
        last_name: "Reyes",
        email: "ana.reyes@example.com",
        mobile: "+639171234567",
        source: "Employee Referral",
        status: "prospect",
        consent_status: "granted",
        consent_recorded_at: recordedAt,
        available_from: "2026-10-15",
      }
    );
  });

  it("rejects missing identity, invalid consent, and malformed dates", () => {
    assert.throws(
      () =>
        normalizeCandidateCreateInput({
          first_name: "",
          last_name: "Reyes",
          consent_status: "granted",
        }),
      /First name is required/
    );
    assert.throws(
      () =>
        normalizeCandidateCreateInput({
          first_name: "Ana",
          last_name: "Reyes",
          consent_status: "unknown",
        }),
      /Invalid consent status/
    );
    assert.throws(
      () =>
        normalizeCandidateCreateInput({
          first_name: "Ana",
          last_name: "Reyes",
          available_from: "10\/15\/2026",
        }),
      /available date/
    );
  });
});

describe("candidate list params", () => {
  it("caps pagination and validates stage filters", () => {
    assert.deepEqual(
      parseCandidateListParams(
        new URLSearchParams({
          limit: "999",
          offset: "-4",
          q: " Ana ",
          stage: "screening",
        })
      ),
      { limit: 200, offset: 0, q: "Ana", stage: "screening" }
    );
    assert.throws(
      () => parseCandidateListParams(new URLSearchParams({ stage: "hired" })),
      /Invalid candidate stage/
    );
  });

  it("escapes candidate search patterns", () => {
    assert.equal(
      candidateSearchFilter("Ana_100%"),
      "candidate_number.ilike.%Ana\\_100\\%%,first_name.ilike.%Ana\\_100\\%%,middle_name.ilike.%Ana\\_100\\%%,last_name.ilike.%Ana\\_100\\%%,email.ilike.%Ana\\_100\\%%,mobile.ilike.%Ana\\_100\\%%"
    );
  });
});
