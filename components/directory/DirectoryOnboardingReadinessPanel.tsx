"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { directoryJson } from "@/lib/directory/browser";
import type { OnboardingReadiness } from "@/lib/directory/onboarding-readiness";

export function DirectoryOnboardingReadinessPanel({
  organizationId,
  employeeId,
  clientId,
  canCompleteTasks,
  canManageCredentials,
}: {
  organizationId: string;
  employeeId: string;
  clientId: string;
  canCompleteTasks: boolean;
  canManageCredentials: boolean;
}) {
  const [readiness, setReadiness] = useState<OnboardingReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [savingCredential, setSavingCredential] = useState(false);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; version: number }>
  >([]);
  const [templateId, setTemplateId] = useState("");
  const [assigningPacket, setAssigningPacket] = useState(false);
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [json, templatePage] = await Promise.all([
        directoryJson<{ data: OnboardingReadiness }>(
          `/api/directory/employees/${employeeId}/onboarding-readiness?${new URLSearchParams(
            { client_id: clientId }
          )}`,
          organizationId
        ),
        directoryJson<{
          data: Array<{ id: string; name: string; version: number }>;
        }>(
          "/api/directory/onboarding/templates?active=true&limit=200&offset=0",
          organizationId
        ),
      ]);
      setReadiness(json.data);
      setTemplates(templatePage.data);
      setTemplateId((current) => current || templatePage.data[0]?.id || "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Readiness could not be loaded"
      );
    }
  }, [clientId, employeeId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function completeTask(taskId: string) {
    setSavingTaskId(taskId);
    setError(null);
    try {
      await directoryJson(
        `/api/directory/employees/${employeeId}/onboarding-tasks/${taskId}`,
        organizationId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        }
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task could not be saved");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function verifyCredential(definitionId: string) {
    setSavingCredential(true);
    setError(null);
    try {
      await directoryJson(
        `/api/directory/employees/${employeeId}/credentials`,
        organizationId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential_definition_id: definitionId,
            status: "verified",
            issued_on: issuedOn || null,
            expires_on: expiresOn || null,
          }),
        }
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Credential could not be saved"
      );
    } finally {
      setSavingCredential(false);
    }
  }

  async function assignPacket() {
    if (!templateId) return;
    setAssigningPacket(true);
    setError(null);
    try {
      await directoryJson(
        `/api/directory/employees/${employeeId}/onboarding-packets`,
        organizationId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packet_template_id: templateId }),
        }
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Packet could not be assigned");
    } finally {
      setAssigningPacket(false);
    }
  }

  const nextTask =
    readiness?.next_action?.kind === "task"
      ? readiness.tasks.find(
          (task) => task.id === readiness.next_action?.id
        )
      : null;

  return (
    <Card className="mb-4 shadow-card" aria-live="polite">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>Onboarding readiness</CardTitle>
          <CardDescription>
            Required packet work and placement credentials.
          </CardDescription>
        </div>
        {readiness ? (
          <Badge variant={readiness.ready ? "success" : "warning"}>
            {readiness.ready
              ? "Ready"
              : `${readiness.blocker_count} blocker${
                  readiness.blocker_count === 1 ? "" : "s"
                }`}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : !readiness ? (
          <p className="text-sm text-muted-foreground">Checking readiness…</p>
        ) : readiness.ready ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              All blocking tasks and credentials are complete.
            </p>
            {readiness.tasks.length === 0 &&
            canCompleteTasks &&
            templates.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-muted-foreground">
                  Onboarding packet
                  <select
                    className="mt-1 block min-h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · v{template.version}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={assigningPacket || !templateId}
                  onClick={() => void assignPacket()}
                >
                  {assigningPacket ? "Assigning…" : "Assign packet"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next action
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {readiness.next_action?.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {readiness.next_action?.kind === "credential"
                  ? `Credential is ${readiness.next_action.status}. Add or verify it in Documents.`
                  : `Task is ${readiness.next_action?.status}.`}
              </p>
            </div>
            {nextTask && canCompleteTasks ? (
              <Button
                type="button"
                size="sm"
                className="min-h-11 shrink-0 sm:min-h-10"
                disabled={savingTaskId !== null}
                onClick={() => void completeTask(nextTask.id)}
              >
                {savingTaskId === nextTask.id ? "Saving…" : "Mark complete"}
              </Button>
            ) : null}
            {readiness.next_action?.kind === "credential" &&
            canManageCredentials ? (
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-[22rem]">
                <div className="space-y-1">
                  <Label htmlFor="readiness-issued" className="text-xs">
                    Issued
                  </Label>
                  <Input
                    id="readiness-issued"
                    type="date"
                    value={issuedOn}
                    onChange={(event) => setIssuedOn(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="readiness-expires" className="text-xs">
                    Expires
                  </Label>
                  <Input
                    id="readiness-expires"
                    type="date"
                    value={expiresOn}
                    onChange={(event) => setExpiresOn(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="col-span-2 min-h-11 sm:min-h-10"
                  disabled={savingCredential}
                  onClick={() =>
                    void verifyCredential(readiness.next_action!.id)
                  }
                >
                  {savingCredential ? "Saving…" : "Verify credential"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
