"use client";

import { format } from "date-fns";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import { cn } from "@/lib/utils";
import type { RegisterPayslipLine } from "@/components/payroll/RegisterPayslipBreakdown";
import { registerPayslipDisplayName } from "@/components/payroll/RegisterPayslipBreakdown";

const EARNING_ORDER = [
  "basic",
  "basic_pay",
  "regular_pay",
  "overtime",
  "ot_pay",
  "night_diff",
  "nd_pay",
  "legal_holiday",
  "special_holiday",
  "rest_day",
  "pto",
  "allowance",
  "cola",
  "sea",
  "ctpa",
  "adjustment",
  "other",
];

const HOUR_ORDER = [
  "regular",
  "actual_regular_hours",
  "overtime",
  "overtime_hours",
  "night_diff",
  "night_diff_hours",
  "legal_holiday",
  "legal_holiday_hours",
  "special_holiday",
  "special_holiday_hours",
  "rest_day",
  "rest_day_hours",
  "pto",
  "pto_hours",
];

const PRIMARY_DEDUCTION_SKIP = new Set([
  "sss",
  "philhealth",
  "pagibig",
  "withholding_tax",
  "loans",
  "other",
  "sss_regular",
  "sss_wisp",
  "sss_er",
  "sss_wisp_er",
  "sss_ecc",
  "philhealth_er",
  "pagibig_er",
  "taxable_income",
]);

