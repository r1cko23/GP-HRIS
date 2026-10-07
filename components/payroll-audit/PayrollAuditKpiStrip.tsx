"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { formatCurrency } from "@/utils/format";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import { dbKpiGrid } from "@/lib/dashboard-ui";
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
    <div className="flex h-full min-w-0 items-start justify-between gap-3 rounded-md border border-border/80 bg-card px-3 py-2.5">
      <VStack gap="1" align="start" className="min-w-0 flex-1">
        <BodySmall className="text-xs text-muted-foreground">{label}</BodySmall>
        <div className="truncate text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {value}
        </div>
        {sublabel ? (
          <Caption className="truncate text-muted-foreground">{sublabel}</Caption>
        ) : null}
        {deltaPct != null ? (
          <HStack gap="1" align="center">
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
        ) : null}
      </VStack>
      <div className={`shrink-0 rounded-md p-1.5 ${iconBg}`}>
        <Icon name={icon} size={IconSizes.sm} className={iconClass} />
      </div>
    </div>
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
      <div className={dbKpiGrid}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-md border border-border/80 bg-muted/30"
          />
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
    <div className={dbKpiGrid + " items-stretch"}>
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
