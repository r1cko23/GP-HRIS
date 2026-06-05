import * as XLSX from "xlsx";
import { normalizeEmployeeName } from "./normalize-name";
import type { PlantillaEmployee, PlantillaMetrics } from "./types";

const NAME_HEADERS = [
  "employee name",
  "name",
  "full name",
  "employee",
  "emp name",
  "staff name",
];

function parseNameFromLine(line: string): string | null {
  const numbered = line.match(/^\d+\.\s+([A-Z][A-Z\s,\.-]+?)(?:\s+\d[\d,\.]*|\s*$)/);
  if (numbered) return numbered[1].trim();

  const plain = line.match(/^([A-Z][A-Z\s,\.-]{2,})$/);
  if (plain && plain[1].includes(",")) return plain[1].trim();

  return null;
}

function parseCsvPlantilla(text: string): PlantillaEmployee[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => NAME_HEADERS.includes(h.replace(/"/g, "")));

  const employees: PlantillaEmployee[] = [];
  const startRow = nameIdx >= 0 ? 1 : 0;

  for (let i = startRow; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
    const name = nameIdx >= 0 ? cols[nameIdx] : cols[0];
    if (!name || name.length < 3) continue;
    if (/^(total|employee|name)/i.test(name)) continue;
    employees.push({ name: name.trim() });
  }

  return employees;
}

function parseXlsxPlantilla(buffer: Buffer): PlantillaEmployee[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (rows.length === 0) return [];

  const keys = Object.keys(rows[0]);
  const nameKey =
    keys.find((k) => NAME_HEADERS.includes(k.trim().toLowerCase())) ?? keys[0];

  const rateKey = keys.find((k) =>
    /daily\s*rate|rate|per day/i.test(k)
  );
  const positionKey = keys.find((k) => /position|job|title/i.test(k));

  return rows
    .map((row) => {
      const name = String(row[nameKey] ?? "").trim();
      if (!name || name.length < 3) return null;
      if (/^(total|employee|name)/i.test(name)) return null;
      const employee: PlantillaEmployee = {
        name,
        dailyRate: rateKey
          ? Number(String(row[rateKey]).replace(/,/g, "")) || null
          : null,
        position: positionKey
          ? String(row[positionKey] ?? "").trim() || null
          : null,
      };
      return employee;
    })
    .filter((e): e is PlantillaEmployee => e !== null);
}

async function parsePdfPlantilla(buffer: Buffer): Promise<PlantillaEmployee[]> {
  const { extractPdfText } = await import("./extract-pdf-text");
  const text = await extractPdfText(buffer);
  const employees: PlantillaEmployee[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const name = parseNameFromLine(line.trim());
    if (!name) continue;
    const key = normalizeEmployeeName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    employees.push({ name });
  }

  return employees;
}

export async function parsePlantillaFile(
  buffer: Buffer,
  fileName: string
): Promise<PlantillaMetrics> {
  const lower = fileName.toLowerCase();
  let employees: PlantillaEmployee[] = [];
  let sourceFormat: PlantillaMetrics["sourceFormat"] = "csv";

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    employees = parseXlsxPlantilla(buffer);
    sourceFormat = "xlsx";
  } else if (lower.endsWith(".csv")) {
    employees = parseCsvPlantilla(buffer.toString("utf8"));
    sourceFormat = "csv";
  } else if (lower.endsWith(".pdf")) {
    employees = await parsePdfPlantilla(buffer);
    sourceFormat = "pdf";
  } else {
    throw new Error(
      "Unsupported plantilla format. Use CSV, Excel (.xlsx), or PDF."
    );
  }

  if (employees.length === 0) {
    throw new Error(
      "No employees found in plantilla. Check that the file has an Employee Name column or numbered name rows."
    );
  }

  return {
    documentType: "plantilla",
    employeeCount: employees.length,
    employees,
    sourceFormat,
  };
}
