"use client";

import { Badge } from "@/components/ui/badge";
import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary/types";
import { fromCentavos } from "@/lib/payroll-summary/validate-parsed-register";
import { formatCurrency } from "@/utils/format";

export function uploadStatusLabel(
  upload: Pick<
    PayrollSummaryUploadRecord,
    "status" | "errorMessage" | "rollupGapCentavos"
  >
): string {
  const status = upload.status ?? "ready";
  if (status === "processing") return "Processing";
  if (status === "failed") {
    if (upload.rollupGapCentavos != null && upload.rollupGapCentavos > 0) {
      return `Failed — off by ${formatCurrency(fromCentavos(upload.rollupGapCentavos))}`;
    }
    return upload.errorMessage ? "Failed" : "Failed";
  }
  return "Ready";
}

export function UploadStatusBadge({
  upload,
}: {
  upload: Pick<
    PayrollSummaryUploadRecord,
    "status" | "errorMessage" | "rollupGapCentavos"
  >;
}) {
  const status = upload.status ?? "ready";

  if (status === "processing") {
    return (
      <Badge variant="secondary" className="font-normal">
        Processing…
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive" className="font-normal max-w-[220px] truncate">
        {uploadStatusLabel(upload)}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="font-normal border-emerald-200 text-emerald-800">
      Ready
    </Badge>
  );
}
