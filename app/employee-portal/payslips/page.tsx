"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTitle, H3, BodySmall } from "@/components/ui/typography";
import {
  epCardInteractive,
  epFormActionButton,
  epFormActions,
  epInlineField,
  epPageHeaderRow,
  epPageWrapper,
  epTouchButton,
} from "@/lib/employee-portal-ui";
import { epRequestFiledLine } from "@/lib/employee-portal-request-history";
import { cn } from "@/lib/utils";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { format, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/utils/format";
import { PayslipPrint } from "@/components/PayslipPrint";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PayslipPreviewDialogBody,
  PayslipPreviewDialogContent,
  PayslipPreviewDialogFooter,
  PayslipPreviewDialogHeader,
  PayslipPreviewDocument,
} from "@/components/employee-portal/PayslipPreviewDialog";
import { toast } from "sonner";
import {
  buildPayslipPrintProps,
  payslipMonthKey,
  type EmployeeProfileForPayslip,
  type SavedPayslipForDisplay,
} from "@/lib/payslip-employee-view";

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

export default function EmployeePayslipsPage() {
  const { employee } = useEmployeeSession();
  const [payslips, setPayslips] = useState<SavedPayslipForDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<EmployeeProfileForPayslip | null>(null);
  const [selectedPayslip, setSelectedPayslip] =
    useState<SavedPayslipForDisplay | null>(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    payslips.forEach((p) => keys.add(payslipMonthKey(p)));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [payslips]);

  const filteredPayslips = useMemo(() => {
    if (!selectedMonth) return payslips;
    return payslips.filter((p) => payslipMonthKey(p) === selectedMonth);
  }, [payslips, selectedMonth]);

  const payslipProfile = useMemo((): EmployeeProfileForPayslip | null => {
    if (!profile) return null;
    return {
      employee_id: employee.employee_id,
      full_name: profile.full_name || employee.full_name,
      position: profile.position ?? null,
      employee_type: profile.employee_type ?? null,
      job_level: profile.job_level ?? null,
      monthly_rate: profile.monthly_rate ?? null,
      per_day: profile.per_day ?? null,
      assigned_hotel: profile.assigned_hotel ?? null,
    };
  }, [profile, employee]);

  const printProps = useMemo(() => {
    if (!selectedPayslip || !payslipProfile) return null;
    return buildPayslipPrintProps(selectedPayslip, payslipProfile);
  }, [selectedPayslip, payslipProfile]);

  useEffect(() => {
    loadPayslips();
    loadProfile();
  }, [employee.id]);

  useEffect(() => {
    if (monthOptions.length === 0) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth((prev) =>
      prev && monthOptions.includes(prev) ? prev : monthOptions[0]
    );
  }, [monthOptions]);

  async function loadPayslips() {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/employee-portal/payslips?employee_id=${encodeURIComponent(employee.id)}`
      );
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error || "Failed to load payslips");
        return;
      }

      setPayslips((payload.payslips as SavedPayslipForDisplay[]) || []);
    } catch {
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    try {
      const response = await fetch(
        `/api/employee-portal/employee-profile?employee_id=${encodeURIComponent(employee.id)}`
      );
      const payload = await response.json();
      if (!response.ok) return;
      setProfile({
        employee_id: employee.employee_id,
        full_name: payload.full_name || employee.full_name,
        position: payload.position ?? null,
        employee_type: payload.employee_type ?? null,
        job_level: payload.job_level ?? null,
        monthly_rate: payload.monthly_rate ?? null,
        per_day: payload.per_day ?? null,
        assigned_hotel: payload.assigned_hotel ?? null,
      });
    } catch {
      setProfile({
        employee_id: employee.employee_id,
        full_name: employee.full_name,
      });
    }
  }

  function openPayslipPreview(payslip: SavedPayslipForDisplay) {
    setSelectedPayslip(payslip);
    setShowPayslipModal(true);
  }

  function handlePrint() {
    const payslipContainer = document.getElementById("payslip-print-content");
    if (!payslipContainer) {
      toast.error("Payslip content not found");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print payslip");
      return;
    }

    const payslipHTML = payslipContainer.outerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Payslip</title>
          <style>
            html, body { margin: 0; padding: 0; background: white; }
            .payslip-container { width: 8.5in; padding: 0.5in; margin: 0 auto; }
            @media print { @page { size: letter portrait; margin: 0.5in; } }
          </style>
        </head>
        <body>${payslipHTML}
          <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (loading) {
    return (
      <div className={cn("w-full", epPageWrapper)}>
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className={cn("mx-auto w-full max-w-6xl", epPageWrapper)}>
        <div className={epPageHeaderRow}>
          <PageTitle className="min-w-0 shrink-0">My Payslips</PageTitle>
          {payslips.length > 0 ? (
            <div className={epInlineField}>
              <BodySmall className="shrink-0 text-muted-foreground">
                Month
              </BodySmall>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="min-h-11 w-full sm:min-h-9 sm:w-[14rem]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((key) => (
                    <SelectItem key={key} value={key}>
                      {formatMonthLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {payslips.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <VStack gap="4" align="center">
                <div className="rounded-full bg-muted p-6">
                  <Icon
                    name="FileText"
                    size={IconSizes.xl}
                    className="text-muted-foreground"
                  />
                </div>
                <VStack gap="2" align="center">
                  <H3 className="text-xl font-semibold">No payslips yet</H3>
                  <BodySmall className="max-w-md text-muted-foreground">
                    Payslips appear here after HR finalizes the payroll run on Payroll.
                  </BodySmall>
                </VStack>
              </VStack>
            </CardContent>
          </Card>
        ) : filteredPayslips.length === 0 ? (
          <Card className="w-full">
            <CardContent className="py-12 text-center">
              <BodySmall className="text-muted-foreground">
                No payslips for{" "}
                {selectedMonth ? formatMonthLabel(selectedMonth) : "this month"}.
              </BodySmall>
            </CardContent>
          </Card>
        ) : (
          <VStack gap="3" className="w-full items-stretch">
            {filteredPayslips.map((payslip) => (
              <Card
                key={payslip.id}
                className={cn(
                  "w-full border-border/80 bg-card",
                  epCardInteractive
                )}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="grid w-full grid-cols-1 items-center gap-3 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-5">
                    <VStack gap="1" align="start" className="min-w-0">
                      <HStack gap="2" align="center" className="flex-wrap">
                        <p className="text-sm font-semibold leading-tight text-foreground">
                          {format(parseISO(payslip.period_start), "MMM d")} –{" "}
                          {format(parseISO(payslip.period_end), "MMM d, yyyy")}
                        </p>
                        <Badge variant="default" className="shrink-0 text-[10px] px-1.5 py-0">
                          {payslip.status.toUpperCase()}
                        </Badge>
                      </HStack>
                      <BodySmall className="truncate text-xs text-muted-foreground">
                        Payslip #{payslip.payslip_number}
                      </BodySmall>
                      <p className={epRequestFiledLine}>
                        Released:{" "}
                        {format(
                          new Date(payslip.created_at),
                          "MMM d, yyyy h:mm a"
                        )}
                      </p>
                    </VStack>

                    <div className="flex w-full min-w-0 flex-col gap-2.5 lg:w-[17rem] lg:shrink-0 lg:justify-self-end">
                      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2">
                        <VStack gap="1" align="start" className="min-w-0">
                          <BodySmall className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                            Gross
                          </BodySmall>
                          <BodySmall className="truncate text-[11px] font-semibold tabular-nums sm:text-sm">
                            {formatCurrency(payslip.gross_pay)}
                          </BodySmall>
                        </VStack>
                        <VStack gap="1" align="start" className="min-w-0">
                          <BodySmall className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                            Deductions
                          </BodySmall>
                          <BodySmall className="truncate text-[11px] font-semibold tabular-nums sm:text-sm">
                            −{formatCurrency(payslip.total_deductions)}
                          </BodySmall>
                        </VStack>
                        <VStack gap="1" align="start" className="min-w-0">
                          <BodySmall className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                            Net Pay
                          </BodySmall>
                          <BodySmall className="truncate text-[11px] font-semibold tabular-nums text-foreground sm:text-sm">
                            {formatCurrency(payslip.net_pay)}
                          </BodySmall>
                        </VStack>
                      </div>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openPayslipPreview(payslip)}
                        className={cn(
                          epTouchButton,
                          "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        <Icon name="FileText" size={IconSizes.sm} />
                        View & Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </VStack>
        )}
      </div>

      <Dialog
        open={showPayslipModal}
        onOpenChange={setShowPayslipModal}
      >
        <PayslipPreviewDialogContent>
          {selectedPayslip && printProps ? (
            <>
              <PayslipPreviewDialogHeader>
                <DialogHeader className="space-y-0.5 text-left">
                  <DialogTitle className="text-base sm:text-lg">
                    Payslip
                  </DialogTitle>
                  <BodySmall className="text-muted-foreground">
                    Same layout as HR Payslip Details — scroll if needed.
                  </BodySmall>
                </DialogHeader>
              </PayslipPreviewDialogHeader>
              <PayslipPreviewDialogBody>
                <PayslipPreviewDocument>
                  <div id="payslip-print-content">
                    <PayslipPrint {...printProps} />
                  </div>
                </PayslipPreviewDocument>
              </PayslipPreviewDialogBody>
              <PayslipPreviewDialogFooter>
                <DialogFooter
                  className={cn(
                    "m-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                    epFormActions
                  )}
                >
                  <Button
                    variant="secondary"
                    className={epFormActionButton}
                    onClick={() => setShowPayslipModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={handlePrint}
                    className={cn(
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      epFormActionButton
                    )}
                  >
                    <Icon name="Printer" size={IconSizes.sm} />
                    Print / Save PDF
                  </Button>
                </DialogFooter>
              </PayslipPreviewDialogFooter>
            </>
          ) : selectedPayslip ? (
            <>
              <PayslipPreviewDialogHeader>
                <DialogHeader className="text-left">
                  <DialogTitle>Payslip</DialogTitle>
                </DialogHeader>
              </PayslipPreviewDialogHeader>
              <PayslipPreviewDialogBody>
                <BodySmall className="py-4 text-muted-foreground">
                  Loading pay details…
                </BodySmall>
              </PayslipPreviewDialogBody>
            </>
          ) : null}
        </PayslipPreviewDialogContent>
      </Dialog>
    </div>
  );
}
