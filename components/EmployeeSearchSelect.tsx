"use client";

import * as React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn, toTitleCaseWords } from "@/lib/utils";
import {
  suggestEmployeeOptions,
  type EmployeeOption,
} from "@/lib/employees/employee-option-suggest";

export type { EmployeeOption };

const SUGGEST_LIMIT = 10;

function formatEmployeeDisplay(emp: EmployeeOption): string {
  const nameParts = emp.full_name?.trim().split(/\s+/) || [];
  const lastName =
    emp.last_name ?? (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
  const firstName =
    emp.first_name ?? (nameParts.length > 0 ? nameParts[0] : "");
  const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
  if (lastName && firstName) {
    return `${toTitleCaseWords(lastName)}, ${toTitleCaseWords(firstName)}${middleParts.length > 0 ? " " + middleParts.map((p) => toTitleCaseWords(p)).join(" ") : ""} (${emp.employee_id})`;
  }
  return emp.full_name
    ? `${emp.full_name} (${emp.employee_id})`
    : emp.employee_id;
}

export interface EmployeeSearchSelectProps {
  employees: EmployeeOption[];
  value: string;
  onValueChange: (value: string) => void;
  showAllOption?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function EmployeeSearchSelect({
  employees,
  value,
  onValueChange,
  showAllOption = true,
  placeholder = "Search by name or employee ID...",
  className,
  triggerClassName,
  disabled = false,
}: EmployeeSearchSelectProps) {
  const reactId = useId();
  const inputId = `employee-search-${reactId}`;
  const listboxId = `${inputId}-listbox`;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedEmployee =
    value && value !== "all" ? employees.find((e) => e.id === value) : null;
  const displayValue =
    value === "all" || !value
      ? showAllOption
        ? "All Employees"
        : ""
      : selectedEmployee
        ? formatEmployeeDisplay(selectedEmployee)
        : "";

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  const suggestions = useMemo(
    () =>
      suggestEmployeeOptions(employees, debouncedQuery, {
        limit: SUGGEST_LIMIT,
        includeAllWhenEmpty: true,
      }),
    [employees, debouncedQuery]
  );

  const optionIds = useMemo(() => {
    const ids: string[] = [];
    if (showAllOption) ids.push("all");
    for (const emp of suggestions) ids.push(emp.id);
    return ids;
  }, [showAllOption, suggestions]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions, showAllOption]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onValueChange(id);
    setOpen(false);
    setQuery("");
  };

  const activeOptionId =
    open && optionIds[highlight]
      ? `${listboxId}-opt-${optionIds[highlight]}`
      : undefined;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Icon
          name="MagnifyingGlass"
          size={IconSizes.sm}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          placeholder={showAllOption ? "All Employees" : placeholder}
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open && e.key !== "Escape") return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) =>
                optionIds.length ? (h + 1) % optionIds.length : 0
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) =>
                optionIds.length
                  ? (h - 1 + optionIds.length) % optionIds.length
                  : 0
              );
            } else if (e.key === "Enter") {
              const id = optionIds[highlight];
              if (id) {
                e.preventDefault();
                handleSelect(id);
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setQuery("");
            }
          }}
          disabled={disabled}
          className={cn("pl-9", triggerClassName)}
        />
      </div>
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full min-w-full overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-md"
        >
          {showAllOption ? (
            <li
              id={`${listboxId}-opt-all`}
              role="option"
              aria-selected={highlight === 0}
              className={cn(
                "cursor-pointer px-3 py-2",
                highlight === 0
                  ? "bg-accent text-accent-foreground"
                  : (value === "all" || !value) && "bg-accent/50"
              )}
              onMouseEnter={() => setHighlight(0)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect("all");
              }}
            >
              All Employees
            </li>
          ) : null}
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">
              No employees found.
            </li>
          ) : (
            suggestions.map((emp, index) => {
              const optionIndex = showAllOption ? index + 1 : index;
              return (
                <li
                  key={emp.id}
                  id={`${listboxId}-opt-${emp.id}`}
                  role="option"
                  aria-selected={highlight === optionIndex}
                  className={cn(
                    "cursor-pointer px-3 py-2",
                    highlight === optionIndex
                      ? "bg-accent text-accent-foreground"
                      : value === emp.id && "bg-accent/50"
                  )}
                  onMouseEnter={() => setHighlight(optionIndex)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(emp.id);
                  }}
                >
                  {formatEmployeeDisplay(emp)}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
