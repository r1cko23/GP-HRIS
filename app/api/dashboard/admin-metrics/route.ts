import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { format, startOfYear } from "date-fns";
import { verifyAdminAccess } from "@/lib/api-helpers";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";

export const runtime = "nodejs";

function sumField(
  rows: Array<Record<string, unknown>> | null | undefined,
  key: string
): number {
  return (rows ?? []).reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
}

export async function GET() {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const today = new Date();
    const currentCutoffStart = getBiMonthlyPeriodStart(today);
    const currentCutoffEnd = getBiMonthlyPeriodEnd(currentCutoffStart);
    const previousCutoffStart = getPreviousBiMonthlyPeriod(currentCutoffStart);
    const previousCutoffEnd = getBiMonthlyPeriodEnd(previousCutoffStart);
    const yearStart = startOfYear(today);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const currentStartStr = format(currentCutoffStart, "yyyy-MM-dd");
    const currentEndStr = format(currentCutoffEnd, "yyyy-MM-dd");
    const previousStartStr = format(previousCutoffStart, "yyyy-MM-dd");
    const previousEndStr = format(previousCutoffEnd, "yyyy-MM-dd");
    const yearStartStr = format(yearStart, "yyyy-MM-dd");
    const monthStartStr = format(monthStart, "yyyy-MM-dd");

    const trendWindows: Array<{ start: Date; end: Date }> = [];
    let trendCursor = getPreviousBiMonthlyPeriod(currentCutoffStart);
    for (let i = 0; i < 12; i++) {
      const end = getBiMonthlyPeriodEnd(trendCursor);
      trendWindows.push({ start: trendCursor, end });
      trendCursor = getPreviousBiMonthlyPeriod(trendCursor);
    }
    const oldestTrendStart = format(
      trendWindows[trendWindows.length - 1].start,
      "yyyy-MM-dd"
    );

    const [
      totalEmployeesRes,
      activeEmployeesRes,
      currentCutoffRes,
      previousCutoffRes,
      ytdRes,
      mtdRes,
      pendingApprovalsRes,
      trendPayslipsRes,
      recentPayslipsRes,
      totalPayslipsRes,
      pendingPayslipsRes,
      paidPayslipsRes,
      birRes,
    ] = await Promise.all([
      supabase.from("employees").select("*", { count: "exact", head: true }),
      supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("payslips")
        .select(
          "gross_pay, net_pay, employee_id, earnings_breakdown"
        )
        .gte("period_start", currentStartStr)
        .lte("period_end", currentEndStr)
        .eq("status", "paid"),
      supabase
        .from("payslips")
        .select("gross_pay, net_pay")
        .gte("period_start", previousStartStr)
        .lte("period_end", previousEndStr)
        .eq("status", "paid"),
      supabase
        .from("payslips")
        .select("gross_pay, net_pay")
        .gte("period_start", yearStartStr)
        .eq("status", "paid"),
      supabase
        .from("payslips")
        .select("gross_pay, period_start")
        .gte("period_start", monthStartStr)
        .eq("status", "paid"),
      supabase
        .from("payslips")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("payslips")
        .select("gross_pay, net_pay, employee_id, period_start, period_end")
        .gte("period_start", oldestTrendStart)
        .lte("period_end", currentEndStr)
        .eq("status", "paid"),
      supabase
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
        .limit(10),
      supabase.from("payslips").select("*", { count: "exact", head: true }),
      supabase
        .from("payslips")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("payslips")
        .select("*", { count: "exact", head: true })
        .eq("status", "paid"),
      supabase
        .from("payslips")
        .select(
          "deductions_breakdown, sss_amount, philhealth_amount, pagibig_amount, employee_id"
        )
        .gte("period_start", yearStartStr)
        .eq("status", "paid"),
    ]);

    const currentCutoffPayslips = currentCutoffRes.data ?? [];
    const previousCutoffPayslips = previousCutoffRes.data ?? [];
    const ytdPayslips = ytdRes.data ?? [];
    const mtdPayslips = mtdRes.data ?? [];
    const trendPayslips = trendPayslipsRes.data ?? [];
    const birPayslips = birRes.data ?? [];

    const currentCutoffGross = sumField(currentCutoffPayslips, "gross_pay");
    const currentCutoffNet = sumField(currentCutoffPayslips, "net_pay");
    const currentCutoffEmployeeCount = new Set(
      currentCutoffPayslips.map((p) => p.employee_id)
    ).size;
    const previousCutoffGross = sumField(previousCutoffPayslips, "gross_pay");
    const previousCutoffNet = sumField(previousCutoffPayslips, "net_pay");
    const ytdGross = sumField(ytdPayslips, "gross_pay");
    const ytdNet = sumField(ytdPayslips, "net_pay");
    const mtdGross = sumField(mtdPayslips, "gross_pay");
    const mtdCutoffs = new Set(mtdPayslips.map((p) => p.period_start)).size;

    const totalEmployees = totalEmployeesRes.count ?? 0;
    const activeEmployees = activeEmployeesRes.count ?? 0;

    const cutoffTrends = [...trendWindows].reverse().map(({ start, end }) => {
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");
      const rows = trendPayslips.filter(
        (p) =>
          String(p.period_start) >= startStr && String(p.period_end) <= endStr
      );
      return {
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        grossPay: sumField(rows, "gross_pay"),
        netPay: sumField(rows, "net_pay"),
        employeeCount: new Set(rows.map((p) => p.employee_id)).size,
        periodLabel: formatBiMonthlyPeriod(start, end),
      };
    });

    let regularPay = 0;
    let nightDiffPay = 0;
    let holidayPay = 0;
    let sundayPay = 0;
    for (const payslip of currentCutoffPayslips) {
      const earnings = (payslip.earnings_breakdown as Record<string, unknown>) || {};
      // earnings_breakdown may be attendance array or object — support both
      if (Array.isArray(earnings)) {
        continue;
      }
      regularPay += Number(earnings.regularPay ?? 0);
      nightDiffPay += Number(earnings.nightDifferential ?? 0);
      holidayPay += Number(earnings.holidayPay ?? 0);
      sundayPay += Number(earnings.sundayPay ?? 0);
    }

    let ytdTaxWithheld = 0;
    let ytdSSS = 0;
    let ytdPhilHealth = 0;
    let ytdPagIBIG = 0;
    const employeesWithPayslips = new Set<string>();
    for (const payslip of birPayslips) {
      const deductions = (payslip.deductions_breakdown as Record<string, unknown>) || {};
      ytdTaxWithheld += Number(deductions.tax ?? 0);
      ytdSSS += Number(payslip.sss_amount ?? 0);
      ytdPhilHealth += Number(payslip.philhealth_amount ?? 0);
      ytdPagIBIG += Number(payslip.pagibig_amount ?? 0);
      if (payslip.employee_id) employeesWithPayslips.add(String(payslip.employee_id));
    }

    return NextResponse.json({
      stats: {
        currentCutoffGross,
        currentCutoffNet,
        currentCutoffEmployeeCount,
        currentCutoffPeriod: formatBiMonthlyPeriod(
          currentCutoffStart,
          currentCutoffEnd
        ),
        previousCutoffGross,
        previousCutoffNet,
        previousCutoffPeriod: formatBiMonthlyPeriod(
          previousCutoffStart,
          previousCutoffEnd
        ),
        ytdGross,
        ytdNet,
        ytdDeductions: ytdGross - ytdNet,
        totalEmployees,
        activeEmployees,
        inactiveEmployees: totalEmployees - activeEmployees,
        mtdGross,
        mtdCutoffs,
        criticalAlerts: 0,
        warningAlerts: 0,
        pendingApprovals: pendingApprovalsRes.count ?? 0,
      },
      cutoffTrends,
      costBreakdown: {
        regularPay,
        nightDiffPay,
        holidayPay,
        sundayPay,
      },
      payslipStats: {
        totalPayslips: totalPayslipsRes.count ?? 0,
        pendingApprovals: pendingPayslipsRes.count ?? 0,
        paid: paidPayslipsRes.count ?? 0,
        recentPayslips: recentPayslipsRes.data ?? [],
      },
      birStats: {
        ytdTaxWithheld,
        ytdSSS,
        ytdPhilHealth,
        ytdPagIBIG,
        totalEmployeesWithPayslips: employeesWithPayslips.size,
      },
      departments: [],
    });
  } catch (error: unknown) {
    console.error("Admin metrics GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load admin metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
