import { NextRequest } from "next/server";
import { jsonError } from "@/lib/directory/auth";

export const dynamic = "force-dynamic";

const GONE =
  "Peso catch-up is removed. After Post, use an hours-based Adjustment run (ADR 0017).";

/** @deprecated Superseded by Adjustment cutoffs (ADR 0017). */
export async function GET(_request: NextRequest) {
  return jsonError(GONE, 410);
}

/** @deprecated Superseded by Adjustment cutoffs (ADR 0017). */
export async function POST(_request: NextRequest) {
  return jsonError(GONE, 410);
}
