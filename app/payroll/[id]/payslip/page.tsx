"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { HStack, VStack } from "@/components/ui/stack";
import { BodySmall } from "@/components/ui/typography";
import { OrganicPayslipDetailedBreakdown } from "@/components/payroll/OrganicPayslipDetailedBreakdown";
import {
  registerPayslipDisplayName,
  type RegisterPayslipLine,
} from "@/components/payroll/RegisterPayslipBreakdown";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
} from "@/lib/directory/browser";
import { toast } from "sonner";

function downloadBase64File(
  base64: string,
  filename: string,
  mime: string
) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export default function OrganicRegisterPayslipPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cutoffId = typeof params.id === "string" ? params.id : "";
  const lineId = searchParams.get("line")?.trim() ?? "";
  const officeEmployeeId = searchParams.get("employee")?.trim() ?? "";

  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payrollDate, setPayrollDate] = useState<string | null>(null);
  const [line, setLine] = useState<RegisterPayslipLine | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    if (!cutoffId) return;
    if (!lineId && !officeEmployeeId) {
      setError("Missing payslip line or employee in the URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const org = await ensureDirectoryOrgId();
      setOrgId(org);

      const periodJson = await directoryJson<{
        data: {
          period: {
            period_start: string;
            period_end: string;
            payroll_date: string | null;
          };
        };
      }>(`/api/timekeeping/cutoff-periods/${cutoffId}`, org);
      setPeriodStart(periodJson.data.period.period_start);
      setPeriodEnd(periodJson.data.period.period_end);
      setPayrollDate(periodJson.data.period.payroll_date ?? null);

      const qs = new URLSearchParams(
        lineId
          ? { line_id: lineId }
          : { office_employee_id: officeEmployeeId }
      );
      const reg = await directoryJson<{
        data: {
          run: {
            period_start?: string;
            period_end?: string;
            payroll_date?: string | null;
          } | null;
          lines: RegisterPayslipLine[];
        } | null;
      }>(
        `/api/timekeeping/cutoff-periods/${cutoffId}/payroll-run?${qs}`,
        org
      );
      const found = reg.data?.lines?.[0] ?? null;
      if (!found) {
        setLine(null);
        setError(
          "No register payslip found for this employee on this cutoff. Build the register first."
        );
        return;
      }
      setLine(found);
      if (reg.data?.run?.period_start) {
        setPeriodStart(String(reg.data.run.period_start));
      }
      if (reg.data?.run?.period_end) {
        setPeriodEnd(String(reg.data.run.period_end));
      }
      if (reg.data?.run?.payroll_date != null) {
        setPayrollDate(reg.data.run.payroll_date);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payslip");
      setLine(null);
    } finally {
      setLoading(false);
    }
  }, [cutoffId, lineId, officeEmployeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadPdf() {
    if (!line?.id || !orgId) {
      toast.error("This payslip has no register line id for PDF export");
      return;
    }
    setPdfBusy(true);
    try {
      const qs = new URLSearchParams({
        type: "payslip-pdf",
        format: "json",
        line_id: line.id,
      });
      const json = await directoryJson<{
        data: { pdf_base64: string; filename: string };
      }>(
        `/api/timekeeping/cutoff-periods/${cutoffId}/exports?${qs}`,
        orgId
      );
      downloadBase64File(
        json.data.pdf_base64,
        json.data.filename,
        "application/pdf"
      );
      toast.success(`Downloaded ${json.data.filename}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Payslip PDF download failed"
      );
    } finally {
      setPdfBusy(false);
    }
  }

  const name = line ? registerPayslipDisplayName(line) : "";

  return (
    <DashboardLayout>
      <VStack gap="4" className={dbPageWrapper}>
        <DashboardPageHeader
          title={name ? `Payslip · ${name}` : "Payslip"}
          description={
            periodStart && periodEnd
              ? `${periodStart}–${periodEnd}${
                  line?.employee_code ? ` · ${line.employee_code}` : ""
                }`
              : "Organic register payslip"
          }
          actions={
            <HStack gap="2" className="flex-wrap">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={`/payroll/${cutoffId}`}>← Cutoff</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!line?.id || pdfBusy || loading}
                onClick={() => void downloadPdf()}
              >
                {pdfBusy ? "Downloading…" : "Download PDF"}
              </Button>
            </HStack>
          }
        />

        {loading ? (
          <CardSection>
            <BodySmall className="text-muted-foreground">
              Loading payslip…
            </BodySmall>
          </CardSection>
        ) : null}

        {!loading && error ? (
          <CardSection title="Payslip unavailable">
            <BodySmall className="text-destructive">{error}</BodySmall>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              asChild
            >
              <Link href={`/payroll/${cutoffId}`}>Back to cutoff</Link>
            </Button>
          </CardSection>
        ) : null}

        {!loading && !error && line && periodStart && periodEnd ? (
          <div className="w-full overflow-x-auto pb-2">
            <OrganicPayslipDetailedBreakdown
              line={line}
              periodStart={periodStart}
              periodEnd={periodEnd}
              payrollDate={payrollDate}
            />
          </div>
        ) : null}
      </VStack>
    </DashboardLayout>
  );
}
