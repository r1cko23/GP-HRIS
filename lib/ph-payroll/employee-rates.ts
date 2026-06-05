/**
 * Resolve employee pay rates (Frappe HR Salary Structure pattern).
 */

import { calculateMonthlySalary } from "@/utils/ph-deductions";

export type RateEmployee = {
  monthly_rate?: number | null;
  per_day?: number | null;
};

export function getRatePerHour(emp: RateEmployee): number {
  if (emp.monthly_rate && emp.monthly_rate > 0) {
    return emp.monthly_rate / (26 * 8);
  }
  if (emp.per_day && emp.per_day > 0) {
    return emp.per_day / 8;
  }
  return 0;
}

export function getMonthlySalary(emp: RateEmployee): number {
  if (emp.monthly_rate && emp.monthly_rate > 0) return emp.monthly_rate;
  if (emp.per_day && emp.per_day > 0) {
    return calculateMonthlySalary(emp.per_day, 26);
  }
  return 0;
}
