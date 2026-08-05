"use client";

import { useRef } from "react";
import { PayrollAuditInsightsPanel } from "@/components/payroll-audit/PayrollAuditInsightsPanel";
import { PayrollAuditPeriodComparison } from "@/components/payroll-audit/PayrollAuditPeriodComparison";
import { PayrollAuditMetricsPanel } from "@/components/payroll-audit/PayrollAuditMetricsPanel";
import { PayrollAuditPlantillaSection } from "@/components/payroll-audit/PayrollAuditPlantillaSection";
import { PayrollAuditUploadHistory } from "@/components/payroll-audit/PayrollAuditUploadHistory";
import { PayrollEmployeeAnomaliesPanel } from "@/components/payroll-audit/PayrollEmployeeAnomaliesPanel";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HStack } from "@/components/ui/stack";
import { Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { dbMobileTabList, dbMobileTabTrigger } from "@/lib/dashboard-ui";
import { hasEmployeeAnomalies } from "@/lib/payroll-summary/diff-payroll-employees";
import type {
  AuditUploadAnomalies,
  PayrollAuditClientEmployee,
  PayrollSummaryMetrics,
  PayrollSummaryUploadRecord,
} from "@/lib/payroll-summary/types";

const COMPOSITION_MIN_CUTOFFS = 3;

interface UploadResult {
  upload: PayrollSummaryUploadRecord;
  metrics?: PayrollSummaryMetrics | null;
  previous?: PayrollSummaryMetrics | null;
  anomalies?: AuditUploadAnomalies | null;
}

interface PayrollAuditClientWorkspaceProps {
  clientName: string;
  trend: PayrollSummaryUploadRecord[];
  uploads: PayrollSummaryUploadRecord[];
  clientEmployees: PayrollAuditClientEmployee[];
  lastResult: UploadResult | null;
  loading: boolean;
  uploading: boolean;
  deletingId: string | null;
  clearingAll: boolean;
  onUpload: (file: File) => void;
  onBack: () => void;
  onRefresh: () => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
}

function UploadRegisterSection({
  uploading,
  onUpload,
  onBack,
}: {
  uploading: boolean;
  onUpload: (file: File) => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <CardSection title="Upload register">
      <Caption className="mb-3 text-muted-foreground">
        Routed by the client name on the PDF (creates the client if needed). The
        client selector above is only for browsing history.
      </Caption>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
        className="sr-only"
      />
      <HStack className="flex-wrap gap-2">
        <Button
          type="button"
          className="w-full min-h-11 touch-manipulation sm:w-auto"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="FileArrowDown" size={IconSizes.sm} className="mr-2" />
          {uploading ? "Processing register…" : "Choose payroll summary PDF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11 touch-manipulation sm:w-auto"
          disabled={uploading}
          onClick={onBack}
        >
          <Icon name="ArrowLeft" size={IconSizes.sm} className="mr-2" />
          Back to upload
        </Button>
      </HStack>
      {uploading && (
        <HStack gap="2" align="center" className="mt-2">
          <Icon
            name="Hourglass"
            size={IconSizes.sm}
            className="animate-spin text-muted-foreground"
          />
          <Caption>Uploading, parsing, and validating centavo tie-out…</Caption>
        </HStack>
      )}
    </CardSection>
  );
}

function AnomaliesSection({ lastResult }: { lastResult: UploadResult }) {
  const showCrossPeriodAnomalies =
    lastResult.anomalies?.vsLastRegister.hasBaseline &&
    lastResult.anomalies.vsLastRegister.baselinePeriodStart !==
      lastResult.metrics?.periodStart;

  const hasAnomalies =
    lastResult.anomalies &&
    (hasEmployeeAnomalies(lastResult.anomalies.samePeriod) ||
      (showCrossPeriodAnomalies &&
        hasEmployeeAnomalies(lastResult.anomalies.vsLastRegister)));

  if (!hasAnomalies || !lastResult.anomalies) return null;

  return (
    <CardSection title="Employee anomalies" className="border-amber-200/60">
      <PayrollEmployeeAnomaliesPanel
        title="vs previous upload (same cutoff)"
        anomalies={lastResult.anomalies.samePeriod}
      />
      {showCrossPeriodAnomalies && (
        <div className="mt-4 border-t pt-4">
          <PayrollEmployeeAnomaliesPanel
            title="vs last register (previous cutoff)"
            anomalies={lastResult.anomalies.vsLastRegister}
          />
        </div>
      )}
    </CardSection>
  );
}

function AuditTabContent(props: PayrollAuditClientWorkspaceProps) {
  const {
    trend,
    lastResult,
    loading,
    uploading,
    deletingId,
    clearingAll,
    uploads,
    onUpload,
    onBack,
    onRefresh,
    onClearAll,
    onDelete,
  } = props;

  return (
    <div className="space-y-4 lg:space-y-5">
      <PayrollAuditPeriodComparison trend={trend} loading={loading} />
      <UploadRegisterSection
        uploading={uploading}
        onUpload={onUpload}
        onBack={onBack}
      />
      <PayrollAuditMetricsPanel
        trend={trend}
        uploadAnomalies={lastResult?.anomalies}
        current={lastResult?.metrics ?? undefined}
        previous={lastResult?.previous ?? undefined}
        anomalies={lastResult?.anomalies?.samePeriod}
      />
      {lastResult && <AnomaliesSection lastResult={lastResult} />}
      <PayrollAuditUploadHistory
        uploads={uploads}
        loading={loading}
        deletingId={deletingId}
        clearingAll={clearingAll}
        onRefresh={onRefresh}
        onClearAll={onClearAll}
        onDelete={onDelete}
      />
    </div>
  );
}

export function PayrollAuditClientWorkspace(props: PayrollAuditClientWorkspaceProps) {
  const { trend, clientName } = props;
  const showComposition = trend.length >= COMPOSITION_MIN_CUTOFFS;

  return (
    <Tabs defaultValue="audit" className="w-full min-w-0">
      <TabsList className={dbMobileTabList}>
        <TabsTrigger value="audit" className={dbMobileTabTrigger}>
          Audit
        </TabsTrigger>
        <TabsTrigger value="roster" className={dbMobileTabTrigger}>
          Roster
        </TabsTrigger>
        <TabsTrigger value="trends" className={dbMobileTabTrigger}>
          Trends
        </TabsTrigger>
      </TabsList>

      <TabsContent value="audit" className="mt-4">
        <AuditTabContent {...props} />
      </TabsContent>

      <TabsContent value="roster" className="mt-4">
        <PayrollAuditPlantillaSection
          clientName={clientName}
          employees={props.clientEmployees}
        />
      </TabsContent>

      <TabsContent value="trends" className="mt-4">
        {showComposition ? (
          <PayrollAuditInsightsPanel trend={trend} clientName={clientName} />
        ) : (
          <CardSection title="Trends">
            <Caption className="text-muted-foreground">
              Upload at least {COMPOSITION_MIN_CUTOFFS} cutoffs to unlock the
              Trends report (KPIs, mix chart, and composition matrix).
            </Caption>
          </CardSection>
        )}
      </TabsContent>
    </Tabs>
  );
}
