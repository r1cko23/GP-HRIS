import { Badge } from "@/components/ui/badge";
import { directoryStatusMeta } from "@/lib/directory/employees";
import { cn } from "@/lib/utils";

export function directoryStatusLabel(status: string) {
  return directoryStatusMeta(status).label;
}

type Props = {
  status: string;
  /** Show payroll hint under the badge (roster / 201). */
  showHint?: boolean;
  /** Computed queue flag — active but missing from latest cutoff. */
  needsReview?: boolean;
  className?: string;
};

export function DirectoryStatusBadge({
  status,
  showHint = false,
  needsReview = false,
  className,
}: Props) {
  const meta = directoryStatusMeta(status);
  const title = [meta.short, meta.payroll].filter(Boolean).join(" ") || undefined;

  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <span className="inline-flex flex-wrap items-center gap-1">
        <Badge variant={meta.badge} title={title}>
          {meta.label}
        </Badge>
        {needsReview ? (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-950"
            title="Active but missing from this client's latest released cutoff"
          >
            Needs review
          </Badge>
        ) : null}
      </span>
      {showHint && meta.payroll ? (
        <span className="max-w-[14rem] text-[10px] leading-snug text-muted-foreground">
          {meta.payroll}
        </span>
      ) : null}
    </span>
  );
}
