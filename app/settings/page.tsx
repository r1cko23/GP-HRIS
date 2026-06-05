"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { H3, H4, BodySmall, Caption } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { formatDateDisplay } from "@/utils/holidays";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { PermissionsManager } from "@/components/PermissionsManager";
import { AccessPreviewCard } from "@/components/access/AccessPreviewCard";
import { CopyAccessFromPanel } from "@/components/access/CopyAccessFromPanel";
import { copyUserAccess } from "@/lib/copy-user-access";
import { getRoleProfile } from "@/lib/access-matrix";
import type { Database } from "@/types/database";
import { isHRFamilyRole } from "@/lib/roles";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserRole = Database["public"]["Tables"]["users"]["Row"]["role"];

interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  can_access_salary?: boolean | null;
  profile_picture_url: string | null;
  permissions: any | null;
  created_at: string;
  assigned_ot_groups?: {
    id: string;
    name: string;
    approver_id: string | null;
    viewer_id: string | null;
  }[];
  employee_specific_assignments?: {
    id: string;
    employee_id: string;
    full_name: string;
    overtime_approver_id: string | null;
    overtime_viewer_id: string | null;
  }[];
}

interface OvertimeGroup {
  id: string;
  name: string;
  description: string | null;
}

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  holiday_type: "regular" | "non-working";
  year: number;
}

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [overtimeGroups, setOvertimeGroups] = useState<OvertimeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedOTGroups, setSelectedOTGroups] = useState<string[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showOTDetailsModal, setShowOTDetailsModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [pendingCopyFromUserId, setPendingCopyFromUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "head_of_hr" as UserRole,
    ot_groups: [] as string[],
  });
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [userToActivate, setUserToActivate] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [userMgmtSearch, setUserMgmtSearch] = useState("");

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        setCurrentUser(userData);
      }

      // Load all users (admin can see all, including inactive)
      // First check current user to debug
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log("Current auth user:", authUser?.id, authUser?.email);

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("full_name", { ascending: true });

      if (usersError) {
        console.error("Error loading users:", usersError);
        console.error("Error details:", {
          message: usersError.message,
          details: usersError.details,
          hint: usersError.hint,
          code: usersError.code,
        });
        throw usersError;
      }

      console.log(`Loaded ${usersData?.length || 0} users`);
      console.log("Users data sample:", usersData?.slice(0, 3));
      console.log("Full users data:", usersData);

      if (!usersData || usersData.length === 0) {
        console.warn("No users returned from query - checking RLS policies");
        setUsers([]);
        // Don't return early - still load holidays and groups
      }

      // Load holidays (filter by date range instead of year column)
      // Use current year dynamically
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1).toISOString().split('T')[0];
      const yearEnd = new Date(currentYear, 11, 31).toISOString().split('T')[0];
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("holidays")
        .select("*")
        .gte("holiday_date", yearStart)
        .lte("holiday_date", yearEnd)
        .order("holiday_date");

      if (holidaysError) {
        console.error("Error loading holidays:", holidaysError);
        // Don't throw - just set empty array
        setHolidays([]);
      } else {
        setHolidays(holidaysData || []);
      }

      // Load overtime groups (don't throw on error - just log it)
      const { data: groupsData, error: groupsError } = await supabase
        .from("overtime_groups")
        .select("id, name, description")
        .order("name");

      if (groupsError) {
        console.error("Error loading overtime groups:", groupsError);
        // Don't throw - just set empty array so users can still be displayed
        setOvertimeGroups([]);
      } else {
        setOvertimeGroups(groupsData || []);
      }

      // Load users with their assigned OT groups (after groups are loaded)
      // IMPORTANT: Set users immediately, even if group loading fails
      if (!usersData || usersData.length === 0) {
        console.warn("No users data available - setting empty array");
        setUsers([]);
      } else {
        console.log(`Processing ${usersData.length} users with OT groups...`);
        // Set users immediately with empty groups as fallback
        const usersWithEmptyGroups = usersData.map((user: any) => ({ ...user, assigned_ot_groups: [] }));
        console.log(`✅ Setting ${usersWithEmptyGroups.length} users immediately`);
        console.log("Sample user being set:", usersWithEmptyGroups[0]);
        setUsers(usersWithEmptyGroups);
        console.log("✅ setUsers() called successfully");

        try {
          const usersWithGroups = await Promise.all(
            usersData.map(async (user: any) => {
              try {
                // Find groups where this user is approver or viewer
                const { data: approverGroups, error: approverError } = await supabase
                  .from("overtime_groups")
                  .select("id, name, approver_id, viewer_id")
                  .eq("approver_id", user.id);

                if (approverError) {
                  console.warn(`Error loading approver groups for ${user.email}:`, approverError);
                }

                const { data: viewerGroups, error: viewerError } = await supabase
                  .from("overtime_groups")
                  .select("id, name, approver_id, viewer_id")
                  .eq("viewer_id", user.id);

                if (viewerError) {
                  console.warn(`Error loading viewer groups for ${user.email}:`, viewerError);
                }

                const assignedGroups = [
                  ...(approverGroups || []),
                  ...(viewerGroups || []).filter(
                    (vg: any) => !(approverGroups || []).some((ag: any) => ag.id === vg.id)
                  ),
                ];

                // Also find employee-specific assignments (where this user is directly assigned as approver or viewer)
                const { data: employeeAssignments, error: employeeError } = await supabase
                  .from("employees")
                  .select("id, employee_id, full_name, overtime_approver_id, overtime_viewer_id")
                  .or(`overtime_approver_id.eq.${user.id},overtime_viewer_id.eq.${user.id}`);

                if (employeeError) {
                  console.warn(`Error loading employee assignments for ${user.email}:`, employeeError);
                }

                return {
                  ...user,
                  assigned_ot_groups: assignedGroups,
                  employee_specific_assignments: employeeAssignments || [],
                };
              } catch (userError) {
                console.error(`Error processing user ${user.email}:`, userError);
                // Return user without groups if there's an error
                return {
                  ...user,
                  assigned_ot_groups: [],
                  employee_specific_assignments: [],
                };
              }
            })
          );

          console.log(`✅ Successfully processed ${usersWithGroups.length} users with groups`);
          console.log("Updating users state with groups:", usersWithGroups.length);
          setUsers(usersWithGroups);
        } catch (groupError) {
          console.error("❌ Error loading user groups:", groupError);
          // Users are already set above, so this is just a warning
          console.warn("Users displayed without OT group assignments");
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = currentUser?.role === "admin";

  // Helper function to format role names nicely
  function formatRoleName(role: string): string {
    const roleMap: Record<string, string> = {
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
    return roleMap[role] || role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  const filteredUsersForTable = useMemo(() => {
    const q = userMgmtSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        formatRoleName(u.role).toLowerCase().includes(q)
    );
  }, [users, userMgmtSearch]);

  function RoleBadge({ role }: { role: User["role"] }) {
    const label = formatRoleName(role);
    if (role === "admin") {
      return (
        <Badge className="border-emerald-800 bg-emerald-700 text-white hover:bg-emerald-700">
          {label}
        </Badge>
      );
    }
    if (isHRFamilyRole(role)) {
      return (
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100">
          {label}
        </Badge>
      );
    }
    if (role === "approver") {
      return (
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        >
          {label}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-violet-200 bg-violet-50 text-violet-900 dark:bg-violet-950 dark:text-violet-100"
      >
        {label}
      </Badge>
    );
  }

  function TeamMemberActionsMenu({ user }: { user: User }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 px-2 sm:h-8"
            disabled={user.id === currentUser?.id}
            aria-label={`Actions for ${user.full_name}`}
          >
            <Icon name="DotsThreeVertical" size={IconSizes.sm} className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.is_active ? (
            <DropdownMenuItem
              onClick={() => setUserToDeactivate(user)}
              disabled={user.id === currentUser?.id}
              className="text-destructive focus:text-destructive"
            >
              <Icon name="UserMinus" size={IconSizes.sm} className="mr-2" />
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setUserToActivate(user)}>
              <Icon name="UserPlus" size={IconSizes.sm} className="mr-2" />
              Activate
            </DropdownMenuItem>
          )}
          {(user.role === "approver" || user.role === "viewer") && (
            <DropdownMenuItem
              onClick={() => {
                setEditingUser(user);
                const assignedGroupIds = user.assigned_ot_groups?.map((g) => g.id) || [];
                setSelectedOTGroups(assignedGroupIds);
                setShowUserModal(true);
              }}
            >
              <Icon name="UsersThree" size={IconSizes.sm} className="mr-2" />
              Manage groups
            </DropdownMenuItem>
          )}
          {(currentUser?.role === "admin" || isHRFamilyRole(currentUser?.role)) &&
            user.role !== "admin" && (
            <DropdownMenuItem
              onClick={async () => {
                try {
                  const { error } = await supabase.rpc("set_user_salary_access", {
                    p_target_user_id: user.id,
                    p_can_access_salary: !user.can_access_salary,
                  });
                  if (error) throw error;
                  toast.success(
                    `Salary access ${!user.can_access_salary ? "granted" : "revoked"} for ${user.full_name}`
                  );
                  loadData();
                  const { clearUserRoleCache } = await import("@/lib/hooks/useUserRole");
                  clearUserRoleCache();
                } catch (error: any) {
                  console.error("Error updating salary access:", error);
                  toast.error(error.message || "Failed to update salary access");
                }
              }}
            >
              <Icon name={user.can_access_salary ? "Lock" : "Key"} size={IconSizes.sm} className="mr-2" />
              {user.can_access_salary ? "Revoke salary access" : "Grant salary access"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setUserToDelete(user)}
            disabled={user.id === currentUser?.id}
            className="text-destructive focus:text-destructive"
          >
            <Icon name="Trash" size={IconSizes.sm} className="mr-2" />
            Remove member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function TeamsSummary({ user }: { user: User }) {
    if (user.role !== "approver" && user.role !== "viewer" && user.role !== "admin") {
      return <span className="text-muted-foreground">—</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {user.assigned_ot_groups && user.assigned_ot_groups.length > 0 && (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-xs text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800"
              title={user.assigned_ot_groups.map((g) => g.name).join(", ")}
            >
              <Icon name="UsersThree" size={IconSizes.xs} className="mr-1" />
              {user.assigned_ot_groups.length} {user.assigned_ot_groups.length === 1 ? "group" : "groups"}
            </Badge>
          )}
          {user.employee_specific_assignments && user.employee_specific_assignments.length > 0 && (
            <Badge
              variant="outline"
              className="bg-violet-50 text-xs text-violet-900 border-violet-200 dark:bg-violet-950 dark:text-violet-100"
            >
              <Icon name="User" size={IconSizes.xs} className="mr-1" />
              {user.employee_specific_assignments.length}{" "}
              {user.employee_specific_assignments.length === 1 ? "person" : "people"}
            </Badge>
          )}
          {user.role === "admin" &&
            (!user.assigned_ot_groups || user.assigned_ot_groups.length === 0) &&
            (!user.employee_specific_assignments || user.employee_specific_assignments.length === 0) && (
              <Caption className="text-muted-foreground">All groups</Caption>
            )}
          {(user.role === "approver" || user.role === "viewer") &&
            (!user.assigned_ot_groups || user.assigned_ot_groups.length === 0) &&
            (!user.employee_specific_assignments || user.employee_specific_assignments.length === 0) && (
              <Caption className="text-amber-800 dark:text-amber-200">Not assigned</Caption>
            )}
        </div>
        {((user.assigned_ot_groups && user.assigned_ot_groups.length > 0) ||
          (user.employee_specific_assignments && user.employee_specific_assignments.length > 0)) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            onClick={() => {
              setEditingUser(user);
              setShowOTDetailsModal(true);
            }}
            title="Assignment details"
          >
            <Icon name="Info" size={IconSizes.sm} />
          </Button>
        )}
      </div>
    );
  }

  async function assignUserToOTGroups(
    userId: string,
    userRole: "approver" | "viewer",
    groupIds: string[]
  ) {
    // First, remove user from all groups
    if (userRole === "approver") {
      await (supabase.from("overtime_groups") as any)
        .update({ approver_id: null })
        .eq("approver_id", userId);
    } else {
      await (supabase.from("overtime_groups") as any)
        .update({ viewer_id: null })
        .eq("viewer_id", userId);
    }

    // Then assign to selected groups
    for (const groupId of groupIds) {
      const updateField = userRole === "approver" ? "approver_id" : "viewer_id";
      const updateData: any = {};
      updateData[updateField] = userId;

      const { error } = await (supabase.from("overtime_groups") as any)
        .update(updateData)
        .eq("id", groupId);

      if (error) {
        throw new Error(`Failed to assign to group: ${error.message}`);
      }
    }
  }

  async function handleCreateUser() {
    console.log("handleCreateUser called", {
      newUser,
      creatingUser,
      passwordLength: newUser.password?.length,
    });

    // Client-side validation
    const trimmedEmail = newUser.email?.trim() || "";
    const trimmedFullName = newUser.full_name?.trim() || "";
    const trimmedPassword = newUser.password?.trim() || "";

    console.log("Validation check:", {
      hasEmail: !!trimmedEmail,
      hasFullName: !!trimmedFullName,
      hasPassword: !!trimmedPassword,
      passwordLength: trimmedPassword.length,
      hasRole: !!newUser.role,
    });

    if (
      !trimmedEmail ||
      !trimmedFullName ||
      !trimmedPassword ||
      !newUser.role
    ) {
      console.log("Validation failed: missing fields", {
        trimmedEmail,
        trimmedFullName,
        trimmedPassword: trimmedPassword ? "***" : "",
        passwordLength: trimmedPassword.length,
        role: newUser.role,
      });
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      console.log("Email validation failed:", trimmedEmail);
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate password length
    if (trimmedPassword.length < 8) {
      console.log("Password validation failed:", {
        length: trimmedPassword.length,
        required: 8,
      });
      toast.error(
        `Password must be at least 8 characters long (currently ${trimmedPassword.length})`
      );
      return;
    }

    console.log("All validations passed, proceeding with API call");

    setCreatingUser(true);
    try {
      console.log("Sending request to /api/users/create", { newUser });
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();
      console.log("API response:", { status: response.status, data });

      if (!response.ok) {
        const errorMessage = data.details
          ? `${data.error}: ${data.details}`
          : data.error || "Failed to create user";
        throw new Error(errorMessage);
      }

      // If Approver/Viewer, assign to selected groups
      if ((newUser.role === "approver" || newUser.role === "viewer") && selectedOTGroups.length > 0) {
        try {
          await assignUserToOTGroups(data.user.id, newUser.role, selectedOTGroups);
        } catch (error: any) {
          console.error("Error assigning OT groups:", error);
          toast.error("User created but failed to assign groups: " + error.message);
        }
      }

      if (pendingCopyFromUserId && data.user?.id) {
        try {
          await copyUserAccess(supabase, pendingCopyFromUserId, data.user.id, {
            copyPermissions: true,
            copySalaryAccess: true,
            copyOtGroups: true,
          });
          toast.success("Access copied from colleague", {
            description: `Matched settings from the person you selected.`,
          });
        } catch (error: any) {
          console.error("Error copying access:", error);
          toast.error("User created but copying access failed: " + error.message);
        }
        setPendingCopyFromUserId(null);
      }

      // If editing user and role changed to Approver/Viewer, update groups
      if (editingUser && (newUser.role === "approver" || newUser.role === "viewer") && selectedOTGroups.length > 0) {
        try {
          await assignUserToOTGroups(editingUser.id, newUser.role, selectedOTGroups);
        } catch (error: any) {
          console.error("Error updating OT groups:", error);
          toast.error("Failed to update groups: " + error.message);
        }
      }

      toast.success(`User created successfully!`, {
        description: `${data.user.full_name} • ${data.user.email} • Role: ${data.user.role}`,
      });
      setShowUserModal(false);
      setNewUser({
        email: "",
        full_name: "",
        password: "",
        role: "head_of_hr",
        ot_groups: [],
      });
      setSelectedOTGroups([]);
      setEditingUser(null);
      // Reload users list
      await loadData();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleUpdateUserStatus(userId: string, isActive: boolean) {
    setUpdatingStatus(true);
    try {
      const response = await fetch("/api/users/update-status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          is_active: isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user status");
      }

      toast.success(
        `User ${isActive ? "activated" : "deactivated"} successfully!`,
        {
          description: "User status has been updated",
        }
      );
      setUserToDeactivate(null);
      setUserToActivate(null);
      // Reload users list
      await loadData();
    } catch (error: any) {
      console.error("Error updating user status:", error);
      toast.error(error.message || "Failed to update user status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;

    if (deleteConfirmText.toLowerCase() !== "delete") {
      toast.error('Please type "delete" to confirm');
      return;
    }

    setDeletingUser(true);
    try {
      const response = await fetch("/api/users/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userToDelete.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast.success(`User deleted successfully!`, {
        description: `${userToDelete.full_name} • ${userToDelete.email}`,
      });
      setUserToDelete(null);
      setDeleteConfirmText("");
      // Reload users list
      await loadData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeletingUser(false);
    }
  }

  function validateEmail(email: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  }

  function validatePassword(password: string) {
    if (!password.trim()) {
      setPasswordError("Password is required");
      return false;
    }
    if (password.trim().length < 8) {
      setPasswordError(
        `Password must be at least 8 characters long (currently ${
          password.trim().length
        })`
      );
      return false;
    }
    setPasswordError("");
    return true;
  }

  if (loading) {
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

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full">
        <DashboardPageHeader
          title="Settings"
          description="Control who can sign in, what they can see and change in the app, and which employee groups each approver covers."
        />

        {/* User Info */}
        <CardSection title="Your profile" description="Signed-in account on this device">
          <VStack gap="6" align="center" className="w-full">
            {currentUser?.id ? (
              <ProfilePictureUpload
                currentPictureUrl={currentUser?.profile_picture_url || null}
                userId={currentUser.id}
                userName={currentUser?.full_name || "User"}
                userType="user"
                onUploadComplete={async () => {
                  await loadData();
                }}
                size="lg"
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                  <span className="text-muted-foreground text-lg">US</span>
                </div>
                <Caption className="text-xs text-muted-foreground">
                  Loading user information...
                </Caption>
              </div>
            )}
            <VStack gap="3" align="center" className="w-full">
              <div className="flex flex-col items-center">
                <VStack gap="3" align="start">
                  <HStack gap="3" align="center">
                    <BodySmall className="w-16 text-left">Name:</BodySmall>
                    <span className="font-semibold">
                      {currentUser?.full_name}
                    </span>
                  </HStack>
                  <HStack gap="3" align="center">
                    <BodySmall className="w-16 text-left">Email:</BodySmall>
                    <span className="font-semibold">{currentUser?.email}</span>
                  </HStack>
                  <HStack gap="3" align="center">
                    <BodySmall className="w-16 text-left">Role:</BodySmall>
                    <Badge variant={isAdmin ? "default" : "secondary"}>
                      {formatRoleName(currentUser?.role || "")}
                    </Badge>
                  </HStack>
                </VStack>
              </div>
            </VStack>
          </VStack>
        </CardSection>

        {/* User Management (Admin Only) */}
        {isAdmin && (
          <CardSection
            title="Team members"
            description="Dashboard logins, roles, and salary visibility. Tie approvers/viewers to groups so they only see the right requests."
          >
            <details className="group mb-4 rounded-lg border border-border bg-muted/20 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                <span>Groups &amp; approvals</span>
                <Icon
                  name="CaretDown"
                  size={IconSizes.sm}
                  className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="space-y-3 border-t border-border px-4 pb-3 pt-2 text-muted-foreground">
                <p>
                  Approvers and viewers only see employees in the{" "}
                  <strong className="text-foreground">groups</strong> you give them. Set group leads on{" "}
                  <Link
                    href="/overtime-groups"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Groups &amp; approvers
                  </Link>{" "}
                  or use <strong className="text-foreground">Manage groups</strong> in the row menu.
                </p>
                <Button size="sm" variant="secondary" asChild className="w-full sm:w-auto">
                  <Link href="/overtime-groups">
                    <Icon name="UsersThree" size={IconSizes.sm} className="mr-2" />
                    Open Groups &amp; approvers
                  </Link>
                </Button>
              </div>
            </details>

            <HStack justify="between" align="center" className="flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:max-w-sm">
                <Icon
                  name="MagnifyingGlass"
                  size={IconSizes.sm}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  type="search"
                  placeholder="Search name, email, or role…"
                  value={userMgmtSearch}
                  onChange={(e) => setUserMgmtSearch(e.target.value)}
                  className="pl-9"
                  aria-label="Search team members"
                />
              </div>
              <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowUserModal(true)}>
                <Icon name="Plus" size={IconSizes.sm} className="mr-2" />
                Add member
              </Button>
            </HStack>
            <Caption className="mt-2 block text-muted-foreground">
              {filteredUsersForTable.length} of {users.length} people
            </Caption>

            {loading && users.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <Icon name="ArrowsClockwise" size={IconSizes.sm} className="animate-spin" />
                  Loading team members…
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
                <Icon name="User" size={IconSizes.md} className="mx-auto mb-2 opacity-50" />
                <p>No users found.</p>
              </div>
            ) : filteredUsersForTable.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
                No one matches “{userMgmtSearch}”.
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-3 md:hidden">
                  {filteredUsersForTable.map((user) => (
                    <Card key={user.id} className="border-border shadow-sm">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-foreground">{user.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <TeamMemberActionsMenu user={user} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <RoleBadge role={user.role} />
                          <Badge variant={user.is_active ? "outline" : "secondary"}>
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {user.role === "admin" ? (
                            <Badge className="border-emerald-800 bg-emerald-700 text-white">Pay info</Badge>
                          ) : user.can_access_salary ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">
                              Pay info
                            </Badge>
                          ) : (
                            <Badge variant="secondary">No pay info</Badge>
                          )}
                        </div>
                        <div className="text-xs">
                          <span className="font-medium text-muted-foreground">Teams: </span>
                          <TeamsSummary user={user} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-4 hidden overflow-hidden rounded-lg border border-border bg-card md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Pay info</TableHead>
                        <TableHead className="min-w-[140px] font-semibold">Teams</TableHead>
                        <TableHead className="text-right font-semibold">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsersForTable.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="align-middle font-medium text-foreground">
                              {user.full_name}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate align-middle text-muted-foreground">
                              {user.email}
                            </TableCell>
                            <TableCell className="align-middle">
                              <RoleBadge role={user.role} />
                            </TableCell>
                            <TableCell className="align-middle">
                              <Badge variant={user.is_active ? "outline" : "secondary"}>
                                {user.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-middle">
                              {user.role === "admin" ? (
                                <Badge className="border-emerald-800 bg-emerald-700 text-white">Yes</Badge>
                              ) : user.can_access_salary ? (
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">
                                  Yes
                                </Badge>
                              ) : (
                                <Badge variant="secondary">No</Badge>
                              )}
                            </TableCell>
                            <TableCell className="align-middle">
                              <TeamsSummary user={user} />
                            </TableCell>
                            <TableCell className="text-right align-middle">
                              <TeamMemberActionsMenu user={user} />
                            </TableCell>
                          </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardSection>
        )}

        {/* Permissions Management (Admin Only) */}
        {isAdmin && (
          <CardSection
            title="App access"
            description="Use Role guide when onboarding, or copy access from a colleague when replacing HR or approvers. Detailed Add/View/Edit/Remove is under each person’s Edit access."
          >
            <PermissionsManager
              users={users}
              onPermissionsUpdate={loadData}
            />
          </CardSection>
        )}

        {/* Holidays */}
        <CardSection
          title="Philippine Holidays 2025"
          description="System automatically detects these holidays"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VStack gap="3" align="start">
              <H4>Regular Holidays (2x Pay)</H4>
              <VStack gap="2" className="w-full">
                {holidays
                  .filter((h) => h.holiday_type === "regular")
                  .map((holiday) => (
                    <HStack
                      key={holiday.id}
                      justify="between"
                      align="center"
                      className="p-2 bg-red-50 rounded w-full"
                    >
                      <BodySmall>{holiday.holiday_name}</BodySmall>
                      <Caption>
                        {formatDateDisplay(holiday.holiday_date)}
                      </Caption>
                    </HStack>
                  ))}
              </VStack>
            </VStack>

            <VStack gap="3" align="start">
              <H4>Non-Working Holidays (1.3x Pay)</H4>
              <VStack gap="2" className="w-full">
                {holidays
                  .filter((h) => h.holiday_type === "non-working")
                  .map((holiday) => (
                    <HStack
                      key={holiday.id}
                      justify="between"
                      align="center"
                      className="p-2 bg-yellow-50 rounded w-full"
                    >
                      <BodySmall>{holiday.holiday_name}</BodySmall>
                      <Caption>
                        {formatDateDisplay(holiday.holiday_date)}
                      </Caption>
                    </HStack>
                  ))}
              </VStack>
            </VStack>
          </div>
        </CardSection>
      </VStack>

      {/* Add User Modal */}
      <Dialog
        open={showUserModal}
        onOpenChange={(open) => {
          setShowUserModal(open);
          if (!open) {
            // Clear form and errors when closing
            setNewUser({
              email: "",
              full_name: "",
              password: "",
              role: "head_of_hr",
              ot_groups: [],
            });
            setSelectedOTGroups([]);
            setEditingUser(null);
            setEmailError("");
            setPasswordError("");
            setPendingCopyFromUserId(null);
          } else if (editingUser) {
            // Pre-populate form when editing
            setNewUser({
              email: editingUser.email,
              full_name: editingUser.full_name,
              password: "", // Don't pre-fill password
              role: editingUser.role,
              ot_groups: editingUser.assigned_ot_groups?.map(g => g.id) || [],
            });
            setSelectedOTGroups(editingUser.assigned_ot_groups?.map(g => g.id) || []);
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit member & teams" : "Add team member"}
            </DialogTitle>
            {!editingUser && (
              <Caption className="text-muted-foreground leading-relaxed">
                Choose a role, preview typical access, and optionally copy from someone who is leaving.
              </Caption>
            )}
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Validate OT groups for Approver/Viewer roles
              if ((newUser.role === "approver" || newUser.role === "viewer") && selectedOTGroups.length === 0) {
                toast.error("Please select at least one group for Approver/Viewer roles");
                return;
              }

              // If editing, update user without password
              if (editingUser) {
                setCreatingUser(true);
                try {
                  // Update user role if changed
                  const { error: updateError } = await (supabase.from("users") as any)
                    .update({ role: newUser.role })
                    .eq("id", editingUser.id);

                  if (updateError) throw updateError;

                  // Update OT groups if Approver/Viewer
                  if ((newUser.role === "approver" || newUser.role === "viewer") && selectedOTGroups.length > 0) {
                    await assignUserToOTGroups(editingUser.id, newUser.role, selectedOTGroups);
                  }

                  toast.success("User updated successfully!");
                  setShowUserModal(false);
                  setEditingUser(null);
                  setSelectedOTGroups([]);
                  await loadData();
                  return;
                } catch (error: any) {
                  console.error("Error updating user:", error);
                  toast.error(error.message || "Failed to update user");
                  return;
                } finally {
                  setCreatingUser(false);
                }
              }

              const formData = {
                email: newUser.email,
                full_name: newUser.full_name,
                password: newUser.password,
                role: newUser.role,
                ot_groups: selectedOTGroups,
              };

              console.log("=== FORM SUBMIT TRIGGERED ===", {
                formData,
                creatingUser,
                passwordLength: formData.password?.length,
                passwordValue: formData.password ? "***" : "empty",
              });

              if (creatingUser) {
                console.warn("Form submission blocked - already creating user");
                toast.error("Please wait, user creation in progress...");
                return;
              }

              // Call handleCreateUser
              console.log("Calling handleCreateUser...");
              handleCreateUser().catch((error) => {
                console.error("Error in form submit handler:", error);
                toast.error(error.message || "Failed to create user");
              });
            }}
            onKeyDown={(e) => {
              // Allow Enter key to submit
              if (e.key === "Enter" && !creatingUser) {
                console.log("Enter key pressed in form");
              }
            }}
          >
            <VStack gap="4" className="mt-4">
              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => {
                    setNewUser({ ...newUser, email: e.target.value });
                    if (e.target.value) {
                      validateEmail(e.target.value);
                    } else {
                      setEmailError("");
                    }
                  }}
                  onBlur={(e) => validateEmail(e.target.value)}
                  disabled={creatingUser}
                  className={emailError ? "border-destructive" : ""}
                />
                {emailError && (
                  <Caption className="text-destructive">{emailError}</Caption>
                )}
              </VStack>

              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="John Doe"
                  value={newUser.full_name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, full_name: e.target.value })
                  }
                  disabled={creatingUser}
                />
              </VStack>

              {!editingUser && (
                <VStack gap="2" align="start" className="w-full">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={newUser.password}
                    onChange={(e) => {
                      setNewUser({ ...newUser, password: e.target.value });
                      if (e.target.value) {
                        validatePassword(e.target.value);
                      } else {
                        setPasswordError("");
                      }
                    }}
                    onBlur={(e) => validatePassword(e.target.value)}
                    disabled={creatingUser}
                    className={passwordError ? "border-destructive" : ""}
                  />
                  {passwordError ? (
                    <Caption className="text-destructive">
                      {passwordError}
                    </Caption>
                  ) : (
                    <Caption className="text-muted-foreground">
                      Password must be at least 8 characters long
                    </Caption>
                  )}
                </VStack>
              )}

              <VStack gap="2" align="start" className="w-full">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: UserRole) =>
                    setNewUser({ ...newUser, role: value })
                  }
                  disabled={creatingUser}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="head_of_hr">Head of HR</SelectItem>
                    <SelectItem value="hr_admin">HR &amp; Admin</SelectItem>
                    <SelectItem value="hr_compben">HR Compben</SelectItem>
                    <SelectItem value="approver">Approver</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {getRoleProfile(newUser.role) && (
                  <Caption className="text-muted-foreground leading-snug">
                    {getRoleProfile(newUser.role)?.bestFor}
                  </Caption>
                )}
              </VStack>

              {!editingUser && (
                <AccessPreviewCard role={newUser.role} variant="compact" />
              )}

              {users.length > 0 && (
                <CopyAccessFromPanel
                  sourceCandidates={users}
                  targetUserId={editingUser?.id}
                  targetLabel={editingUser?.full_name ?? (newUser.full_name || "new member")}
                  onSourceIdChange={editingUser ? undefined : setPendingCopyFromUserId}
                  onCopied={editingUser ? () => loadData() : undefined}
                  compact
                  className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-3"
                />
              )}

              {/* Group assignment (only for Approver/Viewer roles) */}
              {(newUser.role === "approver" || newUser.role === "viewer") && (
                <VStack gap="3" align="start" className="w-full rounded-lg border bg-muted/20 p-3">
                  <div>
                    <Label htmlFor="ot_groups" className="text-foreground">
                      Groups *
                    </Label>
                    <BodySmall className="text-muted-foreground mt-1 block leading-snug">
                      This person will only see requests for employees in the groups you tick (leave—first step, failure
                      to log, overtime). <strong className="text-foreground">Head of HR</strong> always completes final leave
                      approval. You can also set the lead per group on{" "}
                      <Link href="/overtime-groups" className="text-primary underline-offset-4 hover:underline">
                        Groups &amp; approvers
                      </Link>
                      .
                    </BodySmall>
                  </div>
                  <div
                    id="ot_groups"
                    className="flex flex-col gap-1 w-full max-h-52 overflow-y-auto rounded-md border bg-background p-2"
                  >
                    {overtimeGroups.length === 0 ? (
                      <Caption className="text-muted-foreground p-2">No groups found. Create groups first.</Caption>
                    ) : (
                      overtimeGroups.map((group) => (
                        <label
                          key={group.id}
                          htmlFor={`ot-g-${group.id}`}
                          className="flex items-start gap-3 cursor-pointer rounded-md px-2 py-2 hover:bg-accent/80"
                        >
                          <Checkbox
                            id={`ot-g-${group.id}`}
                            checked={selectedOTGroups.includes(group.id)}
                            onCheckedChange={(checked) => {
                              if (checked === true) {
                                setSelectedOTGroups([...selectedOTGroups, group.id]);
                              } else {
                                setSelectedOTGroups(selectedOTGroups.filter((id) => id !== group.id));
                              }
                            }}
                            disabled={creatingUser}
                            className="mt-0.5"
                          />
                          <span className="flex flex-col gap-0.5">
                            <BodySmall className="text-sm font-medium leading-tight">{group.name}</BodySmall>
                            {group.description ? (
                              <Caption className="text-xs text-muted-foreground">{group.description}</Caption>
                            ) : null}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedOTGroups.length === 0 && (
                    <Caption className="text-destructive">
                      Choose at least one group for approvers and viewers.
                    </Caption>
                  )}
                </VStack>
              )}
            </VStack>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowUserModal(false);
                  setNewUser({
                    email: "",
                    full_name: "",
                    password: "",
                    role: "head_of_hr",
                    ot_groups: [],
                  });
                  setSelectedOTGroups([]);
                  setEditingUser(null);
                  setPendingCopyFromUserId(null);
                }}
                disabled={creatingUser}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creatingUser || (!editingUser && !newUser.password)}
                className={creatingUser ? "opacity-50 cursor-not-allowed" : ""}
                onClick={(e) => {
                  // Also handle click directly as fallback
                  console.log("Button clicked directly", {
                    newUser,
                    creatingUser,
                    passwordLength: newUser.password?.length,
                    editingUser: !!editingUser,
                  });
                  // Let form handle submission, but log for debugging
                }}
              >
                {creatingUser ? (
                  <>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className="animate-spin mr-2"
                    />
                    {editingUser ? "Updating..." : "Creating..."}
                  </>
                ) : editingUser ? (
                  "Save changes"
                ) : (
                  "Add member"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate member confirmation */}
      <AlertDialog
        open={!!userToDeactivate}
        onOpenChange={(open) => !open && setUserToDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{userToDeactivate?.full_name}</strong> won’t be able to sign in until you turn their access
              back on.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingStatus}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                userToDeactivate &&
                handleUpdateUserStatus(userToDeactivate.id, false)
              }
              disabled={updatingStatus}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updatingStatus ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="animate-spin mr-2"
                  />
                  Deactivating...
                </>
              ) : (
                "Deactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate member confirmation */}
      <AlertDialog
        open={!!userToActivate}
        onOpenChange={(open) => !open && setUserToActivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn access back on?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{userToActivate?.full_name}</strong> will be able to sign in again with their existing account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingStatus}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                userToActivate &&
                handleUpdateUserStatus(userToActivate.id, true)
              }
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="animate-spin mr-2"
                  />
                  Activating...
                </>
              ) : (
                "Activate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member permanently */}
      <AlertDialog
        open={!!userToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This can’t be undone. <strong>{userToDelete?.full_name}</strong>’s login and related data will be removed
              from the app.
              <br />
              <br />
              Type <strong className="text-destructive">delete</strong> to
              confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              placeholder="Type 'delete' to confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={deletingUser}
              className={
                deleteConfirmText &&
                deleteConfirmText.toLowerCase() !== "delete"
                  ? "border-destructive"
                  : ""
              }
            />
            {deleteConfirmText &&
              deleteConfirmText.toLowerCase() !== "delete" && (
                <Caption className="text-destructive mt-1">
                  Please type "delete" exactly to confirm
                </Caption>
              )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={
                deletingUser || deleteConfirmText.toLowerCase() !== "delete"
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUser ? (
                <>
                  <Icon
                    name="ArrowsClockwise"
                    size={IconSizes.sm}
                    className="animate-spin mr-2"
                  />
                  Deleting...
                </>
              ) : (
                "Remove member"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OT Assignment Details Modal */}
      <Dialog open={showOTDetailsModal} onOpenChange={setShowOTDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Group assignments for {editingUser?.full_name}
            </DialogTitle>
          </DialogHeader>

          <VStack gap="6" className="mt-4">
            {/* Group-based assignments */}
            {editingUser?.assigned_ot_groups && editingUser.assigned_ot_groups.length > 0 && (
              <div>
                <H4 className="mb-3 flex items-center gap-2">
                  <Icon name="UsersThree" size={IconSizes.md} className="text-green-600" />
                  Group-Based Assignments ({editingUser.assigned_ot_groups.length})
                </H4>
                <div className="space-y-2">
                  {editingUser.assigned_ot_groups.map((group) => (
                    <Card key={group.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              group.approver_id === editingUser.id
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }
                          >
                            {group.approver_id === editingUser.id ? "Approver" : "Viewer"}
                          </Badge>
                          <BodySmall className="font-medium">{group.name}</BodySmall>
                        </div>
                        <Caption className="text-muted-foreground">
                          {group.approver_id === editingUser.id
                            ? "Can approve (first step: OT, FTL, leave—Head of HR finalizes leave)"
                            : "Can view requests for this group"}
                        </Caption>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Employee-specific assignments */}
            {editingUser?.employee_specific_assignments && editingUser.employee_specific_assignments.length > 0 && (
              <div>
                <H4 className="mb-3 flex items-center gap-2">
                  <Icon name="User" size={IconSizes.md} className="text-purple-600" />
                  Employee-Specific Assignments ({editingUser.employee_specific_assignments.length})
                </H4>
                <div className="space-y-2">
                  {editingUser.employee_specific_assignments.map((emp) => (
                    <Card key={emp.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              emp.overtime_approver_id === editingUser.id
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-orange-50 text-orange-700 border-orange-200"
                            }
                          >
                            {emp.overtime_approver_id === editingUser.id ? "Approver" : "Viewer"}
                          </Badge>
                          <div>
                            <BodySmall className="font-medium">{emp.full_name}</BodySmall>
                            <Caption className="text-muted-foreground">ID: {emp.employee_id}</Caption>
                          </div>
                        </div>
                        <Caption className="text-muted-foreground">
                          {emp.overtime_approver_id === editingUser.id
                            ? "Can approve (first step: OT, FTL, leave—Head of HR finalizes leave)"
                            : "Can view requests for this employee"}
                        </Caption>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No assignments */}
            {(!editingUser?.assigned_ot_groups || editingUser.assigned_ot_groups.length === 0) &&
             (!editingUser?.employee_specific_assignments || editingUser.employee_specific_assignments.length === 0) && (
              <div className="text-center py-8">
                <Icon name="User" size={IconSizes.lg} className="mx-auto mb-2 opacity-50 text-muted-foreground" />
                <BodySmall className="text-muted-foreground">No group assignments</BodySmall>
              </div>
            )}
          </VStack>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOTDetailsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}