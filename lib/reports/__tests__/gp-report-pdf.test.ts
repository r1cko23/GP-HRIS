import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GP_COMPANY_NAME,
  createGpLandscapeReport,
  loadGpLogoDataUrl,
  resetGpLogoCacheForTests,
  stampGpReportFooter,
} from "../gp-report-pdf";

describe("createGpLandscapeReport", () => {
  it("opens landscape A4 with company name and title", () => {
    resetGpLogoCacheForTests();
    const { doc, pageWidth, pageHeight, contentTop } = createGpLandscapeReport({
      title: "Debit memo",
      subtitle: "BILL-2026-09-16-2026-09-30",
    });
    assert.ok(pageWidth > pageHeight, "page is landscape");
    assert.ok(contentTop > 20);
    const bytes = Buffer.from(doc.output("arraybuffer"));
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "%PDF");
    const text = bytes.toString("latin1");
    assert.match(text, /Debit memo/);
    assert.match(text, new RegExp(GP_COMPANY_NAME.replace(/\./g, "\\.")));
  });

  it("loads the public GP logo when present", () => {
    resetGpLogoCacheForTests();
    const logo = loadGpLogoDataUrl();
    assert.ok(logo);
    assert.match(logo!, /^data:image\/webp;base64,/);
  });
});

describe("stampGpReportFooter", () => {
  it("writes page markers without throwing", () => {
    const { doc } = createGpLandscapeReport({ title: "Test" });
    stampGpReportFooter(doc);
    const text = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    assert.match(text, /page 1 of 1/);
  });
});
