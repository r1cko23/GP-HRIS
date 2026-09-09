/**
 * Printable stakeholder PDF of the CSM vs Directory tagging brief.
 * Helvetica (no office SQL Server, no live fetch).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  TAGGING_KIND_LABEL,
  type TaggingBrief,
  type TaggingRateRow,
} from "./csm-tagging-brief";

const GP_GREEN: [number, number, number] = [46, 125, 50];

function pdfName(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function wrap(doc: jsPDF, text: string, x: number, y: number, maxWidth: number): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * 5;
}

export function taggingBriefToPdf(
  brief: TaggingBrief,
  extra?: { rateRows?: TaggingRateRow[] }
): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFillColor(...GP_GREEN);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Green Pasture People Management Inc.", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Why CSM + GP-HRIS can replace GREENHRISMAIN employee management", margin, 20);

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${pdfName(brief.site)} · ${brief.cutoff}`, margin, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = wrap(
    doc,
    "GREENHRISMAIN is the old 201 / payroll file. It no longer stays current: wrong plant, stale daily rate, resigned people still Active, and a second Employee_id after resign instead of rehire. CSM Verified is the source of who is actually deployed — present, site, Casual vs Resigned. Directory keeps the person, employee code, and rates. GP did not log into office SQL Server. GREENHRISMAIN Employee_id below is Directory legacy_id.",
    margin,
    46,
    pageW - margin * 2
  );

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("What to say in the room", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = wrap(
    doc,
    "CSM is the source of who is actually deployed. The 201 should follow that person, not invent a new ID. Seven people on this DTR could not enter payroll until we used the CSM Directory id. Four were still sitting on Taytay, Laguna, or Baesa. Two have two live employee numbers for one person. Rates live on the Directory person and the position card — CSM has no daily_rate column.",
    margin,
    y,
    pageW - margin * 2
  );

  autoTable(doc, {
    startY: y + 4,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold" },
    },
    body: [
      ["Who is on this site", "CSM Verified (not GREENHRISMAIN)"],
      ["On the timesheet", String(brief.timesheet_people)],
      ["Hours rows before CSM align", String(brief.ingested_before_align)],
      ["Hours rows after CSM align", String(brief.ingested_after_align)],
      ["Exceptions in this brief", String(brief.findings.length)],
      ["Posted register", "27 lines \u00b7 gross PHP 278,469.61 \u00b7 posted 5 Sep 2026"],
    ],
  });

  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? y) + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("How to walk GREENHRISMAIN", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const steps = [
    "1. Open CSM · Nabati Batangas · Verified. That list is who is actually deployed this cycle (27 Casual on the DTR, plus 3 Resigned). GREENHRISMAIN is not that list.",
    "2. Open GREENHRISMAIN Employee_id 27143 (Babadilla). That 201 was still on Taytay. Same person, wrong plant. Dayto is Laguna; Mazo and Umali are Baesa.",
    "3. Open Employee_id 16797 and 25682 (Anonuevo). Two 201s. CSM points at 16797. Ops created 25682 after resign instead of rehire. Rubi is 20586 vs 24741.",
    "4. Show GP cutoff ingest: 20 hours rows, then 27 after we applied CSM's tag. We did not insert anyone. Going forward, CSM Approve / Transfer / Resign writes the same Directory person.",
    "5. Rate lag: the original 201 still carried the old daily rate (540 / 546 / Dayto 677.25). GP lifted from the later 201 or the Batangas position card. Billing daily rate is still 0 — not copied from payroll. Register is posted 5 Sep 2026. July office PDF is a different cutoff — names match; pesos will not.",
  ];
  for (const step of steps) {
    y = wrap(doc, step, margin, y, pageW - margin * 2) + 2;
  }

  doc.addPage("a4", "landscape");
  const landW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Exceptions vs CSM Verified", margin, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "Source: CSM Verified Nabati Batangas · Directory backfill 5 Sep 2026 · timesheet Aug 16-31 2026. Office SQL Server not queried.",
    margin,
    22
  );

  autoTable(doc, {
    startY: 26,
    head: [
      [
        "Kind",
        "Name",
        "201 code",
        "GH id",
        "CSM said",
        "Directory had",
        "Timesheet",
        "GP did",
      ],
    ],
    body: brief.findings.map((row) => [
      TAGGING_KIND_LABEL[row.kind],
      pdfName(`${row.last_name}, ${row.first_name}`),
      row.employee_code,
      String(row.greenhrismain_employee_id),
      pdfName(row.csm_said),
      pdfName(row.directory_had),
      pdfName(row.timesheet_tag),
      pdfName(row.gp_did),
    ]),
    styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
    headStyles: { fillColor: GP_GREEN, textColor: 255, fontStyle: "bold" },
    margin: { left: margin, right: margin },
    tableWidth: landW - margin * 2,
  });

  const rateRows = extra?.rateRows?.filter(
    (row) => Math.abs(row.directory_daily_rate - row.office_daily_rate) > 0.02
  );
  if (rateRows?.length) {
    doc.addPage("a4", "landscape");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Appendix — 201 daily rate vs last office scrape", margin, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      "Snapshot of what the 201 still carried before GP followed the position card / later 201. Office column is Payrollsummary_EDD BATANGAS.pdf 16-31 Jul 2026 (same 27 names; previous cutoff — not August money proof). Billing daily rate is still 0 — not copied from payroll.",
      margin,
      22,
      { maxWidth: doc.internal.pageSize.getWidth() - margin * 2 }
    );
    autoTable(doc, {
      startY: 34,
      margin: { left: margin, right: margin },
      tableWidth: doc.internal.pageSize.getWidth() - margin * 2,
      head: [
        [
          "Name",
          "201 code",
          "GH id",
          "Directory rate",
          "Office scrape",
          "Note",
        ],
      ],
      body: rateRows.map((row) => [
        pdfName(row.name),
        row.employee_code,
        String(row.greenhrismain_employee_id),
        row.directory_daily_rate.toFixed(2),
        row.office_daily_rate.toFixed(2),
        pdfName(row.note),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: GP_GREEN, textColor: 255 },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Confidential · GP-HRIS · page ${i} of ${pages} · GREENHRISMAIN not modified`,
      margin,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
