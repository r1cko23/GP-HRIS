"use client";

import { format } from "date-fns";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import { formatCurrency } from "@/utils/format";
import { PREMIUM_RATES } from "@/lib/ph-payroll/premiums";
import { cn } from "@/lib/utils";
import type { RegisterPayslipLine } from "@/components/payroll/RegisterPayslipBreakdown";
import { registerPayslipDisplayName } from "@/components/payroll/RegisterPayslipBreakdown";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

type PremiumRow = {
  label: string;
  hoursKey: string;
  earningKey: string;
  multiplier: number;
};

/** Office-style numbered premium rows, mapped to Organic register buckets. */
const PREMIUM_ROWS: PremiumRow[] = [
  {
    label: "1. Hours Work (Regular)",
    hoursKey: "actual_regular_hours",
    earningKey: "basic",
    multiplier: PREMIUM_RATES.regular,
  },
  {
    label: "2. Night Diff",
    hoursKey: "night_diff_hours",
    earningKey: "night_diff",
    multiplier: PREMIUM_RATES.night_diff,
  },
  {
    label: "3. Legal Holiday",
    hoursKey: "legal_holiday_hours",
    earningKey: "legal_holiday",
    multiplier: PREMIUM_RATES.legal_holiday,
  },
  {
    label: "4. Special Holiday",
    hoursKey: "special_holiday_hours",
    earningKey: "special_holiday",
    multiplier: PREMIUM_RATES.special_holiday,
  },
  {
    label: "5. Rest Day",
    hoursKey: "rest_day_hours",
    earningKey: "rest_day",
    multiplier: PREMIUM_RATES.rest_day,
  },
  {
    label: "6. Regular OT",
    hoursKey: "overtime_hours",
    earningKey: "overtime",
    multiplier: PREMIUM_RATES.overtime,
  },
  {
    label: "7. Legal Holiday OT",
    hoursKey: "legal_holiday_ot_hours",
    earningKey: "legal_holiday_ot",
    multiplier: PREMIUM_RATES.legal_holiday_ot,
  },
  {
    label: "8. Legal Holiday ND",
    hoursKey: "legal_holiday_nd_hours",
    earningKey: "legal_holiday_nd",
    multiplier: PREMIUM_RATES.legal_holiday_nd,
  },
  {
    label: "9. Special Holiday OT",
    hoursKey: "special_holiday_ot_hours",
    earningKey: "special_holiday_ot",
    multiplier: PREMIUM_RATES.special_holiday_ot,
  },
  {
    label: "10. Rest Day OT",
    hoursKey: "rest_day_ot_hours",
    earningKey: "rest_day_ot",
    multiplier: PREMIUM_RATES.rest_day_ot,
  },
  {
    label: "11. Regular Night Diff OT",
    hoursKey: "regular_night_ot_hours",
    earningKey: "regular_night_ot",
    multiplier: PREMIUM_RATES.regular_night_ot,
  },
  {
    label: "12. PTO",
    hoursKey: "pto_hours",
    earningKey: "pto",
    multiplier: PREMIUM_RATES.pto,
  },
  {
    label: "13. WDO",
    hoursKey: "wdo_hours",
    earningKey: "wdo",
    multiplier: PREMIUM_RATES.wdo,
  },
];

function BasicRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <tr className={emphasize ? "bg-emerald-50/80" : undefined}>
      <td
        className={cn(
          "px-2 py-1.5 text-xs text-neutral-700",
          emphasize && "font-semibold text-foreground"
        )}
      >
        {label}
      </td>
      <td
        className={cn(
          "px-2 py-1.5 text-right text-xs tabular-nums text-foreground",
          emphasize && "font-semibold"
        )}
      >
        {value}
      </td>
    </tr>
  );
}

function DeductionRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <tr>
      <td
        className={cn(
          "px-2 py-1.5 text-xs",
          muted ? "text-muted-foreground" : "text-neutral-700"
        )}
      >
        {label}
      </td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-foreground">
        {value}
      </td>
    </tr>
  );
}

/**
 * Office-style payslip breakdown fed by Organic register line aggregates
 * (hours × multiplier × amount), not per-day attendance.
 */
