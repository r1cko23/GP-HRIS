"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense, useEffect, useState } from "react";
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
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { formatRoleLabel } from "@/lib/format-role-label";
import { formatProfileDisplayName } from "@/lib/format-profile-display-name";
import { DirectoryTenantChip } from "@/components/directory/DirectoryTenantChip";
import { AppNav } from "@/components/AppNav";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
}

function TopbarNavFallback() {
  return <div className="hidden h-8 min-w-0 flex-1 lg:block" aria-hidden />;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
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
          setUser({
            id: userData.id,
            email: userData.email,
          } as User);

          setUserRole(userData.role);
          setUserFullName(userData.full_name || "");
          setProfilePictureUrl(userData.profile_picture_url);

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

    getUser();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event) => {
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
    const { clearSessionCache } = await import("@/lib/session-utils");
    clearSessionCache();

    const { clearCurrentUserCache } = await import("@/lib/hooks/useCurrentUser");
    clearCurrentUserCache();

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

  const displayUserName = formatProfileDisplayName(userFullName) || userFullName;
  const accountLabel = displayUserName || user?.email || "Account";

  return (
    <header
      className="app-shell-header app-sidebar sticky top-0 z-30 flex shrink-0 items-center border-b px-2 shadow-sm sm:px-3"
      data-testid="topbar"
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        {onMenuClick ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 min-h-8 min-w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-active hover:text-sidebar-foreground lg:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}

        <Link
          href="/people"
          className="topbar-logo-plate"
          aria-label="Green Pasture home"
        >
          <img
            src="/gp-logo.webp"
            alt="Green Pasture People Management Inc."
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </Link>

        <div className="hidden min-w-0 flex-1 lg:flex">
          <Suspense fallback={<TopbarNavFallback />}>
            <AppNav orientation="bar" />
          </Suspense>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <DirectoryTenantChip />
          {userRole ? (
            <span
              className="app-topbar-chip hidden md:inline-flex"
              title={userRole}
            >
              {formatRoleLabel(userRole)}
            </span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-8 min-h-8 max-w-[12rem] gap-1.5 px-1 text-sidebar-foreground",
                  "hover:bg-sidebar-active hover:text-sidebar-foreground"
                )}
                aria-label={accountLabel}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage
                    src={profilePictureUrl || undefined}
                    alt={accountLabel}
                  />
                  <AvatarFallback className="bg-sidebar-accent text-[10px] text-sidebar-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 truncate text-xs font-medium xl:inline">
                  {displayUserName || user?.email}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block truncate">{accountLabel}</span>
                {userRole ? (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {formatRoleLabel(userRole)}
                  </span>
                ) : null}
              </DropdownMenuLabel>
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
