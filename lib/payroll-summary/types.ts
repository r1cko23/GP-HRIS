/**
 * Parsed metrics from a Payroll Register / Payroll Summary PDF.
 */
import type { EmployeeFieldChange } from "./anomaly-fields";
import type { PayrollRegisterRow } from "./register-columns";

/** Full payroll register row — same columns as Reports → Payroll Register export. */
export type PayrollEmployeeRow = PayrollRegisterRow;

export interface PayrollSummaryMetrics {
  periodStart: string;
  periodEnd: string;
  employeeCount: number;
  hoursWorkedTotal: number;
  regOTHoursTotal: number;
  silTotal: number | null;
  silCutoffTotal: number;
  grossAmountTotal: number;
  netAmountTotal: number;
  totalOTAmount: number | null;
  companyName: string | null;
  payoutDate: string | null;
  sourceFormat: "gp_hris" | "external_register";
  employees: PayrollEmployeeRow[];
}

export interface PayrollSummaryDiffField {
  key: keyof Pick<
    PayrollSummaryMetrics,
    | "employeeCount"
    | "hoursWorkedTotal"
    | "regOTHoursTotal"
    | "silTotal"
    | "silCutoffTotal"
    | "grossAmountTotal"
    | "netAmountTotal"
    | "totalOTAmount"
  >;
  label: string;
  previous: number | null;
  current: number;
  delta: number | null;
  deltaPercent: number | null;
}

export interface PayrollSummaryDiff {
  fields: PayrollSummaryDiffField[];
  hasPrevious: boolean;
}

export interface PayrollSummaryUploadRecord extends PayrollSummaryMetrics {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
  sourceFileName: string | null;
  companyId: string | null;
  documentType: AuditDocumentType;
  status?: "processing" | "ready" | "failed";
  errorMessage?: string | null;
  rollupGapCentavos?: number | null;
  processedAt?: string | null;
  storagePath?: string | null;
}

export type AuditDocumentType = "plantilla" | "payroll_register";

export interface PlantillaEmployee {
  name: string;
  dailyRate?: number | null;
  position?: string | null;
}

export interface PlantillaMetrics {
  documentType: "plantilla";
  employeeCount: number;
  employees: PlantillaEmployee[];
  sourceFormat: "csv" | "xlsx" | "pdf";
}

export interface PayrollAuditClientEmployee {
  id: string;
  companyId: string;
  displayName: string;
  normalizedName: string;
  dailyRate: number | null;
  position: string | null;
  hoursWorked: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  silCutoff: number | null;
  plantillaUploadId: string | null;
  registerUploadId: string | null;
  registeredAt: string;
  updatedAt: string;
}

export type EmployeeAnomalyStatus = "added" | "removed" | "changed" | "renamed";

export interface PayrollEmployeeAnomalies {
  added: EmployeeAnomalyRow[];
  removed: EmployeeAnomalyRow[];
  changed: EmployeeAnomalyRow[];
  renamed: EmployeeAnomalyRow[];
  hasBaseline: boolean;
  baselinePeriodStart: string | null;
  baselinePeriodEnd: string | null;
}

export interface EmployeeAnomalyRow {
  name: string;
  previousName?: string | null;
  status: EmployeeAnomalyStatus;
  /** Rename match confidence (0–1) when status is renamed */
  matchScore?: number | null;
  riskFlags: string[];
  /** Sum of positive earnings deltas — manpower cost exposure */
  manpowerCostDelta: number;
  hoursWorked: number | null;
  daysWorked: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  silCutoff: number | null;
  hoursDelta: number | null;
  grossDelta: number | null;
  netDelta: number | null;
  silCutoffDelta: number | null;
  fieldChanges: EmployeeFieldChange[];
  topChangeLabel?: string | null;
}

export interface AuditUploadAnomalies {
  /** vs previous upload for the same cutoff period */
  samePeriod: PayrollEmployeeAnomalies;
  /** vs most recent prior register for this client (any cutoff) */
  vsLastRegister: PayrollEmployeeAnomalies;
}

export interface AuditCompany {
  id: string;
  name: string;
  slug: string;
}
