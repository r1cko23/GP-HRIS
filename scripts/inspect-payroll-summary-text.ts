import fs from "fs";
import path from "path";
import { extractPdfText } from "../lib/payroll-summary/extract-pdf-text";

const files = process.argv.slice(2);
const defaults = [
  "samples/payroll-registers/NIKKEI_MAY 16-30, 2026/TERRAZA EDSA SHANG INC/PAYROLL SUMMARY_NIKKEI.pdf",
  "samples/payroll-registers/VIVENTIS  MAY 16-31, 2026/Payroll Summary_VIVENTIS.pdf",
  "samples/payroll-registers/NABATI MAY 1-15, 2026/EDD_LAGUNA/Payrollsummary_LAGUNA.pdf",
  "samples/payroll-registers/LEVELWEAR MAY 01-15, 2026/PAYROLL SUMMARY_ LEVELWEAR.pdf",
  "samples/payroll-registers/VOUNO MAY 1-15, 2026/Payroll Summary_VOUNO.pdf",
];

async function main() {
  for (const f of files.length ? files : defaults) {
    const buf = fs.readFileSync(f);
    const text = await extractPdfText(buf);
    console.log(`\n===== ${path.basename(f)} (${text.length} chars) =====`);
    console.log(text.slice(0, 3000));
    const totalLine = text
      .split(/\r?\n/)
      .find((l) => /^Total\s/i.test(l) || /^TOTAL\s/i.test(l));
    console.log("\nTOTAL LINE:", totalLine ?? "(none)");
    const periodLine = text.match(
      /\d{1,2}\/\d{1,2}\/\d{4}\s+to\s+\d{1,2}\/\d{1,2}\/\d{4}/i
    );
    console.log("PERIOD:", periodLine?.[0] ?? "(none)");
  }
}

main().catch(console.error);
