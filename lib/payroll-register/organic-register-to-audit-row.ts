/**
 * Map an Organic register line onto the payroll-audit register row
 * (`PayrollRegisterRow`) so cutoff summary PDFs project the same KPIs
 * as parsed MAIN Payroll Summary uploads.
 */

import { payrollDaysFromHours } from "@/lib/ph-payroll/supplemental-pay";
import {
  emptyRegisterRow,
  sumOTPayComponents,
  type PayrollRegisterRow,
} from "@/lib/payroll-summary/register-columns";
import {
  overlayMainAccruals,
  type OrganicAccrualContext,
} from "./main-accrual-overlay";

export type OrganicAuditSourceLine = {
  last_name?: string | null;
  first_name?: string | null;
  daily_rate?: number | null;
  gross_pay?: number | null;
  total_deductions?: number | null;
  net_pay?: number | null;
  hours?: Record<string, number> | null;
  earnings?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function organicRegisterLineToAuditRow(
  line: OrganicAuditSourceLine,
  accrual?: OrganicAccrualContext
): PayrollRegisterRow {
  const hours = line.hours ?? {};
  const earnings = line.earnings ?? {};
  const deductions = line.deductions ?? {};
  const name = [line.last_name, line.first_name].filter(Boolean).join(", ");
  const row = emptyRegisterRow(name);

  const daysWork =
    n(earnings.days_work) ||
    payrollDaysFromHours({
      actual_regular_hours: n(hours.actual_regular_hours),
      pto_hours: n(hours.pto_hours),
    });

  row.dailyRate = n(line.daily_rate);
  row.hoursWorked = n(hours.actual_regular_hours);
  row.daysWorked = daysWork;
  row.basicSalary = n(earnings.basic ?? earnings.basic_pay ?? earnings.regular_pay);
  row.totalSalary = row.basicSalary;
  row.regOTHours = n(hours.overtime_hours);
  row.regOTAmount = n(earnings.overtime ?? earnings.ot_pay);
  row.nightDiffHours = n(hours.night_diff_hours);
  row.nightDiffAmount = n(earnings.night_diff ?? earnings.nd_pay);
  row.regNightdiffOTHours = n(hours.regular_night_ot_hours);
  row.regNightdiffOTAmount = n(earnings.regular_night_ot);
  row.specialHolidayHours = round2(
    n(hours.legal_holiday_hours) + n(hours.special_holiday_hours)
  );
  row.specialHolidayAmount = round2(
    n(earnings.legal_holiday) + n(earnings.special_holiday)
  );
  row.specialHolidayOTHours = round2(
    n(hours.legal_holiday_ot_hours) + n(hours.special_holiday_ot_hours)
  );
  row.specialHolidayOTAmount = round2(
    n(earnings.legal_holiday_ot) + n(earnings.special_holiday_ot)
  );
  row.restdayHours = round2(
    n(hours.rest_day_hours) + n(hours.rest_day_ot_hours) + n(hours.wdo_hours)
  );
  row.restdayAmount = round2(
    n(earnings.rest_day) + n(earnings.rest_day_ot) + n(earnings.wdo)
  );
  row.serviceIncentiveLeaveAmount = n(earnings.pto);
  row.allowance = round2(
    n(earnings.allowance) +
      n(earnings.cola) +
      n(earnings.cola_payroll) +
      n(earnings.sea) +
      n(earnings.sea_payroll) +
      n(earnings.ctpa) +
      n(earnings.ctpa_payroll)
  );
  const adjustment = n(earnings.adjustment);
  if (adjustment > 0) row.refund = adjustment;
  else if (adjustment < 0) row.otherDeduction = round2(row.otherDeduction - adjustment);

  row.grossAmount = n(line.gross_pay);
  row.sss = n(deductions.sss);
  row.sssPRO = n(deductions.sss_wisp);
  row.philhealth = n(deductions.philhealth);
  row.pagibig = n(deductions.pagibig);
  row.withholdingTax = n(deductions.withholding_tax);
  row.sssLoan = n(deductions.loans);
  row.otherDeduction = round2(row.otherDeduction + n(deductions.other));
  row.totalDeduction = n(line.total_deductions);
  row.netAmount = n(line.net_pay);
  row.totalOTAmount = sumOTPayComponents(row);

  const overlay = overlayMainAccruals({
    basicPay: row.basicSalary,
    daysWorked: row.daysWorked,
    dailyRate: row.dailyRate,
    registerPeriodEnd: accrual?.registerPeriodEnd ?? "",
    scrapePeriodEnd: accrual?.scrapePeriodEnd,
    scraped: accrual?.scraped ?? null,
    laterCutoffBasics: accrual?.laterCutoffBasics ?? [],
  });
  row.thirteenthMonthCutoff = overlay.thirteenthMonthCutoff;
  row.silCutoff = overlay.silCutoff;
  row.thirteenthMonthYTD = overlay.thirteenthMonthYTD;

  return row;
}
