import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEmployeeDocumentUpload,
  computeDocumentInspection,
  employeeDocumentStoragePath,
  parseEmployeeDocumentType,
} from "../documents";

describe("employee documents", () => {
  it("accepts the PH 201 scan types", () => {
    assert.equal(parseEmployeeDocumentType("nbi_clearance"), "nbi_clearance");
    assert.equal(parseEmployeeDocumentType("sss_id"), "sss_id");
    assert.equal(parseEmployeeDocumentType("passport"), null);
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
});
