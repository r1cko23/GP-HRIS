"use client";

import Link from "next/link";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

export type DirectoryCrumb = {
  label: string;
  href?: string;
};

type Props = {
  items: DirectoryCrumb[];
  className?: string;
};

/** Shared trail: Directory → Client → Person */
export function DirectoryBreadcrumb({ items, className }: Props) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="Directory"
      className={cn(
        "flex flex-wrap items-center gap-1 text-sm text-muted-foreground",
        className
      )}
    >
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <Icon
                name="CaretRight"
                size={IconSizes.sm}
                className="shrink-0 text-muted-foreground/70"
                aria-hidden
              />
            ) : null}
            {item.href && !last ? (
              <Link
                href={item.href}
                className="max-w-[12rem] truncate font-medium text-muted-foreground hover:text-foreground sm:max-w-[18rem]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "max-w-[14rem] truncate sm:max-w-[22rem]",
                  last ? "font-medium text-foreground" : "font-medium"
                )}
                aria-current={last ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
