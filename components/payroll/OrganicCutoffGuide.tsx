"use client";

import { Button } from "@/components/ui/button";
import { Caption, BodySmall } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { cn } from "@/lib/utils";
import type {
  OrganicAuditCheck,
  OrganicCutoffPrimaryAction,
} from "@/lib/payroll-register/organic-cutoff-workflow";

const checkStyles: Record<
  OrganicAuditCheck["status"],
  { mark: string; row: string }
> = {
  pass: {
    mark: "bg-primary text-primary-foreground",
    row: "border-primary/20 bg-primary/5",
  },
  warn: {
    mark: "bg-amber-500 text-white",
    row: "border-amber-300/60 bg-amber-50",
  },
  pending: {
    mark: "bg-muted text-muted-foreground",
    row: "border-border bg-muted/20",
  },
};

type Props = {
  primaryAction: OrganicCutoffPrimaryAction;
  checklist: OrganicAuditCheck[];
  busy?: boolean;
  onPrimaryAction: () => void;
  onJumpToSection: (sectionId: string) => void;
};

export function OrganicCutoffGuide({
  primaryAction,
  checklist,
  busy,
  onPrimaryAction,
  onJumpToSection,
}: Props) {
  const warnCount = checklist.filter((c) => c.status === "warn").length;
  const passCount = checklist.filter((c) => c.status === "pass").length;
  const allClear = passCount === checklist.length && warnCount === 0;
  const postedFlow =
    primaryAction.id === "downloads" || primaryAction.id === "done";

  return (
    <div
      id="cutoff-guide"
      className="space-y-3 rounded-md border border-border bg-card p-3 shadow-card sm:space-y-4 sm:p-4"
    >
      <div
        className={cn(
          "rounded-md border p-3 sm:p-4",
          postedFlow
            ? "border-border bg-muted/20"
            : "border-primary/20 bg-primary/5"
        )}
      >
        <HStack
          justify="between"
          align="center"
          className="flex-col gap-3 sm:flex-row sm:items-center"
        >
          <VStack gap="1" align="start" className="min-w-0 flex-1">
            <Caption
              className={cn(
                "whitespace-nowrap font-medium uppercase tracking-wide",
                postedFlow ? "text-muted-foreground" : "text-primary"
              )}
            >
              {postedFlow ? "Posted" : "Next step"}
            </Caption>
            <BodySmall className="text-balance text-base font-semibold leading-snug text-foreground">
              {primaryAction.label}
            </BodySmall>
            <Caption className="max-w-[65ch] text-muted-foreground">
              {primaryAction.description}
            </Caption>
            {primaryAction.blockedByReadiness ? (
              <Caption className="max-w-[65ch] text-amber-800">
                Resolve audit flags before continuing, or continue with a
                confirmation if you intentionally leave them.
              </Caption>
            ) : null}
          </VStack>
          <Button
            type="button"
            variant={postedFlow ? "outline" : "default"}
            className="min-h-11 w-full shrink-0 sm:min-h-10 sm:w-auto"
            disabled={!!busy}
            onClick={onPrimaryAction}
          >
            {busy ? "Working…" : primaryAction.label}
          </Button>
        </HStack>
      </div>

      <div>
        <HStack justify="between" align="center" className="mb-2 flex-wrap gap-2">
          <VStack gap="0" align="start">
            <BodySmall className="font-semibold leading-snug text-foreground">
              Audit checklist
            </BodySmall>
            <Caption className="text-muted-foreground">
              {allClear ? (
                <>All {passCount} checks passed</>
              ) : (
                <>
                  <span className="tabular-nums">{passCount}</span> ready
                  {warnCount > 0 ? (
                    <>
                      {" "}
                      · <span className="tabular-nums">{warnCount}</span> need
                      attention
                    </>
                  ) : null}
                </>
              )}
            </Caption>
          </VStack>
        </HStack>
        <ul
          className={cn(
            "grid gap-2",
            allClear
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
              : "sm:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {checklist.map((check) => {
            const styles = checkStyles[check.status];
            return (
              <li key={check.id}>
                <button
                  type="button"
                  title={check.detail}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border text-left transition-colors hover:bg-muted/40",
                    styles.row,
                    allClear ? "p-2.5" : "p-3"
                  )}
                  onClick={() => {
                    if (check.sectionId) onJumpToSection(check.sectionId);
                  }}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      styles.mark
                    )}
                    aria-hidden
                  >
                    {check.status === "pass"
                      ? "✓"
                      : check.status === "warn"
                        ? "!"
                        : "·"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-pretty text-sm font-medium leading-snug text-foreground">
                      {check.label}
                    </span>
                    {!allClear ? (
                      <Caption className="text-muted-foreground">
                        {check.detail}
                      </Caption>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
