"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { BodySmall } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { bustCache } from "@/lib/cache-client";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  directoryJson,
  readDirectoryOrgId,
} from "@/lib/directory/browser";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Location = { id: string; name: string };
type OvertimeGroup = { id: string; name: string; description: string | null };

type DirectoryHit = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  status: string;
  client_id: string | null;
};

export default function NewEmployeePage() {
  const supabase = createClient();
  const router = useRouter();
  const { isAdmin, isHR } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [overtimeGroups, setOvertimeGroups] = useState<OvertimeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DirectoryHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DirectoryHit | null>(null);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [overtimeGroupId, setOvertimeGroupId] = useState<string>("");
  const [portalPassword, setPortalPassword] = useState("");

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canRead("employees")) {
      router.replace("/time/overtime");
    }
  }, [canRead, permissionsLoading, router]);

  useEffect(() => {
    setOrganizationId(readDirectoryOrgId() || null);
  }, []);

  const loadRefs = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, ogRes] = await Promise.all([
        supabase
          .from("office_locations")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("overtime_groups")
          .select("id, name, description")
          .eq("is_active", true)
          .order("name"),
      ]);
      setLocations((locRes.data as Location[]) ?? []);
      setOvertimeGroups((ogRes.data as OvertimeGroup[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!permissionsLoading && canRead("employees")) {
      void loadRefs();
    }
  }, [permissionsLoading, canRead, loadRefs]);

  useEffect(() => {
    if (!organizationId || q.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const json = await directoryJson<{ data: DirectoryHit[] }>(
          `/api/directory/employees?q=${encodeURIComponent(q.trim())}&limit=20&offset=0&status=active`,
          organizationId
        );
        if (!cancelled) setHits(json.data ?? []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, organizationId]);

  function toggleLocation(id: string) {
    setLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      toast.error("Select a Directory employee to enroll");
      return;
    }
    if (!(isAdmin || isHR)) {
      toast.error("Admin/HR access required");
      return;
    }
    if (locationIds.length === 0) {
      toast.error("Please assign at least one location");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/employees/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directory_employee_id: selected.id,
          organization_id: organizationId,
          locationIds,
          overtime_group_id: overtimeGroupId || null,
          portal_password: portalPassword.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        id?: string;
        error?: string;
        warning?: string;
        action?: string;
      };
      if (!res.ok) throw new Error(json.error || "Enrollment failed");
      if (json.warning) toast.warning(json.warning);
      toast.success(
        json.action === "updated"
          ? "Bundy enrollment updated"
          : "Enrolled for Bundy clock",
        {
          description: `${selected.first_name} ${selected.last_name}${
            selected.employee_code ? ` · ${selected.employee_code}` : ""
          }`,
        }
      );
      await bustCache();
      router.push(json.id ? `/time/enrollment/${json.id}` : "/time/enrollment");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to enroll employee"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!permissionsLoading && !canRead("employees")) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="w-full p-8">
          <BodySmall>Redirecting…</BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("mx-auto w-full max-w-3xl pb-32", dbPageWrapper)}>
        <DashboardPageHeader
          above={
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="-ml-2 h-8 w-fit gap-1"
            >
              <Link href="/time/enrollment">
                <Icon name="CaretLeft" size={IconSizes.sm} />
                Office employees
              </Link>
            </Button>
          }
          title="Enroll from directory"
          description="Link a Directory person to bundy clock and the employee portal."
        />

        <Card>
          <CardHeader>
            <CardTitle>Directory person</CardTitle>
            <CardDescription>
              Search active Directory employees, then assign office locations.
              Prefer clients with Bundy enabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="dir-search">Search Directory</Label>
                  <Input
                    id="dir-search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Name or employee code…"
                    autoComplete="off"
                  />
                  {searching ? (
                    <p className="text-xs text-muted-foreground">Searching…</p>
                  ) : null}
                  {hits.length > 0 ? (
                    <ul className="max-h-48 overflow-auto rounded-md border divide-y">
                      {hits.map((hit) => {
                        const active = selected?.id === hit.id;
                        return (
                          <li key={hit.id}>
                            <button
                              type="button"
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-muted/60",
                                active && "bg-muted"
                              )}
                              onClick={() => {
                                setSelected(hit);
                                setPortalPassword(hit.employee_code ?? "");
                              }}
                            >
                              <span className="font-medium">
                                {hit.last_name}, {hit.first_name}
                                {hit.middle_name ? ` ${hit.middle_name}` : ""}
                              </span>
                              <span className="ml-2 text-muted-foreground">
                                {hit.employee_code ?? "—"} · {hit.status}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {selected ? (
                    <p className="text-sm text-foreground">
                      Selected:{" "}
                      <strong>
                        {selected.last_name}, {selected.first_name}
                      </strong>{" "}
                      ({selected.employee_code ?? selected.id})
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Office locations</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {locations.map((loc) => (
                      <label
                        key={loc.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={locationIds.includes(loc.id)}
                          onChange={() => toggleLocation(loc.id)}
                        />
                        {loc.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Overtime group (optional)</Label>
                  <Select
                    value={overtimeGroupId || "__none__"}
                    onValueChange={(v) =>
                      setOvertimeGroupId(v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {overtimeGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portal-pw">Portal password</Label>
                  <Input
                    id="portal-pw"
                    value={portalPassword}
                    onChange={(e) => setPortalPassword(e.target.value)}
                    placeholder="Defaults to employee code"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Need a new person?{" "}
                  <Link href="/people" className="underline">
                    Add in Directory
                  </Link>{" "}
                  first (auto-enrolls when the Client has Bundy enabled).
                </p>

                <div className="sticky bottom-0 -mx-6 mt-8 flex justify-end gap-2 border-t bg-background px-6 py-4">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/time/enrollment">Cancel</Link>
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || !selected || locationIds.length === 0}
                  >
                    {submitting ? "Enrolling…" : "Enroll for Bundy"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
