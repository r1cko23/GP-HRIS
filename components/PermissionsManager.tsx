"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { H4, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MODULE_INFO,
  DEFAULT_PERMISSIONS,
  MODULES,
  ACTIONS,
  clearPermissionsCache,
  getDefaultPermissionsForRole,
  type ModuleName,
  type ActionName,
  type UserPermissions,
  type ModulePermissions,
} from "@/lib/hooks/usePermissions";
import type { Database } from "@/types/database";
import { isHRFamilyRole } from "@/lib/roles";
import { RoleAccessGuide } from "@/components/access/RoleAccessGuide";
import { CopyAccessFromPanel, type CopyAccessUser } from "@/components/access/CopyAccessFromPanel";
import { AccessPreviewCard } from "@/components/access/AccessPreviewCard";

type UserRowRole = Database["public"]["Tables"]["users"]["Row"]["role"];

interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRowRole;
  is_active: boolean;
  permissions: UserPermissions | null;
  can_access_salary?: boolean | null;
}

interface PermissionsManagerProps {
  users: User[];
  onPermissionsUpdate: () => void;
}

// Group modules by category
const CATEGORY_LABELS: Record<string, string> = {
  overview: "Overview & dashboard",
  people: "People & HR",
  time: "Time & attendance",
  admin: "Admin & reports",
  settings: "Settings",
};

const CATEGORY_ORDER = ["overview", "people", "time", "admin", "settings"];

function roleBadgeClass(role: User["role"]): string {
  if (isHRFamilyRole(role)) {
    return "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800";
  }
  switch (role) {
    case "approver":
      return "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800";
    case "viewer":
      return "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:border-violet-800";
    default:
      return "";
  }
}

function formatRoleLabel(role: User["role"]): string {
  const labels: Partial<Record<User["role"], string>> = {
    admin: "Admin",
    head_of_hr: "Head of HR",
    hr_admin: "HR & Admin",
    hr_compben: "HR Compben",
    approver: "Approver",
    viewer: "Viewer",
    account_manager: "Account manager",
    ot_approver: "OT approver",
    ot_viewer: "OT viewer",
  };
  return labels[role] ?? String(role).replace(/_/g, " ");
}

