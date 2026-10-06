"use client";

import { useEffect, useRef, useState } from "react";
import { directoryJson } from "@/lib/directory/browser";
import {
  clientPackStatus,
  type ClientPackStatus,
} from "@/lib/directory/client-pack";
import {
  fitnessClearanceGate,
  type FitnessClearanceDocument,
} from "@/lib/directory/documents";
import { cn } from "@/lib/utils";

type Props = {
  organizationId: string;
  employeeId: string;
  asOfDate: string;
  priorEndedOn?: string | null;
  clientId?: string | null;
  purpose: "rehire" | "activate";
  className?: string;
  onFitnessChange?: (blocked: boolean, error: string | null) => void;
};

export function FitnessClearancePackPanel({
  organizationId,
  employeeId,
  asOfDate,
  priorEndedOn = null,
  clientId = null,
  purpose,
  className,
  onFitnessChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [fitnessError, setFitnessError] = useState<string | null>(null);
  const [fitnessBlocked, setFitnessBlocked] = useState(false);
  const [pack, setPack] = useState<ClientPackStatus | null>(null);
  const onFitnessChangeRef = useRef(onFitnessChange);
  onFitnessChangeRef.current = onFitnessChange;

  useEffect(() => {
    if (!asOfDate) {
      setFitnessBlocked(false);
      setFitnessError(null);
      setPack(null);
      onFitnessChangeRef.current?.(false, null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const docsJson = await directoryJson<{
          data: FitnessClearanceDocument[];
        }>(`/api/directory/employees/${employeeId}/documents`, organizationId);
        if (cancelled) return;
        const documents = docsJson.data ?? [];
        const gate = fitnessClearanceGate({
          asOfDate,
          priorEndedOn,
          documents,
          purpose,
        });
        setFitnessBlocked(!gate.ok);
        setFitnessError(gate.ok ? null : gate.error);
        onFitnessChangeRef.current?.(!gate.ok, gate.ok ? null : gate.error);

        let industry: string | null = null;
        if (clientId) {
          try {
            const clientJson = await directoryJson<{
              data: { industry?: string | null };
            }>(`/api/directory/clients/${clientId}`, organizationId);
            if (!cancelled) {
              industry = clientJson.data?.industry ?? null;
            }
          } catch {
            industry = null;
          }
        }
        if (!cancelled) {
          setPack(
            clientPackStatus({
              industry,
              documents,
              asOfDate,
            })
          );
          setFetchNote(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFitnessBlocked(false);
          setFitnessError(null);
          setPack(null);
          onFitnessChangeRef.current?.(false, null);
          setFetchNote(
            err instanceof Error
              ? `Could not preview clearances (${err.message}). Confirm still checks on the server.`
              : "Could not preview clearances. Confirm still checks on the server."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, employeeId, asOfDate, priorEndedOn, clientId, purpose]);

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {loading ? (
        <p className="text-muted-foreground">
          Checking NBI, medical, and client pack…
        </p>
      ) : null}
      {!loading && fitnessBlocked && fitnessError ? (
        <p className="text-destructive" role="alert">
          {fitnessError}
        </p>
      ) : null}
      {!loading && !fitnessBlocked && !fetchNote ? (
        <p className="text-muted-foreground">
          NBI and medical clearance cover this date. Keep SSS/TIN on the 201.
        </p>
      ) : null}
      {!loading && fetchNote ? (
        <p className="text-muted-foreground">{fetchNote}</p>
      ) : null}
      {pack ? (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="font-medium text-foreground">
            Recommended for {pack.industryLabel}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Advisory only — does not block{" "}
            {purpose === "activate" ? "Activate" : "Rehire"}.
          </p>
          <ul className="mt-2 space-y-1">
            {pack.items.map((item) => (
              <li
                key={item.key}
                className={cn(
                  "flex items-center justify-between gap-2 text-xs",
                  item.ok ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span>{item.label}</span>
                <span className="tabular-nums">
                  {item.ok ? "On file" : "Missing"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
