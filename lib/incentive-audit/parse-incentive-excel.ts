import * as XLSX from "xlsx";
import { normalizeEmployeeName } from "@/lib/payroll-summary/normalize-name";
import type { IncentiveCandidateRow, IncentiveSheet } from "./types";

const SHEET_ALIASES: Record<string, IncentiveSheet> = {
  "NON-HOTEL": "NON-HOTEL",
  "NON HOTEL": "NON-HOTEL",
  NONHOTEL: "NON-HOTEL",
  HOTEL: "HOTEL",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function excelSerialToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const y = String(parsed.y).padStart(4, "0");
    const m = String(parsed.m).padStart(2, "0");
    const d = String(parsed.d).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = String(value).trim();
  if (!text) return null;
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function toText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function findColumn(
  headers: string[],
  predicates: Array<(h: string) => boolean>
): number {
  for (const predicate of predicates) {
    const idx = headers.findIndex(predicate);
    if (idx >= 0) return idx;
  }
  return -1;
}

function mapSheetName(name: string): IncentiveSheet | null {
  const key = name.replace(/\s+/g, " ").trim().toUpperCase();
  return SHEET_ALIASES[key] ?? null;
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  sheetName: IncentiveSheet
): IncentiveCandidateRow[] {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  if (!matrix.length) return [];

  const headers = matrix[0].map(normalizeHeader);
  const candidateIdx = findColumn(headers, [
    (h) => h === "CANDIDATE",
    (h) => h.includes("CANDIDATE"),
    (h) => h === "NAME" || h.includes("EMPLOYEE NAME"),
  ]);
  if (candidateIdx < 0) {
    throw new Error(
      `Sheet "${sheetName}" is missing a CANDIDATE column. Use the INCENTIVES VERIFICATION format.`
    );
  }

  const industryIdx = findColumn(headers, [
    (h) => h.includes("INSDUSTRY") || h.includes("INDUSTRY"),
  ]);
  const branchIdx = findColumn(headers, [
    (h) => h.includes("BRANCH") || h.includes("CLIENT"),
  ]);
  const positionIdx = findColumn(headers, [(h) => h.includes("POSITION")]);
  const recruiterIdx = findColumn(headers, [(h) => h.includes("RECRUITER")]);
  const endorsementIdx = findColumn(headers, [(h) => h.includes("ENDORSEMENT")]);
  const deploymentIdx = findColumn(headers, [(h) => h.includes("DEPLOYMENT")]);
  const hrisIdx = findColumn(headers, [(h) => h.includes("HRIS VERIFICATION")]);
  const statusIdx = findColumn(headers, [
    (h) => h.startsWith("STATUS"),
    (h) => h.includes("VERIFIED") && h.includes("QUALIFIED"),
  ]);
  const hoursIdx = findColumn(headers, [(h) => h.includes("TOTAL HOURS")]);
  const daysIdx = findColumn(headers, [(h) => h.includes("TOTAL DAYS")]);
  const amountIdx = findColumn(headers, [
    (h) => h.includes("INCENTIVE AMOUNT") || h.includes("POSIBLE INCENTIVE"),
  ]);
  const notesIdx = findColumn(headers, [(h) => h.startsWith("NOTES")]);

  const rows: IncentiveCandidateRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    const candidateName = toText(raw[candidateIdx]);
    if (!candidateName) continue;

    const incentiveAmount = toNumber(raw[amountIdx]) ?? 0;
    const notesParts: string[] = [];
    const collectNote = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value) && value > 40000) {
        const iso = excelSerialToIso(value);
        if (iso) {
          notesParts.push(iso);
          return;
        }
      }
      const n = toText(value);
      if (n) notesParts.push(n);
    };
    if (notesIdx >= 0) {
      collectNote(raw[notesIdx]);
      for (let c = notesIdx + 1; c < headers.length; c++) {
        if (headers[c].startsWith("NOTES")) {
          collectNote(raw[c]);
        }
      }
    }

    rows.push({
      sheet: sheetName,
      rowIndex: i + 1,
      industry: industryIdx >= 0 ? toText(raw[industryIdx]) : null,
      candidateName,
      normalizedName: normalizeEmployeeName(candidateName),
      branchClient: branchIdx >= 0 ? toText(raw[branchIdx]) : null,
      position: positionIdx >= 0 ? toText(raw[positionIdx]) : null,
      recruiter: recruiterIdx >= 0 ? toText(raw[recruiterIdx]) : null,
      endorsementDate:
        endorsementIdx >= 0 ? excelSerialToIso(raw[endorsementIdx]) : null,
      deploymentDate:
        deploymentIdx >= 0 ? excelSerialToIso(raw[deploymentIdx]) : null,
      hrisVerification: hrisIdx >= 0 ? toText(raw[hrisIdx]) : null,
      status: statusIdx >= 0 ? toText(raw[statusIdx])?.toUpperCase() ?? null : null,
      totalHours: hoursIdx >= 0 ? toNumber(raw[hoursIdx]) : null,
      totalDays: daysIdx >= 0 ? toNumber(raw[daysIdx]) : null,
      incentiveAmount,
      notes: notesParts.length ? notesParts.join(" | ") : null,
    });
  }

  return rows;
}

export function parseIncentiveVerificationWorkbook(
  buffer: Buffer
): IncentiveCandidateRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const rows: IncentiveCandidateRow[] = [];
  let foundSheet = false;

  for (const sheetName of workbook.SheetNames) {
    const mapped = mapSheetName(sheetName);
    if (!mapped) continue;
    foundSheet = true;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    rows.push(...parseSheet(sheet, mapped));
  }

  if (!foundSheet) {
    throw new Error(
      'Workbook must include "NON-HOTEL" and/or "HOTEL" sheets (INCENTIVES VERIFICATION format).'
    );
  }

  if (rows.length === 0) {
    throw new Error("No candidate rows found in the workbook.");
  }

  return rows;
}
