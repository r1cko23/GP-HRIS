/**
 * Stakeholder pack: CSV + PDF of CSM vs Directory tagging (no SQL Server).
 *
 *   npx tsx scripts/export-csm-tagging-brief.ts
 */
import fs from "fs";
import path from "path";
import {
  NABATI_BATANGAS_RATE_GAPS,
  nabatiBatangasTaggingBrief,
  taggingBriefToCsv,
} from "../lib/directory/csm-tagging-brief";
import { taggingBriefToPdf } from "../lib/directory/csm-tagging-brief-pdf";

const brief = nabatiBatangasTaggingBrief();
const outDir = path.resolve(__dirname, "..", "docs");
const csvPath = path.join(outDir, "nabati-batangas-csm-tagging-brief.csv");
const pdfPath = path.join(outDir, "nabati-batangas-csm-tagging-brief.pdf");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(csvPath, taggingBriefToCsv(brief) + "\n");
fs.writeFileSync(
  pdfPath,
  taggingBriefToPdf(brief, { rateRows: NABATI_BATANGAS_RATE_GAPS })
);

process.stderr.write(
  `${brief.site} ${brief.cutoff} · ${brief.findings.length} exceptions · ${NABATI_BATANGAS_RATE_GAPS.length} rate gaps\n`
);
process.stderr.write(`CSV ${csvPath}\n`);
process.stderr.write(`PDF ${pdfPath}\n`);
