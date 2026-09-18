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
