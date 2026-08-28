"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import {
  DirectoryRehireDialog,
  type DirectoryRehireEmployee,
} from "@/components/directory/DirectoryRehireDialog";
import { directoryJson } from "@/lib/directory/browser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type OfficeLinkedEmployee = {
  id: string;
  full_name?: string | null;
  employee_id?: string | null;
  employee_code?: string | null;
  is_active: boolean;
  status?: string | null;
  directory_employee_id?: string | null;
  organization_id?: string | null;
};

type Props = {
  employee: OfficeLinkedEmployee;
  triggerClassName?: string;
  onRehired: () => void;
};

function isOfficeInactive(employee: OfficeLinkedEmployee): boolean {
  if (employee.is_active === false) return true;
  if (employee.status && employee.status !== "active") return true;
  return false;
}

/**
 * Rehire on the office Employees tab for Organic-linked rows (ADR 0006).
 * Keeps employee_code; updates Directory master + linked public.employees.
 */
export function OfficeOrganicRehireDialog({
  employee,
  triggerClassName,
  onRehired,
}: Props) {
  const directoryId = employee.directory_employee_id?.trim() || null;
  const organizationId = employee.organization_id?.trim() || null;
  const eligible = Boolean(directoryId && organizationId && isOfficeInactive(employee));

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [directoryEmployee, setDirectoryEmployee] =
    useState<DirectoryRehireEmployee | null>(null);

  if (!eligible || !directoryId || !organizationId) return null;

  const resolvedDirectoryId = directoryId;
  const resolvedOrganizationId = organizationId;

  async function openRehire() {
    setLoading(true);
    try {
      const json = await directoryJson<{ data: DirectoryRehireEmployee }>(
        `/api/directory/employees/${resolvedDirectoryId}`,
        resolvedOrganizationId
      );
      setDirectoryEmployee(json.data);
      setOpen(true);
    } catch (err) {
      toast.error("Could not open rehire", {
        description: err instanceof Error ? err.message : "Load failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={cn(triggerClassName)}
        disabled={loading}
        onClick={() => void openRehire()}
      >
        <Icon name="ArrowCounterClockwise" size={IconSizes.sm} className="mr-1" />
        {loading ? "Loading…" : "Rehire"}
      </Button>
      {directoryEmployee ? (
        <DirectoryRehireDialog
          organizationId={resolvedOrganizationId}
          employee={directoryEmployee}
          forceEligible
          hideTrigger
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setDirectoryEmployee(null);
          }}
          onRehired={() => {
            toast.success("Employee rehired", {
              description: `${employee.full_name ?? "Employee"} · ID kept`,
            });
            onRehired();
          }}
        />
      ) : null}
    </>
  );
}
