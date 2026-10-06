import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TicketReplyForm } from "@/components/support/ticket-reply-form";
import { getMyTicket, isSupportId, readStaff } from "@/lib/it-support";
import { statusLabel, whenLabel } from "@/lib/support-labels";

export default async function TicketPage({ params }: { params: { id: string } }) {
  const staff = await readStaff();
  if (!staff) redirect("/login");
  if (!isSupportId(params.id)) notFound();
  const result = await getMyTicket(staff, params.id);
  if (!result.ticket) notFound();
  const ticket = result.ticket;

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Link href="/support" className="text-sm text-primary">
          My tickets
        </Link>
        <div>
          <p className="text-xs text-muted-foreground">
            {ticket.number} · {statusLabel(ticket.status)}
          </p>
          <h1 className="text-[1.75rem] font-semibold tracking-tight">{ticket.subject}</h1>
        </div>
        <ol className="flex flex-col gap-3">
          {ticket.messages.map((message) => (
            <li key={message.id} className="rounded-md border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {message.authorName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {message.authorKind === "staff" ? "IT support" : "You"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{whenLabel(message.createdAt)}</p>
              </div>
              {message.body ? <p className="mt-2 whitespace-pre-wrap text-sm">{message.body}</p> : null}
              {message.attachments.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {message.attachments.map((attachment) => (
                    <a key={attachment.id} href={`/api/support/tickets/${ticket.id}/files/${attachment.id}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/support/tickets/${ticket.id}/files/${attachment.id}`}
                        alt={attachment.fileName}
                        className="max-h-64 rounded-md border border-border"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <TicketReplyForm ticketId={ticket.id} />
      </div>
    </DashboardLayout>
  );
}
