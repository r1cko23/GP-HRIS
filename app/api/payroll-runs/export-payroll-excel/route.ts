import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import XLSX from "xlsx-js-style";
import { buildGpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const headerStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 10 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  fill: { fgColor: { rgb: "FFEFEFEF" } },
  border: {
    top: { style: "thin", color: { rgb: "FFBDBDBD" } },
    left: { style: "thin", color: { rgb: "FFBDBDBD" } },
    bottom: { style: "thin", color: { rgb: "FFBDBDBD" } },
    right: { style: "thin", color: { rgb: "FFBDBDBD" } },
  },
};

const moneyStyle: XLSX.CellStyle = {
  numFmt: "#,##0.00",
  alignment: { horizontal: "right", vertical: "center" },
};

const titleStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 14 },
  alignment: { horizontal: "center", vertical: "center" },
};

const subtitleStyle: XLSX.CellStyle = {
  font: { bold: true, sz: 11 },
  alignment: { horizontal: "center", vertical: "center" },
};

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const payroll_run_id = body?.payroll_run_id as string | undefined;
    if (!payroll_run_id) {
      return NextResponse.json(
        { error: "payroll_run_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("id, cutoff_start, cutoff_end, status")
      .eq("id", payroll_run_id)
      .single();

    if (runErr) throw runErr;
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }
    if (String(run.status) !== "finalized") {
      return NextResponse.json(
        { error: "Finalize the payroll run before exporting payroll Excel." },
        { status: 400 }
      );
    }

    const { data: slips, error: slipsErr } = await admin
      .from("payslips")
      .select(
        "gross_pay, total_deductions, net_pay, adjustment_amount, sss_amount, philhealth_amount, pagibig_amount, deductions_breakdown, employees:employee_id ( employee_id, full_name, position )"
      )
      .eq("payroll_run_id", payroll_run_id)
      .order("created_at", { ascending: true });

    if (slipsErr) throw slipsErr;

    const cutoffStart = String(run.cutoff_start);
    const cutoffEnd = String(run.cutoff_end);

    const table = buildGpPayrollRegisterTable({
      cutoffStart,
      cutoffEnd,
      slips: (slips || []) as Parameters<
        typeof buildGpPayrollRegisterTable
      >[0]["slips"],
    });

    const aoa: (string | number)[][] = [
      [table.title],
      [table.subtitle],
      [],
      table.headers,
      ...table.rows,
      table.totalsRow,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = table.columnWidths.map((wch) => ({ wch }));
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: table.headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: table.headers.length - 1 } },
    ];

    function setStyle(addr: string, style: XLSX.CellStyle) {
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      ws[addr].s = { ...(ws[addr].s || {}), ...style };
    }

    setStyle("A1", titleStyle);
    setStyle("A2", subtitleStyle);

    const headerRowIndex = 3;
    for (let c = 0; c < table.headers.length; c++) {
      setStyle(XLSX.utils.encode_cell({ r: headerRowIndex, c }), headerStyle);
    }

    const dataStart = headerRowIndex + 1;
    const dataEnd = aoa.length - 1;
    for (let r = dataStart; r <= dataEnd; r++) {
      for (let c = 0; c < table.headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell || typeof cell.v !== "number") continue;
        if (c >= 4) setStyle(addr, moneyStyle);
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const fileName = `payroll_${cutoffStart}_to_${cutoffEnd}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("export-payroll-excel error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to export payroll excel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