const NON_MONEY_EARNING_KEYS = new Set(["days_work", "hours_work"]);

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function money(value: unknown): string {
  return `₱${n(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOt\b/g, "OT")
    .replace(/\bNd\b/g, "ND")
    .replace(/\bSss\b/g, "SSS")
    .replace(/\bWtax\b/g, "WTax")
    .replace(/\bCola\b/g, "COLA")
    .replace(/\bSea\b/g, "SEA")
    .replace(/\bCtpa\b/g, "CTPA");
}

function sortedEntries(
  map: Record<string, number>,
  preferred: string[]
): Array<[string, number]> {
  const keys = Object.keys(map);
  const ordered = [
    ...preferred.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferred.includes(k)).sort(),
  ];
  return ordered
    .map((k) => [k, n(map[k])] as [string, number])
    .filter(([, amount]) => amount !== 0);
}

function DocRow({
  label,
  value,
  emphasize,
  emphasizeTone,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  emphasizeTone?: "green" | "amber";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-2 py-1.5 text-[13px]",
        emphasize &&
          (emphasizeTone === "amber"
            ? "bg-amber-50 font-semibold"
            : "bg-emerald-50 font-semibold")
      )}
    >
      <span className={emphasize ? "text-foreground" : "text-neutral-600"}>
        {label}
      </span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function SectionHead({
  title,
  tone = "primary",
}: {
  title: string;
  tone?: "primary" | "neutral";
}) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white",
        tone === "primary" ? "bg-primary" : "bg-neutral-700"
      )}
    >
      {title}
    </div>
  );
}

/**
 * Screen preview that mirrors generateOrganicPayslipPDF layout.
 */
export function OrganicPayslipDocument({
  line,
  periodStart,
  periodEnd,
  payrollDate,
  companyName = "GREEN PASTURE PEOPLE MANAGEMENT INC.",
  className,
}: {
  line: RegisterPayslipLine;
  periodStart: string;
  periodEnd: string;
  payrollDate?: string | null;
  companyName?: string;
  className?: string;
}) {
  const name = registerPayslipDisplayName(line);
  const periodLabel = formatBiMonthlyPeriod(
    new Date(`${periodStart}T00:00:00`),
    new Date(`${periodEnd}T00:00:00`)
  );
  const earnings = line.earnings ?? {};
  const deductions = line.deductions ?? {};
  const hours = line.hours ?? {};

  const earningRows = sortedEntries(earnings, EARNING_ORDER).filter(
    ([key]) => !NON_MONEY_EARNING_KEYS.has(key)
  );
  const hourRows = sortedEntries(hours, HOUR_ORDER).filter(
    ([key]) => key !== "hours_work"
  );
  const primaryDeductionRows: Array<[string, number]> = [
    ["SSS", n(deductions.sss)],
    ["PhilHealth", n(deductions.philhealth)],
    ["Pag-IBIG", n(deductions.pagibig)],
    ["Withholding tax", n(deductions.withholding_tax)],
    ["Loans", n(deductions.loans)],
    ["Other", n(deductions.other)],
  ];
  const primaryDeductions = primaryDeductionRows.filter(
    ([label, amount]) => !(label === "Other" && amount === 0)
  );

  const extraDeductions = Object.entries(deductions)
    .filter(([key, amount]) => !PRIMARY_DEDUCTION_SKIP.has(key) && n(amount) !== 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-[720px] overflow-hidden rounded-md border border-border bg-white text-foreground shadow-card",
        className
      )}
    >
      <header className="flex items-start justify-between gap-4 bg-primary px-5 py-4 text-primary-foreground">
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">{companyName}</p>
          <p className="mt-1 text-xs text-primary-foreground/85">
            Employee Payslip · Confidential
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold tracking-wide">PAYSLIP</p>
      </header>

      <div className="space-y-4 px-5 py-4">
        <dl className="grid gap-1 text-[13px] sm:grid-cols-[7rem_1fr]">
          <dt className="font-semibold text-neutral-700">Pay period</dt>
          <dd>{periodLabel}</dd>
          {payrollDate ? (
            <>
              <dt className="font-semibold text-neutral-700">Payroll date</dt>
              <dd className="tabular-nums">{payrollDate}</dd>
            </>
          ) : null}
          <dt className="font-semibold text-neutral-700">Generated</dt>
          <dd>{format(new Date(), "MMM d, yyyy h:mm a")}</dd>
        </dl>

        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-base font-bold">{name || "—"}</p>
          <p className="mt-1 text-[13px] text-neutral-700">
            Employee ID:{" "}
            <span className="font-mono tabular-nums">
              {line.employee_code ?? "—"}
            </span>
          </p>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-0.5 text-[13px] text-neutral-700">
            <span>Daily rate: {money(line.daily_rate)}</span>
            <span>Monthly salary: {money(line.monthly_salary)}</span>
          </div>
          {line.bank_name || line.bank_account_no ? (
            <p className="mt-1 text-[13px] text-neutral-700">
              Bank: {line.bank_name ?? "—"}
              {line.bank_account_no ? ` · ${line.bank_account_no}` : ""}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-sm border border-neutral-200">
              <SectionHead title="Earnings" />
              <div className="divide-y divide-neutral-100">
                {earningRows.length === 0 ? (
                  <DocRow label="No earning lines" value="—" />
                ) : (
                  earningRows.map(([key, amount]) => (
                    <DocRow
                      key={key}
                      label={labelize(key)}
                      value={money(amount)}
                    />
                  ))
                )}
                <DocRow
                  label="Gross pay"
                  value={money(line.gross_pay)}
                  emphasize
                  emphasizeTone="green"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-sm border border-neutral-200">
              <SectionHead title="Hours" tone="neutral" />
              <div className="divide-y divide-neutral-100">
                {hourRows.length === 0 ? (
                  <DocRow label="No hour detail" value="—" />
                ) : (
                  hourRows.map(([key, value]) => (
                    <DocRow
                      key={key}
                      label={labelize(key)}
                      value={value.toLocaleString("en-PH", {
                        maximumFractionDigits: 2,
                      })}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-sm border border-neutral-200 self-start">
            <SectionHead title="Deductions" />
            <div className="divide-y divide-neutral-100">
              {primaryDeductions.map(([label, amount]) => (
                <DocRow key={label} label={label} value={money(amount)} />
              ))}
              {extraDeductions.map(([key, amount]) => (
                <DocRow
                  key={key}
                  label={labelize(key)}
                  value={money(amount)}
                />
              ))}
              <DocRow
                label="Total deductions"
                value={money(line.total_deductions)}
                emphasize
                emphasizeTone="amber"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md bg-primary px-4 py-3 text-primary-foreground">
          <span className="text-sm font-bold tracking-wide">NET PAY</span>
          <span className="text-lg font-bold tabular-nums">
            {money(line.net_pay)}
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-neutral-500">
          This payslip is computer-generated from the approved payroll register.
          Keep for your records.
        </p>

        <div className="grid gap-8 pt-2 sm:grid-cols-2">
          <div>
            <div className="mb-1 border-b border-neutral-400" />
            <p className="text-[11px] text-neutral-500">Employee acknowledgment</p>
          </div>
          <div>
            <div className="mb-1 border-b border-neutral-400" />
            <p className="text-[11px] text-neutral-500">Authorized signature</p>
          </div>
        </div>
      </div>
    </article>
  );
}
