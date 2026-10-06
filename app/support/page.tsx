import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { listMyTickets, readStaff, type SupportSummary } from "@/lib/it-support";
import { statusLabel, whenLabel } from "@/lib/support-labels";

export default async function MyTicketsPage() {
  const staff = await readStaff();
  if (!staff) redirect("/login");
  const result = await listMyTickets(staff);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight">My tickets</h1>
          <p className="text-sm text-muted-foreground">Problems you reported from GP-HRIS</p>
        </div>
        {result.error ? <p className="text-sm text-destructive">{result.error}</p> : null}
        {!result.error && result.tickets.length === 0 ? (
          <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
            No tickets
          </p>
        ) : null}
        {result.tickets.length > 0 ? (
          <ul className="overflow-hidden rounded-md border border-border bg-card shadow-card">
            {result.tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </ul>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function TicketRow({ ticket }: { ticket: SupportSummary }) {
  return (
    <li className="border-b border-border last:border-0">
      <Link href={`/support/${ticket.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="block font-medium">{ticket.subject}</span>
          <span className="text-xs text-muted-foreground">{ticket.number}</span>
        </span>
        <span className="text-sm text-muted-foreground">
          {statusLabel(ticket.status)} · {whenLabel(ticket.updatedAt)}
        </span>
      </Link>
    </li>
  );
}
