import { directoryJson } from "@/lib/directory/browser";

function foldTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve free-text job title to a Directory position id for this Client.
 * Creates the position card when missing.
 */
export async function resolveClientPositionId(args: {
  organizationId: string;
  clientId: string;
  jobTitle: string;
  existing?: Array<{ id: string; label: string }>;
}): Promise<string | null> {
  const title = args.jobTitle.trim();
  if (!title) return null;

  const hit = (args.existing ?? []).find(
    (row) => foldTitle(row.label) === foldTitle(title)
  );
  if (hit) return hit.id;

  const json = await directoryJson<{ data: { id: string } }>(
    "/api/directory/positions",
    args.organizationId,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: args.clientId,
        job_title: title,
      }),
    }
  );
  return json.data.id;
}
