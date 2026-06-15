"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BodySmall, Caption, H4 } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import type {
  PayrollPrimaryAction,
  PayrollWorkflowStep,
} from "@/lib/payroll-workflow";

const stepStatusStyles: Record<
  PayrollWorkflowStep["status"],
  { ring: string; dot: string; text: string }
> = {
  complete: {
    ring: "border-primary/30 bg-primary/5",
    dot: "bg-primary text-primary-foreground",
    text: "text-foreground",
  },
  current: {
    ring: "border-primary ring-2 ring-primary/20 bg-primary/10",
    dot: "bg-primary text-primary-foreground",
    text: "text-foreground",
  },
  attention: {
    ring: "border-amber-400/60 ring-2 ring-amber-400/25 bg-amber-50",
    dot: "bg-amber-500 text-white",
    text: "text-foreground",
  },
  upcoming: {
    ring: "border-border bg-muted/30",
    dot: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
};

type Props = {
  steps: PayrollWorkflowStep[];
  primaryAction: PayrollPrimaryAction;
  periodLabel: string;
  loading?: boolean;
  onPrimaryAction: () => void;
};

export function PayrollWorkflowSteps({
  steps,
  primaryAction,
  periodLabel,
  loading,
  onPrimaryAction,
}: Props) {
  return (
    <Card className="overflow-hidden border-border shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <HStack justify="between" align="start" className="flex-wrap gap-2">
          <VStack gap="0" align="start">
            <H4 className="text-base font-semibold">Payroll workflow</H4>
            <Caption className="text-muted-foreground">
              {periodLabel} — follow the steps in order
            </Caption>
          </VStack>
        </HStack>

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const styles = stepStatusStyles[step.status];
            const isLast = index === steps.length - 1;

            return (
              <li key={step.id} className="relative min-w-0">
                <div
                  className={cn(
                    "flex h-full flex-col rounded-xl border p-3 transition-colors",
                    styles.ring
                  )}
                >
                  <HStack gap="2" align="center" className="mb-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        styles.dot
                      )}
                      aria-hidden
                    >
                      {step.status === "complete" ? (
                        <Icon name="Check" size={IconSizes.sm} />
                      ) : (
                        step.number
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-medium leading-tight",
                        styles.text
                      )}
                    >
                      {step.shortTitle}
                    </span>
                  </HStack>
                  <BodySmall className="text-xs leading-snug text-muted-foreground">
                    {step.description}
                  </BodySmall>
                  {step.metric ? (
                    <Caption className="mt-2 font-medium text-foreground/80">
                      {step.metric}
                    </Caption>
                  ) : null}
                  {step.href && step.status !== "upcoming" ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto justify-start px-0 text-xs"
                      asChild
                    >
                      <Link href={step.href}>
                        Open page
                        <Icon
                          name="ArrowRight"
                          size={IconSizes.sm}
                          className="ml-1"
                        />
                      </Link>
                    </Button>
                  ) : null}
                </div>
                {!isLast ? (
                  <span
                    className="absolute -right-1 top-1/2 z-10 hidden h-px w-2 -translate-y-1/2 bg-border lg:block"
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <HStack
            justify="between"
            align="center"
            className="flex-col gap-3 sm:flex-row sm:items-center"
          >
            <VStack gap="1" align="start" className="min-w-0 flex-1">
              <BodySmall className="font-semibold text-foreground">
                {primaryAction.label}
              </BodySmall>
              <Caption className="text-muted-foreground">
                {primaryAction.description}
              </Caption>
            </VStack>
            <Button
              variant={primaryAction.variant}
              size="lg"
              className="w-full shrink-0 sm:w-auto"
              disabled={
                loading ||
                primaryAction.disabled ||
                primaryAction.id === "none"
              }
              title={primaryAction.disabledReason}
              onClick={onPrimaryAction}
            >
              <Icon name={primaryAction.icon} size={IconSizes.sm} />
              {primaryAction.label}
            </Button>
          </HStack>
        </div>
      </CardContent>
    </Card>
  );
}
