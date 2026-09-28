/**
 * Approve Nabati GP-Client adjustment + build draft register.
 *   npx tsx scripts/nabati-sep-approve-and-run.ts
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(".env.local");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const id = "c2513f46-e84f-4816-b872-89dc6ec1c7d3";
  const { data, error } = await db
    .from("cutoff_periods")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,status,period_kind")
    .single();
  if (error) throw error;
  console.log("approved", data);

  const org = "36ef619f-54d7-4d2f-ae9b-9e2c8889c0af";
  const key = process.env.DIRECTORY_SERVICE_API_KEY!;
  const base = (process.env.DIRECTORY_API_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const res = await fetch(
    `${base}/api/timekeeping/cutoff-periods/${id}/payroll-run`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-directory-api-key": key,
        "x-organization-id": org,
      },
      body: JSON.stringify({
        notes: "Nabati Sep GP-Client hours vs MAIN debit memo",
      }),
    }
  );
  const json = (await res.json()) as {
    error?: string;
    data?: {
      run?: { id: string };
      line_count?: number;
      totals?: Record<string, number>;
      blocked_statutory?: Array<{
        last_name: string;
        first_name: string;
        missing?: string[];
        cutoffs_without_ids?: number;
      }>;
      status_warnings?: Array<{
        last_name: string;
        first_name: string;
        status: string;
      }>;
      reminder_memo?: string | null;
    };
  };
  if (!res.ok) {
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        run_id: json.data?.run?.id,
        line_count: json.data?.line_count,
        totals: json.data?.totals,
        blocked_count: json.data?.blocked_statutory?.length ?? 0,
        blocked: (json.data?.blocked_statutory || []).map(
          (b) =>
            `${b.last_name}, ${b.first_name} (${(b.missing || []).join("/")}${
              b.cutoffs_without_ids
                ? `, ${b.cutoffs_without_ids} cutoffs`
                : ""
            })`
        ),
        status_warnings: (json.data?.status_warnings || []).map(
          (b) => `${b.last_name}, ${b.first_name} (${b.status})`
        ),
        reminder_memo_preview: (json.data?.reminder_memo || "").slice(0, 400),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
