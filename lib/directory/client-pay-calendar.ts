/** Standing Client pay calendar → dated Cutoff period. Date-only YYYY-MM-DD. */

export type ClientPayCalendar = {
  cut1_start?: number | null;
  cut1_end?: number | null;
  cut2_start?: number | null;
  cut2_end?: number | null;
  pay_frequency?: string | null;
};

export type CutoffWindowKind = "first" | "second";

export type ProposedCutoff = {
  period_start: string;
  period_end: string;
  payroll_date: string;
  pay_frequency: "weekly" | "semi-monthly" | "monthly";
  window: CutoffWindowKind;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseYmd(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** Stored 28–31 means end-of-month (GREENHRISMAIN 16–30 → 16–31 in July). */
export function resolveCalendarDay(
  year: number,
  month: number,
  stored: number | null | undefined,
  fallback: number
): number {
  const last = lastDayOfMonth(year, month);
  const raw = stored == null || !Number.isFinite(stored) ? fallback : Math.trunc(stored);
  if (raw >= 28) return last;
  return Math.min(Math.max(raw, 1), last);
}

export function normalizePayFrequency(
  raw: string | null | undefined
): "weekly" | "semi-monthly" | "monthly" {
  if (raw === "weekly" || raw === "monthly") return raw;
  return "semi-monthly";
}

function payrollDateForWindow(
  year: number,
  month: number,
  window: CutoffWindowKind
): string {
  if (window === "first") {
    return ymd(year, month, 20);
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return ymd(nextYear, nextMonth, 5);
}

export function windowsForMonth(
  calendar: ClientPayCalendar,
  year: number,
  month: number
): ProposedCutoff[] {
  const freq = normalizePayFrequency(calendar.pay_frequency);
  const firstStart = resolveCalendarDay(year, month, calendar.cut1_start, 1);
  const firstEnd = resolveCalendarDay(year, month, calendar.cut1_end, 15);
  const secondStart = resolveCalendarDay(year, month, calendar.cut2_start, 16);
  const secondEnd = resolveCalendarDay(year, month, calendar.cut2_end, 30);

  const first: ProposedCutoff = {
    period_start: ymd(year, month, firstStart),
    period_end: ymd(year, month, Math.max(firstStart, firstEnd)),
    payroll_date: payrollDateForWindow(year, month, "first"),
    pay_frequency: freq,
    window: "first",
  };

  if (freq === "monthly") {
    return [
      {
        ...first,
        period_end: ymd(year, month, lastDayOfMonth(year, month)),
      },
    ];
  }

  return [
    first,
    {
      period_start: ymd(year, month, secondStart),
      period_end: ymd(year, month, Math.max(secondStart, secondEnd)),
      payroll_date: payrollDateForWindow(year, month, "second"),
      pay_frequency: freq,
      window: "second",
    },
  ];
}

export function cutoffWindowKind(
  calendar: ClientPayCalendar,
  periodStart: string
): CutoffWindowKind | "other" {
  const { year, month, day } = parseYmd(periodStart);
  const match = windowsForMonth(calendar, year, month).find(
    (w) => w.period_start === periodStart.slice(0, 10)
  );
  if (match) return match.window;
  return day <= 15 ? "first" : "second";
}

function addMonths(year: number, month: number, delta: number): {
  year: number;
  month: number;
} {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function todayYmdManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function nextCutoffFromCalendar(
  calendar: ClientPayCalendar,
  existing: Array<{ period_start: string; period_end: string }>,
  asOf: string
): ProposedCutoff | null {
  const asOfDay = asOf.slice(0, 10);
  const lastEnd = existing
    .map((row) => row.period_end.slice(0, 10))
    .sort()
    .at(-1);

  const origin = parseYmd(lastEnd ?? asOfDay);
  const startShift = lastEnd ? 0 : -1;
  const windows: ProposedCutoff[] = [];
  for (let i = startShift; i <= 14; i += 1) {
    const { year, month } = addMonths(origin.year, origin.month, i);
    windows.push(...windowsForMonth(calendar, year, month));
  }

  if (lastEnd) {
    return windows.find((w) => w.period_start > lastEnd) ?? null;
  }

  return (
    windows.find(
      (w) => asOfDay >= w.period_start && asOfDay <= w.period_end
    ) ??
    windows.find((w) => w.period_start > asOfDay) ??
    null
  );
}
