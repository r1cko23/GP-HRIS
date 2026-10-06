"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import { LifeBuoy, Ticket } from "lucide-react";
import { REPORT_ABOUT, reportAssignment } from "@/lib/report-assignment";

function controlClass(className: string) {
  return `${className} support-topbar-control`;
}

export function SupportHeaderActions({
  className,
  ticketsHref,
}: {
  className: string;
  ticketsHref: string;
}) {
  return (
    <span className="support-topbar-group">
      <a href="/api/support/enter" className={controlClass(className)}>
        <LifeBuoy className="block h-3.5 w-3.5 shrink-0" />
        <span className="hidden lg:inline">Support</span>
      </a>
      <ReportProblemButton className={className} ticketsHref={ticketsHref} />
      <Link href={ticketsHref} className={controlClass(className)} aria-label="My tickets">
        <Ticket className="block h-3.5 w-3.5 shrink-0" />
        <span className="hidden lg:inline xl:hidden">Tickets</span>
        <span className="hidden xl:inline">My tickets</span>
      </Link>
    </span>
  );
}

const field = "min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10";

function ReportProblemButton({ className, ticketsHref }: { className: string; ticketsHref: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [kind, setKind] = useState("not_am_verified");
  const [has201, setHas201] = useState("");
  const [clientName, setClientName] = useState("");
  const assignment = reportAssignment({ kind, has201, reportedAt: new Date() });
  const needsClient = kind !== "it_defect";

  function openForm() {
    setError("");
    setTicketNumber("");
    setPageUrl(window.location.href);
    setKind("not_am_verified");
    setHas201("");
    setClientName("");
    setOpen(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/support/tickets", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      ticket?: { number: string };
    };
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "Could not send the ticket");
      return;
    }
    setTicketNumber(body.ticket?.number ?? "Sent");
    event.currentTarget.reset();
  }

  return (
    <>
      <button type="button" className={controlClass(className)} onClick={openForm} aria-label="Report a problem">
        <LifeBuoy className="block h-3.5 w-3.5 shrink-0" />
        <span className="hidden lg:inline">Report a problem</span>
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/40 p-4">
              <form
                onSubmit={onSubmit}
                className="mx-auto my-4 flex w-full max-w-lg flex-col gap-3 rounded-md border border-border bg-card p-4 text-foreground shadow-card"
              >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">Report a problem</h2>
              <button type="button" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <input type="hidden" name="pageUrl" value={pageUrl} />
            <label className="flex flex-col gap-1 text-sm">
              What is this about
              <select name="kind" required value={kind} onChange={(event) => setKind(event.target.value)} className={field}>
                {REPORT_ABOUT.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {kind === "not_am_verified" ? (
              <label className="flex flex-col gap-1 text-sm">
                Is the 201 file already in HRIS?
                <select name="has201" required value={has201} onChange={(event) => setHas201(event.target.value)} className={field}>
                  <option value="">Choose</option>
                  <option value="yes">Yes, the 201 file is on file</option>
                  <option value="no">No, the 201 file is missing</option>
                </select>
              </label>
            ) : (
              <input type="hidden" name="has201" value={kind === "missing_201" ? "no" : ""} />
            )}
            {needsClient ? (
              <label className="flex flex-col gap-1 text-sm">
                Client
                <input
                  name="clientName"
                  required
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  className={field}
                />
              </label>
            ) : null}
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <p>
                <span className="text-muted-foreground">Assign to · </span>
                {assignment && (!needsClient || clientName.trim()) ? assignment.assignee : "Choose what this is about"}
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">Urgency · </span>
                {assignment && (!needsClient || clientName.trim()) ? assignment.urgency : "—"}
              </p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Subject
              <input name="subject" required className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              What is going wrong
              <textarea
                name="description"
                required
                rows={4}
                className="min-h-28 rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Screenshots
              <input type="file" name="screenshots" accept="image/png,image/jpeg,image/webp" multiple />
              <span className="text-xs text-muted-foreground">PNG, JPEG, or WebP. Up to 3, 5 MB each.</span>
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {ticketNumber ? (
              <p className="text-sm">
                Ticket {ticketNumber} is in the queue.{" "}
                <Link href={ticketsHref} className="text-primary">
                  My tickets
                </Link>
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:min-h-10"
            >
              {pending ? "Sending" : "Send ticket"}
            </button>
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
