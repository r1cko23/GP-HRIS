import type { PayrollSummaryMetrics } from "./types";

/** Legacy smoke-test tolerance (wrong layout detection). */
export const REGISTER_GROSS_ROLLUP_DRIFT_PCT = 0.05;

export function toCentavos(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCentavos(centavos: number): number {
  return centavos / 100;
}

export function extractSalariesAndWagesGross(text: string): number | null {
  const match = text.match(/Salaries and Wages:\s*([\d,]+\.?\d*)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatPeso(value: number): string {
  return `₱${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function computeRollupGapCentavos(metrics: PayrollSummaryMetrics): number {
  const rolledUp = metrics.employees.reduce((sum, emp) => sum + emp.grossAmount, 0);
  return Math.abs(toCentavos(metrics.grossAmountTotal) - toCentavos(rolledUp));
}

export interface RegisterValidationOptions {
  pdfText?: string;
  /** When true (default), employee gross must tie to register total to the centavo. */
  requireExactCentavos?: boolean;
  rollupDriftPct?: number;
}

/**
 * Validate parsed register metrics. Money-grade uploads require exact centavo tie-out.
 */
export function validateParsedRegisterMetrics(
  metrics: PayrollSummaryMetrics,
  options: RegisterValidationOptions = {}
): void {
  const requireExact = options.requireExactCentavos !== false;
  const pdfText = options.pdfText ?? "";

  const footerGross = pdfText ? extractSalariesAndWagesGross(pdfText) : null;
  if (footerGross != null) {
    const footerGap = Math.abs(
      toCentavos(footerGross) - toCentavos(metrics.grossAmountTotal)
    );
    if (footerGap > 0) {
      throw new Error(
        `Register gross ${formatPeso(metrics.grossAmountTotal)} does not match ` +
          `Salaries and Wages footer ${formatPeso(footerGross)} (off by ${formatPeso(fromCentavos(footerGap))}). ` +
          `The PDF layout may not be supported yet — contact IT with this file.`
      );
    }
  }

  if (metrics.employeeCount === 0 && metrics.grossAmountTotal > 0) {
    throw new Error(
      "No employees were parsed from this register but a gross total was found. Check the PDF layout."
    );
  }

  if (metrics.employees.length > 0 && metrics.grossAmountTotal > 0) {
    const rolledUpGross = metrics.employees.reduce(
      (sum, emp) => sum + emp.grossAmount,
      0
    );
    const gapCentavos = Math.abs(
      toCentavos(metrics.grossAmountTotal) - toCentavos(rolledUpGross)
    );

    if (requireExact && gapCentavos > 0) {
      throw new Error(
        `Employee gross total ${formatPeso(rolledUpGross)} does not match register gross ` +
          `${formatPeso(metrics.grossAmountTotal)} (off by ${formatPeso(fromCentavos(gapCentavos))}). ` +
          `Every centavo must tie out before this upload can be used for audit.`
      );
    }

    if (!requireExact) {
      const rollupPct = options.rollupDriftPct ?? REGISTER_GROSS_ROLLUP_DRIFT_PCT;
      const drift =
        metrics.grossAmountTotal > 0
          ? gapCentavos / toCentavos(metrics.grossAmountTotal)
          : 0;
      if (drift > rollupPct) {
        throw new Error(
          `Employee gross total ${formatPeso(rolledUpGross)} does not match register gross ` +
            `${formatPeso(metrics.grossAmountTotal)} (${(drift * 100).toFixed(1)}% off). ` +
            `The PDF column layout may be wrong.`
        );
      }
    }
  }
}
