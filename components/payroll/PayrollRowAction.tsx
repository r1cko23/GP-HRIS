"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import type { PayrollEntryRow } from "@/lib/ph-payroll/payroll-entry-validation";

type Props = {
  row: PayrollEntryRow;
  periodStart: string;
  size?: "sm" | "default";
};

/**
 * Contextual next step for one employee row in payroll entry.
 */
export function PayrollRowAction({ row, periodStart, size = "sm" }: Props) {
  const issues = row.issues.join(" ").toLowerCase();

  if (row.payslipId) {
    const isPaid = row.payslipStatus === "paid";
    return (
      <Button variant={isPaid ? "ghost" : "outline"} size={size} asChild>
        <Link
          href={`/payroll/payslips?employee=${row.employeeId}&period=${periodStart}`}
        >
          <Icon
            name={isPaid ? "Eye" : "PencilSimple"}
            size={IconSizes.sm}
            className="mr-1"
          />
          {isPaid ? "View payslip" : "Review & pay"}
        </Link>
      </Button>
    );
  }

  if (!row.hasRate || issues.includes("missing monthly rate")) {
    return (
      <Button variant="outline" size={size} asChild>
        <Link href={`/time/enrollment/${row.employeeId}/edit`}>
          <Icon name="Gear" size={IconSizes.sm} className="mr-1" />
          Set pay rate
        </Link>
      </Button>
    );
  }

  if (
    row.timesheetStatus !== "finalized" ||
    issues.includes("timesheet not finalized")
  ) {
    return (
      <Button variant="outline" size={size} asChild>
        <Link
          href={`/time/attendance?employee=${row.employeeId}&period_start=${periodStart}`}
        >
          <Icon name="CalendarBlank" size={IconSizes.sm} className="mr-1" />
          Fix timesheet
        </Link>
      </Button>
    );
  }

  if (issues.includes("no clock entries")) {
    return (
      <Button variant="outline" size={size} asChild>
        <Link href={`/time/entries?employee=${row.employeeId}`}>
          <Icon name="Clock" size={IconSizes.sm} className="mr-1" />
          Time entries
        </Link>
      </Button>
    );
  }

  if (row.status === "ready" || row.status === "warning") {
    return (
      <Button variant="outline" size={size} asChild>
        <Link
          href={`/payroll/payslips?employee=${row.employeeId}&period=${periodStart}`}
        >
          <Icon name="RocketLaunch" size={IconSizes.sm} className="mr-1" />
          Preview payslip
        </Link>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size={size} asChild>
      <Link href={`/payroll/payslips?employee=${row.employeeId}&period=${periodStart}`}>
        Open
      </Link>
    </Button>
  );
}
