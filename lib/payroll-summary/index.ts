export {
  extractPdfText,
  extractPdfTextResult,
  type PdfTextExtractionResult,
  type PdfTextSource,
} from "./extract-pdf-text";
export {
  extractPdfTextWithOcrSpace,
  isOcrSpaceConfigured,
  OCR_SPACE_MAX_BYTES,
} from "./ocr-space";
export {
  isPayrollPdfTextSufficient,
  scorePayrollPdfText,
} from "./pdf-text-quality";
export {
  isPayrollSummaryFileName,
  assertPayrollSummaryFileName,
} from "./detect-payroll-summary";
export {
  detectExternalRegisterLayout,
  extractRegisterHeaderBlock,
  tokenizeRegisterHeaderLabels,
  buildLayoutFromHeaderLabels,
  refineLabelsToColumnCount,
  alignLabelsToColumnCount,
  resolveFieldForHeaderLabel,
  inferRegisterColumnCount,
  HEADER_PHRASES,
  type DetectedRegisterLayout,
} from "./detect-register-layout";
export {
  parsePayrollRegisterPdf,
  parsePayrollRegisterText,
  parseMoney,
  parseNumericTokens,
  extractPeriod,
  inferBiMonthlyPeriodEnd,
  extractCompanyName,
} from "./parse-payroll-register-pdf";
export {
  resolveAuditClientName,
  clientNameFromPayrollSummaryFileName,
  clientNameFromRelativePath,
  isPlausibleCompanyName,
} from "./resolve-audit-client-name";
export { findOrCreateAuditCompany } from "./find-or-create-audit-company";
export { peekRegisterClientName } from "./peek-register-client";
export { queuePayrollRegisterUpload } from "./queue-register-upload";
export {
  processRegisterUpload,
  rowToUploadRecord,
  storePayrollAuditPdf,
  PAYROLL_AUDIT_STORAGE_BUCKET,
} from "./process-register-upload";
export {
  validateParsedRegisterMetrics,
  toCentavos,
  fromCentavos,
  computeRollupGapCentavos,
} from "./validate-parsed-register";
export { diffPayrollSummary } from "./diff-payroll-summary";
export {
  AUDIT_TRACKED_METRICS,
  buildAuditMetricsSummary,
  sumAuditMetricTotals,
  type AuditMetricRow,
  type AuditMetricsSummary,
} from "./audit-metrics";
export {
  diffPayrollEmployees,
  hasEmployeeAnomalies,
} from "./diff-payroll-employees";
export {
  EMPLOYEE_ANOMALY_FIELDS,
  riskFlagLabel,
} from "./anomaly-fields";
export { employeeNameSimilarity, RENAME_MATCH_THRESHOLD } from "./employee-name-match";
export { upsertClientEmployeesFromRegister } from "./register-client-employees";
export { normalizeEmployeeName } from "./normalize-name";
export { parsePlantillaFile } from "./parse-plantilla";
export {
  PAYROLL_REGISTER_HEADERS,
  GP_HRIS_REGISTER_COL,
  GP_HRIS_REGISTER_MIN_COLUMNS,
  parseRegisterRow,
  pickRegisterTotals,
  sumOTPayComponents,
} from "./register-columns";
export type { PayrollRegisterRow, RegisterLayoutMap } from "./register-columns";
export {
  buildCategoryChangeDrilldown,
  type CategoryChangeContributor,
  type CategoryChangeDrilldown,
} from "./category-change-drilldown";
export {
  buildPeriodBridge,
  buildPeriodChanges,
  buildVolumeContext,
  sumEmployeeCategories,
  enrichCompositionTotals,
  totalsFromMetrics,
  metricsFromUploadRecord,
  topMoverFromChanges,
  PAYROLL_BRIDGE_CATEGORIES,
} from "./category-breakdown";
export {
  buildCompositionSeries,
  buildPeriodComposition,
  compositionLegend,
  hasRichComposition,
  COMPOSITION_COLORS,
} from "./composition-chart";
export type {
  CompositionView,
  CompositionSlice,
  PeriodComposition,
} from "./composition-chart";
export type {
  BridgeMetric,
  CategoryBridgeItem,
  PeriodBridgeAnalysis,
  PeriodChangeRow,
  PayrollCategoryTotals,
} from "./category-breakdown";
export type {
  AuditCompany,
  AuditDocumentType,
  AuditUploadAnomalies,
  EmployeeAnomalyRow,
  EmployeeAnomalyStatus,
  PayrollEmployeeAnomalies,
  PlantillaEmployee,
  PlantillaMetrics,
  PayrollAuditClientEmployee,
  PayrollSummaryMetrics,
  PayrollSummaryDiff,
  PayrollSummaryDiffField,
  PayrollSummaryUploadRecord,
  PayrollEmployeeRow,
} from "./types";