export function PermissionsManager({ users, onPermissionsUpdate }: PermissionsManagerProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"people" | "guide">("people");
  const [editView, setEditView] = useState<"simple" | "advanced">("simple");

  const supabase = createClient();

  // Group modules by category
  const modulesByCategory = useMemo(() => {
    const grouped: Record<string, typeof MODULE_INFO> = {};
    for (const module of MODULE_INFO) {
      if (!grouped[module.category]) {
        grouped[module.category] = [];
      }
      grouped[module.category].push(module);
    }
    return grouped;
  }, []);

  // Filter out admin users (they always have full access)
  const editableUsers = useMemo(() => {
    return users.filter((user) => user.role !== "admin");
  }, [users]);

  const filteredEditableUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return editableUsers;
    return editableUsers.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        formatRoleLabel(u.role).toLowerCase().includes(q)
    );
  }, [editableUsers, searchQuery]);

  // Get effective permissions for a user (custom or role defaults)
  const getEffectivePermissions = (user: User): UserPermissions => {
    if (user.permissions) {
      // Merge custom with defaults
      const defaults = getDefaultPermissionsForRole(user.role);
      const merged = { ...defaults };
      for (const [module, perms] of Object.entries(user.permissions)) {
        if (merged[module as ModuleName]) {
          merged[module as ModuleName] = {
            ...merged[module as ModuleName],
            ...(perms as ModulePermissions),
          };
        }
      }
      return merged;
    }
    return getDefaultPermissionsForRole(user.role);
  };

  // Open modal to edit user permissions
  const handleEditPermissions = (user: User) => {
    setSelectedUser(user);
    setEditingPermissions(getEffectivePermissions(user));
    setHasChanges(false);
    setEditView("simple");
    setShowModal(true);
  };

  // Toggle a single permission
  const handleTogglePermission = (module: ModuleName, action: ActionName) => {
    if (!editingPermissions) return;

    setEditingPermissions({
      ...editingPermissions,
      [module]: {
        ...editingPermissions[module],
        [action]: !editingPermissions[module][action],
      },
    });
    setHasChanges(true);
  };

  // Toggle all permissions for a module
  const handleToggleModuleAll = (module: ModuleName, enabled: boolean) => {
    if (!editingPermissions) return;

    setEditingPermissions({
      ...editingPermissions,
      [module]: {
        create: enabled,
        read: enabled,
        update: enabled,
        delete: enabled,
      },
    });
    setHasChanges(true);
  };

  // Reset to role defaults
  const handleResetToDefaults = () => {
    if (!selectedUser) return;
    setEditingPermissions(getDefaultPermissionsForRole(selectedUser.role));
    setHasChanges(true);
  };

  // Save permissions
  const handleSavePermissions = async () => {
    if (!selectedUser || !editingPermissions) return;

    setSaving(true);
    try {
      // Calculate the diff from role defaults to only store customizations
      const defaults = DEFAULT_PERMISSIONS[selectedUser.role] || DEFAULT_PERMISSIONS.viewer;
      const customPerms: Partial<UserPermissions> = {};
      let hasCustomizations = false;

      for (const [module, perms] of Object.entries(editingPermissions)) {
        const defaultPerms = defaults[module as ModuleName];
        if (defaultPerms) {
          const moduleCustom: Partial<ModulePermissions> = {};
          let moduleHasCustom = false;

          for (const action of Object.values(ACTIONS)) {
            if ((perms as ModulePermissions)[action] !== defaultPerms[action]) {
              moduleCustom[action] = (perms as ModulePermissions)[action];
              moduleHasCustom = true;
              hasCustomizations = true;
            }
          }

          if (moduleHasCustom) {
            customPerms[module as ModuleName] = {
              ...defaultPerms,
              ...moduleCustom,
            };
          }
        }
      }

      // Use RPC so HR-family roles (and admin) can persist ACL without hitting users-table RLS on PATCH
      const { error } = await supabase.rpc("set_user_permissions", {
        p_target_user_id: selectedUser.id,
        p_permissions: hasCustomizations ? customPerms : null,
      });

      if (error) throw error;

      // Clear permissions cache
      clearPermissionsCache();

      toast.success("Pages & Functions saved", {
        description: `${selectedUser.full_name}’s permissions are updated.`,
      });

      setShowModal(false);
      setSelectedUser(null);
      setEditingPermissions(null);
      setHasChanges(false);
      onPermissionsUpdate();
    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast.error("Couldn’t save app access", {
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Count permissions for display
  const getPermissionSummary = (user: User): { total: number; enabled: number } => {
    const perms = getEffectivePermissions(user);
    let total = 0;
    let enabled = 0;

    for (const module of Object.values(perms)) {
      for (const action of Object.values(module)) {
        total++;
        if (action) enabled++;
      }
    }

    return { total, enabled };
  };

  // Check if all actions for a module are enabled
  const isModuleFullyEnabled = (module: ModuleName): boolean => {
    if (!editingPermissions) return false;
    const perms = editingPermissions[module];
    return perms.create && perms.read && perms.update && perms.delete;
  };

  // Check if module has mixed permissions
  const isModulePartiallyEnabled = (module: ModuleName): boolean => {
    if (!editingPermissions) return false;
    const perms = editingPermissions[module];
    const enabled = [perms.create, perms.read, perms.update, perms.delete].filter(Boolean).length;
    return enabled > 0 && enabled < 4;
  };

  const copyCandidates: CopyAccessUser[] = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        is_active: u.is_active,
        can_access_salary: u.can_access_salary,
        permissions: u.permissions,
      })),
    [users]
  );

  return (
    <VStack gap="4" className="w-full">
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        <Button
          type="button"
          variant={activeTab === "people" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => setActiveTab("people")}
        >
          By person
        </Button>
        <Button
          type="button"
          variant={activeTab === "guide" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => setActiveTab("guide")}
        >
          Role guide
        </Button>
      </div>

      {activeTab === "guide" ? (
        <RoleAccessGuide />
      ) : null}

      {activeTab === "people" ? (
        <>
      <details className="group rounded-lg border border-border bg-muted/20 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <span>App access vs. group approvals</span>
          <Icon
            name="CaretDown"
            size={IconSizes.sm}
            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="space-y-2 border-t border-border px-4 pb-3 pt-2 text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Here</strong> — which screens and tools someone can use (Employees,
            Payslips, queues, etc.).
          </p>
          <p>
            <strong className="text-foreground">Groups &amp; team members</strong> — who covers which employees for
            first-step leave, failure to log, and OT. Configure in{" "}
            <Link href="/overtime-groups" className="font-medium text-primary underline-offset-4 hover:underline">
              Groups &amp; approvers
            </Link>
            . Head of HR still finalizes leave.
          </p>
        </div>
      </details>

      <HStack gap="3" className="w-full flex-col sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Icon
            name="MagnifyingGlass"
            size={IconSizes.sm}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Find a team member…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Find team member to configure app access"
          />
        </div>
        <Caption className="text-muted-foreground sm:whitespace-nowrap">
          {filteredEditableUsers.length} of {editableUsers.length} people
        </Caption>
      </HStack>

      {editableUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <Icon name="ShieldCheck" size={IconSizes.md} className="mx-auto mb-2 opacity-50" />
          <p>No one to configure here yet.</p>
          <Caption>Admins already have full app access.</Caption>
        </div>
      ) : filteredEditableUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          No team members match “{searchQuery}”. Try another name or email.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredEditableUsers.map((user) => {
              const summary = getPermissionSummary(user);
              const hasCustom = user.permissions !== null;
              const pct = summary.total ? (summary.enabled / summary.total) * 100 : 0;
              return (
                <Card key={user.id} className="border-border shadow-sm">
                  <CardContent className="space-y-3 p-4">
                    <div className="min-w-0">
                      <BodySmall className="font-semibold text-foreground">{user.full_name}</BodySmall>
                      <Caption className="truncate text-muted-foreground">{user.email}</Caption>
                      {!user.is_active && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={roleBadgeClass(user.role)}>
                        {formatRoleLabel(user.role)}
                      </Badge>
                      {hasCustom ? (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                        >
                          Customized
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-dashed text-muted-foreground">
                          Role preset
                        </Badge>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Access enabled</span>
                        <span className="tabular-nums">
                          {summary.enabled}/{summary.total}
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full border border-border/60 bg-muted"
                        title={`${summary.enabled} of ${summary.total} options on`}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-full"
                      onClick={() => handleEditPermissions(user)}
                      disabled={!user.is_active}
                    >
                      <Icon name="Sliders" size={IconSizes.sm} className="mr-2" />
                      Edit access
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Member</TableHead>
                  <TableHead className="font-semibold text-foreground">Role</TableHead>
                  <TableHead className="font-semibold text-foreground">Access</TableHead>
                  <TableHead className="hidden font-semibold text-foreground lg:table-cell">Source</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEditableUsers.map((user) => {
                  const summary = getPermissionSummary(user);
                  const hasCustom = user.permissions !== null;

                  return (
                    <TableRow key={user.id} className="group">
                      <TableCell className="align-middle">
                        <VStack gap="1" align="start">
                          <BodySmall className="font-medium text-foreground">{user.full_name}</BodySmall>
                          <Caption className="text-muted-foreground">{user.email}</Caption>
                          {!user.is_active && (
                            <Badge variant="secondary" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </VStack>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="outline" className={roleBadgeClass(user.role)}>
                          {formatRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle">
                        <HStack gap="2" align="center">
                          <div
                            className="h-2 w-24 overflow-hidden rounded-full border border-border/60 bg-muted xl:w-28"
                            title={`${summary.enabled} of ${summary.total} access options on`}
                          >
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${summary.total ? (summary.enabled / summary.total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <Caption className="tabular-nums text-muted-foreground">
                            {summary.enabled}/{summary.total}
                          </Caption>
                        </HStack>
                      </TableCell>
                      <TableCell className="hidden align-middle lg:table-cell">
                        {hasCustom ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
                          >
                            Customized
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-dashed text-muted-foreground">
                            Role template
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPermissions(user)}
                          disabled={!user.is_active}
                        >
                          <Icon name="Sliders" size={IconSizes.sm} className="mr-2" />
                          Edit access
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
        </>
      ) : null}

      {/* Edit Permissions Modal */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!open && hasChanges) {
            // Confirm before closing with unsaved changes
            if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
              setShowModal(false);
              setSelectedUser(null);
              setEditingPermissions(null);
              setHasChanges(false);
            }
          } else {
            setShowModal(open);
            if (!open) {
              setSelectedUser(null);
              setEditingPermissions(null);
              setHasChanges(false);
            }
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto gap-0">
          <DialogHeader className="space-y-1 pb-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name="ShieldCheck" size={IconSizes.md} />
              </span>
              Pages & Functions
            </DialogTitle>
            <DialogDescription className="text-base leading-snug">
              {selectedUser && (
                <>
                  Choose what <strong>{selectedUser.full_name}</strong> can open and do in the app. Until you change
                  something, we use the usual access for their role.
                </>
              )}
            </DialogDescription>
            {selectedUser && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground pb-2">
                <span>Role</span>
                <Badge variant="outline" className={roleBadgeClass(selectedUser.role)}>
                  {formatRoleLabel(selectedUser.role)}
                </Badge>
              </div>
            )}
          </DialogHeader>

          {editingPermissions && selectedUser && (
            <VStack gap="6" className="mt-4">
              <CopyAccessFromPanel
                sourceCandidates={copyCandidates}
                targetUserId={selectedUser.id}
                targetLabel={selectedUser.full_name}
                compact
                onCopied={() => {
                  onPermissionsUpdate();
                  setEditingPermissions(getEffectivePermissions(selectedUser));
                  setHasChanges(false);
                }}
              />

              <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
                <Button
                  type="button"
                  variant={editView === "simple" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditView("simple")}
                >
                  Summary
                </Button>
                <Button
                  type="button"
                  variant={editView === "advanced" ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditView("advanced")}
                >
                  Detailed (Add / View / Edit / Remove)
                </Button>
              </div>

              {editView === "simple" ? (
                <AccessPreviewCard
                  role={selectedUser.role}
                  effectivePermissions={editingPermissions}
                  canAccessSalary={false}
                  variant="full"
                  title="Current access (read-only summary)"
                />
              ) : null}

              {/* Quick Actions */}
              {editView === "advanced" ? (
              <>
              <HStack justify="between" align="center" className="border-b pb-4">
                <HStack gap="2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetToDefaults}
                    disabled={saving}
                  >
                    <Icon name="ArrowCounterClockwise" size={IconSizes.sm} className="mr-2" />
                    Match role template
                  </Button>
                </HStack>
                {hasChanges && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                    Unsaved changes
                  </Badge>
                )}
              </HStack>

              {/* Permissions Grid by Category */}
              {CATEGORY_ORDER.map((category) => {
                const modules = modulesByCategory[category];
                if (!modules || modules.length === 0) return null;

                return (
                  <Card key={category} className="shadow-sm">
                    <CardHeader className="py-3 pb-2">
                      <CardTitle className="text-sm font-semibold">
                        {CATEGORY_LABELS[category] || category}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Use the row checkbox for full access to that area, or set Add, View, Edit, and Remove
                        separately.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        {/* Header row */}
                        <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                          <div className="col-span-2">Area</div>
                          <div className="text-center">Add</div>
                          <div className="text-center">View</div>
                          <div className="text-center">Edit</div>
                          <div className="text-center">Remove</div>
                        </div>

                        {/* Module rows */}
                        {modules.map((moduleInfo) => {
                          const moduleKey = moduleInfo.key;
                          const perms = editingPermissions[moduleKey];
                          const isFullyEnabled = isModuleFullyEnabled(moduleKey);
                          const isPartial = isModulePartiallyEnabled(moduleKey);

                          return (
                            <div
                              key={moduleKey}
                              className="grid grid-cols-6 gap-2 items-center py-2 hover:bg-accent/50 rounded px-2 -mx-2"
                            >
                              <div className="col-span-2">
                                <HStack gap="3" align="center">
                                  <Checkbox
                                    id={`${moduleKey}-all`}
                                    checked={isFullyEnabled}
                                    ref={(ref) => {
                                      if (ref) {
                                        (ref as any).indeterminate = isPartial;
                                      }
                                    }}
                                    onCheckedChange={(checked) => {
                                      handleToggleModuleAll(moduleKey, checked === true);
                                    }}
                                    disabled={saving}
                                  />
                                  <VStack gap="0" align="start">
                                    <Label
                                      htmlFor={`${moduleKey}-all`}
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {moduleInfo.label}
                                    </Label>
                                    <Caption className="text-muted-foreground text-xs">
                                      {moduleInfo.description}
                                    </Caption>
                                  </VStack>
                                </HStack>
                              </div>

                              {/* CRUD Checkboxes */}
                              {(["create", "read", "update", "delete"] as ActionName[]).map(
                                (action) => (
                                  <div key={action} className="flex justify-center">
                                    <Checkbox
                                      id={`${moduleKey}-${action}`}
                                      checked={perms[action]}
                                      onCheckedChange={() =>
                                        handleTogglePermission(moduleKey, action)
                                      }
                                      disabled={saving}
                                    />
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </>
              ) : (
                <Caption className="text-muted-foreground pb-2">
                  Switch to <strong className="text-foreground">Detailed</strong> to change individual
                  permissions, or use <strong className="text-foreground">Copy access from colleague</strong> above.
                </Caption>
              )}
            </VStack>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                if (hasChanges) {
                  if (
                    window.confirm(
                      "You have unsaved changes. Close without saving?"
                    )
                  ) {
                    setShowModal(false);
                  }
                } else {
                  setShowModal(false);
                }
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving || !hasChanges}>
              {saving ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="animate-spin mr-2"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                  Save changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VStack>
  );
}