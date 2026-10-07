import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  EMPLOYEE_SESSION_COOKIE,
  employeePortalAdmin,
  requireEmployeePortalSession,
} from "@/lib/employee-portal/server-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    employee_id?: string;
    password?: string;
  } | null;
  const employeeCode = body?.employee_id?.trim();
  const password = body?.password ?? "";
  if (!employeeCode || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const admin = employeePortalAdmin();
  const { data, error } = await admin.rpc("authenticate_employee", {
    p_employee_id: employeeCode,
    p_password: password,
  });
  const authentication = Array.isArray(data) ? data[0] : data;
  const employee = authentication?.employee_data;
  if (error || !authentication?.success || !employee?.id) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { data: issued, error: issueError } = await admin.rpc(
    "issue_employee_portal_session",
    {
      p_employee_id: employee.id,
      p_ttl_minutes: 480,
      p_ip_address:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      p_user_agent: request.headers.get("user-agent"),
    }
  );
  const session = Array.isArray(issued) ? issued[0] : issued;
  if (issueError || !session?.session_token) {
    return NextResponse.json(
      { error: "Could not start employee session" },
      { status: 500 }
    );
  }

  const response = NextResponse.json({
    employee: {
      id: employee.id,
      employee_id: employee.employee_id,
      full_name: employee.full_name,
    },
    expires_at: session.expires_at,
  });
  response.cookies.set(EMPLOYEE_SESSION_COOKIE, session.session_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expires_at),
  });
  return response;
}

export async function DELETE() {
  const session = await requireEmployeePortalSession();
  const response = NextResponse.json({ ok: true });
  if (session.ok) {
    const token = cookiesValue();
    if (token) {
      await session.admin
        .from("employee_portal_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("session_token", token);
    }
  }
  response.cookies.set(EMPLOYEE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function cookiesValue() {
  return cookies().get(EMPLOYEE_SESSION_COOKIE)?.value;
}
