import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export const SUPPORT_APP = "hris" as const;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StaffSession = {
  app: typeof SUPPORT_APP;
  email: string;
  name: string;
  userId: string;
};

export type SupportAttachment = { id: string; fileName: string; contentType: string };
export type SupportMessage = {
  id: string;
  authorKind: "reporter" | "staff";
  authorName: string;
  body: string;
  createdAt: string;
  attachments: SupportAttachment[];
};
export type SupportTicket = {
  id: string;
  number: string;
  subject: string;
  status: string;
  updatedAt: string;
  pageUrl: string;
  description: string;
  messages: SupportMessage[];
};
export type SupportSummary = {
  id: string;
  number: string;
  subject: string;
  status: string;
  updatedAt: string;
};

export function isSupportId(value: string) {
  return ID.test(value);
}

export function bindReporterForm(incoming: FormData, reporter: StaffSession) {
  const out = new FormData();
  out.set("app", reporter.app);
  out.set("email", reporter.email);
  out.set("name", reporter.name);
  out.set("userId", reporter.userId);
  out.set("pageUrl", String(incoming.get("pageUrl") ?? ""));
  out.set("subject", String(incoming.get("subject") ?? ""));
  out.set("description", String(incoming.get("description") ?? ""));
  out.set("body", String(incoming.get("body") ?? ""));
  out.set("kind", String(incoming.get("kind") ?? ""));
  out.set("has201", String(incoming.get("has201") ?? ""));
  out.set("clientName", String(incoming.get("clientName") ?? ""));
  for (const file of incoming.getAll("screenshots")) {
    if (file instanceof File && file.size > 0) out.append("screenshots", file);
  }
  return out;
}

export async function readStaff(): Promise<StaffSession | null> {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from("users").select("full_name").eq("id", user.id).maybeSingle();
  const fullName = data && "full_name" in data ? String(data.full_name ?? "") : "";
  return {
    app: SUPPORT_APP,
    email: user.email,
    name: fullName.trim() || user.email,
    userId: user.id,
  };
}

export function supportSiteUrl(host: string) {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (hostname.endsWith(".greenpasture.ph")) return "https://support.greenpasture.ph";
  if (hostname.endsWith(".greenpasture.com") || hostname === "greenpasture.com") {
    return "https://support.greenpasture.com";
  }
  return process.env.IT_SUPPORT_URL || "http://localhost:3010";
}

export async function forwardSupport(path: string, init?: RequestInit) {
  const base = process.env.IT_SUPPORT_URL;
  const secret = process.env.SUPPORT_INGEST_SECRET;
  if (!base || !secret) {
    return Response.json({ error: "IT support is not configured" }, { status: 503 });
  }
  const response = await fetch(new URL(path, base), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${secret}`,
    },
    cache: "no-store",
  });
  const bytes = await response.arrayBuffer();
  return new Response(bytes, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, no-store",
    },
  });
}

function reporterQuery(staff: StaffSession) {
  return new URLSearchParams({ app: staff.app, email: staff.email });
}

export async function listMyTickets(staff: StaffSession) {
  const response = await forwardSupport(`/api/ingest/tickets?${reporterQuery(staff)}`);
  const body = (await response.json().catch(() => ({}))) as { tickets?: SupportSummary[]; error?: string };
  if (!response.ok) return { error: body.error ?? "Could not load tickets", tickets: [] as SupportSummary[] };
  return { error: "", tickets: body.tickets ?? [] };
}

export async function getMyTicket(staff: StaffSession, id: string) {
  const response = await forwardSupport(`/api/ingest/tickets/${id}?${reporterQuery(staff)}`);
  const body = (await response.json().catch(() => ({}))) as { ticket?: SupportTicket; error?: string };
  if (!response.ok || !body.ticket) return { error: body.error ?? "Ticket not found", ticket: null };
  return { error: "", ticket: body.ticket };
}
