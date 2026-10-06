"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error ?? "Could not send the reply");
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 shadow-card">
      <label className="flex flex-col gap-1 text-sm">
        Reply
        <textarea name="body" rows={4} className="min-h-28 rounded-md border border-input bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Screenshots
        <input type="file" name="screenshots" accept="image/png,image/jpeg,image/webp" multiple />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:min-h-10"
      >
        {pending ? "Sending" : "Send reply"}
      </button>
    </form>
  );
}
