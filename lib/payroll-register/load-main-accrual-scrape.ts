/**
 * Load the latest payroll-audit MAIN scrape for a cutoff site, plus posted
 * GP basics after that scrape and before this cutoff. Catalog overlay only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scrapedAccrualsFromParsedEmployees,
  selectLatestMainScrape,
  type ScrapedAccrual,
} from "./main-accrual-overlay";

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function basicFromEarnings(earnings: unknown): number {
  const row = (earnings ?? {}) as Record<string, unknown>;
  return n(row.basic ?? row.basic_pay ?? row.regular_pay);
}

export type MainAccrualScrapePack = {
  mainScrape: { periodEnd: string; employees: ScrapedAccrual[] } | null;
  laterPostedBasics: Array<{ name: string; basicPay: number }>;
};

export async function loadMainAccrualScrapeForCutoff(
  publicDb: SupabaseClient,
  directory: SupabaseClient,
  params: {
    clientId?: string | null;
    branchId?: string | null;
    periodEnd: string;
  }
): Promise<MainAccrualScrapePack> {
  const empty: MainAccrualScrapePack = {
    mainScrape: null,
    laterPostedBasics: [],
  };
  const clientId = params.clientId?.trim();
  if (!clientId) return empty;

  const { data: client } = await directory
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();
  const clientName = String(client?.name ?? "").trim();
  if (!clientName) return empty;

  const year = Number(params.periodEnd.slice(0, 4)) || new Date().getFullYear();
  const fromOpenings = await loadOpeningsAsScrape(publicDb, {
    clientId,
    year,
    onOrBefore: params.periodEnd.slice(0, 10),
  });
  if (fromOpenings) {
    const laterPostedBasics = await loadLaterPostedBasics(publicDb, {
      clientId,
      branchId: params.branchId ?? null,
      scrapePeriodEnd: fromOpenings.periodEnd,
      registerPeriodEnd: params.periodEnd.slice(0, 10),
    });
    return { mainScrape: fromOpenings, laterPostedBasics };
  }

  let branchName: string | null = null;
  if (params.branchId) {
    const { data: branch } = await directory
      .from("client_branches")
      .select("name")
      .eq("id", params.branchId)
      .maybeSingle();
    branchName = String(branch?.name ?? "").trim() || null;
  }

  const { data: uploadMeta, error: uploadError } = await publicDb
    .from("payroll_summary_uploads")
    .select("id, company_name, period_end")
    .eq("status", "ready")
    .lte("period_end", params.periodEnd)
    .order("period_end", { ascending: false })
    .order("uploaded_at", { ascending: false })
    .limit(200);
  if (uploadError) throw new Error(uploadError.message);

  const picked = selectLatestMainScrape(
    (uploadMeta ?? []).map((row) => ({
      companyName: String(row.company_name ?? ""),
      periodEnd: String(row.period_end ?? "").slice(0, 10),
      employees: [],
    })),
    {
      clientName,
      branchName,
      onOrBefore: params.periodEnd.slice(0, 10),
    }
  );
  if (!picked) return empty;

  const metaRow = (uploadMeta ?? []).find(
    (row) =>
      String(row.company_name ?? "") === picked.companyName &&
      String(row.period_end ?? "").slice(0, 10) === picked.periodEnd
  );
  if (!metaRow) return empty;

  const { data: full, error: fullError } = await publicDb
    .from("payroll_summary_uploads")
    .select("period_end, parsed_json")
    .eq("id", metaRow.id)
    .maybeSingle();
  if (fullError) throw new Error(fullError.message);
  if (!full) return empty;

  const parsed = (full.parsed_json ?? {}) as {
    employees?: Array<Record<string, unknown>>;
  };
  const mainScrape = {
    periodEnd: String(full.period_end ?? picked.periodEnd).slice(0, 10),
    employees: scrapedAccrualsFromParsedEmployees(parsed.employees ?? []),
  };

  const laterPostedBasics = await loadLaterPostedBasics(publicDb, {
    clientId,
    branchId: params.branchId ?? null,
    scrapePeriodEnd: mainScrape.periodEnd,
    registerPeriodEnd: params.periodEnd.slice(0, 10),
  });

  return { mainScrape, laterPostedBasics };
}

async function loadOpeningsAsScrape(
  publicDb: SupabaseClient,
  params: { clientId: string; year: number; onOrBefore: string }
): Promise<{ periodEnd: string; employees: ScrapedAccrual[] } | null> {
  const employees: ScrapedAccrual[] = [];
  let maxEnd = "";
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await publicDb
      .from("payroll_main_accrual_openings")
      .select(
        "last_name, first_name, thirteenth_month, thirteenth_month_ytd, sil_cutoff, as_of_period_end"
      )
      .eq("client_id", params.clientId)
      .eq("thirteenmonthyear", params.year)
      .lte("as_of_period_end", params.onOrBefore)
      .order("last_name")
      .range(offset, offset + 199);
    if (error) {
      if (/payroll_main_accrual_openings|schema cache|does not exist/i.test(error.message)) {
        return null;
      }
      throw new Error(error.message);
    }
    if (!data?.length) break;
    for (const row of data) {
      employees.push({
        name: [row.last_name, row.first_name].filter(Boolean).join(", "),
        thirteenthMonthCutoff: n(row.thirteenth_month),
        thirteenthMonthYTD: n(row.thirteenth_month_ytd),
        silCutoff: n(row.sil_cutoff),
      });
      const end = String(row.as_of_period_end ?? "").slice(0, 10);
      if (end > maxEnd) maxEnd = end;
    }
    if (data.length < 200) break;
  }
  if (!employees.length || !maxEnd) return null;
  return { periodEnd: maxEnd, employees };
}

async function loadLaterPostedBasics(
  publicDb: SupabaseClient,
  params: {
    clientId: string;
    branchId: string | null;
    scrapePeriodEnd: string;
    registerPeriodEnd: string;
  }
): Promise<Array<{ name: string; basicPay: number }>> {
  if (!params.branchId) return [];
  if (params.scrapePeriodEnd >= params.registerPeriodEnd) return [];

  const { data: periods, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id")
    .eq("client_id", params.clientId)
    .eq("branch_id", params.branchId)
    .gt("period_end", params.scrapePeriodEnd)
    .lt("period_end", params.registerPeriodEnd);
  if (periodError) throw new Error(periodError.message);
  const periodIds = (periods ?? []).map((row) => row.id as string);
  if (!periodIds.length) return [];

  const { data: runs, error: runError } = await publicDb
    .from("payroll_register_runs")
    .select("id")
    .eq("status", "posted")
    .in("cutoff_period_id", periodIds);
  if (runError) throw new Error(runError.message);
  const runIds = (runs ?? []).map((row) => row.id as string);
  if (!runIds.length) return [];

  const { data: lines, error: lineError } = await publicDb
    .from("payroll_register_lines")
    .select("last_name, first_name, earnings")
    .in("run_id", runIds)
    .limit(500);
  if (lineError) throw new Error(lineError.message);

  return (lines ?? []).map((row) => ({
    name: [row.last_name, row.first_name].filter(Boolean).join(", "),
    basicPay: basicFromEarnings(row.earnings),
  }));
}
