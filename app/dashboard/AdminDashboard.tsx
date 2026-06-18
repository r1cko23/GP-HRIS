"use client";

/**
 * ADMIN/EXECUTIVE DASHBOARD - Example Implementation
 *
 * This is an example implementation showing what an admin-specific dashboard
 * would look like with executive-level metrics and analytics.
 *
 * To use this:
 * 1. Check user role on page load
 * 2. If role === 'admin', show this dashboard
 * 3. If role is Head of HR / HR family, show the regular dashboard (current dashboard/page.tsx)
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MetricCard } from "@/components/ui/metric-card";
import { CardSection } from "@/components/ui/card-section";
import { BodySmall } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { formatCurrency } from "@/utils/format";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { cn } from "@/lib/utils";
import { dbKpiGrid, dbPageWrapper } from "@/lib/dashboard-ui";
import { format, startOfYear } from "date-fns";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";

interface ExecutiveStats {
  // Current Cutoff Period
  currentCutoffGross: number;
  currentCutoffNet: number;
  currentCutoffEmployeeCount: number;
  currentCutoffPeriod: string;

  // Previous Cutoff (for comparison)
  previousCutoffGross: number;
  previousCutoffNet: number;
  previousCutoffPeriod: string;

  // Year to Date
  ytdGross: number;
  ytdNet: number;
  ytdDeductions: number;

  // Workforce
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;

  // Month to Date (current month)
  mtdGross: number;
  mtdCutoffs: number;

  // Alerts
  criticalAlerts: number;
  warningAlerts: number;
  pendingApprovals: number;
}

interface DepartmentCost {
  department: string;
  employeeCount: number;
  totalCost: number;
  avgCostPerEmployee: number;
  percentage: number;
}

interface CutoffTrend {
  periodStart: string;
  periodEnd: string;
  grossPay: number;
  netPay: number;
  employeeCount: number;
  periodLabel: string;
}

interface CostBreakdown {
  regularPay: number;
  nightDiffPay: number;
  holidayPay: number;
  sundayPay: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<ExecutiveStats | null>(null);
  const [departments, setDepartments] = useState<DepartmentCost[]>([]);
  const [cutoffTrends, setCutoffTrends] = useState<CutoffTrend[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [payslipStats, setPayslipStats] = useState({
    totalPayslips: 0,
    pendingApprovals: 0,
    paid: 0,
    recentPayslips: [] as any[],
  });
  const [birStats, setBirStats] = useState({
    ytdTaxWithheld: 0,
    ytdSSS: 0,
    ytdPhilHealth: 0,
    ytdPagIBIG: 0,
    totalEmployeesWithPayslips: 0,
  });
  const supabase = createClient();

  useEffect(() => {
    async function fetchExecutiveMetrics() {
      try {
        const today = new Date();

        // Get current bi-monthly cutoff period
        const currentCutoffStart = getBiMonthlyPeriodStart(today);
        const currentCutoffEnd = getBiMonthlyPeriodEnd(currentCutoffStart);
        currentCutoffEnd.setHours(23, 59, 59, 999);

        // Get previous bi-monthly cutoff period
        const previousCutoffStart = getPreviousBiMonthlyPeriod(currentCutoffStart);
        const previousCutoffEnd = getBiMonthlyPeriodEnd(previousCutoffStart);
        previousCutoffEnd.setHours(23, 59, 59, 999);

        const yearStart = startOfYear(today);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Format period labels
        const currentCutoffLabel = formatBiMonthlyPeriod(currentCutoffStart, currentCutoffEnd);
        const previousCutoffLabel = formatBiMonthlyPeriod(previousCutoffStart, previousCutoffEnd);

        // 1. Workforce Stats
        const { count: totalEmployees, error: employeesError } = await supabase
          .from("employees")
          .select("*", { count: "exact", head: true });

        if (employeesError) {
          console.error("Error fetching employees:", employeesError);
        }

        const { count: activeEmployees, error: activeEmployeesError } =
          await supabase
            .from("employees")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true);

        if (activeEmployeesError) {
          console.error(
            "Error fetching active employees:",
            activeEmployeesError
          );
        }

        const inactiveEmployees =
          (totalEmployees || 0) - (activeEmployees || 0);

        // 2. Current Cutoff Period Payslips (more accurate than time entries)
        const { data: currentCutoffPayslips, error: currentCutoffError } =
          await supabase
            .from("payslips")
            .select("gross_pay, net_pay, employee_id, period_start, period_end")
            .gte("period_start", format(currentCutoffStart, "yyyy-MM-dd"))
            .lte("period_end", format(currentCutoffEnd, "yyyy-MM-dd"))
            .eq("status", "paid");

        if (currentCutoffError) {
          console.error(
            "Error fetching current cutoff payslips:",
            currentCutoffError
          );
        }

        const currentCutoffGross =
          (currentCutoffPayslips || []).reduce(
            (sum, p) => sum + Number(p.gross_pay || 0),
            0
          ) || 0;
        const currentCutoffNet =
          (currentCutoffPayslips || []).reduce(
            (sum, p) => sum + Number(p.net_pay || 0),
            0
          ) || 0;
        const currentCutoffEmployeeCount =
          new Set(
            (currentCutoffPayslips || []).map((p) => p.employee_id)
          ).size || 0;

        // 3. Previous Cutoff Period Payslips
        const { data: previousCutoffPayslips } = await supabase
          .from("payslips")
          .select("gross_pay, net_pay")
          .gte("period_start", format(previousCutoffStart, "yyyy-MM-dd"))
          .lte("period_end", format(previousCutoffEnd, "yyyy-MM-dd"))
          .eq("status", "paid");

        const previousCutoffGross =
          (previousCutoffPayslips || []).reduce(
            (sum, p) => sum + Number(p.gross_pay || 0),
            0
          ) || 0;
        const previousCutoffNet =
          (previousCutoffPayslips || []).reduce(
            (sum, p) => sum + Number(p.net_pay || 0),
            0
          ) || 0;

        // 4. Year to Date Stats from Payslips
        const { data: ytdPayslips } = await supabase
          .from("payslips")
          .select("gross_pay, net_pay, deductions_breakdown")
          .gte("period_start", format(yearStart, "yyyy-MM-dd"))
          .eq("status", "paid");

        const ytdGross =
          (ytdPayslips || []).reduce(
            (sum, p) => sum + Number(p.gross_pay || 0),
            0
          ) || 0;
        const ytdNet =
          (ytdPayslips || []).reduce(
            (sum, p) => sum + Number(p.net_pay || 0),
            0
          ) || 0;
        const ytdDeductions = ytdGross - ytdNet;

        // 5. Month to Date
        const { data: mtdPayslips } = await supabase
          .from("payslips")
          .select("gross_pay, period_start")
          .gte("period_start", format(monthStart, "yyyy-MM-dd"))
          .eq("status", "paid");

        const mtdGross =
          (mtdPayslips || []).reduce(
            (sum, p) => sum + Number(p.gross_pay || 0),
            0
          ) || 0;
        const uniqueCutoffs = new Set(
          (mtdPayslips || []).map((p) => p.period_start)
        );
        const mtdCutoffs = uniqueCutoffs.size;

        // 6. Pending Approvals (draft payslips)
        const { count: pendingApprovals } = await supabase
          .from("payslips")
          .select("*", { count: "exact", head: true })
          .eq("status", "draft");

        setStats({
          currentCutoffGross,
          currentCutoffNet,
          currentCutoffEmployeeCount,
          currentCutoffPeriod: currentCutoffLabel,
          previousCutoffGross,
          previousCutoffNet,
          previousCutoffPeriod: previousCutoffLabel,
          ytdGross,
          ytdNet,
          ytdDeductions,
          totalEmployees: totalEmployees || 0,
          activeEmployees: activeEmployees || 0,
          inactiveEmployees,
          mtdGross,
          mtdCutoffs,
          criticalAlerts: 0,
          warningAlerts: 0,
          pendingApprovals: pendingApprovals || 0,
        });

        // 7. Cutoff Trends (last 12 cutoffs) - using payslips
        let trendPeriodStart = getPreviousBiMonthlyPeriod(currentCutoffStart);
        const trendPeriods: CutoffTrend[] = [];

        for (let i = 0; i < 12; i++) {
          const trendPeriodEnd = getBiMonthlyPeriodEnd(trendPeriodStart);

          const { data: trendPayslips } = await supabase
            .from("payslips")
            .select("gross_pay, net_pay, employee_id")
            .gte("period_start", format(trendPeriodStart, "yyyy-MM-dd"))
            .lte("period_end", format(trendPeriodEnd, "yyyy-MM-dd"))
            .eq("status", "paid");

          const trendGross =
            (trendPayslips || []).reduce(
              (sum, p) => sum + Number(p.gross_pay || 0),
              0
            ) || 0;
          const trendNet =
            (trendPayslips || []).reduce(
              (sum, p) => sum + Number(p.net_pay || 0),
              0
            ) || 0;
          const trendEmployeeCount =
            new Set((trendPayslips || []).map((p) => p.employee_id)).size || 0;

          trendPeriods.push({
            periodStart: trendPeriodStart.toISOString(),
            periodEnd: trendPeriodEnd.toISOString(),
            grossPay: trendGross,
            netPay: trendNet,
            employeeCount: trendEmployeeCount,
            periodLabel: formatBiMonthlyPeriod(trendPeriodStart, trendPeriodEnd),
          });

          trendPeriodStart = getPreviousBiMonthlyPeriod(trendPeriodStart);
        }

        setCutoffTrends(trendPeriods.reverse()); // Reverse to show oldest first

        // 8. Cost Breakdown (current cutoff) - from payslips earnings breakdown
        if (currentCutoffPayslips && currentCutoffPayslips.length > 0) {
          let regularPay = 0;
          let nightDiffPay = 0;
          let holidayPay = 0;
          let sundayPay = 0;

          currentCutoffPayslips.forEach((payslip: any) => {
            const earnings = payslip.earnings_breakdown || {};
            regularPay += Number(earnings.regularPay || 0);
            nightDiffPay += Number(earnings.nightDifferential || 0);
            holidayPay += Number(earnings.holidayPay || 0);
            sundayPay += Number(earnings.sundayPay || 0);
          });

          setCostBreakdown({
            regularPay,
            nightDiffPay,
            holidayPay,
            sundayPay,
          });
        }

        // 9. Payslip Statistics
        const { data: payslipData } = await supabase
          .from("payslips")
          .select(
            `
            id,
            status,
            created_at,
            net_pay,
            employee_id,
            employees!payslips_employee_id_fkey(full_name, employee_id)
          `
          )
          .order("created_at", { ascending: false })
          .limit(10);

        const { count: totalPayslips } = await supabase
          .from("payslips")
          .select("*", { count: "exact", head: true });

        const { count: pendingPayslips } = await supabase
          .from("payslips")
          .select("*", { count: "exact", head: true })
          .eq("status", "draft");

        const { count: paidPayslips } = await supabase
          .from("payslips")
          .select("*", { count: "exact", head: true })
          .eq("status", "paid");

        setPayslipStats({
          totalPayslips: totalPayslips || 0,
          pendingApprovals: pendingPayslips || 0,
          paid: paidPayslips || 0,
          recentPayslips: payslipData || [],
        });

        // 10. BIR Statistics (YTD from paid payslips)
        // Reuse yearStart from line 127
        const { data: birPayslips } = await supabase
          .from("payslips")
          .select("deductions_breakdown, sss_amount, philhealth_amount, pagibig_amount, employee_id")
          .gte("period_start", yearStart.toISOString().split("T")[0])
          .eq("status", "paid");

        let ytdTaxWithheld = 0;
        let ytdSSS = 0;
        let ytdPhilHealth = 0;
        let ytdPagIBIG = 0;
        const employeesWithPayslips = new Set<string>();

        (birPayslips || []).forEach((payslip: any) => {
          const deductions = payslip.deductions_breakdown as any;
          ytdTaxWithheld += Number(deductions?.tax || 0);
          ytdSSS += Number(payslip.sss_amount || 0);
          ytdPhilHealth += Number(payslip.philhealth_amount || 0);
          ytdPagIBIG += Number(payslip.pagibig_amount || 0);
          if (payslip.employee_id) {
            employeesWithPayslips.add(payslip.employee_id);
          }
        });

        setBirStats({
          ytdTaxWithheld,
          ytdSSS,
          ytdPhilHealth,
          ytdPagIBIG,
          totalEmployeesWithPayslips: employeesWithPayslips.size,
        });
      } catch (error: any) {
        console.error("Error fetching executive metrics:", error);
        console.error("Error details:", {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        });
        // Set default stats on error so UI doesn't break
        setStats({
          currentCutoffGross: 0,
          currentCutoffNet: 0,
          currentCutoffEmployeeCount: 0,
          currentCutoffPeriod: "",
          previousCutoffGross: 0,
          previousCutoffNet: 0,
          previousCutoffPeriod: "",
          ytdGross: 0,
          ytdNet: 0,
          ytdDeductions: 0,
          totalEmployees: 0,
          activeEmployees: 0,
          inactiveEmployees: 0,
          mtdGross: 0,
          mtdCutoffs: 0,
          criticalAlerts: 0,
          warningAlerts: 0,
          pendingApprovals: 0,
        });
        setPayslipStats({
          totalPayslips: 0,
          pendingApprovals: 0,
          paid: 0,
          recentPayslips: [],
        });
        setBirStats({
          ytdTaxWithheld: 0,
          ytdSSS: 0,
          ytdPhilHealth: 0,
          ytdPagIBIG: 0,
          totalEmployeesWithPayslips: 0,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchExecutiveMetrics();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon
          name="ArrowsClockwise"
          size={IconSizes.lg}
          className="animate-spin text-muted-foreground"
        />
      </div>
    );
  }

  // Calculate percentage changes
  const cutoffOverCutoffChange = stats?.previousCutoffGross
    ? ((stats.currentCutoffGross - stats.previousCutoffGross) /
        stats.previousCutoffGross) *
      100
    : 0;

  const avgCostPerEmployee =
    stats && stats.currentCutoffEmployeeCount > 0
      ? stats.currentCutoffGross / stats.currentCutoffEmployeeCount
      : 0;

  const isIncreasing = cutoffOverCutoffChange > 0;

  const pendingCount = stats?.pendingApprovals ?? 0;
  const hasAlerts =
    pendingCount > 0 ||
    (stats?.criticalAlerts ?? 0) > 0 ||
    (stats?.warningAlerts ?? 0) > 0;

  return (
      <div className={cn("w-full", dbPageWrapper)}>
        <DashboardPageHeader
          title="Executive dashboard"
          description={stats?.currentCutoffPeriod || undefined}
        />

        {/* Priority actions — full width at top */}
        {hasAlerts && (
          <div className="flex w-full flex-col gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {pendingCount}
                </span>
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Pending approvals
                </span>
              </div>
              {(stats?.criticalAlerts ?? 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Icon name="WarningCircle" size={IconSizes.sm} className="text-destructive" />
                  <span className="text-sm font-bold text-destructive">{stats?.criticalAlerts}</span>
                  <span className="text-xs text-muted-foreground">critical</span>
                </div>
              )}
              {(stats?.warningAlerts ?? 0) > 0 && (
                <div className="flex items-center gap-1.5">
                  <Icon name="WarningCircle" size={IconSizes.sm} className="text-yellow-600" />
                  <span className="text-sm font-bold text-yellow-600">{stats?.warningAlerts}</span>
                  <span className="text-xs text-muted-foreground">warning</span>
                </div>
              )}
            </div>
            <Link href="/payslips" className="shrink-0">
              <Button className="w-full sm:w-auto">
                View pending payslips
                <Icon name="CaretRight" size={IconSizes.sm} />
              </Button>
            </Link>
          </div>
        )}

        <div className={dbKpiGrid}>
          <MetricCard
            label="Payroll this cutoff"
            value={
              <span className="font-bold text-primary">
                {formatCurrency(stats?.currentCutoffGross || 0)}
              </span>
            }
            meta={
              stats?.previousCutoffGross ? (
                <span
                  className={cn(
                    "font-semibold",
                    isIncreasing ? "text-emerald-600" : "text-destructive"
                  )}
                >
                  {isIncreasing ? "↑" : "↓"} {Math.abs(cutoffOverCutoffChange).toFixed(1)}%
                </span>
              ) : null
            }
            icon={
              <span className="text-lg font-bold text-primary">₱</span>
            }
          />
          <MetricCard
            label="Active employees"
            value={
              <span className="font-bold">{stats?.activeEmployees ?? 0}</span>
            }
            meta={
              (stats?.inactiveEmployees ?? 0) > 0 ? (
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{stats?.inactiveEmployees}</span> inactive
                </span>
              ) : null
            }
            icon={<Icon name="UsersThree" size={IconSizes.sm} />}
          />
          <MetricCard
            label="Avg cost / employee"
            value={
              <span className="font-bold">{formatCurrency(avgCostPerEmployee)}</span>
            }
            icon={<Icon name="ChartLineUp" size={IconSizes.sm} />}
          />
          <MetricCard
            label="YTD payroll"
            value={
              <span className="font-bold">{formatCurrency(stats?.ytdGross || 0)}</span>
            }
            icon={<Icon name="CalendarBlank" size={IconSizes.sm} />}
          />
        </div>

        {/* Main content: charts left, summary right */}
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="flex flex-col gap-4 lg:col-span-8 lg:gap-6">
            <CardSection title="Cost breakdown" className="w-full">
              <VStack gap="3" className="w-full">
                {costBreakdown ? (
                  (() => {
                    const total =
                      costBreakdown.regularPay +
                      costBreakdown.nightDiffPay +
                      costBreakdown.holidayPay +
                      costBreakdown.sundayPay;
                    const rows = [
                      { label: "Regular hours", value: costBreakdown.regularPay },
                      { label: "Night differential", value: costBreakdown.nightDiffPay },
                      { label: "Holiday pay", value: costBreakdown.holidayPay },
                      { label: "Sunday / rest day", value: costBreakdown.sundayPay },
                    ];
                    return rows.map((row) => {
                      const pct = total > 0 ? ((row.value / total) * 100).toFixed(0) : "0";
                      return (
                        <HStack key={row.label} justify="between" align="center">
                          <span className="text-sm text-muted-foreground">{row.label}</span>
                          <span className="text-sm font-bold tabular-nums text-foreground">
                            {formatCurrency(row.value)}{" "}
                            <span className="font-medium text-muted-foreground">({pct}%)</span>
                          </span>
                        </HStack>
                      );
                    });
                  })()
                ) : (
                  <BodySmall className="text-muted-foreground">No data for this cutoff</BodySmall>
                )}
              </VStack>
            </CardSection>

            <CardSection title="Payroll cost trend" className="w-full">
              <VStack gap="2.5" className="w-full">
                {cutoffTrends.length > 0 ? (
                  cutoffTrends.map((trend, index) => {
                    const maxValue = Math.max(...cutoffTrends.map((t) => t.grossPay));
                    const percentage = maxValue > 0 ? (trend.grossPay / maxValue) * 100 : 0;
                    return (
                      <div key={index} className="w-full">
                        <HStack justify="between" align="center" className="mb-1 w-full">
                          <span className="text-xs text-muted-foreground">{trend.periodLabel}</span>
                          <span className="text-sm font-bold tabular-nums text-foreground">
                            {formatCurrency(trend.grossPay)}
                          </span>
                        </HStack>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <BodySmall className="py-4 text-center text-muted-foreground">
                    No payroll data yet
                  </BodySmall>
                )}
              </VStack>
            </CardSection>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-4 lg:gap-6">
            <CardSection title="Cash flow" className="w-full">
              <VStack gap="3" className="w-full">
                <HStack justify="between" align="center">
                  <span className="text-sm text-muted-foreground">This cutoff net</span>
                  <span className="text-base font-bold tabular-nums text-primary">
                    {formatCurrency(stats?.currentCutoffNet || 0)}
                  </span>
                </HStack>
                <HStack justify="between" align="center">
                  <span className="text-sm text-muted-foreground">Last cutoff net</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(stats?.previousCutoffNet || 0)}
                  </span>
                </HStack>
                <HStack
                  justify="between"
                  align="center"
                  className="border-t border-border pt-3"
                >
                  <span className="text-sm font-medium">Month to date</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {formatCurrency(stats?.mtdGross || 0)}
                  </span>
                </HStack>
              </VStack>
            </CardSection>

            <CardSection
              title={`BIR & contributions · ${format(new Date(), "yyyy")}`}
              className="w-full"
            >
              <VStack gap="3" className="w-full">
                {[
                  { label: "Tax withheld", value: birStats.ytdTaxWithheld, highlight: true },
                  { label: "SSS", value: birStats.ytdSSS },
                  { label: "PhilHealth", value: birStats.ytdPhilHealth },
                  { label: "Pag-IBIG", value: birStats.ytdPagIBIG },
                ].map((item) => (
                  <HStack key={item.label} justify="between" align="center">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        item.highlight
                          ? "text-base font-bold text-primary"
                          : "text-sm font-semibold"
                      )}
                    >
                      {formatCurrency(item.value)}
                    </span>
                  </HStack>
                ))}
                <HStack
                  justify="between"
                  align="center"
                  className="border-t border-border pt-3"
                >
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-base font-bold tabular-nums">
                    {formatCurrency(
                      birStats.ytdTaxWithheld +
                        birStats.ytdSSS +
                        birStats.ytdPhilHealth +
                        birStats.ytdPagIBIG
                    )}
                  </span>
                </HStack>
                <Link href="/bir-reports" className="pt-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Icon name="FileText" size={IconSizes.sm} />
                    BIR reports
                  </Button>
                </Link>
              </VStack>
            </CardSection>

            {payslipStats.recentPayslips.length > 0 && (
              <CardSection title="Recent payslips" className="w-full">
                <div className="space-y-2 w-full">
                  {payslipStats.recentPayslips.slice(0, 5).map((payslip: any) => (
                    <Link
                      key={payslip.id}
                      href={`/payslips?employee=${payslip.employee_id}`}
                      className="block rounded-lg border border-border/80 p-3 transition-colors hover:bg-accent"
                    >
                      <HStack justify="between" align="center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {(payslip.employees as any)?.full_name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payslip.created_at), "MMM d")}
                          </p>
                        </div>
                        <VStack gap="1" align="end">
                          <Badge
                            variant={payslip.status === "paid" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {payslip.status}
                          </Badge>
                          <span className="text-sm font-bold tabular-nums">
                            {formatCurrency(payslip.net_pay || 0)}
                          </span>
                        </VStack>
                      </HStack>
                    </Link>
                  ))}
                </div>
              </CardSection>
            )}
          </div>
        </div>
      </div>
  );
}