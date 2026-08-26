import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, branches, reportPeriods } from "@/db";
import { requireUser } from "@/lib/session";
import { buildTemplate, templateFileName } from "@/lib/excel/template";
import { ROSTER } from "@/lib/roster";

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") ?? user.branchId;
  const periodId = url.searchParams.get("periodId");

  if (!branchId || !periodId) {
    return NextResponse.json({ error: "branchId and periodId are required." }, { status: 400 });
  }
  if (user.role === "BRANCH" && branchId !== user.branchId) {
    return NextResponse.json({ error: "You can only download a template for your own branch." }, { status: 403 });
  }

  const [branch, period] = await Promise.all([
    db.query.branches.findFirst({ where: eq(branches.id, branchId) }),
    db.query.reportPeriods.findFirst({ where: eq(reportPeriods.id, periodId) }),
  ]);
  if (!branch || !period) {
    return NextResponse.json({ error: "Branch or reporting period not found." }, { status: 404 });
  }

  const buffer = await buildTemplate({
    branchCode: branch.code,
    branchName: branch.name,
    year: period.year,
    week: period.week,
    salesmen: ROSTER[branch.code] ?? [],
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${templateFileName(branch.code, period.year, period.week)}"`,
      "Cache-Control": "no-store",
    },
  });
}
