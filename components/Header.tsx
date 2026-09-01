"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { formatRoleLabel } from "@/lib/format-role-label";
import { DirectoryTenantChip } from "@/components/directory/DirectoryTenantChip";
import { headerTitleForPath } from "@/lib/hubs";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userFullName, setUserFullName] = useState<string>("");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    null
  );

  useEffect(() => {
    let userSubscription: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function getUser() {
      try {
        // Use optimized hook that uses /api/auth/me endpoint
        const { useCurrentUser } = await import("@/lib/hooks/useCurrentUser");
        // Note: We can't use hooks conditionally, so we'll fetch directly
        const response = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok || !isMounted) return;

        const data = await response.json();
        const userData = data.user;

        if (userData && isMounted) {
          // Set auth user for compatibility
          setUser({
            id: userData.id,
            email: userData.email,
          } as User);

          setUserRole(userData.role);
          setUserFullName(userData.full_name || "");
          setProfilePictureUrl(userData.profile_picture_url);

          // Set up real-time subscription for user profile changes
          // Only subscribe once when we have a user
          if (!userSubscription && userData.id) {
            userSubscription = supabase
              .channel(`user-profile-${userData.id}`)
              .on(
                "postgres_changes",
                {
                  event: "UPDATE",
                  schema: "public",
                  table: "users",
                  filter: `id=eq.${userData.id}`,
                },
                (payload) => {
                  if (!isMounted) return;
                  const newData = payload.new as {
                    profile_picture_url?: string | null;
                    full_name?: string;
                    role?: string;
                  };
                  if (newData.profile_picture_url !== undefined) {
                    setProfilePictureUrl(newData.profile_picture_url);
                  }
                  if (newData.full_name !== undefined) {
                    setUserFullName(newData.full_name || "");
                  }
                  if (newData.role !== undefined) {
                    setUserRole(newData.role);
                  }
                }
              )
              .subscribe();
          }
        }
      } catch (error) {
        console.error("Error fetching user in Header:", error);
      }
    }

    // Initial fetch
    getUser();

    // Listen for auth state changes to refresh user data
    // Only refresh on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED events
    // This prevents excessive calls on every auth state change
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Only refresh on meaningful auth events
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          void import("@/lib/hooks/useCurrentUser").then(({ clearCurrentUserCache }) => {
            clearCurrentUserCache();
          });
        }
        getUser();
      }
    });

    return () => {
      isMounted = false;
      authSubscription.unsubscribe();
      if (userSubscription) {
        userSubscription.unsubscribe();
      }
    };
  }, [supabase]);

  const handleLogout = async () => {
    // Clear session cache on logout
    const { clearSessionCache } = await import("@/lib/session-utils");
    clearSessionCache();

    // Clear current user cache
    const { clearCurrentUserCache } = await import("@/lib/hooks/useCurrentUser");
    clearCurrentUserCache();

    // Clear page-switch session + Redis epoch
    const { bustCache } = await import("@/lib/cache-client");
    await bustCache();

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const getInitials = () => {
    if (userFullName) {
      const parts = userFullName.trim().split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return userFullName.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const mobileTitle = headerTitleForPath(pathname);

  return (
    <header className="app-shell-header sticky top-0 z-30 flex shrink-0 items-center border-b border-border/80 bg-background px-3 shadow-sm sm:px-6">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onMenuClick ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={onMenuClick}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : null}
          <p className="truncate text-sm font-semibold tracking-tight text-foreground lg:hidden">
            {mobileTitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <DirectoryTenantChip />
          {userRole ? (
            <Badge
              variant="secondary"
              className="hidden max-w-[10rem] truncate border border-primary/25 bg-primary/10 text-xs font-medium text-primary md:inline-flex"
              title={userRole}
            >
              {formatRoleLabel(userRole)}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="hidden text-xs font-normal text-muted-foreground md:inline-flex"
            >
              Loading role…
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex max-w-[min(100%,18rem)] items-center gap-2 sm:gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={profilePictureUrl || undefined}
                    alt={userFullName || user?.email || "User"}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex flex-col items-start text-left">
                  <span className="truncate text-sm font-medium text-foreground">
                    {userFullName || user?.email}
                  </span>
                  <Badge
                    variant="outline"
                    className="mt-0.5 h-5 max-w-full truncate border-primary/30 px-1.5 text-[10px] font-medium text-primary md:hidden"
                  >
                    {userRole ? formatRoleLabel(userRole) : "…"}
                  </Badge>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <Icon name="SignOut" size={IconSizes.sm} className="mr-2" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}