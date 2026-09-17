"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardSection } from "@/components/ui/card-section";
import { BodySmall } from "@/components/ui/typography";
import { directoryJson } from "@/lib/directory/browser";
import { toast } from "sonner";

type AdjustmentRow = {
  id: string;
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  status: string;
  notes: string | null;
};

export function PayrollAdjustmentPanel(props: {
  cutoffId: string;
  orgId: string;
  periodStatus: string;
  periodKind?: string | null;
  periodLabel: string;
}) {
  const router = useRouter();
  const isPostedRegular =
    props.periodStatus === "posted" &&
    (props.periodKind ?? "regular") !== "adjustment";
  const isAdjustment = (props.periodKind ?? "regular") === "adjustment";

  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!props.cutoffId || !props.orgId) return;
    setLoading(true);
    try {
      const json = await directoryJson<{
        data: { adjustments: AdjustmentRow[] };
      }>(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/adjustment`,
        props.orgId
      );
      setAdjustments(json.data?.adjustments ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load adjustments"
      );
    } finally {
      setLoading(false);
    }
  }, [props.cutoffId, props.orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openAdjustment() {
    setBusy(true);
    try {
      const json = await directoryJson<{
        data: { created: boolean; cutoff: { id: string } };
      }>(`/api/timekeeping/cutoff-periods/${props.cutoffId}/adjustment`, props.orgId, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const id = json.data?.cutoff?.id;
      toast.success(
        json.data?.created
          ? "Adjustment cutoff opened"
          : "Opening existing adjustment"
      );
      if (id) router.push(`/payroll/${id}`);
      else await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to open adjustment"
      );
    } finally {
      setBusy(false);
    }
  }

  if (isAdjustment) {
    return (
      <div id="cutoff-adjustment" className="scroll-mt-24">
        <CardSection title="Adjustment run">
          <Badge variant="outline">Adjustment</Badge>
        </CardSection>
      </div>
    );
  }

  if (!isPostedRegular) {
    return null;
  }

  return (
    <div id="cutoff-adjustment" className="scroll-mt-24">
      <CardSection title="Adjustment run">
        {loading ? (
          <BodySmall className="text-muted-foreground">Loading…</BodySmall>
        ) : adjustments.length ? (
          <ul className="mb-3 space-y-2">
            {adjustments.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/payroll/${row.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {row.period_start}–{row.period_end}
                </Link>
                <Badge variant="outline">{row.status.replace(/_/g, " ")}</Badge>
                {row.payroll_date ? (
                  <span className="text-muted-foreground">
                    Payout {row.payroll_date}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <BodySmall className="mb-3 text-muted-foreground">
            No adjustment run for {props.periodLabel} yet.
          </BodySmall>
        )}

        <Button
          type="button"
          disabled={busy}
          onClick={() => void openAdjustment()}
        >
          {busy
            ? "Opening…"
            : adjustments.length
              ? "Open adjustment"
              : "Open adjustment run"}
        </Button>
      </CardSection>
    </div>
  );
}
