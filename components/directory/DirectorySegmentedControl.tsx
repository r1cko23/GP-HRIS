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
  className?: string;
};

/** iOS-style segmented control: one muted track, selected pill, no inverted colors. */
export function DirectorySegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: Props) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex w-fit max-w-full flex-wrap gap-0.5 rounded-md bg-muted p-1",
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
              "gp-pressable inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[0.375rem] font-medium text-foreground",
              size === "sm"
                ? "min-h-8 px-2.5 text-sm"
                : "min-h-9 px-3 text-sm",
              selected
                ? "bg-card shadow-card"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            {option.count != null ? (
              <span className="tabular-nums text-xs font-normal text-muted-foreground">
                {option.count.toLocaleString()}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
