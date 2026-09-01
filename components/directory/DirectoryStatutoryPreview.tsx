"use client";

import { useMemo } from "react";
import { previewStatutoryFromDailyRate } from "@/lib/ph-payroll/statutory-preview";
import { formatCurrency } from "@/utils/format";
import { Caption } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  dailyRate: number | string | null | undefined;
  statutorySchedule?: string | null;
  wtaxSchedule?: string | null;
};

function scheduleLabel(raw: string | null | undefined, fallback: string): string {
  const s = (raw ?? "").trim();
  return s || fallback;
}

function isMonthlyStatutory(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s.includes("semi")) return false;
  return s.includes("month");
}

export function DirectoryStatutoryPreview({
  dailyRate,
  statutorySchedule,
  wtaxSchedule,
}: Props) {
  const preview = useMemo(
    () => previewStatutoryFromDailyRate(dailyRate),
    [dailyRate]
  );

  if (!preview) {
    return (
      <p className="text-pretty text-sm leading-normal text-muted-foreground">
        Set a payroll daily rate to preview 2026 statutory tables.
      </p>
    );
  }

  const monthlyStat = isMonthlyStatutory(statutorySchedule);
  const monthlyWtax = isMonthlyStatutory(wtaxSchedule);

  const rows = [
    {
      label: "SSS (incl. WISP)",
      cutoff: preview.perCutoff.sss,
      month: preview.monthlyEe.sss,
      er: preview.monthlyEr.sss + preview.monthlyEr.sss_wisp,
    },
    {
      label: "PhilHealth",
      cutoff: preview.perCutoff.philhealth,
      month: preview.monthlyEe.philhealth,
      er: preview.monthlyEr.philhealth,
    },
    {
      label: "Pag-IBIG",
      cutoff: preview.perCutoff.pagibig,
      month: preview.monthlyEe.pagibig,
      er: preview.monthlyEr.pagibig,
    },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <Caption className="text-muted-foreground">Monthly basis</Caption>
          <p className="text-sm font-medium tabular-nums">
            {formatCurrency(preview.monthlySalary)}
          </p>
          <Caption className="text-muted-foreground">
            ×{"\u00a0"}26 working days
          </Caption>
        </div>
        <div className="min-w-0">
          <Caption className="text-muted-foreground">Hourly (÷{"\u00a0"}8)</Caption>
          <p className="text-sm font-medium tabular-nums">
            {formatCurrency(preview.hourlyRate)}
          </p>
        </div>
        <div className="min-w-0">
          <Caption className="whitespace-nowrap text-muted-foreground">
            SSS ECC (ER / mo)
          </Caption>
          <p className="text-sm font-medium tabular-nums">
            {formatCurrency(preview.monthlyEr.sss_ecc)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contribution</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Per kinsena (EE)
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Per month (EE)
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Per month (ER)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="whitespace-nowrap">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.cutoff)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.month)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.er)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-medium">
              <TableCell>EE total</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(preview.perCutoff.total)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(preview.monthlyEe.total)}
              </TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="max-w-[65ch] rounded-md border border-border bg-muted/30 px-3 py-2.5">
        <p className="text-pretty text-sm font-medium leading-snug text-foreground">
          Sample withholding tax
        </p>
        <p className="mt-1 text-pretty text-sm leading-normal text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">
            {formatCurrency(preview.wtaxIllustrative.withholdingTax)}
          </span>
          {" "}
          per kinsena if basic pay were{" "}
          <span className="tabular-nums text-foreground">
            {formatCurrency(preview.wtaxIllustrative.referenceGross)}
          </span>
          . Posted tax uses that cutoff’s actual gross (hours, premiums, overtime), not this figure.
        </p>
      </div>

      <Caption className="block max-w-[65ch] text-muted-foreground">
        Client schedule: statutory{" "}
        {scheduleLabel(statutorySchedule, "Semi-Monthly")}
        {monthlyStat
          ? " (SSS / PhilHealth / Pag-IBIG on 2nd kinsena)"
          : " (every kinsena)"}
        ; WTAX {scheduleLabel(wtaxSchedule, "Semi-Monthly")}
        {monthlyWtax ? " (2nd kinsena only)" : " (every kinsena)"}. Tables:
        2026 SSS, PhilHealth, Pag-IBIG, BIR semi-monthly.
      </Caption>
    </div>
  );
}
