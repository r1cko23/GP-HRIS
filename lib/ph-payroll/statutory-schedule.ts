import {
  cutoffWindowKind,
  type ClientPayCalendar,
} from "@/lib/directory/client-pay-calendar";

export type StatutoryThisCutoff = {
  sss: boolean;
  philhealth: boolean;
  pagibig: boolean;
  wtax: boolean;
  window: "first" | "second" | "other";
};

function isMonthlySchedule(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s.includes("semi")) return false;
  return s.includes("month");
}

/**
 * Organic Client: statutory Monthly → SSS/PH/Pag-IBIG on the second window;
 * WTAX Semi-Monthly → every cutoff.
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
  const sss = !(monthlyStat && first);
  const wtax = !(monthlyWtax && first);
  return {
    sss,
    philhealth: sss,
    pagibig: sss,
    wtax,
    window,
  };
}
