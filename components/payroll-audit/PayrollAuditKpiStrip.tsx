"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { formatCurrency } from "@/utils/format";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary/types";

interface PayrollAuditKpiStripProps {
  trend: PayrollSummaryUploadRecord[];
  loading?: boolean;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function KpiCard({
  label,
  value,
  sublabel,
  deltaPct,
  icon,
  iconClass,
  iconBg,
}: {
  label: string;
  value: string;
  sublabel?: string;
  deltaPct?: number | null;
  icon: "CurrencyDollarSimple" | "Receipt" | "UsersThree" | "Timer";
  iconClass: string;
  iconBg: string;
}) {
  const isUp = deltaPct != null && deltaPct > 0;
  const isDown = deltaPct != null && deltaPct < 0;

  return (
    <Card className="stats-card-surface h-full min-h-[130px]">
      <CardContent className="p-5 h-full flex flex-col">
        <HStack justify="between" align="start" className="flex-1">
          <VStack gap="1" align="start" className="flex-1 min-w-0">
            <BodySmall className="text-muted-foreground">{label}</BodySmall>
            <div className="stats-value text-foreground truncate w-full">{value}</div>
            {sublabel && (
              <Caption className="text-muted-foreground truncate">{sublabel}</Caption>
            )}
            {deltaPct != null && (
              <HStack gap="1" align="center" className="mt-1">
                {(isUp || isDown) && (
                  <Icon
                    name={isUp ? "CaretUp" : "CaretDown"}
                    size={IconSizes.xs}
                    className={isUp ? "text-emerald-600" : "text-red-600"}
                  />
                )}
                <Caption
                  className={
                    isUp
                      ? "text-emerald-600"
                      : isDown
                        ? "text-red-600"
                        : "text-muted-foreground"
                  }
                >
                  {Math.abs(deltaPct).toFixed(1)}% vs prior cutoff
                </Caption>
              </HStack>
            )}
          </VStack>
          <div className={`p-3 rounded-full flex-shrink-0 ${iconBg}`}>
            <Icon name={icon} size={IconSizes.md} className={iconClass} />
          </div>
        </HStack>
      </CardContent>
    </Card>
  );
}

export function PayrollAuditKpiStrip({ trend, loading }: PayrollAuditKpiStripProps) {
  const { latest, previous } = useMemo(() => {
    const sorted = [...trend].sort((a, b) =>
      a.periodStart.localeCompare(b.periodStart)
    );
    return {
      latest: sorted[sorted.length - 1] ?? null,
      previous: sorted.length >= 2 ? sorted[sorted.length - 2] : null,
    };
  }, [trend]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="stats-card-surface h-[130px] animate-pulse">
            <CardContent className="p-5 h-full bg-muted/20 rounded-lg" />
          </Card>
        ))}
      </div>
    );
  }

  if (!latest) {
    return (
      <Card className="stats-card-surface border-dashed">
        <CardContent className="py-8 text-center">
          <Caption className="text-muted-foreground">
            Upload a payroll register to populate summary metrics.
          </Caption>
        </CardContent>
      </Card>
    );
  }

  const periodLabel = formatBiMonthlyPeriod(
    new Date(latest.periodStart + "T00:00:00"),
    new Date(latest.periodEnd + "T00:00:00")
  );

  const otAmount = latest.totalOTAmount ?? 0;
  const prevOt = previous?.totalOTAmount ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
      <KpiCard
        label="Net pay"
        value={formatCurrency(latest.netAmountTotal)}
        sublabel={periodLabel}
        deltaPct={
          previous
            ? pctChange(latest.netAmountTotal, previous.netAmountTotal)
            : undefined
        }
        icon="CurrencyDollarSimple"
        iconClass="text-emerald-600"
        iconBg="bg-emerald-50"
      />
      <KpiCard
        label="Gross pay"
        value={formatCurrency(latest.grossAmountTotal)}
        sublabel={periodLabel}
        deltaPct={
          previous
            ? pctChange(latest.grossAmountTotal, previous.grossAmountTotal)
            : undefined
        }
        icon="Receipt"
        iconClass="text-blue-600"
        iconBg="bg-blue-50"
      />
      <KpiCard
        label="Headcount"
        value={String(latest.employeeCount)}
        sublabel={`${latest.hoursWorkedTotal.toFixed(0)} regular hrs`}
        deltaPct={
          previous
            ? pctChange(latest.employeeCount, previous.employeeCount)
            : undefined
        }
        icon="UsersThree"
        iconClass="text-violet-600"
        iconBg="bg-violet-50"
      />
      <KpiCard
        label="Total OT"
        value={formatCurrency(otAmount)}
        sublabel={`${latest.regOTHoursTotal.toFixed(1)} OT hrs · SIL cutoff ${formatCurrency(latest.silCutoffTotal)}`}
        deltaPct={previous ? pctChange(otAmount, prevOt) : undefined}
        icon="Timer"
        iconClass="text-amber-600"
        iconBg="bg-amber-50"
      />
    </div>
  );
}
