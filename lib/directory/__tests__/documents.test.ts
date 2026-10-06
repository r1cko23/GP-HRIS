import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEmployeeDocumentUpload,
  combinedScanNotes,
  computeDocumentInspection,
  employeeDocumentStoragePath,
  parseEmployeeDocumentType,
  parseEmployeeDocumentTypes,
  resolveUploadDocTypes,
  rehireClearanceGate,
  fitnessClearanceGate,
  REHIRE_CLEARANCE_TYPES,
  FITNESS_CLEARANCE_TYPES,
} from "../documents";

describe("employee documents", () => {
  it("accepts the PH 201 scan types", () => {
    assert.equal(parseEmployeeDocumentType("nbi_clearance"), "nbi_clearance");
    assert.equal(parseEmployeeDocumentType("sss_id"), "sss_id");
    assert.equal(parseEmployeeDocumentType("passport"), null);
  });

  it("parses a multi-ID combined scan list", () => {
    assert.deepEqual(parseEmployeeDocumentTypes(["sss_id", "tin_id", "sss_id"]), [
      "sss_id",
      "tin_id",
    ]);
    assert.deepEqual(parseEmployeeDocumentTypes('["philhealth_id","pagibig_id"]'), [
      "philhealth_id",
      "pagibig_id",
    ]);
    assert.equal(parseEmployeeDocumentTypes(["passport"]), null);
  });

  it("Other with ticked IDs uploads those types, not a bare other row", () => {
    const result = resolveUploadDocTypes({
      docType: "other",
      containedTypes: ["sss_id", "tin_id", "philhealth_id"],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.types, ["sss_id", "tin_id", "philhealth_id"]);
  });

  it("Other with nothing ticked stays a misc other upload", () => {
    const result = resolveUploadDocTypes({
      docType: "other",
      containedTypes: [],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.types, ["other"]);
  });

  it("single-type upload ignores contained ticks", () => {
    const result = resolveUploadDocTypes({
      docType: "nbi_clearance",
      containedTypes: ["sss_id"],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.types, ["nbi_clearance"]);
  });


  it("rejects a 12 MB upload", () => {
    const result = assertEmployeeDocumentUpload({
      docType: "tin_id",
      mimeType: "application/pdf",
      fileSize: 12 * 1024 * 1024,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /10 MB/i);
  });

  it("rejects a Word document", () => {
    const result = assertEmployeeDocumentUpload({
      docType: "sss_id",
      mimeType: "application/msword",
      fileSize: 1000,
    });
    assert.equal(result.ok, false);
  });

  it("accepts a JPEG under the cap", () => {
    const result = assertEmployeeDocumentUpload({
      docType: "philhealth_id",
      mimeType: "image/jpeg",
      fileSize: 250_000,
    });
    assert.equal(result.ok, true);
  });

  it("stores files under org/employee/type", () => {
    const path = employeeDocumentStoragePath({
      organizationId: "org-1",
      employeeId: "emp-1",
      docType: "pagibig_id",
      fileId: "file-1",
      extension: "pdf",
    });
    assert.equal(path, "org-1/emp-1/pagibig_id/file-1.pdf");
  });

  it("scores statutory scans with zero, one, and all four", () => {
    assert.deepEqual(computeDocumentInspection([]).missing, [
      "sss_id",
      "tin_id",
      "philhealth_id",
      "pagibig_id",
    ]);
    assert.equal(computeDocumentInspection(["sss_id"]).score, 1);
    assert.equal(
      computeDocumentInspection([
        "sss_id",
        "tin_id",
        "philhealth_id",
        "pagibig_id",
      ]).score,
      4
    );
  });

  it("labels a combined scan in notes", () => {
    assert.equal(combinedScanNotes(["sss_id"]), null);
    assert.equal(
      combinedScanNotes(["sss_id", "tin_id"]),
      "Combined scan: SSS ID, TIN ID."
    );
  });
});

describe("rehireClearanceGate", () => {
  it("requires current NBI and medical clearance before rehire", () => {
    assert.deepEqual(REHIRE_CLEARANCE_TYPES, [
      "nbi_clearance",
      "medical_clearance",
    ]);
    const blocked = rehireClearanceGate({
      hireDate: "2026-10-06",
      priorEndedOn: "2025-01-15",
      documents: [],
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.deepEqual(blocked.missing, ["nbi_clearance", "medical_clearance"]);
    assert.match(blocked.error, /NBI clearance/i);
    assert.match(blocked.error, /Medical clearance/i);
  });

  it("accepts fresh NBI and medical after the prior tenure ended", () => {
    const ready = rehireClearanceGate({
      hireDate: "2026-10-06",
      priorEndedOn: "2025-01-15",
      documents: [
        {
          doc_type: "nbi_clearance",
          expires_on: "2027-01-01",
          uploaded_at: "2026-09-01T08:00:00Z",
          superseded_at: null,
        },
        {
          doc_type: "medical_clearance",
          expires_on: "2026-12-31",
          uploaded_at: "2026-09-20T08:00:00Z",
          superseded_at: null,
        },
      ],
    });
    assert.equal(ready.ok, true);
  });

  it("rejects an expired or pre-resign clearance scan", () => {
    const expired = rehireClearanceGate({
      hireDate: "2026-10-06",
      priorEndedOn: "2025-01-15",
      documents: [
        {
          doc_type: "nbi_clearance",
          expires_on: "2026-09-01",
          uploaded_at: "2026-08-01T08:00:00Z",
          superseded_at: null,
        },
        {
          doc_type: "medical_clearance",
          expires_on: "2027-01-01",
          uploaded_at: "2026-09-01T08:00:00Z",
          superseded_at: null,
        },
      ],
    });
    assert.equal(expired.ok, false);
    if (expired.ok) return;
    assert.deepEqual(expired.expired, ["nbi_clearance"]);

    const stale = rehireClearanceGate({
      hireDate: "2026-10-06",
      priorEndedOn: "2025-01-15",
      documents: [
        {
          doc_type: "nbi_clearance",
          expires_on: "2027-01-01",
          uploaded_at: "2024-06-01T08:00:00Z",
          superseded_at: null,
        },
        {
          doc_type: "medical_clearance",
          expires_on: "2027-01-01",
          uploaded_at: "2026-09-01T08:00:00Z",
          superseded_at: null,
        },
      ],
    });
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.deepEqual(stale.stale, ["nbi_clearance"]);
  });

  it("ignores superseded scans and keeps SSS optional for rehire", () => {
    const blocked = rehireClearanceGate({
      hireDate: "2026-10-06",
      priorEndedOn: null,
      documents: [
        {
          doc_type: "nbi_clearance",
          expires_on: "2027-01-01",
          uploaded_at: "2026-09-01T08:00:00Z",
          superseded_at: "2026-09-02T08:00:00Z",
        },
        {
          doc_type: "sss_id",
          expires_on: null,
          uploaded_at: "2020-01-01T08:00:00Z",
          superseded_at: null,
        },
      ],
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.deepEqual(blocked.missing, ["nbi_clearance", "medical_clearance"]);
  });
});

describe("fitnessClearanceGate for Activate", () => {
  it("blocks Activate when medical is expired as of today without stale checks", () => {
    assert.deepEqual(FITNESS_CLEARANCE_TYPES, REHIRE_CLEARANCE_TYPES);
    const blocked = fitnessClearanceGate({
      asOfDate: "2026-10-06",
      documents: [
        {
          doc_type: "nbi_clearance",
          expires_on: "2027-01-01",
          uploaded_at: "2024-01-01T08:00:00Z",
          superseded_at: null,
        },
        {
          doc_type: "medical_clearance",
          expires_on: "2026-09-01",
          uploaded_at: "2024-01-01T08:00:00Z",
          superseded_at: null,
        },
      ],
      purpose: "activate",
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.deepEqual(blocked.expired, ["medical_clearance"]);
    assert.deepEqual(blocked.stale, []);
    assert.match(blocked.error, /Activate/i);
  });

  it("allows Activate when both clearances cover asOfDate", () => {
    const ready = fitnessClearanceGate({
      asOfDate: "2026-10-06",
      documents: [
        {
          doc_type: "nbi_clearance",
          expires_on: "2027-01-01",
          uploaded_at: "2020-01-01T08:00:00Z",
          superseded_at: null,
        },
        {
          doc_type: "medical_clearance",
          expires_on: null,
          uploaded_at: "2020-01-01T08:00:00Z",
          superseded_at: null,
        },
      ],
      purpose: "activate",
    });
    assert.equal(ready.ok, true);
  });
});
