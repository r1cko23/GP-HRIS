"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DIRECTORY_TENANT_EVENT,
  readDirectoryClient,
  type DirectoryClientMemory,
} from "@/lib/directory/browser";

export function DirectoryTenantChip() {
  const pathname = usePathname();
  const [client, setClient] = useState<DirectoryClientMemory | null>(null);

  useEffect(() => {
    const sync = () => setClient(readDirectoryClient());
    sync();
    window.addEventListener(DIRECTORY_TENANT_EVENT, sync);
    return () => window.removeEventListener(DIRECTORY_TENANT_EVENT, sync);
  }, []);

  if (!client) return null;

  // Already inside this client's employee management / 201 — chip is noise.
  if (pathname.startsWith(`/people/c/${client.id}`)) return null;

  return (
    <Link
      href={`/people/c/${client.id}`}
      className="hidden max-w-[14rem] truncate rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15 sm:inline-flex"
      title={`Open employee management for ${client.name}`}
    >
      Employees · {client.name}
    </Link>
  );
}
