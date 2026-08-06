import { NextResponse } from "next/server";
import { invalidateAppCache, isRedisEnabled } from "@/lib/cache";
import { getAuthenticatedUser } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await invalidateAppCache();
  return NextResponse.json({
    success: true,
    redis: isRedisEnabled(),
    invalidated: ok,
  });
}
