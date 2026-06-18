"use client";

import { CardSection } from "@/components/ui/card-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BodySmall } from "@/components/ui/typography";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import {
  DbDesktopBlock,
  DbMobileBlock,
} from "@/components/dashboard/DashboardViewport";
import { dbMobileListCard } from "@/lib/dashboard-ui";
import { formatCurrency } from "@/utils/format";
import type { PayrollAuditClientEmployee } from "@/lib/payroll-summary/types";

interface PayrollAuditPlantillaSectionProps {
  clientName: string;
  employees: PayrollAuditClientEmployee[];
}

export function PayrollAuditPlantillaSection({
  clientName,
  employees,
}: PayrollAuditPlantillaSectionProps) {
  if (employees.length === 0) {
    return (
      <CardSection title={`Client plantilla — ${clientName}`}>
        <BodySmall className="text-muted-foreground">
          No employees yet — upload a payroll register to build the roster.
        </BodySmall>
      </CardSection>
    );
  }

  return (
    <CardSection
      title={`Client plantilla — ${clientName}`}
      description={`${employees.length} employees from the latest register upload.`}
    >
      <DbMobileBlock className="space-y-2">
        {employees.map((emp) => (
          <div key={emp.id} className={dbMobileListCard}>
            <BodySmall className="font-semibold text-foreground block mb-2">
              {emp.displayName}
            </BodySmall>
            <DashboardMobileField
              label="Hours"
              value={emp.hoursWorked?.toFixed(2) ?? "—"}
            />
            <DashboardMobileField
              label="Gross"
              value={
                emp.grossAmount != null ? formatCurrency(emp.grossAmount) : "—"
              }
            />
            <DashboardMobileField
              label="Net"
              value={emp.netAmount != null ? formatCurrency(emp.netAmount) : "—"}
            />
            <DashboardMobileField
              label="SIL cutoff"
              value={
                emp.silCutoff != null ? formatCurrency(emp.silCutoff) : "—"
              }
            />
          </div>
        ))}
      </DbMobileBlock>

      <DbDesktopBlock>
        <div className="max-h-[420px] overflow-x-auto overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">SIL Cutoff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="text-sm font-medium">
                    {emp.displayName}
                  </TableCell>
                  <TableCell className="text-right">
                    {emp.hoursWorked?.toFixed(2) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {emp.grossAmount != null
                      ? formatCurrency(emp.grossAmount)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {emp.netAmount != null
                      ? formatCurrency(emp.netAmount)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {emp.silCutoff != null
                      ? formatCurrency(emp.silCutoff)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DbDesktopBlock>
    </CardSection>
  );
}
