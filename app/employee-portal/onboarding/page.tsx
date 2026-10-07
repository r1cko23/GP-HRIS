"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Task = {
  id: string;
  title: string;
  description: string | null;
  is_required: boolean;
  status: string;
  due_at: string | null;
  evidence_status: string;
};

type Credential = {
  id: string;
  status: string;
  issued_on: string | null;
  expires_on: string | null;
  definition:
    | { code: string; name: string; description: string | null }
    | Array<{ code: string; name: string; description: string | null }>
    | null;
};

export default function EmployeeOnboardingPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/employee-portal/onboarding", {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || "Could not load onboarding");
      return;
    }
    setTasks(payload.data?.tasks ?? []);
    setCredentials(payload.data?.credentials ?? []);
    setError("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(taskId: string) {
    setSaving(taskId);
    const response = await fetch("/api/employee-portal/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, status: "completed" }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(null);
    if (!response.ok) {
      toast.error(payload.error || "Task could not be updated");
      return;
    }
    toast.success("Task completed");
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your assigned steps and review credential status.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">My tasks</h2>
        </div>
        <div className="divide-y">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No worker tasks are assigned.
            </p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{task.title}</p>
                    <Badge variant={task.status === "completed" ? "success" : "secondary"}>
                      {task.status}
                    </Badge>
                    {task.is_required ? <Badge variant="outline">Required</Badge> : null}
                  </div>
                  {task.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                  {task.due_at ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Due {new Date(task.due_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                {task.status !== "completed" ? (
                  <Button
                    size="sm"
                    disabled={saving !== null}
                    onClick={() => void complete(task.id)}
                  >
                    {saving === task.id ? "Saving…" : "Mark complete"}
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Credentials</h2>
        </div>
        <div className="divide-y">
          {credentials.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No credentials are recorded.
            </p>
          ) : (
            credentials.map((credential) => {
              const definition = Array.isArray(credential.definition)
                ? credential.definition[0]
                : credential.definition;
              return (
                <div
                  key={credential.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-medium">{definition?.name ?? "Credential"}</p>
                    {credential.expires_on ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Expires {new Date(credential.expires_on).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={credential.status === "verified" ? "success" : "secondary"}
                  >
                    {credential.status}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
