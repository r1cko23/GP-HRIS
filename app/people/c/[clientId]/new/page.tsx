"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { peopleEmployeeHirePath } from "@/lib/hubs";

/** Legacy client-scoped hire URL → hub wizard with client prefilled. */
export default function NewDirectoryEmployeeRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";

  useEffect(() => {
    router.replace(peopleEmployeeHirePath(clientId || null));
  }, [clientId, router]);

  return (
    <p className="p-6 text-sm text-muted-foreground">Opening Add employee…</p>
  );
}
