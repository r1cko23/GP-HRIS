import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  detail?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
};

export function EmptyState({ title, detail, action, className, icon }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/25 px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-3 text-muted-foreground [&_svg]:h-8 [&_svg]:w-8">
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </p>
      {detail ? (
        <p className="mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          {detail}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
