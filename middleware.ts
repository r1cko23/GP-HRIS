import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { isHRFamilyRole } from "@/lib/roles";
import { postLoginPath } from "@/lib/hubs";

const ROLE_COOKIE = "gp_role_cache";
const ROLE_COOKIE_MAX_AGE_SEC = 60; // short TTL — refresh often enough for ACL changes

type RoleCache = {
  role: string;
  can_access_salary: boolean | null;
};

function readRoleCache(req: NextRequest): RoleCache | null {
  const raw = req.cookies.get(ROLE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as RoleCache;
    if (parsed && typeof parsed.role === "string") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeRoleCache(res: NextResponse, cache: RoleCache) {
  res.cookies.set({
    name: ROLE_COOKIE,
    value: encodeURIComponent(JSON.stringify(cache)),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ROLE_COOKIE_MAX_AGE_SEC,
  });
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const staticFileExtensions = [
    ".ico",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".svg",
    ".gif",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
  ];
  const isStaticFile = staticFileExtensions.some((ext) => pathname.endsWith(ext));

  if (
    isStaticFile ||
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const protectedPaths = [
    "/people",
    "/benefits",
    "/payroll",
    "/time",
    "/reports",
    "/settings",
    "/payroll-office",
    "/overtime-groups",
    "/directory",
    "/employees",
    "/dashboard",
    "/timesheet",
    "/payslips",
    "/deductions",
    "/loans",
    "/allowances",
    "/schedules",
    "/overtime-approval",
    "/leave-approval",
    "/time-entries",
    "/failure-to-log-approval",
    "/device-activity",
    "/audit",
    "/bir-reports",
    "/payroll-audit",
    "/incentive-audit",
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  const adminOnlyPaths = [
    "/reports/audit",
    "/reports/devices",
    "/reports/bir",
    "/reports/payroll-audit",
    "/reports/incentive-audit",
    "/audit",
    "/device-activity",
    "/bir-reports",
    "/payroll-audit",
    "/incentive-audit",
  ];
  const isAdminPath = adminOnlyPaths.some((path) => pathname.startsWith(path));

  const isLoginPath = pathname === "/login";
  const isResetPasswordPath = pathname === "/reset-password";

  if (!isProtectedPath && !isLoginPath && !isResetPasswordPath) {
    return NextResponse.next();
  }

  if (isResetPasswordPath) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  let user = null;
  try {
    // Prefer getUser once — validates JWT without a separate getSession round-trip.
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    // Missing/expired session is normal for logged-out visitors — not a hard failure.
    const missingSession =
      !error
        ? false
        : /session missing|AuthSessionMissing|not authenticated|invalid jwt|JWT expired/i.test(
            String(error.message ?? error)
          );
    if (error && !missingSession) throw error;
    user = authUser ?? null;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error ?? "");
    console.error("Middleware auth check error:", message);

    if (isProtectedPath) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirectedFrom", pathname);
      redirectUrl.searchParams.set("error", "session_check_failed");
      return NextResponse.redirect(redirectUrl);
    }

    return res;
  }

  if (isProtectedPath && !user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  let resolvedRole: string | null = null;

  if (user) {
    try {
      let userRecord = readRoleCache(req);

      if (!userRecord) {
        const { data: userData } = await supabase
          .from("users")
          .select("role, can_access_salary")
          .eq("id", user.id)
          .eq("is_active", true)
          .single();

        if (userData) {
          userRecord = {
            role: String(userData.role),
            can_access_salary:
              (userData.can_access_salary as boolean | null) ?? null,
          };
          writeRoleCache(res, userRecord);
        }
      }

      if (userRecord) {
        resolvedRole = userRecord.role;
        if (isAdminPath && userRecord.role !== "admin") {
          const redirectUrl = req.nextUrl.clone();
          redirectUrl.pathname = "/reports";
          return NextResponse.redirect(redirectUrl);
        }

        if (userRecord.role === "approver" || userRecord.role === "viewer") {
          const allowedPaths = ["/time"];
          const isAllowedPath = allowedPaths.some((path) =>
            pathname.startsWith(path)
          );

          if (!isAllowedPath) {
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = "/time";
            return NextResponse.redirect(redirectUrl);
          }
        }

        if (
          isHRFamilyRole(userRecord.role) &&
          !userRecord.can_access_salary &&
          (pathname.startsWith("/payroll/payslips") ||
            pathname.startsWith("/payslips"))
        ) {
          const redirectUrl = req.nextUrl.clone();
          redirectUrl.pathname = "/people";
          return NextResponse.redirect(redirectUrl);
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error ?? "");
      console.error("Middleware role lookup error:", message);
    }
  }

  if (isLoginPath && user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = postLoginPath(resolvedRole);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
