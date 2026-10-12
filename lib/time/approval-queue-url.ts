import { format, isValid, parse, startOfWeek } from "date-fns";

/** Monday of the week as yyyy-MM-dd (URL `week` param). */
export function approvalQueueWeekParam(week: Date): string {
  return format(startOfWeek(week, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function parseApprovalQueueWeek(raw: string | null | undefined): Date {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = parse(raw, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) {
      return startOfWeek(parsed, { weekStartsOn: 1 });
    }
  }
  return startOfWeek(new Date(), { weekStartsOn: 1 });
}

export function parseApprovalQueueStatus(
  raw: string | null | undefined,
  allowed: readonly string[],
  fallback = "pending"
): string {
  if (raw && allowed.includes(raw)) return raw;
  return fallback;
}

export function buildApprovalQueueSearch(
  status: string,
  week: Date,
  opts?: { employee?: string }
): string {
  const params = new URLSearchParams();
  params.set("status", status || "pending");
  params.set("week", approvalQueueWeekParam(week));
  if (opts?.employee && opts.employee !== "all") {
    params.set("employee", opts.employee);
  }
  return params.toString();
}
