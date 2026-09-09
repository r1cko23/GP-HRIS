import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nabatiBatangasTaggingBrief,
  taggingBriefToCsv,
} from "../csm-tagging-brief";

describe("nabatiBatangasTaggingBrief", () => {
  it("names the people CSM already had on Batangas that Directory still had elsewhere", () => {
    const brief = nabatiBatangasTaggingBrief();
    const babadilla = brief.findings.find((row) => row.last_name === "Babadilla");
    assert.equal(babadilla?.greenhrismain_employee_id, 27143);
    assert.equal(babadilla?.csm_said, "Casual on Nabati Batangas");
    assert.equal(babadilla?.directory_had, "Active on Taytay");
    assert.equal(babadilla?.timesheet_tag, "Directory id present, site wrong");
  });

  it("calls out timesheet rows that had no Directory person (CSM already did)", () => {
    const cadacio = nabatiBatangasTaggingBrief().findings.find(
      (row) => row.last_name === "Cadacio"
    );
    assert.equal(cadacio?.greenhrismain_employee_id, 12980);
    assert.equal(cadacio?.timesheet_tag, "Untagged");
    assert.match(cadacio?.csm_said ?? "", /Raymund|Raymond/);
  });

  it("flags a second GREENHRISMAIN 201 created after resign", () => {
    const anonuevo = nabatiBatangasTaggingBrief().findings.filter(
      (row) => row.last_name === "Añonuevo"
    );
    assert.equal(anonuevo.length, 2);
    const codes = anonuevo.map((row) => row.employee_code).sort();
    assert.deepEqual(codes, ["202211-00036", "202506-00194"]);
  });

  it("exports a CSV stakeholders can open in Excel without SQL Server", () => {
    const csv = taggingBriefToCsv(nabatiBatangasTaggingBrief());
    assert.match(csv, /greenhrismain_employee_id/);
    assert.match(csv, /27143/);
    assert.match(csv, /Taytay/);
    assert.match(csv, /Untagged/);
  });
});

describe("taggingBriefToPdf", () => {
  it("writes a PDF stakeholders can print without opening SQL Server", async () => {
    const { taggingBriefToPdf } = await import("../csm-tagging-brief-pdf");
    const { NABATI_BATANGAS_RATE_GAPS } = await import("../csm-tagging-brief");
    const bytes = taggingBriefToPdf(nabatiBatangasTaggingBrief(), {
      rateRows: NABATI_BATANGAS_RATE_GAPS,
    });
    assert.equal(Buffer.from(bytes.subarray(0, 4)).toString("latin1"), "%PDF");
    const text = Buffer.from(bytes).toString("latin1");
    assert.match(text, /Babadilla/);
    assert.match(text, /27143/);
    assert.match(text, /CSM is the source of who is actually deployed/);
    assert.match(text, /daily rate vs last office scrape/);
    assert.match(text, /16797/);
    assert.match(text, /278,469/);
    assert.match(text, /posted 5 Sep 2026/);
  });
});
