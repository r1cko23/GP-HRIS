import { NextRequest, NextResponse } from "next/server";
import { requireEmployeePortalSession } from "@/lib/employee-portal/server-session";

export const dynamic = "force-dynamic";

async function resolveDirectoryPerson(
  session: Extract<
    Awaited<ReturnType<typeof requireEmployeePortalSession>>,
    { ok: true }
  >
) {
  const { data: enrollment, error } = await session.admin
    .from("employees")
    .select("directory_employee_id")
    .eq("id", session.employeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!enrollment?.directory_employee_id) return null;
  const directory = session.admin.schema("directory");
  const { data: person, error: personError } = await directory
    .from("employees")
    .select("id,organization_id")
    .eq("id", enrollment.directory_employee_id)
    .maybeSingle();
  if (personError) throw new Error(personError.message);
  return person;
}

export async function GET() {
  const session = await requireEmployeePortalSession();
  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status }
    );
  }
  try {
    const person = await resolveDirectoryPerson(session);
    if (!person) {
      return NextResponse.json({ data: { tasks: [], credentials: [] } });
    }
    const directory = session.admin.schema("directory");
    const [{ data: tasks, error: taskError }, { data: credentials, error: credentialError }] =
      await Promise.all([
        directory
          .from("employee_onboarding_tasks")
          .select(
            "id,title,description,is_required,status,due_at,evidence_status,completed_at,completion_notes"
          )
          .eq("organization_id", person.organization_id)
          .eq("employee_id", person.id)
          .eq("owner_type", "worker")
          .order("due_at", { ascending: true, nullsFirst: false }),
        directory
          .from("employee_credentials")
          .select(
            "id,status,issued_on,expires_on,definition:credential_definitions(code,name,description)"
          )
          .eq("organization_id", person.organization_id)
          .eq("employee_id", person.id)
          .order("expires_on", { ascending: true, nullsFirst: false }),
      ]);
    if (taskError || credentialError) {
      throw new Error(taskError?.message ?? credentialError?.message);
    }
    return NextResponse.json({
      data: { tasks: tasks ?? [], credentials: credentials ?? [] },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load onboarding" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await requireEmployeePortalSession();
  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status }
    );
  }
  const body = (await request.json().catch(() => null)) as {
    task_id?: string;
    status?: "in_progress" | "completed";
  } | null;
  const taskId = body?.task_id?.trim();
  if (!taskId || !["in_progress", "completed"].includes(body?.status ?? "")) {
    return NextResponse.json({ error: "Invalid task update" }, { status: 400 });
  }
  try {
    const person = await resolveDirectoryPerson(session);
    if (!person) {
      return NextResponse.json({ error: "Directory person not linked" }, { status: 409 });
    }
    const now = new Date().toISOString();
    const { data, error } = await session.admin
      .schema("directory")
      .from("employee_onboarding_tasks")
      .update({
        status: body!.status,
        completed_at: body!.status === "completed" ? now : null,
        completion_notes:
          body!.status === "completed" ? "Completed by worker portal" : null,
        updated_at: now,
      })
      .eq("id", taskId)
      .eq("organization_id", person.organization_id)
      .eq("employee_id", person.id)
      .eq("owner_type", "worker")
      .in("status", ["pending", "in_progress"])
      .select("id,status,completed_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        { error: "Task not found or no longer editable" },
        { status: 409 }
      );
    }
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update task" },
      { status: 500 }
    );
  }
}
