"use client";

import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dbTableShell } from "@/lib/dashboard-ui";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /** Right-align numbers; center other non-name columns when set */
  align?: "left" | "center" | "right";
};

type Props<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  tableClassName?: string;
  minWidthClassName?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Show skeleton rows while loading */
  skeletonRows?: number;
  pagination?: {
    showingLabel: string;
    onPrevious?: () => void;
    onNext?: () => void;
    previousDisabled?: boolean;
    nextDisabled?: boolean;
  };
};

function alignClass(align?: "left" | "center" | "right") {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = "Nothing on file yet",
  emptyDetail,
  emptyAction,
  toolbar,
  footer,
  className,
  tableClassName,
  minWidthClassName = "min-w-[40rem]",
  onRowClick,
  rowClassName,
  skeletonRows = 6,
  pagination,
}: Props<T>) {
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}
      <div className={dbTableShell}>
        {loading ? (
          <div className="space-y-0 p-0">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border/70 px-4 py-3 last:border-0"
              >
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/5" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <EmptyState
            title={emptyTitle}
            detail={emptyDetail}
            action={emptyAction}
            className="border-0 bg-transparent py-14"
          />
        ) : (
          <Table className={cn(minWidthClassName, tableClassName)}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col.id}
                    className={cn(
                      "h-10 bg-muted/30 text-xs font-semibold tracking-tight text-muted-foreground",
                      alignClass(col.align),
                      col.headerClassName
                    )}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  role={onRowClick ? "link" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    "group",
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row)
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(
                        "py-3",
                        alignClass(col.align),
                        col.className
                      )}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {pagination && !showEmpty ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.showingLabel}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pagination.onPrevious}
              disabled={pagination.previousDisabled || loading}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pagination.onNext}
              disabled={pagination.nextDisabled || loading}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
      {footer}
    </div>
  );
}
