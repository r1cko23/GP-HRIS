#!/usr/bin/env node
/**
 * Benchmark payroll PDF extraction: native pdf-parse vs OCR.space vs Google Vision.
 *
 * Requires .env.local:
 *   OCR_SPACE_API_KEY (optional)
 *   GOOGLE_APPLICATION_CREDENTIALS and/or GOOGLE_CLOUD_CREDENTIALS (optional)
 *
 * Usage:
 *   npx tsx scripts/benchmark-ocr-sources.js
 *   npx tsx scripts/benchmark-ocr-sources.js "PAYROLL SUMMARY_CHICHA HUT_1-15.pdf"
 */

require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const requireCjs = createRequire(__filename);
const OCR_MAX = 1 * 1024 * 1024;

const SOURCES = ["native", "ocr-space", "google-vision"];

async function extractNative(buffer) {
  const { PDFParse } = requireCjs("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

function unmappedGross(metrics, buildPeriodComposition) {
  const comp = buildPeriodComposition(metrics, "gross");
  return comp.slices.find((s) => s.key === "other")?.value ?? 0;
}

function grossDrift(metrics) {
  const sum = metrics.employees.reduce((s, e) => s + (e.grossAmount ?? 0), 0);
  return Math.abs(sum - metrics.grossAmountTotal);
}

function grade(metrics, score, unmapped, drift, err) {
  if (err || !metrics) return 0;
  let g = score;
  if (unmapped <= 1) g += 10;
  else if (unmapped <= 50) g += 5;
  if (drift <= 1) g += 10;
  else if (drift <= 50) g += 5;
  if (metrics.employeeCount >= 1) g += 3;
  return g;
}

function fmt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return typeof n === "number" ? n.toFixed(2) : String(n);
}

async function main() {
  const { collectPayrollSummaryPdfs } = require("./payroll-sample-utils");
  const { scorePayrollPdfText } = await import(
    "../lib/payroll-summary/pdf-text-quality.ts"
  );
  const { parsePayrollRegisterText } = await import(
    "../lib/payroll-summary/parse-payroll-register-pdf.ts"
  );
  const { buildPeriodComposition } = await import(
    "../lib/payroll-summary/composition-chart.ts"
  );
  const { extractPdfTextWithOcrSpace, isOcrSpaceConfigured } = await import(
    "../lib/payroll-summary/ocr-space.ts"
  );
  const {
    extractPdfTextWithGoogleVision,
    isGoogleVisionConfigured,
    GOOGLE_VISION_MAX_BYTES,
  } = await import("../lib/payroll-summary/google-vision.ts");

  const allFlag = process.argv.includes("--all");
  const explicit = process.argv
    .slice(2)
    .filter((a) => a.endsWith(".pdf"));

  const extra = [
    "PAYROLL SUMMARY_CHICHA HUT_1-15.pdf",
    "PAYROLL SUMMARY_CHICHA HUT_16-31.pdf",
    "Payroll summary_CONVERGE_1-15.pdf",
    "Payroll summary_converge_16-31.pdf",
  ].map((n) => path.join(process.cwd(), n));

  let pdfs =
    explicit.length > 0
      ? explicit.map((p) => ({ key: path.basename(p), absPath: path.resolve(p) }))
      : collectPayrollSummaryPdfs({ includeAll: false, extraPaths: extra });

  if (!allFlag && explicit.length === 0) {
    pdfs = pdfs.filter(({ absPath }) => extra.includes(absPath));
  }

  console.log("=== Payroll OCR benchmark ===\n");
  const visionReady = isGoogleVisionConfigured();
  console.log(
    `Sources: native=always | ocr-space=${isOcrSpaceConfigured() ? "yes" : "NO KEY"} | google-vision=${visionReady ? "yes" : "NO VALID CREDS"}`
  );
  if (!visionReady && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log(
      "  ↳ GOOGLE_APPLICATION_CREDENTIALS points to a missing file — fix path or paste JSON into GOOGLE_CLOUD_CREDENTIALS"
    );
  }
  console.log(`\nPDFs: ${pdfs.length} (use --all for full samples folder)\n`);

  const summary = { native: 0, "ocr-space": 0, "google-vision": 0, tie: 0 };

  for (const { key, absPath } of pdfs) {
    if (!fs.existsSync(absPath)) {
      console.log(`SKIP (missing): ${key}\n`);
      continue;
    }

    const buf = fs.readFileSync(absPath);
    const sizeMb = (buf.byteLength / 1024 / 1024).toFixed(2);
    console.log(`━━━ ${key} (${sizeMb} MB) ━━━`);

    const results = {};

    for (const source of SOURCES) {
      const row = {
        ok: false,
        score: null,
        err: null,
        employees: null,
        gross: null,
        net: null,
        unmapped: null,
        drift: null,
        grade: 0,
        chars: 0,
      };
      results[source] = row;

      try {
        if (source === "ocr-space") {
          if (!isOcrSpaceConfigured()) {
            row.err = "OCR_SPACE_API_KEY not set";
            continue;
          }
          if (buf.byteLength > OCR_MAX) {
            row.err = `over ${OCR_MAX / 1024 / 1024}MB OCR.space limit`;
            continue;
          }
        }
        if (source === "google-vision") {
          if (!isGoogleVisionConfigured()) {
            row.err = "Google credentials not set";
            continue;
          }
          if (buf.byteLength > GOOGLE_VISION_MAX_BYTES) {
            row.err = "over Vision size limit";
            continue;
          }
        }

        let text = "";
        if (source === "native") {
          text = await extractNative(buf);
        } else if (source === "ocr-space") {
          text = await extractPdfTextWithOcrSpace(buf);
        } else {
          text = await extractPdfTextWithGoogleVision(buf);
        }

        row.chars = text.length;
        row.score = scorePayrollPdfText(text);
        const metrics = await parsePayrollRegisterText(text);
        row.ok = true;
        row.employees = metrics.employeeCount;
        row.gross = metrics.grossAmountTotal;
        row.net = metrics.netAmountTotal;
        row.unmapped = unmappedGross(metrics, buildPeriodComposition);
        row.drift = grossDrift(metrics);
        row.grade = grade(
          metrics,
          row.score,
          row.unmapped,
          row.drift,
          null
        );
      } catch (e) {
        row.err = e instanceof Error ? e.message : String(e);
      }
    }

    const labels = {
      native: "Native (pdf-parse)",
      "ocr-space": "OCR.space",
      "google-vision": "Google Vision",
    };

    console.log(
      "| Source          | Score | Grade | Emp | Gross      | Net        | Unmapped | Drift  | Chars  |"
    );
    console.log(
      "|-----------------|-------|-------|-----|------------|------------|----------|--------|--------|"
    );

    for (const source of SOURCES) {
      const r = results[source];
      if (r.err) {
        console.log(
          `| ${labels[source].padEnd(15)} |  —    |  —    |  —  | FAIL: ${r.err.slice(0, 40)}`
        );
        continue;
      }
      console.log(
        `| ${labels[source].padEnd(15)} | ${String(r.score).padStart(5)} | ${String(r.grade).padStart(5)} | ${String(r.employees).padStart(3)} | ${("₱" + fmt(r.gross)).padStart(10)} | ${("₱" + fmt(r.net)).padStart(10)} | ${("₱" + fmt(r.unmapped)).padStart(8)} | ${("₱" + fmt(r.drift)).padStart(6)} | ${String(r.chars).padStart(6)} |`
      );
    }

    const ranked = SOURCES.filter((s) => results[s].ok).sort(
      (a, b) => results[b].grade - results[a].grade
    );
    if (ranked.length === 0) {
      console.log("\nWinner: none (all failed)\n");
      continue;
    }
    const best = ranked[0];
    const tied = ranked.filter((s) => results[s].grade === results[best].grade);
    const winner = tied.length > 1 ? "tie" : best;
    if (winner === "tie") {
      summary.tie++;
      console.log(`\nWinner: tie (${tied.map((s) => labels[s]).join(", ")}) — grade ${results[best].grade}\n`);
    } else {
      summary[winner]++;
      console.log(`\nWinner: ${labels[winner]} (grade ${results[winner].grade})\n`);
    }
  }

  console.log("=== Overall winners ===");
  console.log(`Native:        ${summary.native}`);
  console.log(`OCR.space:     ${summary["ocr-space"]}`);
  console.log(`Google Vision: ${summary["google-vision"]}`);
  console.log(`Ties:          ${summary.tie}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
