import {
  cutoffWindowKind,
  type ClientPayCalendar,
} from "@/lib/directory/client-pay-calendar";

export type StatutoryAmountMode = "half" | "full";

/** Where SSS MSC is taken from for this cutoff. */
export type SssSalaryBasis = "monthly_rate" | "period_gross";

export type StatutoryThisCutoff = {
  sss: boolean;
  philhealth: boolean;
  pagibig: boolean;
  wtax: boolean;
  window: "first" | "second" | "other";
  /** PhilHealth EE split when applied (SSS uses sssBasis + full table when period_gross). */
  amountMode: StatutoryAmountMode;
  /**
   * MAIN Semi-Monthly Deployed (basisofsssded=gross): first kinsena looks up
   * the full SSS table on period taxable gross. Second stays rate-based half
   * until month-to-date prior SSS is wired.
   */
  sssBasis: SssSalaryBasis;
  /**
   * Pag-IBIG EE basis when applied. Semi-Monthly Deployed matches MAIN:
   * full monthly on the first kinsena, none on the second.
   */
  pagibigAmountMode: StatutoryAmountMode;
  /**
   * When set, PhilHealth EE is this fixed peso amount (MAIN Deployed first
   * kinsena posts ₱250 for everyone).
   */
  philhealthFixedEe?: number | null;
};

function isMonthlySchedule(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s.includes("semi")) return false;
  return s.includes("month");
}

/**
 * Organic Client: statutory Monthly → SSS/PH/Pag-IBIG on the second window
 * (full monthly EE). WTAX Semi-Monthly → every cutoff.
 *
 * Semi-Monthly Deployed (MAIN): first kinsena SSS = full table on period gross;
 * PhilHealth fixed ₱250; Pag-IBIG full ₱200. Second kinsena: SSS rate-half for
 * now; Pag-IBIG off; PhilHealth formula half.
 */
export function statutoryThisCutoff(
  calendar: ClientPayCalendar & {
    statutory_schedule?: string | null;
    wtax_schedule?: string | null;
  },
  periodStart: string
): StatutoryThisCutoff {
  const window = cutoffWindowKind(calendar, periodStart);
  const first = window === "first";
  const monthlyStat = isMonthlySchedule(calendar.statutory_schedule);
  const monthlyWtax = isMonthlySchedule(calendar.wtax_schedule);
  const wtax = !(monthlyWtax && first);

  if (monthlyStat) {
    const onSecond = !first && window === "second";
    return {
      sss: onSecond,
      philhealth: onSecond,
      pagibig: onSecond,
      wtax,
      window,
      amountMode: "full",
      sssBasis: "monthly_rate",
      pagibigAmountMode: "full",
      philhealthFixedEe: null,
    };
  }

  // Semi-Monthly (default): MAIN Deployed first-kinsena posting.
  const pagibigOnFirst = first || window === "other";
  return {
    sss: true,
    philhealth: true,
    pagibig: pagibigOnFirst,
    wtax,
    window,
    amountMode: "half",
    sssBasis: first || window === "other" ? "period_gross" : "monthly_rate",
    pagibigAmountMode: "full",
    philhealthFixedEe: first ? 250 : null,
  };
}
