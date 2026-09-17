/**
 * GP-HRIS → GP-Client: pull a Validated timesheet into a Deployed cutoff.
 * Creating a cutoff does not ingest.
 */

export class GpClientConfigError extends Error {
  constructor() {
    super(
      "GP-Client API is not configured. Set GP_CLIENT_API_BASE_URL and DIRECTORY_SERVICE_API_KEY."
    );
  }
}

/** Production GP-Client host when env is unset (DEPLOYED_WORKER_WORKFLOW). */
export const DEFAULT_PRODUCTION_GP_CLIENT_API_BASE =
  "https://payroll.greenpasture.ph";

export function resolveGpClientApiBase(env: {
  GP_CLIENT_API_BASE_URL?: string;
  NODE_ENV?: string;
} = process.env): string {
  const configured = env.GP_CLIENT_API_BASE_URL?.replace(/\/$/, "").trim();
  if (configured) return configured;
  if (env.NODE_ENV === "production") {
    return DEFAULT_PRODUCTION_GP_CLIENT_API_BASE;
  }
  return "http://localhost:3001";
}

export type GpClientIngestBody = {
  directory_cutoff_period_id: string;
  directory_client_id: string;
  directory_branch_id: string | null;
  period_start: string;
  period_end: string;
};

export function gpClientIngestBody(period: {
  id: string;
  client_id: string;
  branch_id: string | null;
  period_start: string;
  period_end: string;
}): GpClientIngestBody {
  return {
    directory_cutoff_period_id: period.id,
    directory_client_id: period.client_id,
    directory_branch_id: period.branch_id,
    period_start: String(period.period_start).slice(0, 10),
    period_end: String(period.period_end).slice(0, 10),
  };
}

function gpClientConfig() {
  const base = resolveGpClientApiBase();
  const key = process.env.DIRECTORY_SERVICE_API_KEY?.trim();
  if (!base || !key) throw new GpClientConfigError();
  return { base, key };
}

export type GpClientIngestResult = {
  cutoff_period_id: string;
  hours_upserted: number;
  skipped: Array<{ full_name: string; missing: string[] }>;
};

export async function requestGpClientCutoffIngest(
  period: {
    id: string;
    client_id: string;
    branch_id: string | null;
    period_start: string;
    period_end: string;
  }
): Promise<GpClientIngestResult> {
  const { base, key } = gpClientConfig();
  let res: Response;
  try {
    res = await fetch(`${base}/api/hris/ingest-cutoff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-directory-api-key": key,
      },
      body: JSON.stringify(gpClientIngestBody(period)),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      `Cannot reach GP-Client at ${base}. Start GP-Client with npm run dev -p 3001.`
    );
  }
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: GpClientIngestResult;
  };
  if (!res.ok) {
    throw new Error(json.error || `GP-Client ingest failed (${res.status})`);
  }
  if (!json.data) {
    throw new Error("GP-Client ingest returned no data");
  }
  return json.data;
}
