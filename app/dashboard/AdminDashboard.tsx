"use client";

/**
 * ADMIN/EXECUTIVE DASHBOARD
 */

import { useEffect, useState } from "react";
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
import { format } from "date-fns";

interface ExecutiveStats {
  currentCutoffGross: number;
  currentCutoffNet: number;
  currentCutoffEmployeeCount: number;
  currentCutoffPeriod: string;
  previousCutoffGross: number;
  previousCutoffNet: number;
  previousCutoffPeriod: string;
  ytdGross: number;
  ytdNet: number;
  ytdDeductions: number;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  mtdGross: number;
  mtdCutoffs: number;
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
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
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

  useEffect(() => {
    async function fetchExecutiveMetrics() {
      try {
        const res = await fetch("/api/dashboard/admin-metrics");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to load admin metrics");
        }
        const json = await res.json();
        setStats(json.stats ?? null);
        setCutoffTrends(json.cutoffTrends ?? []);
        setCostBreakdown(json.costBreakdown ?? null);
        setPayslipStats(
          json.payslipStats ?? {
            totalPayslips: 0,
            pendingApprovals: 0,
            paid: 0,
            recentPayslips: [],
          }
        );
        setBirStats(
          json.birStats ?? {
            ytdTaxWithheld: 0,
            ytdSSS: 0,
            ytdPhilHealth: 0,
            ytdPagIBIG: 0,
            totalEmployeesWithPayslips: 0,
          }
        );
        setDepartments(json.departments ?? []);
      } catch (error: any) {
        console.error("Error fetching executive metrics:", error);
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
  }, []);

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
              <VStack gap="3" className="w-full">
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