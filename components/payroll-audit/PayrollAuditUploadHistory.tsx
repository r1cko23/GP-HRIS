"use client";

import { format } from "date-fns";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { formatCurrency } from "@/utils/format";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary/types";

interface PayrollAuditUploadHistoryProps {
  uploads: PayrollSummaryUploadRecord[];
  loading: boolean;
  deletingId: string | null;
  clearingAll: boolean;
  onRefresh: () => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
}

export function PayrollAuditUploadHistory({
  uploads,
  loading,
  deletingId,
  clearingAll,
  onRefresh,
  onClearAll,
  onDelete,
}: PayrollAuditUploadHistoryProps) {
  return (
    <CardSection
      title={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Upload history</span>
          <HStack gap="2">
            {uploads.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onClearAll}
                disabled={loading || clearingAll}
              >
                <Icon name="Trash" size={IconSizes.sm} />
                Clear all
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <Icon name="ArrowsClockwise" size={IconSizes.sm} />
              Refresh
            </Button>
          </HStack>
        </div>
      }
      description="All payroll register uploads for this client."
      className="overflow-hidden"
    >

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <BodySmall>Loading uploads…</BodySmall>
        </div>
      ) : uploads.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/20">
          <BodySmall className="text-muted-foreground">
            No register uploads for this client yet.
          </BodySmall>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">OT</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-sm whitespace-nowrap">
                    {row.periodStart
                      ? formatBiMonthlyPeriod(
                          new Date(row.periodStart + "T00:00:00"),
                          new Date(row.periodEnd + "T00:00:00")
                        )
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">{row.employeeCount}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(row.grossAmountTotal)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(row.netAmountTotal)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {row.totalOTAmount != null
                      ? formatCurrency(row.totalOTAmount)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Caption>
                      {format(new Date(row.uploadedAt), "MMM d, yyyy h:mm a")}
                    </Caption>
                  </TableCell>
                  <TableCell>
                    <Caption className="max-w-[140px] truncate block">
                      {row.sourceFileName ?? "—"}
                    </Caption>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === row.id || clearingAll}
                      onClick={() => onDelete(row.id)}
                      aria-label={`Remove upload ${row.sourceFileName ?? ""}`}
                    >
                      <Icon name="Trash" size={IconSizes.sm} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardSection>
  );
}
