/**
 * Resolve which payroll-audit client a register PDF should land on.
 * Priority: PDF companyName → parent folder (folder bulk) → filename token.
 */

const PERIOD_FOLDER =
  /\b(jan|feb|mar|apr|may|jun|july|jul|aug|sep|oct|nov|dec|january|february|march|april|june|august|september|october|november|december)\b|\d{1,2}\s*[-–]\s*\d{1,2}|\d{4}/i;

const WINDOWS_COPY_SUFFIX = /\s*\(\d+\)\s*$/;

export function isPlausibleCompanyName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 160) return false;
  if (/^\d+\.\s/.test(trimmed)) return false;
  if (/^[\d,.\s\-₱]+$/.test(trimmed)) return false;
  if (/\d{1,3}\.\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+,/.test(trimmed)) {
    return false;
  }
  if (/Daily Rate|Gross Amt|Cuttoff|Salaries and Wages/i.test(trimmed)) {
    return false;
  }
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(trimmed);
}

export function cleanAuditClientName(name: string): string {
  return name
    .replace(/\s*System\.Data\.DataRowView\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `PAYROLL SUMMARY_NIKKEI (2).pdf` → `NIKKEI` */
export function clientNameFromPayrollSummaryFileName(
  fileName: string
): string | null {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(WINDOWS_COPY_SUFFIX, "")
    .trim();

  const match = base.match(
    /^(?:payroll\s*summary|payrollsummary)(?:\s*[_-]|\s+)(.+)$/i
  );
  if (!match) return null;

  let token = match[1].trim();
  // Drop trailing cutoff phrases: "VIVENTIS JULY 16-24, 2026"
  token = token
    .replace(
      /\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?).*$/i,
      ""
    )
    .trim();

  return token.length >= 2 ? token : null;
}

/**
 * From `webkitRelativePath` / folder bulk paths, pick the nearest non-period
 * parent folder (often the branch / site name under a client cutoff folder).
 */
export function clientNameFromRelativePath(
  relativePath: string | null | undefined
): string | null {
  if (!relativePath) return null;
  const parts = relativePath
    .split(/[/\\]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  // Walk up from the file's parent
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i].replace(WINDOWS_COPY_SUFFIX, "").trim();
    if (part.length < 2) continue;
    if (/^5th|^20th|for reporting$/i.test(part)) continue;
    if (PERIOD_FOLDER.test(part) && !/\bINC\.?\b|\bCORP\.?\b/i.test(part)) {
      // Period-ish folder like "NIKKEI JULY 16-24, 2026" → strip to brand
      const brand = part
        .replace(
          /\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?).*$/i,
          ""
        )
        .replace(/[_-]+$/, "")
        .trim();
      if (brand.length >= 2 && !PERIOD_FOLDER.test(brand)) return brand;
      continue;
    }
    return part;
  }
  return null;
}

export interface ResolveAuditClientNameInput {
  fileName: string;
  /** Browser folder upload path, e.g. `NIKKEI JULY/TERRAZA EDSA/Payroll summary.pdf` */
  relativePath?: string | null;
  /** Parsed from PDF text when available */
  pdfCompanyName?: string | null;
}

export function resolveAuditClientName(
  input: ResolveAuditClientNameInput
): string {
  const fromPdf = input.pdfCompanyName
    ? cleanAuditClientName(input.pdfCompanyName)
    : null;
  if (isPlausibleCompanyName(fromPdf)) return fromPdf!;

  const fromPath = clientNameFromRelativePath(input.relativePath);
  if (isPlausibleCompanyName(fromPath)) return cleanAuditClientName(fromPath!);

  const fromFile = clientNameFromPayrollSummaryFileName(input.fileName);
  if (isPlausibleCompanyName(fromFile)) return cleanAuditClientName(fromFile!);

  const fallback = input.fileName.replace(/\.[^.]+$/, "").trim() || "Unknown client";
  return cleanAuditClientName(fallback);
}
