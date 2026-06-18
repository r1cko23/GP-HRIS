"use client";

import { useMemo } from "react";
import { hasRichComposition } from "@/lib/payroll-summary/composition-chart";
import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary/types";
import { PayrollAuditCompositionChart } from "@/components/payroll-audit/PayrollAuditCompositionChart";
import { CardSection } from "@/components/ui/card-section";
import { Caption } from "@/components/ui/typography";
import { buildCompositionSeries } from "@/lib/payroll-summary/composition-chart";

interface PayrollAuditInsightsPanelProps {
  trend: PayrollSummaryUploadRecord[];
  clientName?: string;
}

export function PayrollAuditInsightsPanel({
  trend,
  clientName,
}: PayrollAuditInsightsPanelProps) {
  const sortedTrend = useMemo(
    () =>
      [...trend].sort((a, b) =>
        a.periodStart.localeCompare(b.periodStart)
      ),
    [trend]
  );

  const compositionSeries = useMemo(
    () => buildCompositionSeries(sortedTrend, "gross"),
    [sortedTrend]
  );
  const richComposition = hasRichComposition(compositionSeries);

  if (sortedTrend.length < 3) {
    return null;
  }

  return (
    <CardSection
      title={clientName ? `Payroll composition · ${clientName}` : "Payroll composition"}
      className="w-full"
    >
      {!richComposition && (
        <div className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2">
          <Caption className="text-amber-900">
            Upload another cutoff or re-upload if this register layout is not mapped yet.
          </Caption>
        </div>
      )}
      <PayrollAuditCompositionChart trend={sortedTrend} />
    </CardSection>
  );
}
