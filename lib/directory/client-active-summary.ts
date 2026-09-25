/**
 * Org-wide active client / active employee totals for the People clients list.
 * Active employees are summed only across clients with status = active.
 */

export type ClientActiveSummaryInput = {
  id: string;
  status: string;
};

export type ClientActiveLifeRow = {
  active_count: number | string;
};

export type ClientActiveSummary = {
  active_clients: number;
  active_employees: number;
};

export function buildClientActiveSummary(
  clients: ClientActiveSummaryInput[],
  lifeByClient: Map<string, ClientActiveLifeRow>
): ClientActiveSummary {
  let active_clients = 0;
  let active_employees = 0;

  for (const client of clients) {
    if (client.status !== "active") continue;
    active_clients += 1;
    active_employees += Number(lifeByClient.get(client.id)?.active_count ?? 0);
  }

  return { active_clients, active_employees };
}
