"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BodySmall } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { HR_FAMILY_ROLES } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface OvertimeGroup {
  id: string;
  name: string;
  description: string | null;
  approver_id: string | null;
  viewer_id: string | null;
  is_active: boolean;
  approver?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  viewer?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

/** Radix Select does not allow SelectItem value=""; use this for “no one assigned”. */
const UNASSIGNED_SELECT_VALUE = "__unassigned__";

function formatAssignableUserRole(role: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    head_of_hr: "Head of HR",
    hr_admin: "HR & Admin",
    hr_compben: "HR Compben",
    account_manager: "Account manager",
    ot_approver: "OT approver",
    ot_viewer: "OT viewer",
    approver: "Approver",
    viewer: "Viewer",
  };
  return labels[role] ?? role.replace(/_/g, " ");
}

export default function OvertimeGroupsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [groups, setGroups] = useState<OvertimeGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "ot_approver" as "ot_approver" | "ot_viewer",
  });
  const [accountError, setAccountError] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, groupSearch]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [roleLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      // Load groups with approver/viewer info
      const { data: groupsData, error: groupsError } = await supabase
        .from("overtime_groups")
        .select(
          `
          *,
          approver:users!overtime_groups_approver_id_fkey(id, full_name, email),
          viewer:users!overtime_groups_viewer_id_fkey(id, full_name, email)
        `
        )
        .order("name");

      if (groupsError) throw groupsError;

      // Load users for dropdowns (include all roles that can be approvers/viewers)
      // Head-of-HR/HR-family users can also be assigned as approvers/viewers for groups
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("is_active", true)
        .in("role", [
          "admin",
          ...HR_FAMILY_ROLES,
          "account_manager",
          "ot_approver",
          "ot_viewer",
        ])
        .order("full_name");

      if (usersError) throw usersError;

      setGroups((groupsData || []) as OvertimeGroup[]);
      setUsers(usersData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function updateGroup(
    groupId: string,
    field: "approver_id" | "viewer_id",
    value: string | null
  ) {
    setSaving(groupId);
    try {
      const updateData = field === "approver_id"
        ? { approver_id: value }
        : { viewer_id: value };

      const { error } = await (supabase.from("overtime_groups") as any)
        .update(updateData)
        .eq("id", groupId);

      if (error) throw error;

      toast.success("Group updated successfully");
      await loadData();
    } catch (error: any) {
      console.error("Error updating group:", error);
      toast.error(error.message || "Failed to update group");
    } finally {
      setSaving(null);
    }
  }

  async function createAccount() {
    if (!newAccount.email || !newAccount.full_name || !newAccount.password) {
      setAccountError("Please fill all fields");
      return;
    }

    if (newAccount.password.length < 8) {
      setAccountError("Password must be at least 8 characters");
      return;
    }

    setCreatingAccount(true);
    setAccountError("");

    try {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newAccount.email,
          full_name: newAccount.full_name,
          password: newAccount.password,
          role: newAccount.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      toast.success("Account created successfully!");
      setShowCreateAccountModal(false);
      setNewAccount({ email: "", full_name: "", password: "", role: "ot_approver" });
      await loadData();
    } catch (error: any) {
      console.error("Error creating account:", error);
      setAccountError(error.message || "Failed to create account");
    } finally {
      setCreatingAccount(false);
    }
  }

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <VStack gap="6" className="w-full pb-24 sm:gap-8">
        <VStack gap="3" align="start" className="w-full sm:gap-4">
          <DashboardPageHeader
            title="Groups & approvers"
            description={
              <BodySmall className="text-sm leading-relaxed text-muted-foreground">
                Match each <strong className="font-medium text-foreground">employee group</strong> to an optional{" "}
                <strong className="font-medium text-foreground">approver</strong> or{" "}
                <strong className="font-medium text-foreground">viewer</strong>. Assign employees to groups on{" "}
                <strong className="font-medium text-foreground">Employees</strong>.
              </BodySmall>
            }
            actions={
              <HStack gap="2" className="w-full shrink-0 flex-col sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
                <Button variant="secondary" size="sm" className="w-full sm:w-auto" asChild>
                  <Link href="/settings">
                    <Icon name="Gear" size={IconSizes.sm} className="mr-2" />
                    Users &amp; app access
                  </Link>
                </Button>
                <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowCreateAccountModal(true)}>
                  <Icon name="Plus" size={IconSizes.sm} className="mr-2" />
                  New approver account
                </Button>
              </HStack>
            }
          />

          <details className="group w-full rounded-lg border border-border bg-muted/25 text-sm shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span>How approvers &amp; viewers work</span>
              <Icon
                name="CaretDown"
                size={IconSizes.sm}
                className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="space-y-2 border-t border-border px-4 pb-3 pt-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">Approver</strong> — first-step actions for OT, failure to log, and
                leave (manager stage). <strong className="text-foreground">Viewer</strong> — read-only for the same
                queue.
              </p>
              <p>
                <strong className="text-foreground">Head of HR</strong> always completes final leave approval. Leave both slots
                unassigned if only Head of HR/admin should handle a group.
              </p>
              <p>
                Menu visibility is separate: use{" "}
                <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
                  Settings → App access
                </Link>
                .
              </p>
            </div>
          </details>

          <div className="relative w-full max-w-md">
            <Icon
              name="MagnifyingGlass"
              size={IconSizes.sm}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              type="search"
              placeholder="Search groups by name…"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              className="pl-9"
              aria-label="Search groups"
            />
          </div>
        </VStack>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon
              name="ArrowsClockwise"
              size={IconSizes.lg}
              className="animate-spin text-muted-foreground"
            />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <Icon name="UsersThree" size={IconSizes.xl} className="mx-auto mb-3 opacity-40" />
            <p>No groups match “{groupSearch}”.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            {filteredGroups.map((group) => (
              <Card key={group.id} className="w-full overflow-hidden shadow-sm">
                <CardHeader className="space-y-1 border-b bg-muted/20 pb-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-snug sm:text-lg">{group.name}</CardTitle>
                    {!group.is_active && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {group.description && (
                    <CardDescription className="text-xs sm:text-sm">{group.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor={`approver-${group.id}`}
                        className="flex items-center gap-2 text-sm font-medium"
                        title="Can approve or reject first-step OT, failure to log, and leave (Head of HR still finalizes leave)."
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          <Icon name="CheckCircle" size={IconSizes.sm} />
                        </span>
                        Approver
                      </Label>
                      <Select
                        value={group.approver_id || UNASSIGNED_SELECT_VALUE}
                        onValueChange={(value) =>
                          updateGroup(
                            group.id,
                            "approver_id",
                            value === UNASSIGNED_SELECT_VALUE ? null : value
                          )
                        }
                        disabled={saving === group.id}
                      >
                        <SelectTrigger id={`approver-${group.id}`} className="h-10 w-full text-left text-sm">
                          <SelectValue placeholder="None — Head of HR/admin only" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_SELECT_VALUE}>No dedicated approver</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name}{" "}
                              <span className="text-muted-foreground">
                                · {formatAssignableUserRole(user.role)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor={`viewer-${group.id}`}
                        className="flex items-center gap-2 text-sm font-medium"
                        title="Read-only access to this group's OT, failure to log, and leave queues."
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                          <Icon name="Eye" size={IconSizes.sm} />
                        </span>
                        Viewer
                      </Label>
                      <Select
                        value={group.viewer_id || UNASSIGNED_SELECT_VALUE}
                        onValueChange={(value) =>
                          updateGroup(
                            group.id,
                            "viewer_id",
                            value === UNASSIGNED_SELECT_VALUE ? null : value
                          )
                        }
                        disabled={saving === group.id}
                      >
                        <SelectTrigger id={`viewer-${group.id}`} className="h-10 w-full text-left text-sm">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_SELECT_VALUE}>No dedicated viewer</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name}{" "}
                              <span className="text-muted-foreground">
                                · {formatAssignableUserRole(user.role)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {saving === group.id && (
                    <BodySmall className="flex items-center gap-2 text-muted-foreground">
                      <Icon name="ArrowsClockwise" size={IconSizes.sm} className="animate-spin" />
                      Saving…
                    </BodySmall>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Account Modal */}
        <Dialog open={showCreateAccountModal} onOpenChange={setShowCreateAccountModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create group approver account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-email">Email</Label>
                <Input
                  id="account-email"
                  type="email"
                  value={newAccount.email}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, email: e.target.value })
                  }
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-name">Full Name</Label>
                <Input
                  id="account-name"
                  value={newAccount.full_name}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, full_name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-role">Role</Label>
                <Select
                  value={newAccount.role}
                  onValueChange={(value: "ot_approver" | "ot_viewer") =>
                    setNewAccount({ ...newAccount, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ot_approver">OT Approver (can approve/reject)</SelectItem>
                    <SelectItem value="ot_viewer">OT Viewer (view only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-password">Password</Label>
                <Input
                  id="account-password"
                  type="password"
                  value={newAccount.password}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, password: e.target.value })
                  }
                  placeholder="Minimum 8 characters"
                />
              </div>
              {accountError && (
                <BodySmall className="text-destructive">{accountError}</BodySmall>
              )}
              <BodySmall className="text-muted-foreground leading-relaxed">
                After creating this account, assign them as <strong className="text-foreground">Approver</strong> or{" "}
                <strong className="text-foreground">Viewer</strong> on the cards above or from{" "}
                <strong className="text-foreground">Settings → Team members</strong>. They only see requests for people
                in the groups you attach; Head of HR still completes final leave approval.
              </BodySmall>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateAccountModal(false);
                  setNewAccount({ email: "", full_name: "", password: "", role: "ot_approver" });
                  setAccountError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={createAccount} disabled={creatingAccount}>
                {creatingAccount ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}