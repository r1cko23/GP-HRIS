"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

export type RosterLifecycleFilterOption = {
  value: string;
  label: string;
  title: string;
};

type Props = {
  filters: RosterLifecycleFilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/** Single-select lifecycle filter in a compact checkbox-style dropdown. */
export function DirectoryRosterLifecycleFilter({
  filters,
  value,
  onChange,
  className,
}: Props) {
  const current =
    filters.find((filter) => filter.value === value) ?? filters[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={`Lifecycle filter: ${current?.label ?? "All"}`}
          className={cn(
            "min-h-9 w-full min-w-0 justify-between gap-2 px-3 font-normal sm:w-auto sm:min-w-[11rem]",
            className
          )}
        >
          <span className="truncate text-sm">
            <span className="text-muted-foreground">Status · </span>
            <span className="font-medium text-foreground">
              {current?.label ?? "All"}
            </span>
          </span>
          <Icon
            name="CaretDown"
            size={IconSizes.sm}
            className="shrink-0 text-muted-foreground"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Lifecycle
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filters.map((filter) => (
          <DropdownMenuCheckboxItem
            key={filter.value}
            checked={value === filter.value}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => {
              if (checked) onChange(filter.value);
            }}
            title={filter.title}
            className="cursor-pointer"
          >
            {filter.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
