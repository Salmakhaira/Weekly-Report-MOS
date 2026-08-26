import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, branches, reportPeriods, weeklyReports, importBatches } from "@/db";
import { requireUser } from "@/lib/session";
import { parseWorkbook } from "@/lib/excel/parse";
import { ROSTER } from "@/lib/roster";

export const maxDuration = 60;

/**
 * Step 1 of the import: read the file, validate it, and park the result in an
 * ImportBatch with status PENDING. Nothing touches weekly_reports yet — the user
 * must confirm on the preview screen first.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  const form = await req.formData();

  const file = form.get("file");
  const branchId = String(form.get("branchId") ?? "");
  const periodId = String(form.get("periodId") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an .xlsx file to upload." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "Only .xlsx files are accepted. Save the file as Excel Workbook and try again." },
      { status: 400 }
    );
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "The file is larger than 15 MB." }, { status: 400 });
  }
  if (user.role === "BRANCH" && branchId !== user.branchId) {
    return NextResponse.json({ error: "You can only upload for your own branch." }, { status: 403 });
  }

  const [branch, period] = await Promise.all([
    db.query.branches.findFirst({ where: eq(branches.id, branchId) }),
    db.query.reportPeriods.findFirst({ where: eq(reportPeriods.id, periodId) }),
  ]);
  if (!branch || !period) {
    return NextResponse.json({ error: "Branch or reporting period not found." }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await parseWorkbook(buffer, {
    branchCode: branch.code,
    year: period.year,
    week: period.week,
    roster: ROSTER[branch.code] ?? [],
  });

  const existing = await db.query.weeklyReports.findFirst({
    where: and(eq(weeklyReports.branchId, branchId), eq(weeklyReports.reportPeriodId, periodId)),
  });

  const [batch] = await db
    .insert(importBatches)
    .values({
      uploadedBy: user.id,
      branchId,
      reportPeriodId: periodId,
      fileName: file.name,
      status: result.canCommit ? "PENDING" : "FAILED",
      totalRows: result.totalRows,
      validRows: result.validRows,
      errorRows: result.errorRows,
      payload: JSON.stringify({ rows: result.rows, actionRows: result.actionRows }),
    })
    .returning();

  return NextResponse.json({
    batchId: batch.id,
    branch: { code: branch.code, name: branch.name },
    period: { year: period.year, week: period.week, status: period.status },
    fileName: file.name,
    // A resubmission over an already-submitted week is what triggers the
    // "Reason for change" requirement on the preview screen.
    isResubmission: existing?.status === "SUBMITTED",
    ...result,
  });
}