export function OrganicPayslipDetailedBreakdown({
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
  const hours = line.hours ?? {};
  const earnings = line.earnings ?? {};
  const deductions = line.deductions ?? {};
  const dailyRate = n(line.daily_rate);
  const hourlyRate = dailyRate > 0 ? dailyRate / 8 : 0;
  const daysWork = n(earnings.days_work);
  const basicPay = n(earnings.basic ?? earnings.basic_pay);
  const tardiness = n(earnings.tardiness_undertime_absence);
  const adjustment = n(earnings.adjustment);
  const allowance = n(earnings.allowance);

  const premiumRows = PREMIUM_ROWS.map((row) => ({
    ...row,
    hours: n(hours[row.hoursKey]),
    amount: n(earnings[row.earningKey]),
  })).filter((row) => row.hours !== 0 || row.amount !== 0);

  const premiumTotal = premiumRows.reduce((sum, row) => sum + row.amount, 0);
  const loanLines = (line.loan_lines ?? []).filter((l) => n(l.amount) !== 0);

  const deductionRows: Array<{ label: string; amount: number; muted?: boolean }> =
    [
      {
        label: "SSS (Regular)",
        amount: n(deductions.sss_regular) || n(deductions.sss),
      },
      { label: "SSS (WISP)", amount: n(deductions.sss_wisp) },
      { label: "PhilHealth", amount: n(deductions.philhealth) },
      { label: "Pag-IBIG", amount: n(deductions.pagibig) },
      { label: "Withholding tax", amount: n(deductions.withholding_tax) },
      { label: "Loans", amount: n(deductions.loans) },
      { label: "Other", amount: n(deductions.other) },
    ].filter((row) => row.amount !== 0 || row.label === "Loans");

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-4xl space-y-4 rounded-md border border-border bg-white p-4 shadow-card sm:p-5",
        className
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">{companyName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Employee Payslip · Confidential
          </p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payslip
        </p>
      </header>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-base font-semibold text-balance">{name || "—"}</p>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
            {line.employee_code ?? "—"}
          </p>
          {(line.bank_name || line.bank_account_no) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Bank: {line.bank_name ?? "—"}
              {line.bank_account_no ? ` · ${line.bank_account_no}` : ""}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="font-medium text-muted-foreground">Pay period</dt>
          <dd>{periodLabel}</dd>
          {payrollDate ? (
            <>
              <dt className="font-medium text-muted-foreground">Payroll date</dt>
              <dd className="tabular-nums">{payrollDate}</dd>
            </>
          ) : null}
          <dt className="font-medium text-muted-foreground">Generated</dt>
          <dd>{format(new Date(), "MMM d, yyyy h:mm a")}</dd>
        </dl>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Basic Earning(s)
            </h3>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  <BasicRow
                    label="Days Work"
                    value={daysWork.toLocaleString("en-PH", {
                      maximumFractionDigits: 2,
                    })}
                  />
                  <BasicRow label="Daily Rate" value={formatCurrency(dailyRate)} />
                  <BasicRow
                    label="Hourly Rate"
                    value={formatCurrency(hourlyRate)}
                  />
                  <BasicRow
                    label="Basic Salary"
                    value={formatCurrency(basicPay)}
                  />
                  {tardiness !== 0 ? (
                    <BasicRow
                      label="Less: Late & undertime"
                      value={formatCurrency(tardiness)}
                    />
                  ) : null}
                  {allowance !== 0 ? (
                    <BasicRow
                      label="Allowance"
                      value={formatCurrency(allowance)}
                    />
                  ) : null}
                  {adjustment !== 0 ? (
                    <BasicRow
                      label="Adjustment"
                      value={formatCurrency(adjustment)}
                    />
                  ) : null}
                  <BasicRow
                    label="Gross Pay"
                    value={formatCurrency(n(line.gross_pay))}
                    emphasize
                  />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Overtimes / Holiday Earning(s)
            </h3>
            <div className="overflow-hidden rounded-md border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">
                        Component
                      </th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground">
                        #Hours
                      </th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground">
                        Multiplier
                      </th>
                      <th className="px-2 py-1.5 text-right text-xs font-semibold text-muted-foreground">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {premiumRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-2 py-3 text-center text-muted-foreground"
                        >
                          No overtime or premium hours on this cutoff
                        </td>
                      </tr>
                    ) : (
                      premiumRows.map((row) => (
                        <tr key={row.label} className="hover:bg-muted/30">
                          <td className="px-2 py-1.5 font-medium text-foreground">
                            {row.label}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-neutral-700">
                            {row.hours.toLocaleString("en-PH", {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-primary">
                            {row.multiplier.toLocaleString("en-PH", {
                              maximumFractionDigits: 3,
                            })}
                            x
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-border bg-muted/30 px-2 py-1.5">
                <span className="text-xs font-medium text-neutral-700">
                  Total earnings lines
                </span>
                <span className="text-sm font-bold tabular-nums text-primary">
                  {formatCurrency(premiumTotal + allowance + adjustment)}
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] leading-normal text-muted-foreground text-pretty">
              Amounts come from the approved payroll register (cutoff hours ×
              daily rate × DOLE multipliers). Day-by-day clock rows are not
              shown here.
            </p>
          </section>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Deductions
            </h3>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {deductionRows.map((row) => (
                    <DeductionRow
                      key={row.label}
                      label={row.label}
                      value={formatCurrency(row.amount)}
                      muted={row.amount === 0}
                    />
                  ))}
                  {loanLines.length > 0 ? (
                    <>
                      <tr>
                        <td
                          colSpan={2}
                          className="bg-muted/30 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          Loan detail
                        </td>
                      </tr>
                      {loanLines.map((loan, i) => (
                        <DeductionRow
                          key={loan.loan_id ?? `${loan.particular}-${i}`}
                          label={loan.particular || loan.loan_type || "Loan"}
                          value={formatCurrency(n(loan.amount))}
                          muted
                        />
                      ))}
                    </>
                  ) : null}
                  <tr className="bg-amber-50">
                    <td className="px-2 py-1.5 text-xs font-semibold">
                      Total deductions
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-semibold tabular-nums">
                      {formatCurrency(n(line.total_deductions))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md bg-primary px-3 py-3 text-primary-foreground">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide">
                Net pay
              </span>
              <span className="text-xl font-bold tabular-nums">
                {formatCurrency(n(line.net_pay))}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-primary-foreground/80">
              Gross {formatCurrency(n(line.gross_pay))} − deductions{" "}
              {formatCurrency(n(line.total_deductions))}
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
