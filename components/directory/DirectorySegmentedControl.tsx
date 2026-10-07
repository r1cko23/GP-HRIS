"use client";

import { cn } from "@/lib/utils";

export type DirectorySegmentOption = {
  id: string;
  label: string;
  count?: number | null;
  title?: string;
};

type Props = {
  options: DirectorySegmentOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  size?: "md" | "sm";
  /**
   * `tabs` — page/queue navigation (underline rail, BambooHR-style).
   * `segment` — compact status filters (All / Active / Inactive).
   */
  variant?: "tabs" | "segment";
  className?: string;
};

export function DirectorySegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  variant = "tabs",
  className,
}: Props) {
  if (variant === "segment") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex w-fit max-w-full flex-wrap items-center gap-1.5",
          className
        )}
      >
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={option.title}
              onClick={() => onChange(option.id)}
              className={cn(
                "gp-pressable inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border text-sm font-medium transition-colors",
                size === "sm" ? "min-h-8 px-3" : "min-h-9 px-3.5",
                selected
                  ? "border-primary/30 bg-accent text-accent-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {option.label}
              {option.count != null ? (
                <span
                  className={cn(
                    "tabular-nums text-xs",
                    selected ? "text-accent-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {option.count.toLocaleString()}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex w-full max-w-full items-stretch gap-0 overflow-x-auto border-b border-border",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={option.title}
            onClick={() => onChange(option.id)}
            className={cn(
              "gp-pressable relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1 text-sm font-medium transition-colors",
              "mr-5 last:mr-0 sm:mr-6",
              size === "sm" ? "min-h-9 text-sm" : "min-h-10",
              selected
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            {option.count != null ? (
              <span
                className={cn(
                  "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none",
                  selected
                    ? "bg-primary/12 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {option.count.toLocaleString()}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
