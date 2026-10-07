"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DIRECTORY_TENANT_EVENT,
  readDirectoryClient,
  type DirectoryClientMemory,
} from "@/lib/directory/browser";
import { canOpenClientRosterShell } from "@/lib/access/people-pages";
import { usePermissions } from "@/lib/hooks/usePermissions";

export function DirectoryTenantChip() {
  const pathname = usePathname();
  const { capabilityKeys: rawCapabilityKeys, loading } = usePermissions();
  const [client, setClient] = useState<DirectoryClientMemory | null>(null);

  useEffect(() => {
    const sync = () => setClient(readDirectoryClient());
    sync();
    window.addEventListener(DIRECTORY_TENANT_EVENT, sync);
    return () => window.removeEventListener(DIRECTORY_TENANT_EVENT, sync);
  }, []);

  if (loading || !client) return null;

  // Already inside this client's employee management / 201 — chip is noise.
  if (pathname.startsWith(`/people/c/${client.id}`)) return null;

  // Encode packs must not jump into Clients roster CMS via the topbar chip.
  if (!canOpenClientRosterShell(rawCapabilityKeys ?? [])) return null;

  return (
    <Link
      href={`/people/c/${client.id}?status=active`}
      className="app-topbar-chip hidden sm:inline-flex"
      title={`Open employee management for ${client.name}`}
    >
      {client.name}
    </Link>
  );
}
