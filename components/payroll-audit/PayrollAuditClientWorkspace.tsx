"use client";

import { useRef } from "react";
import { PayrollAuditInsightsPanel } from "@/components/payroll-audit/PayrollAuditInsightsPanel";
import { PayrollAuditKpiStrip } from "@/components/payroll-audit/PayrollAuditKpiStrip";
import { PayrollAuditMetricsPanel } from "@/components/payroll-audit/PayrollAuditMetricsPanel";
import { PayrollAuditPlantillaSection } from "@/components/payroll-audit/PayrollAuditPlantillaSection";
import { PayrollAuditUploadHistory } from "@/components/payroll-audit/PayrollAuditUploadHistory";
import { PayrollEmployeeAnomaliesPanel } from "@/components/payroll-audit/PayrollEmployeeAnomaliesPanel";
import {
  DbDesktopView,
  DbMobileView,
} from "@/components/dashboard/DashboardViewport";
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

interface UploadResult {
  upload: PayrollSummaryUploadRecord;
  metrics: PayrollSummaryMetrics | null;
  previous: PayrollSummaryMetrics | null;
  anomalies: AuditUploadAnomalies | null;
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
  onRefresh: () => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
}

function UploadRegisterSection({
  uploading,
  onUpload,
}: {
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <CardSection
      title="Upload register"
      description='Upload the Payroll Summary PDF from each cutoff folder (filename starts with "Payroll Summary").'
    >
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
      <Button
        type="button"
        className="w-full min-h-11 touch-manipulation sm:w-auto"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="FileArrowDown" size={IconSizes.sm} className="mr-2" />
        {uploading ? "Processing register…" : "Choose payroll summary PDF"}
      </Button>
      {uploading && (
        <HStack gap="2" align="center" className="mt-2">
          <Icon
            name="Hourglass"
            size={IconSizes.sm}
            className="animate-spin text-muted-foreground"
          />
          <Caption>Parsing and saving upload…</Caption>
        </HStack>
      )}
    </CardSection>
  );
}

function AnomaliesSection({
  lastResult,
}: {
  lastResult: UploadResult;
}) {
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
    <CardSection
      title="Employee anomalies"
      description="Ghost employees, illegal hour/pay insertions, renames, and field deltas vs baseline."
      className="border-amber-200/60"
    >
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

function OverviewPanels({
  trend,
  uploads,
  clientEmployees,
  lastResult,
  loading,
  uploading,
  deletingId,
  clearingAll,
  clientName,
  onUpload,
  onRefresh,
  onClearAll,
  onDelete,
}: PayrollAuditClientWorkspaceProps) {
  return (
    <>
      <UploadRegisterSection uploading={uploading} onUpload={onUpload} />
      <PayrollAuditKpiStrip trend={trend} loading={loading} />
      <PayrollAuditMetricsPanel
        trend={trend}
        uploadAnomalies={lastResult?.anomalies}
        current={lastResult?.metrics ?? undefined}
        previous={lastResult?.previous ?? undefined}
        anomalies={lastResult?.anomalies?.samePeriod}
      />
      {lastResult && <AnomaliesSection lastResult={lastResult} />}
      <PayrollAuditPlantillaSection
        clientName={clientName}
        employees={clientEmployees}
      />
      <PayrollAuditUploadHistory
        uploads={uploads}
        loading={loading}
        deletingId={deletingId}
        clearingAll={clearingAll}
        onRefresh={onRefresh}
        onClearAll={onClearAll}
        onDelete={onDelete}
      />
    </>
  );
}

export function PayrollAuditClientWorkspace(props: PayrollAuditClientWorkspaceProps) {
  const { trend, clientName } = props;

  return (
    <>
      <DbMobileView>
        <Tabs defaultValue="overview" className="w-full min-w-0">
          <TabsList className={dbMobileTabList}>
            <TabsTrigger value="overview" className={dbMobileTabTrigger}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="upload" className={dbMobileTabTrigger}>
              Upload
            </TabsTrigger>
            <TabsTrigger value="insights" className={dbMobileTabTrigger}>
              Insights
            </TabsTrigger>
            <TabsTrigger value="roster" className={dbMobileTabTrigger}>
              Roster
            </TabsTrigger>
            <TabsTrigger value="history" className={dbMobileTabTrigger}>
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3 space-y-3">
            <PayrollAuditKpiStrip trend={trend} loading={props.loading} />
            <PayrollAuditMetricsPanel
              trend={trend}
              uploadAnomalies={props.lastResult?.anomalies}
              current={props.lastResult?.metrics ?? undefined}
              previous={props.lastResult?.previous ?? undefined}
              anomalies={props.lastResult?.anomalies?.samePeriod}
            />
            {props.lastResult && <AnomaliesSection lastResult={props.lastResult} />}
          </TabsContent>

          <TabsContent value="upload" className="mt-3">
            <UploadRegisterSection
              uploading={props.uploading}
              onUpload={props.onUpload}
            />
          </TabsContent>

          <TabsContent value="insights" className="mt-3">
            <PayrollAuditInsightsPanel trend={trend} clientName={clientName} />
          </TabsContent>

          <TabsContent value="roster" className="mt-3">
            <PayrollAuditPlantillaSection
              clientName={clientName}
              employees={props.clientEmployees}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            <PayrollAuditUploadHistory
              uploads={props.uploads}
              loading={props.loading}
              deletingId={props.deletingId}
              clearingAll={props.clearingAll}
              onRefresh={props.onRefresh}
              onClearAll={props.onClearAll}
              onDelete={props.onDelete}
            />
          </TabsContent>
        </Tabs>
      </DbMobileView>

      <DbDesktopView className="space-y-5 lg:space-y-6">
        <OverviewPanels {...props} />
        <PayrollAuditInsightsPanel trend={trend} clientName={clientName} />
      </DbDesktopView>
    </>
  );
}
