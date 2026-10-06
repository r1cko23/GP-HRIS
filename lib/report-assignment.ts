const MANILA = "Asia/Manila";

export const REPORT_ABOUT = [
  {
    value: "not_am_verified",
    label: "Employees are in Timekeeping but not AM Verified in CSM",
  },
  {
    value: "missing_201",
    label: "There is no 201 file, so they cannot be added to CSM",
  },
  { value: "it_defect", label: "The app is broken" },
] as const;

export function reportAssignment(input: {
  kind: string;
  has201: string;
  reportedAt: Date;
}): { assignee: string; urgency: string } | null {
  if (input.kind === "it_defect") return { assignee: "IT support", urgency: "Normal" };
  if (input.kind === "missing_201" || (input.kind === "not_am_verified" && input.has201 === "no")) {
    return { assignee: "People", urgency: "Urgent" };
  }
  if (input.kind === "not_am_verified" && input.has201 === "yes") {
    const day = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: MANILA, day: "numeric" }).format(input.reportedAt),
    );
    if (day <= 2) return { assignee: "Account Supervisor", urgency: "Normal" };
    return { assignee: "Account Manager", urgency: "Urgent" };
  }
  return null;
}
