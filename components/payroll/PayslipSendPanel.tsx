"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Caption, BodySmall } from "@/components/ui/typography";
import { directoryJson } from "@/lib/directory/browser";

type SendResult = {
  sent: number;
  failed: { employee_name: string; detail: string | null }[];
  skipped: { employee_name: string; detail: string | null }[];
};

export function PayslipSendPanel({
  cutoffId,
  orgId,
}: {
  cutoffId: string;
  orgId: string;
}) {
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await directoryJson<{ data: SendResult }>(
        `/api/timekeeping/cutoff-periods/${cutoffId}/payslips/send`,
        orgId,
      );
      setResult(json.data);
      setError(null);
    } catch {
      setResult(null);
    }
  }, [cutoffId, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const json = await directoryJson<{ data: SendResult }>(
        `/api/timekeeping/cutoff-periods/${cutoffId}/payslips/send`,
        orgId,
        { method: "POST" },
      );
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send payslips");
    } finally {
      setSending(false);
    }
  }

  const skipped = result?.skipped ?? [];
  const failed = result?.failed ?? [];

  return (
    <div className="mb-3 space-y-2">
      <BodySmall className="font-semibold text-foreground">Email payslips</BodySmall>
      <Caption className="block text-muted-foreground">
        Sends one payslip PDF per person after post. Someone with no email is skipped.
      </Caption>
      <Button type="button" size="sm" disabled={sending} onClick={() => void send()}>
        {sending ? "Sending…" : "Send"}
      </Button>
      {result ? (
        <Caption className="block text-muted-foreground">
          Sent {result.sent}. Failed {failed.length}. Skipped {skipped.length}.
        </Caption>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {skipped.length > 0 ? (
        <ul className="text-sm text-muted-foreground">
          {skipped.map((row) => (
            <li key={row.employee_name}>{row.employee_name} — no email</li>
          ))}
        </ul>
      ) : null}
      {failed.length > 0 ? (
        <ul className="text-sm text-destructive">
          {failed.map((row) => (
            <li key={`${row.employee_name}-${row.detail}`}>
              {row.employee_name}
              {row.detail ? ` — ${row.detail}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
