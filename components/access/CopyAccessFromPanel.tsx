"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Caption, BodySmall } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { describeCopyPayload } from "@/lib/access-matrix";
import { copyUserAccess } from "@/lib/copy-user-access";
import { formatRoleLabel } from "@/lib/format-role-label";
import { AccessPreviewCard } from "./AccessPreviewCard";
import type { UserPermissions } from "@/lib/hooks/usePermissions";

export interface CopyAccessUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  can_access_salary?: boolean | null;
  permissions?: Partial<UserPermissions> | null;
  assigned_ot_groups?: { id: string; name: string }[];
}

interface CopyAccessFromPanelProps {
  /** People available as copy source (usually active non-admin). */
  sourceCandidates: CopyAccessUser[];
  /** Who receives the copy (must exist). Omit when previewing before create. */
  targetUserId?: string;
  targetLabel?: string;
  /** Called after successful copy */
  onCopied?: () => void;
  /** Fires when user picks or clears a source (for copy-after-create). */
  onSourceIdChange?: (sourceUserId: string | null) => void;
  /** Compact layout for modals */
  compact?: boolean;
  className?: string;
}

const NONE = "__none__";

export function CopyAccessFromPanel({
  sourceCandidates,
  targetUserId,
  targetLabel,
  onCopied,
  onSourceIdChange,
  compact = false,
  className,
}: CopyAccessFromPanelProps) {
  const [sourceId, setSourceId] = useState<string>(NONE);

  const pickSource = (id: string) => {
    setSourceId(id);
    onSourceIdChange?.(id === NONE ? null : id);
  };
  const [copyPermissions, setCopyPermissions] = useState(true);
  const [copySalary, setCopySalary] = useState(true);
  const [copyGroups, setCopyGroups] = useState(true);
  const [applying, setApplying] = useState(false);

  const supabase = createClient();

  const sources = useMemo(
    () =>
      sourceCandidates.filter(
        (u) => u.is_active && u.role !== "admin" && u.id !== targetUserId
      ),
    [sourceCandidates, targetUserId]
  );

  const source = sources.find((u) => u.id === sourceId);

  const payloadLines = source ? describeCopyPayload(source) : [];

  const handleApply = async () => {
    if (!targetUserId) {
      toast.error("Save the new team member first, then copy access.");
      return;
    }
    if (!source) {
      toast.error("Choose a colleague to copy from.");
      return;
    }

    setApplying(true);
    try {
      const result = await copyUserAccess(supabase, source.id, targetUserId, {
        copyPermissions,
        copySalaryAccess: copySalary,
        copyOtGroups: copyGroups,
      });
      toast.success("Access copied", {
        description: [
          result.copiedPermissions && "App access",
          result.copiedSalaryAccess && "Pay info",
          result.copiedOtGroups > 0 && `${result.copiedOtGroups} team(s)`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      onCopied?.();
      pickSource(NONE);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not copy access";
      toast.error(message);
    } finally {
      setApplying(false);
    }
  };

  if (sources.length === 0) {
    return (
      <Caption className={className}>
        No other team members available to copy from yet.
      </Caption>
    );
  }

  return (
    <div
      className={
        className ??
        "rounded-lg border border-border bg-muted/15 p-4 space-y-4"
      }
    >
      <div>
        <BodySmall className="font-semibold text-foreground flex items-center gap-2">
          <Icon name="Copy" size={IconSizes.sm} className="text-primary" />
          Copy access from colleague
        </BodySmall>
        <Caption className="mt-1 block text-muted-foreground leading-relaxed">
          {targetLabel
            ? `Match what ${targetLabel} should inherit from someone leaving or changing roles.`
            : "Use when replacing HR, approvers, or anyone with custom access."}
        </Caption>
      </div>

      <div className="space-y-2">
        <Label htmlFor="copy-source-user">Copy from</Label>
        <Select value={sourceId} onValueChange={pickSource}>
          <SelectTrigger id="copy-source-user">
            <SelectValue placeholder="Select colleague…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— Select —</SelectItem>
            {sources.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name} ({formatRoleLabel(u.role)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {source && (
        <>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {payloadLines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {!compact && (
            <AccessPreviewCard
              role={source.role}
              customPermissions={source.permissions as Partial<UserPermissions> | null}
              canAccessSalary={Boolean(source.can_access_salary)}
              title={`Preview: ${source.full_name}`}
            />
          )}

          <div className="space-y-2">
            <Label className="text-muted-foreground">Include</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={copyPermissions}
                  onCheckedChange={(c) => setCopyPermissions(c === true)}
                />
                App access (menus & actions)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={copySalary}
                  onCheckedChange={(c) => setCopySalary(c === true)}
                />
                Pay info (payslips & loans)
              </label>
              {(source.role === "approver" || source.role === "viewer") && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={copyGroups}
                    onCheckedChange={(c) => setCopyGroups(c === true)}
                  />
                  Team / group assignments
                </label>
              )}
            </div>
          </div>

          {targetUserId ? (
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={applying}
              className="w-full sm:w-auto"
            >
              {applying ? (
                <>
                  <Icon name="ArrowsClockwise" size={IconSizes.sm} className="animate-spin mr-2" />
                  Copying…
                </>
              ) : (
                <>
                  <Icon name="Copy" size={IconSizes.sm} className="mr-2" />
                  Apply to {targetLabel ?? "this person"}
                </>
              )}
            </Button>
          ) : (
            <Caption className="text-amber-800 dark:text-amber-200">
              Create the account first — we&apos;ll copy access right after they are added.
            </Caption>
          )}
        </>
      )}
    </div>
  );
}

export { NONE as COPY_SOURCE_NONE };
