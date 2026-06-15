"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { H4, BodySmall, Label, Caption } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { format } from "date-fns";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { calculateSSS, calculateMonthlySalary } from "@/utils/ph-deductions";
import {
  aggregateCutoffDeductions,
  emptyCutoffDeductions,
  syncCutoffDeductions,
} from "@/lib/ph-payroll";
import type { CutoffDeductions } from "@/lib/ph-payroll/types";
import {
  dbPageWrapper,
  dbPeriodNavButton,
  dbPeriodNavRow,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  monthly_rate?: number | null;
  per_day?: number | null;
}

export default function DeductionsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [periodStart, setPeriodStart] = useState<Date>(() =>
    getBiMonthlyPeriodStart(new Date())
  );
  const [hasSavedRows, setHasSavedRows] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    vale_amount: "0",
    sss_salary_loan: "0",
    sss_calamity_loan: "0",
    pagibig_salary_loan: "0",
    pagibig_calamity_loan: "0",
    sss_contribution: "0",
    philhealth_contribution: "0",
    pagibig_contribution: "0",
    withholding_tax: "0",
    other_deduction: "0",
    sss_pro: "0",
  });

  const supabase = createClient();

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId && employees.length > 0) {
      loadDeductions();
    }
  }, [selectedEmployeeId, periodStart, employees]);

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, monthly_rate, per_day, last_name, first_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  // function autoCalculateContributions() {
  //   if (!selectedEmployeeId) return;
  //
  //   const employee = employees.find(emp => emp.id === selectedEmployeeId);
  //   if (!employee || !employee.rate_per_day) return;
  //
  //   // Calculate contributions based on daily rate
  //   const contributions = calculateAllContributions(employee.rate_per_day, 22); // 22 working days per month
  //
  //   // Update form data with calculated bi-monthly contributions
  //   setFormData(prev => ({
  //     ...prev,
  //     sss_contribution: contributions.biMonthly.sss.toFixed(2),
  //     philhealth_contribution: contributions.biMonthly.philhealth.toFixed(2),
  //     pagibig_contribution: contributions.biMonthly.pagibig.toFixed(2),
  //   }));
  // }

  function cutoffDeductionsToFormData(
    deductionData: CutoffDeductions,
    employeeId: string
  ) {
    let sssProValue = deductionData.sss_pro || 0;
    if (sssProValue === 0) {
      const employee = employees.find((emp) => emp.id === employeeId);
      if (employee) {
        const monthlySalary = employee.monthly_rate
          ? employee.monthly_rate
          : employee.per_day
            ? calculateMonthlySalary(employee.per_day, 22)
            : 0;

        if (monthlySalary > 0) {
          const sssCalculation = calculateSSS(monthlySalary);
          sssProValue = sssCalculation.wispEmployeeShare || 0;
        }
      }
    }

    setFormData({
      vale_amount: deductionData.vale_amount.toString(),
      sss_salary_loan: deductionData.sss_salary_loan.toString(),
      sss_calamity_loan: deductionData.sss_calamity_loan.toString(),
      pagibig_salary_loan: deductionData.pagibig_salary_loan.toString(),
      pagibig_calamity_loan: deductionData.pagibig_calamity_loan.toString(),
      sss_contribution: deductionData.sss_contribution.toString(),
      philhealth_contribution: deductionData.philhealth_contribution.toString(),
      pagibig_contribution: deductionData.pagibig_contribution.toString(),
      withholding_tax: deductionData.withholding_tax.toString(),
      other_deduction: deductionData.other_deduction.toString(),
      sss_pro: sssProValue.toString(),
    });
  }

  async function loadDeductions() {
    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(
        getBiMonthlyPeriodEnd(periodStart),
        "yyyy-MM-dd"
      );

      const { data, error } = await supabase
        .from("employee_deductions")
        .select("deduction_type, amount, deduction_date")
        .eq("employee_id", selectedEmployeeId)
        .gte("deduction_date", periodStartStr)
        .lte("deduction_date", periodEndStr);

      if (error) throw error;

      const rows = data || [];
      setHasSavedRows(rows.length > 0);

      if (rows.length > 0) {
        cutoffDeductionsToFormData(
          aggregateCutoffDeductions(rows),
          selectedEmployeeId
        );
      } else {
        resetForm();
        cutoffDeductionsToFormData(
          emptyCutoffDeductions(),
          selectedEmployeeId
        );
      }
    } catch (error) {
      console.error("Error loading deductions:", error);
      toast.error("Failed to load deductions");
    }
  }

  function resetForm() {
    setFormData({
      vale_amount: "0",
      sss_salary_loan: "0",
      sss_calamity_loan: "0",
      pagibig_salary_loan: "0",
      pagibig_calamity_loan: "0",
      sss_contribution: "0",
      philhealth_contribution: "0",
      pagibig_contribution: "0",
      withholding_tax: "0",
      other_deduction: "0",
      sss_pro: "0",
    });
  }

  async function handleSave() {
    if (!selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }

    setSaving(true);

    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEnd = getBiMonthlyPeriodEnd(periodStart);
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      const roundTo2Decimals = (value: number) => Math.round(value * 100) / 100;

      const cutoffDeductions: CutoffDeductions = {
        vale_amount: roundTo2Decimals(parseFloat(formData.vale_amount) || 0),
        sss_salary_loan: roundTo2Decimals(
          parseFloat(formData.sss_salary_loan) || 0
        ),
        sss_calamity_loan: roundTo2Decimals(
          parseFloat(formData.sss_calamity_loan) || 0
        ),
        pagibig_salary_loan: roundTo2Decimals(
          parseFloat(formData.pagibig_salary_loan) || 0
        ),
        pagibig_calamity_loan: roundTo2Decimals(
          parseFloat(formData.pagibig_calamity_loan) || 0
        ),
        sss_contribution: roundTo2Decimals(
          parseFloat(formData.sss_contribution) || 0
        ),
        philhealth_contribution: roundTo2Decimals(
          parseFloat(formData.philhealth_contribution) || 0
        ),
        pagibig_contribution: roundTo2Decimals(
          parseFloat(formData.pagibig_contribution) || 0
        ),
        withholding_tax: roundTo2Decimals(
          parseFloat(formData.withholding_tax) || 0
        ),
        other_deduction: roundTo2Decimals(
          parseFloat(formData.other_deduction) || 0
        ),
        sss_pro: roundTo2Decimals(parseFloat(formData.sss_pro) || 0),
      };

      const { error } = await syncCutoffDeductions(supabase, {
        employeeId: selectedEmployeeId,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        deductions: cutoffDeductions,
      });

      if (error) throw error;

      toast.success(
        hasSavedRows ? "Deductions updated successfully!" : "Deductions saved successfully!",
        {
          description: `Period: ${formatBiMonthlyPeriod(periodStart, periodEnd)}`,
        }
      );

      loadDeductions();
    } catch (error: any) {
      console.error("Error saving deductions:", error);
      toast.error(error.message || "Failed to save deductions");
    } finally {
      setSaving(false);
    }
  }

  const weeklyTotal =
    parseFloat(formData.vale_amount || "0") +
    parseFloat(formData.sss_salary_loan || "0") +
    parseFloat(formData.sss_calamity_loan || "0") +
    parseFloat(formData.pagibig_salary_loan || "0") +
    parseFloat(formData.pagibig_calamity_loan || "0");

  const govTotal =
    parseFloat(formData.sss_contribution || "0") +
    parseFloat(formData.philhealth_contribution || "0") +
    parseFloat(formData.pagibig_contribution || "0");

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full", dbPageWrapper)}>
        <DashboardPageHeader
          title="Deductions management"
          description="Configure bi-monthly deductions and government contributions per employee."
        />

        <CardSection>
          <VStack gap="4">
            {/* Period Navigation */}
            <VStack gap="2" align="start">
              <Label>Select Bi-Monthly Period (Monday - Friday, 2 weeks)</Label>
              <div className={dbPeriodNavRow}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPeriodStart(getPreviousBiMonthlyPeriod(periodStart))
                  }
                  className={dbPeriodNavButton}
                  aria-label="Previous period"
                >
                  <Icon name="CaretLeft" size={IconSizes.sm} />
                </Button>
                <div className="min-w-0 flex-1 px-1 text-center">
                  <p className="text-xs font-semibold text-foreground sm:text-sm">
                    {formatBiMonthlyPeriod(
                      periodStart,
                      getBiMonthlyPeriodEnd(periodStart)
                    )}
                  </p>
                  <BodySmall>
                    Period starting {format(periodStart, "MMMM d, yyyy")}
                  </BodySmall>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPeriodStart(getNextBiMonthlyPeriod(periodStart))
                  }
                  className={dbPeriodNavButton}
                  aria-label="Next period"
                >
                  <Icon name="CaretRight" size={IconSizes.sm} />
                </Button>
              </div>
            </VStack>

            {/* Employee Selection */}
            <VStack gap="2" align="start">
              <Label>Select Employee</Label>
              <Select
                value={selectedEmployeeId}
                onValueChange={(value) => setSelectedEmployeeId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- Select Employee --" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => {
                    const nameParts = emp.full_name?.trim().split(/\s+/) || [];
                    const lastName = emp.last_name || (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
                    const firstName = emp.first_name || (nameParts.length > 0 ? nameParts[0] : "");
                    const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
                    const displayName = lastName && firstName
                      ? `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""}`
                      : emp.full_name || "";
                    return (
                      <SelectItem key={emp.id} value={emp.id}>
                        {displayName} ({emp.employee_id})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </VStack>
          </VStack>
        </CardSection>

        {selectedEmployeeId && (
          <>
            <CardSection
              title="Bi-Monthly Deductions"
              description={`For period ${formatBiMonthlyPeriod(
                periodStart,
                getBiMonthlyPeriodEnd(periodStart)
              )}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VStack gap="2" align="start">
                  <Label>Vale</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.vale_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, vale_amount: e.target.value })
                    }
                  />
                  <Caption>Cash advance deduction</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>SSS Salary Loan</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sss_salary_loan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sss_salary_loan: e.target.value,
                      })
                    }
                  />
                </VStack>

                <VStack gap="2" align="start">
                  <Label>SSS Calamity Loan</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sss_calamity_loan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sss_calamity_loan: e.target.value,
                      })
                    }
                  />
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Pag-IBIG Salary Loan</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pagibig_salary_loan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pagibig_salary_loan: e.target.value,
                      })
                    }
                  />
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Pag-IBIG Calamity Loan</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pagibig_calamity_loan}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pagibig_calamity_loan: e.target.value,
                      })
                    }
                  />
                </VStack>
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <HStack justify="between" align="center">
                  <span className="font-semibold text-foreground">
                    Total Bi-Monthly Deductions:
                  </span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(weeklyTotal)}
                  </span>
                </HStack>
              </div>
            </CardSection>

            <CardSection
              title="Government Contributions & Overrides"
              description="SSS, PhilHealth, and Pag-IBIG are auto-calculated on payslips (50% per cutoff). Use these fields only for manual overrides, WISP, tax, or other deductions."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VStack gap="2" align="start">
                  <Label>SSS Contribution</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sss_contribution}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sss_contribution: e.target.value,
                      })
                    }
                  />
                  <Caption>Bi-monthly amount</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>PhilHealth Contribution</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.philhealth_contribution}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        philhealth_contribution: e.target.value,
                      })
                    }
                  />
                  <Caption>Bi-monthly amount</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Pag-IBIG Contribution</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pagibig_contribution}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pagibig_contribution: e.target.value,
                      })
                    }
                  />
                  <Caption>Bi-monthly amount</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Withholding Tax</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.withholding_tax}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        withholding_tax: e.target.value,
                      })
                    }
                  />
                  <Caption>Income tax withheld</Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>SSS PRO (WISP - Workers' Investment and Savings Program)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.sss_pro}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sss_pro: e.target.value,
                      })
                    }
                  />
                  <Caption>
                    WISP contribution (auto-calculated for MSC &gt; ₱20,000).
                    Mandatory for employees with monthly salary credit above ₱20,000.
                    You can manually override if needed.
                  </Caption>
                </VStack>

                <VStack gap="2" align="start">
                  <Label>Other Deduction</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.other_deduction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        other_deduction: e.target.value,
                      })
                    }
                  />
                  <Caption>Other manual deductions for this cutoff</Caption>
                </VStack>
              </div>

              <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
                <HStack justify="between" align="center">
                  <span className="font-semibold text-emerald-700">
                    Total Government Contributions:
                  </span>
                  <span className="text-xl font-bold text-emerald-900">
                    {formatCurrency(govTotal)}
                  </span>
                </HStack>
                <BodySmall className="text-emerald-600 mt-2">
                  Saved as individual rows in employee_deductions and picked up
                  by payslip generation for this cutoff.
                </BodySmall>
              </div>
            </CardSection>

            <HStack justify="end" gap="3">
              <Button variant="secondary" onClick={resetForm}>
                Reset
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                Save Deductions
              </Button>
            </HStack>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}