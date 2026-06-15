"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/utils/format";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import { riskFlagLabel } from "@/lib/payroll-summary/anomaly-fields";
import type { EmployeeFieldChange } from "@/lib/payroll-summary/anomaly-fields";
import type {
  EmployeeAnomalyRow,
  PayrollEmployeeAnomalies,
} from "@/lib/payroll-summary/types";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";

function formatDelta(
  value: number | null,
  kind: "currency" | "hours" | "count" = "hours"
): string {
  if (value == null) return "—";
  const prefix = value > 0 ? "+" : "";
  if (kind === "currency") return `${prefix}${formatCurrency(value)}`;
  if (kind === "count") return `${prefix}${value}`;
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function deltaTone(value: number | null, invert = false): string {
  if (value == null || value === 0) return "text-muted-foreground";
  const up = value > 0;
  const bad = invert ? !up : up;
  return bad ? "text-amber-700" : "text-emerald-700";
}

function statusConfig(status: EmployeeAnomalyRow["status"]) {
  switch (status) {
    case "added":
      return {
        label: "New employee",
        variant: "default" as const,
        icon: "UserPlus" as const,
        className: "border-amber-200 bg-amber-50/60",
      };
    case "removed":
      return {
        label: "Left register",
        variant: "destructive" as const,
        icon: "UserMinus" as const,
        className: "border-slate-200 bg-slate-50/80",
      };
    case "renamed":
      return {
        label: "Likely rename",
        variant: "secondary" as const,
        icon: "ArrowsClockwise" as const,
        className: "border-violet-200 bg-violet-50/50",
      };
    default:
      return {
        label: "Pay or hours changed",
        variant: "outline" as const,
        icon: "PencilSimple" as const,
        className: "border-border bg-background",
      };
  }
}

function groupFieldChanges(changes: EmployeeFieldChange[]) {
  const hours = changes.filter((c) => c.kind === "hours" || c.kind === "count");
  const pay = changes.filter((c) => c.kind === "currency" && !isDeductionField(c.key));
  const deductions = changes.filter((c) => isDeductionField(c.key));
  return { hours, pay, deductions };
}

function isDeductionField(key: string): boolean {
  return [
    "sss",
    "sssPRO",
    "philhealth",
    "pagibig",
    "withholdingTax",
    "sssLoan",
    "otherDeduction",
    "totalDeduction",
  ].includes(key);
}

function insightLine(row: EmployeeAnomalyRow): string {
  if (row.status === "added") {
    const parts: string[] = [];
    if (row.grossAmount && row.grossAmount > 0) {
      parts.push(`gross ${formatCurrency(row.grossAmount)}`);
    }
    if (row.hoursWorked && row.hoursWorked > 0) {
      parts.push(
        `${row.hoursWorked.toLocaleString(undefined, { maximumFractionDigits: 2 })} hrs`
      );
    }
    return parts.length > 0
      ? `Not on prior register — now ${parts.join(", ")}`
      : "Not on prior register";
  }
  if (row.status === "removed") {
    return "Was on prior register — no longer listed";
  }
  if (row.status === "renamed" && row.previousName) {
    return `Same person as ${row.previousName}`;
  }
  if (row.topChangeLabel && row.netDelta != null) {
    return `Net ${formatDelta(row.netDelta, "currency")} — mainly ${row.topChangeLabel.toLowerCase()}`;
  }
  if (row.fieldChanges.length > 0) {
    const top = row.fieldChanges[0];
    return `${top.label} ${formatDelta(top.delta, top.kind === "currency" ? "currency" : top.kind === "count" ? "count" : "hours")}`;
  }
  return "Review field details below";
}

function FieldGroup({
  title,
  changes,
}: {
  title: string;
  changes: EmployeeFieldChange[];
}) {
  if (changes.length === 0) return null;

  return (
    <div>
      <Caption className="text-muted-foreground uppercase tracking-wide text-[10px] mb-2 block">
        {title}
      </Caption>
      <ul className="space-y-2">
        {changes.map((change) => (
          <li
            key={change.key}
            className="flex items-center justify-between gap-3 text-sm rounded-md bg-background/80 px-2 py-1.5 border border-border/50"
          >
            <span className="text-muted-foreground">{change.label}</span>
            <div className="text-right tabular-nums shrink-0">
              <span className="text-muted-foreground text-xs">
                {change.kind === "currency"
                  ? formatCurrency(change.previous)
                  : change.previous.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                {" → "}
                {change.kind === "currency"
                  ? formatCurrency(change.current)
                  : change.current.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
              </span>
              <span
                className={`block font-semibold text-xs mt-0.5 ${deltaTone(change.delta)}`}
              >
                {formatDelta(
                  change.delta,
                  change.kind === "currency"
                    ? "currency"
                    : change.kind === "count"
                      ? "count"
                      : "hours"
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricPill({
  label,
  value,
  kind,
}: {
  label: string;
  value: number | null;
  kind: "currency" | "hours";
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 min-w-[100px]">
      <Caption className="text-muted-foreground text-[10px] block mb-0.5">
        {label}
      </Caption>
      <span
        className={`text-sm font-semibold tabular-nums ${deltaTone(value, false)}`}
      >
        {formatDelta(value, kind)}
      </span>
    </div>
  );
}

function EmployeeAnomalyCard({
  row,
  showDeltas = false,
  defaultExpanded = false,
}: {
  row: EmployeeAnomalyRow;
  showDeltas?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = statusConfig(row.status);
  const isGhost = row.riskFlags.includes("potential_ghost");
  const { hours, pay, deductions } = groupFieldChanges(row.fieldChanges);

  return (
    <Card
      className={`overflow-hidden transition-shadow hover:shadow-sm ${config.className} ${
        isGhost ? "ring-1 ring-amber-400/60" : ""
      }`}
    >
      <CardContent className="p-0">
        <button
          type="button"
          className="w-full text-left p-4 space-y-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => row.fieldChanges.length > 0 && setExpanded((v) => !v)}
          disabled={row.fieldChanges.length === 0}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <BodySmall className="font-semibold text-foreground truncate">
                  {row.name}
                </BodySmall>
                <Badge variant={config.variant} className="text-[10px] shrink-0">
                  <Icon name={config.icon} size={IconSizes.xs} className="mr-1" />
                  {config.label}
                </Badge>
                {isGhost && (
                  <Badge variant="destructive" className="text-[10px]">
                    Review — possible ghost
                  </Badge>
                )}
              </div>
              <Caption className="text-muted-foreground block">
                {insightLine(row)}
              </Caption>
            </div>
            {row.fieldChanges.length > 0 && (
              <Icon
                name={expanded ? "CaretUp" : "CaretDown"}
                size={IconSizes.sm}
                className="text-muted-foreground shrink-0 mt-1"
              />
            )}
          </div>

          {row.riskFlags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {row.riskFlags.map((flag) => (
                <Badge
                  key={flag}
                  variant={flag === "potential_ghost" ? "destructive" : "outline"}
                  className="text-[10px] font-normal"
                >
                  {riskFlagLabel(flag)}
                </Badge>
              ))}
            </div>
          )}

          {showDeltas ? (
            <div className="flex flex-wrap gap-2">
              <MetricPill label="Hours change" value={row.hoursDelta} kind="hours" />
              <MetricPill label="Gross change" value={row.grossDelta} kind="currency" />
              <MetricPill label="Net change" value={row.netDelta} kind="currency" />
              {row.silCutoffDelta != null && row.silCutoffDelta !== 0 && (
                <MetricPill
                  label="SIL cutoff change"
                  value={row.silCutoffDelta}
                  kind="currency"
                />
              )}
              {row.manpowerCostDelta > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <Caption className="text-amber-900/80 text-[10px] block mb-0.5">
                    Payroll cost impact
                  </Caption>
                  <span className="text-sm font-semibold text-amber-900 tabular-nums">
                    +{formatCurrency(row.manpowerCostDelta)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm">
              <div className="rounded-lg border px-3 py-2 bg-background/60">
                <Caption className="text-[10px] text-muted-foreground">Hours</Caption>
                <span className="font-medium tabular-nums">
                  {row.hoursWorked?.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }) ?? "—"}
                </span>
              </div>
              <div className="rounded-lg border px-3 py-2 bg-background/60">
                <Caption className="text-[10px] text-muted-foreground">Gross</Caption>
                <span className="font-medium tabular-nums">
                  {row.grossAmount != null ? formatCurrency(row.grossAmount) : "—"}
                </span>
              </div>
              <div className="rounded-lg border px-3 py-2 bg-background/60">
                <Caption className="text-[10px] text-muted-foreground">Net</Caption>
                <span className="font-medium tabular-nums">
                  {row.netAmount != null ? formatCurrency(row.netAmount) : "—"}
                </span>
              </div>
            </div>
          )}
        </button>

        {expanded && row.fieldChanges.length > 0 && (
          <div className="border-t bg-muted/10 px-4 py-4 space-y-4">
            <BodySmall className="font-medium text-foreground">
              What changed ({row.fieldChanges.length} fields)
            </BodySmall>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FieldGroup title="Hours & days" changes={hours} />
              <FieldGroup title="Pay amounts" changes={pay} />
              <FieldGroup title="Deductions" changes={deductions} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnomalySection({
  title,
  description,
  rows,
  showDeltas = false,
  className,
}: {
  title: string;
  description: string;
  rows: EmployeeAnomalyRow[];
  showDeltas?: boolean;
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div>
        <BodySmall className="font-semibold">{title}</BodySmall>
        <Caption className="text-muted-foreground">{description}</Caption>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <EmployeeAnomalyCard
            key={`${row.status}-${row.name}-${row.previousName ?? ""}`}
            row={row}
            showDeltas={showDeltas}
          />
        ))}
      </div>
    </div>
  );
}

function countGhostCandidates(rows: EmployeeAnomalyRow[]): number {
  return rows.filter((r) => r.riskFlags.includes("potential_ghost")).length;
}

export function PayrollEmployeeAnomaliesPanel({
  title,
  anomalies,
}: {
  title: string;
  anomalies: PayrollEmployeeAnomalies;
}) {
  const hasAny =
    anomalies.added.length > 0 ||
    anomalies.removed.length > 0 ||
    anomalies.changed.length > 0 ||
    anomalies.renamed.length > 0;

  const summary = useMemo(() => {
    const all = [
      ...anomalies.added,
      ...anomalies.changed,
      ...anomalies.renamed,
    ];
    const netImpact = anomalies.changed.reduce(
      (sum, r) => sum + (r.netDelta ?? 0),
      0
    );
    const costExposure = all.reduce((sum, r) => sum + r.manpowerCostDelta, 0);
    const topNet = [...anomalies.changed].sort(
      (a, b) => Math.abs(b.netDelta ?? 0) - Math.abs(a.netDelta ?? 0)
    )[0];
    return { netImpact, costExposure, topNet };
  }, [anomalies]);

  if (!anomalies.hasBaseline) {
    return (
      <Caption className="text-muted-foreground">
        No prior register to compare — employee roster saved as plantilla baseline.
      </Caption>
    );
  }

  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-6 text-center">
        <Icon
          name="CheckCircle"
          size={IconSizes.lg}
          className="text-emerald-600 mx-auto mb-2"
        />
        <BodySmall className="text-muted-foreground">
          No employee anomalies vs baseline — roster and pay match the prior register.
        </BodySmall>
      </div>
    );
  }

  const periodLabel =
    anomalies.baselinePeriodStart && anomalies.baselinePeriodEnd
      ? formatBiMonthlyPeriod(
          new Date(anomalies.baselinePeriodStart + "T00:00:00"),
          new Date(anomalies.baselinePeriodEnd + "T00:00:00")
        )
      : null;

  const ghostCount = countGhostCandidates(anomalies.added);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BodySmall className="font-semibold text-foreground">{title}</BodySmall>
        {periodLabel && (
          <Caption className="text-muted-foreground block">
            Compared against the register from <strong>{periodLabel}</strong>.
            Tap a row to see every field that moved.
          </Caption>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {anomalies.changed.length > 0 && (
            <Badge variant="outline" className="text-xs font-normal py-1">
              {anomalies.changed.length} with pay/hour changes
            </Badge>
          )}
          {anomalies.added.length > 0 && (
            <Badge variant="outline" className="text-xs font-normal py-1 border-amber-300">
              {anomalies.added.length} new
            </Badge>
          )}
          {anomalies.removed.length > 0 && (
            <Badge variant="outline" className="text-xs font-normal py-1">
              {anomalies.removed.length} removed
            </Badge>
          )}
          {anomalies.renamed.length > 0 && (
            <Badge variant="outline" className="text-xs font-normal py-1 border-violet-300">
              {anomalies.renamed.length} renamed
            </Badge>
          )}
          {summary.costExposure > 0 && (
            <Badge variant="outline" className="text-xs font-normal py-1 text-amber-800 border-amber-300">
              {formatCurrency(summary.costExposure)} cost exposure
            </Badge>
          )}
          {ghostCount > 0 && (
            <Badge variant="destructive" className="text-xs font-normal py-1">
              {ghostCount} ghost risk
            </Badge>
          )}
        </div>

        {anomalies.changed.length > 0 && summary.topNet && (
          <Caption className="text-muted-foreground block rounded-md bg-muted/30 px-3 py-2">
            Largest net pay swing:{" "}
            <span className="font-medium text-foreground">{summary.topNet.name}</span>{" "}
            ({formatDelta(summary.topNet.netDelta, "currency")} net)
            {summary.netImpact !== 0 && (
              <>
                {" "}
                · Combined net change across {anomalies.changed.length} employees:{" "}
                <span className={deltaTone(summary.netImpact)}>
                  {formatDelta(summary.netImpact, "currency")}
                </span>
              </>
            )}
          </Caption>
        )}
      </div>

      <AnomalySection
        title="New employees"
        description="People on this register who were not on the prior one. Review hours and pay for possible ghost entries."
        rows={anomalies.added}
        className="rounded-lg border border-amber-200/80 p-4 bg-amber-50/30"
      />

      <AnomalySection
        title="Likely name changes"
        description="Same person appears under a different spelling — not a duplicate hire."
        rows={anomalies.renamed}
        showDeltas
        className="rounded-lg border border-violet-200/80 p-4 bg-violet-50/20"
      />

      <AnomalySection
        title="Removed employees"
        description="On the prior register but missing now — resigned, transferred, or data issue."
        rows={anomalies.removed}
        className="rounded-lg border p-4"
      />

      <AnomalySection
        title="Pay & hour changes"
        description="Same employee, different numbers — expand any card for hours (plain numbers) vs pay (₱ amounts)."
        rows={anomalies.changed}
        showDeltas
        className="rounded-lg border p-4"
      />
    </div>
  );
}
