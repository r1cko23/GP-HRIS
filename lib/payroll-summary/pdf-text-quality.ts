/** Heuristic quality score for payroll register PDF text (higher = better). */
export function scorePayrollPdfText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  let score = 0;
  if (trimmed.length >= 400) score += 2;
  if (trimmed.length >= 1200) score += 1;

  if (/\d{1,2}\/\d{1,2}\/\d{4}\s+to\s+\d{1,2}\/\d{1,2}\/\d{4}/i.test(trimmed)) {
    score += 4;
  }

  if (/^Total\s/m.test(trimmed) || /^TOTAL\s/m.test(trimmed)) {
    score += 4;
  }

  const employeeRows = trimmed.match(/^\d+\.\s+\S/gm);
  if (employeeRows && employeeRows.length >= 1) score += 3;
  if (employeeRows && employeeRows.length >= 3) score += 1;

  if (/Payroll Register/i.test(trimmed)) score += 1;
  if (/Hours Worked|Employee Name/i.test(trimmed)) score += 1;

  const moneyTokens = trimmed.match(/\d{1,3}(?:,\d{3})+\.\d{2}/g);
  if (moneyTokens && moneyTokens.length >= 10) score += 2;

  return score;
}

export function isPayrollPdfTextSufficient(text: string): boolean {
  return scorePayrollPdfText(text) >= 8;
}
