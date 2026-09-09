/**
 * Decide what the MAIN → GP catalog payroll mirror should do for one period.
 */

import {
  MAIN_CATALOG_NOTES_PREFIX,
  MAIN_CATALOG_SOURCE_APP,
} from "./main-summary-to-register-line";

export type MainPayrollMirrorAction =
  | "create"
  | "upsert_hours"
  | "replace_catalog_run"
  | "skip_organic_posted"
  | "skip_no_directory";

export type MainPayrollMirrorPlan = {
  action: MainPayrollMirrorAction;
};

function isCatalogRun(notes: string | null | undefined): boolean {
  return (notes ?? "").startsWith(MAIN_CATALOG_NOTES_PREFIX);
}

export function planMainPayrollMirror(input: {
  organicClientId: string;
  mainPeriod: {
    legacyClientId: number;
    legacyBranchId: number | null;
    periodStart: string;
    periodEnd: string;
  };
  directoryClientId: string | null;
  directoryBranchId: string | null;
  existingCutoff: {
    id: string;
    status: string;
    source_app: string | null;
  } | null;
  existingRun: {
    id: string;
    status: string;
    notes: string | null;
  } | null;
}): MainPayrollMirrorPlan {
  if (!input.directoryClientId) {
    return { action: "skip_no_directory" };
  }

  const isOrganic = input.directoryClientId === input.organicClientId;
  if (
    isOrganic &&
    input.existingCutoff &&
    (input.existingCutoff.status === "posted" ||
      input.existingRun?.status === "posted")
  ) {
    return { action: "skip_organic_posted" };
  }

  if (!input.existingCutoff) {
    return { action: "create" };
  }

  const catalogCutoff =
    input.existingCutoff.source_app === MAIN_CATALOG_SOURCE_APP;
  const catalogRun = isCatalogRun(input.existingRun?.notes);

  if (catalogCutoff || catalogRun) {
    return { action: "replace_catalog_run" };
  }

  return { action: "upsert_hours" };
}

export { MAIN_CATALOG_SOURCE_APP, MAIN_CATALOG_NOTES_PREFIX };
