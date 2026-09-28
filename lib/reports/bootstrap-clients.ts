/**
 * Shared org + client bootstrap for Reports remittance pages.
 * Remittance reports default to Deployed (site clients). Organic cash-advance
 * can prefer Organic. Always allow an org switcher to override.
 */

import {
  directoryJson,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
  writeDirectoryOrgId,
  type OrgRow,
} from "@/lib/directory/browser";
import { sortClientsAlphabetically } from "@/lib/reports/default-client";

export type ReportClientOption = { id: string; name: string };

export type ReportOrgBootstrap = {
  orgs: OrgRow[];
  orgId: string;
  orgName: string;
  clients: ReportClientOption[];
};

export async function bootstrapReportClients(opts?: {
  /** When set, wins over session storage so remittance ≠ house-only. */
  preferOrg?: "deployed" | "organic";
}): Promise<ReportOrgBootstrap> {
  const orgs = await loadDirectoryOrganizations();
  const org = pickDirectoryOrg(
    orgs,
    readDirectoryOrgId(),
    opts?.preferOrg ?? null
  );
  if (!org) throw new Error("No organization");
  writeDirectoryOrgId(org.id);

  const clientsJson = await directoryJson<{
    data: Array<{ id: string; name: string }>;
  }>(
    `/api/directory/clients?${new URLSearchParams({
      status: "active",
      limit: "200",
      offset: "0",
    })}`,
    org.id
  );

  const clients = sortClientsAlphabetically(
    (clientsJson.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
    }))
  );

  return {
    orgs,
    orgId: org.id,
    orgName: org.name,
    clients,
  };
}

/** Drop a client_id that is not in the loaded org’s list (e.g. after org switch). */
export function resolveReportClientId(
  clients: ReportClientOption[],
  clientFromUrl: string,
  pickFirst: (rows: ReportClientOption[]) => ReportClientOption | null
): { clientId: string; shouldReplaceUrl: boolean } {
  if (clientFromUrl && clients.some((c) => c.id === clientFromUrl)) {
    return { clientId: clientFromUrl, shouldReplaceUrl: false };
  }
  const first = pickFirst(clients);
  return {
    clientId: first?.id ?? "",
    shouldReplaceUrl: true,
  };
}
