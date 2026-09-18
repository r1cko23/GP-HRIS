import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  loadGpLogoDataUrl,
  resetGpLogoCacheForTests,
} from "../gp-report-logo-node";
import {
  GP_COMPANY_NAME,
  GP_REPORT_FOOTER_RESERVE_MM,
  createGpLandscapeReport,
  fetchPublicGpLogoDataUrl,
  gpReportFooterBaselineY,
  gpReportTableBottomMargin,
  stampGpReportFooter,
} from "../gp-report-pdf";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const PRINT_LOGO = path.join(PUBLIC_DIR, "gp-logo.webp");
const ON_DARK_LOGO = path.join(PUBLIC_DIR, "gp-logo-on-dark.webp");
const BLACK_NOBG_EXPORT = path.join(
  process.cwd(),
  "assets",
  "logos",
  "GP-logo-nobg.webp"
);

describe("createGpLandscapeReport", () => {
  it("opens landscape A4 with company name and title", () => {
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

  it("embeds a provided logo data URL", () => {
    resetGpLogoCacheForTests();
    const logo = loadGpLogoDataUrl();
    assert.ok(logo);
    const { doc, contentTop } = createGpLandscapeReport({
      title: "Debit memo",
      logoDataUrl: logo,
    });
    assert.ok(contentTop > 20);
    const bytes = Buffer.from(doc.output("arraybuffer"));
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "%PDF");
  });
});

describe("loadGpLogoDataUrl", () => {
  it("loads the public GP logo from disk when present", () => {
    resetGpLogoCacheForTests();
    const logo = loadGpLogoDataUrl();
    assert.ok(logo);
    assert.match(logo!, /^data:image\/webp;base64,/);
  });

  it("keeps the print logo off the black on-dark / nobg exports", () => {
    // Topbar chrome once overwrote public/gp-logo.webp with a black-plate
    // lockup; Finance PDFs embed that path on white paper.
    const print = fs.readFileSync(PRINT_LOGO);
    const onDark = fs.readFileSync(ON_DARK_LOGO);
    const blackNobg = fs.readFileSync(BLACK_NOBG_EXPORT);
    assert.notEqual(
      print.equals(onDark),
      true,
      "print logo must not be gp-logo-on-dark.webp"
    );
    assert.notEqual(
      print.equals(blackNobg),
      true,
      "print logo must not be assets/logos/GP-logo-nobg.webp"
    );
    assert.ok(
      print.byteLength < 40_000,
      "print logo should stay the compact light lockup, not a dark export"
    );
  });
});

describe("fetchPublicGpLogoDataUrl", () => {
  it("returns a data URL when fetch succeeds", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const logo = await fetchPublicGpLogoDataUrl(async () =>
      new Response(bytes, { status: 200 })
    );
    assert.equal(logo, `data:image/webp;base64,${Buffer.from(bytes).toString("base64")}`);
  });

  it("returns null when fetch is not ok", async () => {
    const logo = await fetchPublicGpLogoDataUrl(
      async () => new Response("", { status: 404 })
    );
    assert.equal(logo, null);
  });

  it("returns null when fetch throws", async () => {
    const logo = await fetchPublicGpLogoDataUrl(async () => {
      throw new Error("offline");
    });
    assert.equal(logo, null);
  });
});

describe("stampGpReportFooter", () => {
  it("writes page markers without throwing", () => {
    const { doc } = createGpLandscapeReport({ title: "Test" });
    stampGpReportFooter(doc);
    const text = Buffer.from(doc.output("arraybuffer")).toString("latin1");
    assert.match(text, /page 1 of 1/);
  });

  it("reserves enough bottom space that footer sits below table margin", () => {
    assert.ok(GP_REPORT_FOOTER_RESERVE_MM >= 12);
    assert.equal(gpReportTableBottomMargin(6), GP_REPORT_FOOTER_RESERVE_MM);
    assert.equal(gpReportTableBottomMargin(14), 14);
    const { doc } = createGpLandscapeReport({ title: "Test" });
    const h = doc.internal.pageSize.getHeight();
    assert.equal(gpReportFooterBaselineY(doc), h - 5);
    assert.ok(
      gpReportFooterBaselineY(doc) > h - GP_REPORT_FOOTER_RESERVE_MM,
      "footer baseline stays inside the reserved band"
    );
  });
});
