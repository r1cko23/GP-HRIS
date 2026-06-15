#!/usr/bin/env node
/**
 * Compare pdf-parse vs OCR.space extraction on payroll register PDFs.
 * Reports unmapped composition, gross/net drift, and which source parses better.
 *
 * Usage:
 *   node scripts/compare-ocr-vs-native.js
 *   node scripts/compare-ocr-vs-native.js --ocr-only-problems
 *   node scripts/compare-ocr-vs-native.js path/to/file.pdf
 */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const requireCjs = createRequire(__filename);

const OCR_MAX = 1 * 1024 * 1024;
const args = process.argv.slice(2);
const ocrOnlyProblems = args.includes("--ocr-only-problems");
const nativeOnly = args.includes("--native-only");
const explicit = args.filter((a) => !a.startsWith("--") && a.endsWith(".pdf"));

let buildPeriodComposition;

async function loadModules() {
  ({ buildPeriodComposition } = await import(
    "../lib/payroll-summary/composition-chart.ts"
  ));
}

function unmappedGross(metrics) {
  const comp = buildPeriodComposition(metrics, "gross");
  const other = comp.slices.find((s) => s.key === "other");
  return other?.value ?? 0;
}

function employeeGrossDrift(metrics) {
  const sum = metrics.employees.reduce((s, e) => s + (e.grossAmount ?? 0), 0);
  return Math.abs(sum - metrics.grossAmountTotal);
}

async function parseText(text) {
  const { parsePayrollRegisterText } = await import(
    "../lib/payroll-summary/parse-payroll-register-pdf.ts"
  );
  return parsePayrollRegisterText(text);
}

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

