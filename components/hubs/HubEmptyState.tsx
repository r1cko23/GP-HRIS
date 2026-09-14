import type { ReactNode } from "react";

type Props = {
  title: string;
  detail?: string;
  action?: ReactNode;
};

export function HubEmptyState({ title, detail, action }: Props) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {detail ? (
        <p className="mt-1 text-pretty text-sm leading-normal text-muted-foreground">
          {detail}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
