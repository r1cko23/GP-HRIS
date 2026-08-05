import { extractPdfText } from "@/lib/payroll-summary/extract-pdf-text";
import { extractCompanyName } from "@/lib/payroll-summary/parse-payroll-register-pdf";
import {
  cleanAuditClientName,
  clientNameFromPayrollSummaryFileName,
  clientNameFromRelativePath,
  isPlausibleCompanyName,
  resolveAuditClientName,
} from "@/lib/payroll-summary/resolve-audit-client-name";

export interface PeekRegisterClientResult {
  clientName: string;
  pdfCompanyName: string | null;
  source: "pdf" | "path" | "filename";
}

/**
 * Lightweight client identity peek — text extract + company name heuristics.
 * Does not require a full register parse (so layout failures still allow routing).
 */
export async function peekRegisterClientName(input: {
  buffer: Buffer;
  fileName: string;
  relativePath?: string | null;
}): Promise<PeekRegisterClientResult> {
  let pdfCompanyName: string | null = null;
  try {
    const text = await extractPdfText(input.buffer);
    pdfCompanyName = extractCompanyName(text);
  } catch {
    pdfCompanyName = null;
  }

  const clientName = resolveAuditClientName({
    fileName: input.fileName,
    relativePath: input.relativePath,
    pdfCompanyName,
  });

  let source: PeekRegisterClientResult["source"] = "filename";
  const cleanedPdf = pdfCompanyName ? cleanAuditClientName(pdfCompanyName) : null;
  if (isPlausibleCompanyName(cleanedPdf) && clientName === cleanedPdf) {
    source = "pdf";
  } else {
    const fromPath = clientNameFromRelativePath(input.relativePath);
    if (
      fromPath &&
      isPlausibleCompanyName(fromPath) &&
      clientName === cleanAuditClientName(fromPath)
    ) {
      source = "path";
    } else if (clientNameFromPayrollSummaryFileName(input.fileName)) {
      source = "filename";
    }
  }

  return { clientName, pdfCompanyName, source };
}