async function main() {
  await loadModules();
  const { collectPayrollSummaryPdfs } = require("./payroll-sample-utils");
  const { scorePayrollPdfText } = await import(
    "../lib/payroll-summary/pdf-text-quality.ts"
  );
  const { extractPdfTextWithOcrSpace, isOcrSpaceConfigured } = await import(
    "../lib/payroll-summary/ocr-space.ts"
  );

  if (!nativeOnly && !isOcrSpaceConfigured()) {
    console.error("Set OCR_SPACE_API_KEY to run OCR comparisons.");
    process.exit(1);
  }

  const extra = [
    "PAYROLL SUMMARY_CHICHA HUT_1-15.pdf",
    "PAYROLL SUMMARY_CHICHA HUT_16-31.pdf",
  ].map((n) => path.join(process.cwd(), n));

  const pdfs =
    explicit.length > 0
      ? explicit.map((p) => ({ key: p, absPath: path.resolve(p) }))
      : collectPayrollSummaryPdfs({ includeAll: false, extraPaths: extra });

  const nativeProblems = [];

  for (const { key, absPath } of pdfs) {
    const buf = fs.readFileSync(absPath);
    const size = buf.byteLength;
    let nativeMetrics = null;
    let nativeErr = null;
    try {
      const text = await extractNative(buf);
      nativeMetrics = await parseText(text);
    } catch (e) {
      nativeErr = e instanceof Error ? e.message : String(e);
    }

    if (!nativeMetrics) {
      nativeProblems.push({
        key,
        size,
        nativeErr,
        unmapped: null,
        grossDrift: null,
        gross: null,
        net: null,
        employees: null,
      });
      continue;
    }

    const unmapped = unmappedGross(nativeMetrics);
    const grossDrift = employeeGrossDrift(nativeMetrics);
    const row = {
      key,
      size,
      nativeErr: null,
      unmapped,
      grossDrift,
      gross: nativeMetrics.grossAmountTotal,
      net: nativeMetrics.netAmountTotal,
      employees: nativeMetrics.employeeCount,
      format: nativeMetrics.sourceFormat,
    };

    if (unmapped > 1 || grossDrift > 1 || nativeErr) {
      nativeProblems.push(row);
    }
  }

  console.log(`Scanned ${pdfs.length} PDFs — ${nativeProblems.length} with native issues (unmapped > ₱1 or gross drift > ₱1 or parse fail)\n`);

  if (nativeOnly) {
    nativeProblems
      .sort((a, b) => (b.unmapped ?? 0) - (a.unmapped ?? 0))
      .forEach((p) => {
        console.log(
          `• ${p.key}\n  unmapped ₱${(p.unmapped ?? 0).toFixed(2)} | gross drift ₱${(p.grossDrift ?? 0).toFixed(2)} | gross ₱${(p.gross ?? 0).toFixed(2)} | ${p.employees ?? "?"} emp${p.nativeErr ? ` | FAIL ${p.nativeErr}` : ""}`
        );
      });
    return;
  }

  const targets = ocrOnlyProblems
    ? nativeProblems.filter((p) => p.size <= OCR_MAX)
    : pdfs
        .filter(({ absPath }) => {
          const buf = fs.readFileSync(absPath);
          return buf.byteLength <= OCR_MAX;
        })
        .slice(0, 30);

  const ocrTargets =
    ocrOnlyProblems && nativeProblems.length > 0
      ? nativeProblems
          .filter((p) => p.size <= OCR_MAX)
          .map((p) => ({ key: p.key, absPath: pdfs.find((x) => x.key === p.key)?.absPath }))
          .filter((x) => x.absPath)
      : targets;

  const comparisons = [];

  for (const { key, absPath } of ocrTargets) {
    const buf = fs.readFileSync(absPath);
    const nativeText = await extractNative(buf);
    const nativeScore = scorePayrollPdfText(nativeText);

    let nativeMetrics = null;
    let nativeErr = null;
    try {
      nativeMetrics = await parseText(nativeText);
    } catch (e) {
      nativeErr = e instanceof Error ? e.message : String(e);
    }

    let ocrText = null;
    let ocrScore = null;
    let ocrMetrics = null;
    let ocrErr = null;
    try {
      ocrText = await extractPdfTextWithOcrSpace(buf);
      ocrScore = scorePayrollPdfText(ocrText);
      ocrMetrics = await parseText(ocrText);
    } catch (e) {
      ocrErr = e instanceof Error ? e.message : String(e);
    }

    const nativeUnmapped = nativeMetrics ? unmappedGross(nativeMetrics) : null;
    const ocrUnmapped = ocrMetrics ? unmappedGross(ocrMetrics) : null;
    const nativeDrift = nativeMetrics ? employeeGrossDrift(nativeMetrics) : null;
    const ocrDrift = ocrMetrics ? employeeGrossDrift(ocrMetrics) : null;

    const ocrBetter =
      ocrMetrics &&
      nativeMetrics &&
      (ocrUnmapped < nativeUnmapped - 0.5 ||
        ocrDrift < nativeDrift - 0.5 ||
        (nativeErr && !ocrErr));
    const nativeBetter =
      nativeMetrics &&
      (!ocrMetrics ||
        nativeUnmapped < (ocrUnmapped ?? Infinity) - 0.5 ||
        nativeDrift < (ocrDrift ?? Infinity) - 0.5);

    comparisons.push({
      key,
      size: buf.byteLength,
      nativeScore,
      ocrScore,
      nativeErr,
      ocrErr,
      nativeUnmapped,
      ocrUnmapped,
      nativeDrift,
      ocrDrift,
      nativeGross: nativeMetrics?.grossAmountTotal ?? null,
      ocrGross: ocrMetrics?.grossAmountTotal ?? null,
      nativeNet: nativeMetrics?.netAmountTotal ?? null,
      ocrNet: ocrMetrics?.netAmountTotal ?? null,
      winner: ocrBetter && !nativeBetter ? "ocr" : nativeBetter ? "native" : "tie",
    });
  }

  const ocrWins = comparisons.filter((c) => c.winner === "ocr");
  const nativeWins = comparisons.filter((c) => c.winner === "native");
  const ties = comparisons.filter((c) => c.winner === "tie");

  console.log("=== OCR vs native comparison ===");
  console.log(`Compared: ${comparisons.length}`);
  console.log(`OCR better: ${ocrWins.length}`);
  console.log(`Native better: ${nativeWins.length}`);
  console.log(`Tie / inconclusive: ${ties.length}\n`);

  function printRow(c) {
    console.log(`• ${c.key}`);
    console.log(
      `  scores native=${c.nativeScore} ocr=${c.ocrScore ?? "n/a"} | winner=${c.winner}`
    );
    if (c.nativeErr) console.log(`  native FAIL: ${c.nativeErr}`);
    if (c.ocrErr) console.log(`  ocr FAIL: ${c.ocrErr}`);
    console.log(
      `  unmapped: native ₱${(c.nativeUnmapped ?? 0).toFixed(2)} → ocr ₱${(c.ocrUnmapped ?? 0).toFixed(2)}`
    );
    console.log(
      `  gross drift: native ₱${(c.nativeDrift ?? 0).toFixed(2)} → ocr ₱${(c.ocrDrift ?? 0).toFixed(2)}`
    );
    if (c.nativeGross != null && c.ocrGross != null && Math.abs(c.nativeGross - c.ocrGross) > 0.5) {
      console.log(
        `  gross total: native ₱${c.nativeGross.toFixed(2)} vs ocr ₱${c.ocrGross.toFixed(2)}`
      );
    }
    if (c.nativeNet != null && c.ocrNet != null && Math.abs(c.nativeNet - c.ocrNet) > 0.5) {
      console.log(
        `  net total: native ₱${c.nativeNet.toFixed(2)} vs ocr ₱${c.ocrNet.toFixed(2)}`
      );
    }
    console.log("");
  }

  if (ocrWins.length > 0) {
    console.log("--- OCR improved parsing ---");
    ocrWins.sort((a, b) => (b.nativeUnmapped ?? 0) - (a.nativeUnmapped ?? 0));
    ocrWins.slice(0, 15).forEach(printRow);
  } else {
    console.log("--- No files where OCR clearly beat native ---\n");
  }

  if (nativeWins.length > 0) {
    console.log("--- Native pdf-parse better (sample) ---");
    nativeWins
      .filter((c) => c.ocrErr || (c.ocrUnmapped ?? 0) > (c.nativeUnmapped ?? 0))
      .slice(0, 10)
      .forEach(printRow);
  }

  if (nativeProblems.length > 0 && ocrOnlyProblems) {
    console.log("--- Top native problems (unmapped) ---");
    nativeProblems
      .sort((a, b) => (b.unmapped ?? 0) - (a.unmapped ?? 0))
      .slice(0, 20)
      .forEach((p) => {
        console.log(
          `• ${p.key} | unmapped ₱${(p.unmapped ?? 0).toFixed(2)} | drift ₱${(p.grossDrift ?? 0).toFixed(2)} | ${p.employees ?? "?"} emp`
        );
      });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
