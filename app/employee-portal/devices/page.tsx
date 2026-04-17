"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BodySmall } from "@/components/ui/typography";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { format } from "date-fns";
import Link from "next/link";
import { normalizeDeviceLabelForDisplay } from "@/utils/device-info";

interface DeviceRow {
  device_label: string | null;
  first_seen_at: string;
  last_seen_at: string;
  ip_address: string | null;
}

export default function EmployeeDevicesPage() {
  const { employee } = useEmployeeSession();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employee?.id) return;

    let cancelled = false;
    async function fetchDevices() {
      try {
        const res = await fetch(
          `/api/employee/my-devices?employee_id=${encodeURIComponent(employee.id)}`
        );
        if (!res.ok) {
          setDevices([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setDevices(data.devices ?? []);
      } catch {
        if (!cancelled) setDevices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDevices();
    return () => {
      cancelled = true;
    };
  }, [employee?.id]);

  return (
    <VStack className="mx-auto max-w-4xl gap-6">
      <PortalPageHeader
        title="My devices"
        description="Devices used to access your account. If you don’t recognize one, change your password and contact HR."
      />

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Icon
                name="ArrowsClockwise"
                size={IconSizes.lg}
                className="animate-spin text-muted-foreground"
              />
            </div>
          ) : devices.length === 0 ? (
            <BodySmall className="text-muted-foreground">
              No devices recorded yet. Devices are added when you log in.
            </BodySmall>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="hidden sm:table-cell">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {d.device_label ? normalizeDeviceLabelForDisplay(d.device_label) : "—"}
                    </TableCell>
                    <TableCell>
                      {d.first_seen_at
                        ? format(new Date(d.first_seen_at), "MMM d, yyyy HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {d.last_seen_at
                        ? format(new Date(d.last_seen_at), "MMM d, yyyy HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {d.ip_address ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 pt-4 border-t">
            <BodySmall className="text-muted-foreground">
              To change your password, go to{" "}
              <Link
                href="/employee-portal/info"
                className="text-primary underline hover:no-underline"
              >
                My Information
              </Link>
              .
            </BodySmall>
          </div>
        </CardContent>
      </Card>
    </VStack>
  );
}
