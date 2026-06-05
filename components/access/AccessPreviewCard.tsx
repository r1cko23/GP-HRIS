"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Caption } from "@/components/ui/typography";
import {
  buildUserAccessPreview,
  getRoleProfile,
  type FriendlyAccessRow,
} from "@/lib/access-matrix";
import { getDefaultPermissionsForRole, mergePermissions, type UserPermissions } from "@/lib/hooks/usePermissions";
import { AccessLevelBadge } from "./AccessLevelBadge";

interface AccessPreviewCardProps {
  role: string;
  /** Raw users.permissions JSON (merged with role defaults) */
  customPermissions?: Partial<UserPermissions> | null;
  /** Full effective matrix (e.g. while editing ACL) */
  effectivePermissions?: UserPermissions;
  canAccessSalary?: boolean;
  /** compact = fewer rows, only non-none */
  variant?: "full" | "compact";
  title?: string;
}

function resolveEffectivePermissions(
  role: string,
  customPermissions?: Partial<UserPermissions> | null
): UserPermissions {
  if (!customPermissions) {
    return getDefaultPermissionsForRole(role);
  }
  return mergePermissions(role, customPermissions);
}

function AccessRowList({ rows, compact }: { rows: FriendlyAccessRow[]; compact?: boolean }) {
  const visible = compact ? rows.filter((r) => r.level !== "none") : rows;
  if (visible.length === 0) {
    return (
      <Caption className="text-muted-foreground">No app areas enabled for this setup.</Caption>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border/80">
      {visible.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{row.area}</p>
            <Caption className="text-muted-foreground">{row.description}</Caption>
            {row.note ? (
              <Caption className="mt-0.5 block text-amber-800 dark:text-amber-200">{row.note}</Caption>
            ) : null}
          </div>
          <AccessLevelBadge level={row.level} className="self-start sm:self-center" />
        </li>
      ))}
    </ul>
  );
}

/** Friendly summary for a role template or a specific person. */
export function AccessPreviewCard({
  role,
  customPermissions,
  effectivePermissions,
  canAccessSalary = false,
  variant = "compact",
  title,
}: AccessPreviewCardProps) {
  const profile = getRoleProfile(role);
  const useTemplate =
    !customPermissions && !effectivePermissions && variant === "compact" && profile;

  const rows = useTemplate
    ? profile.rows
    : buildUserAccessPreview(
        role,
        effectivePermissions ??
          resolveEffectivePermissions(role, customPermissions),
        canAccessSalary
      );

  return (
    <Card className="border-border/80 bg-muted/10 shadow-none">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold">
          {title ?? (useTemplate ? `${profile.title} — typical access` : "Access preview")}
        </CardTitle>
        {useTemplate && profile.summary ? (
          <CardDescription className="text-xs leading-relaxed">{profile.summary}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <AccessRowList rows={rows} compact={variant === "compact"} />
      </CardContent>
    </Card>
  );
}
