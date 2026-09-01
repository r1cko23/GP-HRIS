"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RegisterPayslipBreakdown,
  registerPayslipDisplayName,
  type RegisterPayslipLine,
} from "@/components/payroll/RegisterPayslipBreakdown";

export type { RegisterPayslipLine };

export function RegisterPayslipDialog({
  open,
  onOpenChange,
  line,
  periodStart,
  periodEnd,
  fullPayslipHref,
  onDownloadPdf,
  downloadingPdf,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: RegisterPayslipLine | null;
  periodStart: string;
  periodEnd: string;
  fullPayslipHref: string | null;
  onDownloadPdf: () => void;
  downloadingPdf?: boolean;
}) {
  if (!line) return null;

  const name = registerPayslipDisplayName(line);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,40rem)] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-md p-0 sm:w-full">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="text-lg">{name || "Payslip breakdown"}</DialogTitle>
          <DialogDescription className="text-sm">
            <span className="tabular-nums">
              {periodStart}–{periodEnd}
            </span>
            {line.employee_code ? (
              <>
                {" · "}
                <span className="font-mono text-xs">{line.employee_code}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          <RegisterPayslipBreakdown line={line} />
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-muted/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:space-x-0 sm:px-6">
          {fullPayslipHref ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto justify-start px-0 text-muted-foreground"
              asChild
            >
              <Link href={fullPayslipHref} onClick={() => onOpenChange(false)}>
                Open full page
              </Link>
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-10 flex-1 sm:flex-none"
              disabled={!!downloadingPdf || !line.id}
              onClick={onDownloadPdf}
            >
              {downloadingPdf ? "Downloading…" : "Download PDF"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
