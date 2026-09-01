"use client";

import type { ReactNode } from "react";
import { BodySmall, Caption } from "@/components/ui/typography";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";

export type RegisterPayslipLine = {
  id?: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  office_employee_id?: string | null;
  directory_employee_id?: string | null;
  daily_rate?: number | null;
  monthly_salary?: number | null;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  hours?: Record<string, number> | null;
  earnings?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
  loan_lines?: Array<{
    loan_id?: string;
    loan_type?: string;
    particular?: string;
    amount: number;
  }> | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
};

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

const PRIMARY_DEDUCTION_KEYS = [
  "sss",
  "philhealth",
  "pagibig",
  "withholding_tax",
  "loans",
  "other",
] as const;

const HIDDEN_DEDUCTION_KEYS = new Set([
  ...PRIMARY_DEDUCTION_KEYS,
  "sss_regular",
  "sss_wisp",
  "sss_er",
  "sss_wisp_er",
  "sss_ecc",
  "philhealth_er",
  "pagibig_er",
  "taxable_income",
]);

/** Stored on earnings JSON but not peso amounts */
const NON_MONEY_EARNING_KEYS = new Set(["days_work", "hours_work"]);

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function labelize(key: string): string {
  const aliases: Record<string, string> = {
    actual_regular_hours: "Regular hours",
    overtime_hours: "Overtime hours",
    night_diff_hours: "Night diff hours",
    legal_holiday_hours: "Legal holiday hours",
    special_holiday_hours: "Special holiday hours",
    rest_day_hours: "Rest day hours",
    pto_hours: "PTO hours",
    basic: "Basic pay",
  };
  if (aliases[key]) return aliases[key];
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

function primaryDeductions(
  deductions: Record<string, number>
): Array<[string, number]> {
  const rows: Array<[string, number]> = [
    ["SSS", n(deductions.sss)],
    ["PhilHealth", n(deductions.philhealth)],
    ["Pag-IBIG", n(deductions.pagibig)],
    ["Withholding tax", n(deductions.withholding_tax)],
    ["Loans", n(deductions.loans)],
    ["Other", n(deductions.other)],
  ];
  return rows.filter(([, amount]) => amount !== 0);
}

function BreakdownRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span
        className={cn(
          "min-w-0 text-sm",
          muted ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {label}
      </span>
      <span className="shrink-0 tabular-nums text-sm text-foreground">
        {value}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card shadow-card">
      <div className="border-b border-border bg-muted/40 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="px-3 py-1">
        <div className="divide-y divide-border/60">{children}</div>
        {footer ? (
          <div className="border-t border-border pt-2">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}

export function registerPayslipDisplayName(line: RegisterPayslipLine): string {
  return [line.last_name, line.first_name].filter(Boolean).join(", ");
}

export function RegisterPayslipBreakdown({
  line,
  className,
}: {
  line: RegisterPayslipLine;
  className?: string;
}) {
  const earnings = line.earnings ?? {};
  const hours = line.hours ?? {};
  const deductions = line.deductions ?? {};
  const earningRows = sortedEntries(earnings, EARNING_ORDER).filter(
    ([key]) => !NON_MONEY_EARNING_KEYS.has(key)
  );
  const daysWork = n(earnings.days_work);
  const hourRows = sortedEntries(hours, HOUR_ORDER).filter(
    ([key]) => key !== "hours_work"
  );
  const deductionRows = primaryDeductions(deductions);
  const extraDeductions = Object.entries(deductions)
    .filter(([key, amount]) => !HIDDEN_DEDUCTION_KEYS.has(key) && n(amount) !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const loanLines = (line.loan_lines ?? []).filter((l) => n(l.amount) !== 0);

  const metaBits = [
    line.daily_rate != null
      ? `Daily ${formatCurrency(n(line.daily_rate))}`
      : null,
    line.monthly_salary != null
      ? `Monthly ${formatCurrency(n(line.monthly_salary))}`
      : null,
    daysWork > 0
      ? `${daysWork.toLocaleString("en-PH", {
          maximumFractionDigits: 2,
        })} days`
      : null,
  ].filter(Boolean);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-md border border-border bg-card px-3 py-2.5 shadow-card">
          <Caption className="text-muted-foreground">Gross</Caption>
          <p className="mt-0.5 text-base font-semibold tabular-nums tracking-tight sm:text-lg">
            {formatCurrency(n(line.gross_pay))}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2.5 shadow-card">
          <Caption className="text-muted-foreground">Deductions</Caption>
          <p className="mt-0.5 text-base font-semibold tabular-nums tracking-tight sm:text-lg">
            {formatCurrency(n(line.total_deductions))}
          </p>
        </div>
        <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2.5 shadow-card">
          <Caption className="text-primary/80">Net pay</Caption>
          <p className="mt-0.5 text-base font-semibold tabular-nums tracking-tight text-primary sm:text-lg">
            {formatCurrency(n(line.net_pay))}
          </p>
        </div>
      </div>

      {metaBits.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {metaBits.map((bit) => (
            <span key={bit}>{bit}</span>
          ))}
        </div>
      ) : null}

      <div className="grid items-start gap-3 sm:grid-cols-2">
        <SectionCard
          title="Earnings"
          footer={
            <div className="flex items-baseline justify-between gap-4 rounded-md bg-muted/50 px-2.5 py-2">
              <span className="text-sm font-medium">Gross pay</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(n(line.gross_pay))}
              </span>
            </div>
          }
        >
          {earningRows.length === 0 ? (
            <BodySmall className="py-2 text-muted-foreground">
              No earning lines
            </BodySmall>
          ) : (
            earningRows.map(([key, amount]) => (
              <BreakdownRow
                key={key}
                label={labelize(key)}
                value={formatCurrency(amount)}
                muted
              />
            ))
          )}
        </SectionCard>

        <SectionCard
          title="Deductions"
          footer={
            <div className="flex items-baseline justify-between gap-4 rounded-md bg-muted/50 px-2.5 py-2">
              <span className="text-sm font-medium">Total deductions</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(n(line.total_deductions))}
              </span>
            </div>
          }
        >
          {deductionRows.length === 0 &&
          extraDeductions.length === 0 &&
          loanLines.length === 0 ? (
            <BodySmall className="py-2 text-muted-foreground">
              No deductions this cutoff
            </BodySmall>
          ) : (
            <>
              {deductionRows.map(([label, amount]) => (
                <BreakdownRow
                  key={label}
                  label={label}
                  value={formatCurrency(amount)}
                  muted
                />
              ))}
              {extraDeductions.map(([key, amount]) => (
                <BreakdownRow
                  key={key}
                  label={labelize(key)}
                  value={formatCurrency(n(amount))}
                  muted
                />
              ))}
              {loanLines.length > 0 ? (
                <div className="space-y-0.5 py-2">
                  <Caption className="mb-1 text-muted-foreground">
                    Loan detail
                  </Caption>
                  {loanLines.map((loan, i) => (
                    <BreakdownRow
                      key={loan.loan_id ?? `${loan.particular}-${i}`}
                      label={
                        loan.particular ||
                        labelize(loan.loan_type ?? "loan")
                      }
                      value={formatCurrency(n(loan.amount))}
                      muted
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Hours">
        {hourRows.length === 0 ? (
          <BodySmall className="py-2 text-muted-foreground">
            No hour detail on this line
          </BodySmall>
        ) : (
          <div className="grid sm:grid-cols-2 sm:gap-x-6">
            {hourRows.map(([key, value]) => (
              <BreakdownRow
                key={key}
                label={labelize(key)}
                value={value.toLocaleString("en-PH", {
                  maximumFractionDigits: 2,
                })}
                muted
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
