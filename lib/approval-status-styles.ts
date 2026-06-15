type LeaveStatus =
  | "pending"
  | "approved_by_manager"
  | "approved_by_hr"
  | "rejected"
  | "cancelled";

function isManagerApprovedLeaveStatus(status: LeaveStatus): boolean {
  return status === "approved_by_manager";
}

export function leaveStatusLabel(status: LeaveStatus): string {
  if (status === "pending") return "PENDING";
  if (isManagerApprovedLeaveStatus(status)) return "APPROVED BY MANAGER";
  if (status === "approved_by_hr") return "APPROVED";
  if (status === "rejected") return "REJECTED";
  return "CANCELLED";
}

export function leaveStatusClass(status: LeaveStatus): string {
  if (status === "pending") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (isManagerApprovedLeaveStatus(status) || status === "approved_by_hr") {
    return "bg-emerald-600 text-white border-emerald-600";
  }
  if (status === "rejected") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function otStatusBadgeClass(
  status: "pending" | "approved" | "rejected"
): string {
  if (status === "approved") {
    return "bg-emerald-600 text-white border-emerald-600";
  }
  if (status === "rejected") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  return "bg-blue-600 text-white border-blue-600";
}

export const ftlStatusStyles: Record<
  "pending" | "approved" | "rejected" | "cancelled",
  string
> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  approved: "bg-emerald-600 text-white border-emerald-600",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
  cancelled: "bg-muted text-muted-foreground border-transparent",
};
