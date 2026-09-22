"use client";

import * as React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  suggestListOptions,
  type ListSuggestOption,
} from "@/lib/list-filter-suggest";
import { cn } from "@/lib/utils";

export type { ListSuggestOption };

const DEFAULT_LIMIT = 10;

export interface ListFilterSuggestProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Fired when a suggestion is picked (defaults to onValueChange(option.value)). */
  onSelect?: (option: ListSuggestOption) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
  /** In-memory suggestion source. Ignored when fetchSuggestions is set. */
  items?: ListSuggestOption[];
  /** Remote suggestion source; minChars defaults to 2. */
  fetchSuggestions?: (query: string) => Promise<ListSuggestOption[]>;
  minChars?: number;
  limit?: number;
  debounceMs?: number;
  emptyMessage?: string;
}

export function ListFilterSuggest({
  value,
  onValueChange,
  onSelect,
  placeholder = "Search…",
  className,
  inputClassName,
  id: idProp,
  "aria-label": ariaLabel,
  disabled = false,
  items,
  fetchSuggestions,
  minChars: minCharsProp,
  limit = DEFAULT_LIMIT,
  debounceMs = 300,
  emptyMessage = "No matches",
}: ListFilterSuggestProps) {
  const reactId = useId();
  const inputId = idProp ?? `list-filter-suggest-${reactId}`;
  const listboxId = `${inputId}-listbox`;
  const isRemote = Boolean(fetchSuggestions);
  const minChars = minCharsProp ?? (isRemote ? 2 : 1);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [remoteItems, setRemoteItems] = useState<ListSuggestOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebounce(value, debounceMs);

  const memorySuggestions = useMemo(() => {
    if (isRemote) return [];
    return suggestListOptions(items ?? [], debouncedValue, {
      limit,
      minChars,
    });
  }, [isRemote, items, debouncedValue, limit, minChars]);

  useEffect(() => {
    if (!fetchSuggestions) return;
    const q = debouncedValue.trim();
    if (q.length < minChars) {
      setRemoteItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchSuggestions(q)
      .then((rows) => {
        if (!cancelled) setRemoteItems(rows.slice(0, limit));
      })
      .catch(() => {
        if (!cancelled) setRemoteItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSuggestions, debouncedValue, minChars, limit]);

  const suggestions = isRemote ? remoteItems : memorySuggestions;
  const queryReady = value.trim().length >= minChars;
  const showPanel = open && queryReady;

  useEffect(() => {
    setHighlight(0);
  }, [suggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: ListSuggestOption) => {
    if (onSelect) onSelect(option);
    else onValueChange(option.value);
    setOpen(false);
  };

  const activeOptionId =
    showPanel && suggestions[highlight]
      ? `${listboxId}-opt-${suggestions[highlight]!.id}`
      : undefined;

  return (
    <div ref={containerRef} className={cn("relative min-w-[220px]", className)}>
      <div className="relative">
        <Icon
          name="MagnifyingGlass"
          size={IconSizes.sm}
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onValueChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showPanel && e.key !== "Escape") return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) =>
                suggestions.length ? (h + 1) % suggestions.length : 0
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) =>
                suggestions.length
                  ? (h - 1 + suggestions.length) % suggestions.length
                  : 0
              );
            } else if (e.key === "Enter") {
              const opt = suggestions[highlight];
              if (opt) {
                e.preventDefault();
                handleSelect(opt);
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className={cn("pl-9", inputClassName)}
        />
      </div>
      {showPanel ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-md"
        >
          {loading ? (
            <li className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
              <Icon
                name="ArrowsClockwise"
                size={IconSizes.sm}
                className="animate-spin"
              />
              Searching…
            </li>
          ) : suggestions.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">{emptyMessage}</li>
          ) : (
            suggestions.map((opt, index) => (
              <li
                key={opt.id}
                id={`${listboxId}-opt-${opt.id}`}
                role="option"
                aria-selected={highlight === index}
                className={cn(
                  "cursor-pointer px-3 py-2",
                  highlight === index
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
              >
                <div className="font-medium leading-snug">{opt.primary}</div>
                {opt.secondary ? (
                  <div className="text-xs text-muted-foreground">
                    {opt.secondary}
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
