"use client";

import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { DirectoryNavIconButton } from "@/components/directory/DirectoryNavIconButton";
import {
  formatClientCutoffRange,
  formatClientPayFrequency,
  type DirectoryClientRow,
} from "@/lib/directory/client-form";
import { cn } from "@/lib/utils";

type Props = {
  client: DirectoryClientRow;
  clientId: string;
  latestPayrollEnd?: string | null;
  className?: string;
};

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Read-only client master summary — lives on the client management page. */
export function DirectoryClientSummaryStrip({
  client,
  clientId,
  latestPayrollEnd,
  className,
}: Props) {
  const pay = formatClientPayFrequency(client.pay_frequency);
  const cut1 = formatClientCutoffRange(client.cut1_start, client.cut1_end);
  const cut2 = formatClientCutoffRange(client.cut2_start, client.cut2_end);
  const active = client.status !== "inactive";
  const contact =
    [client.contact_person, client.phone].filter(Boolean).join(" · ") || "—";
  const cuts =
    [cut1 ? `1st ${cut1}` : null, cut2 ? `2nd ${cut2}` : null]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <section
      aria-label="Client details"
      className={cn(
        "rounded-md border border-border bg-card px-3 py-3 shadow-card sm:px-4 sm:py-3.5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground"
          aria-hidden
        >
          <Icon name="Buildings" size={IconSizes.sm} />
        </div>

        <dl className="grid min-w-0 flex-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Detail
            label="Status"
            value={
              <span
                className={cn(
                  "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
                  active
                    ? "bg-primary/12 text-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {active ? "Active" : "Inactive"}
              </span>
            }
          />
          <Detail label="Pay cycle" value={pay} />
          <Detail label="TIN" value={client.tin?.trim() || "—"} />
          <Detail label="Contact" value={contact} className="sm:col-span-2" />
          <Detail label="Cutoffs" value={cuts} />
          {latestPayrollEnd ? (
            <Detail label="Last payroll" value={latestPayrollEnd} />
          ) : null}
        </dl>

        <DirectoryNavIconButton
          href={`/people/clients/${clientId}`}
          icon="PencilSimple"
          label="Edit client details"
          variant="outline"
        />
      </div>
    </section>
  );
}
