import { eq } from "drizzle-orm";
import { db, branches, weeklyReports } from "@/db";
import { requireBranchUser } from "@/lib/session";
import { recentPeriods } from "@/lib/reports";
import { PageHeader } from "@/components/ui";
import UploadClient from "./UploadClient";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const user = await requireBranchUser();

  const [branch, periods, existing] = await Promise.all([
    db.query.branches.findFirst({ where: eq(branches.id, user.branchId) }),
    recentPeriods(8),
    db
      .select({ reportPeriodId: weeklyReports.reportPeriodId, status: weeklyReports.status })
      .from(weeklyReports)
      .where(eq(weeklyReports.branchId, user.branchId)),
  ]);

  const submitted = new Set(existing.filter((e) => e.status === "SUBMITTED").map((e) => e.reportPeriodId));

  return (
    <>
      <PageHeader
        title="Upload weekly report"
        subtitle="Download the template, fill it, then upload it here. Nothing is saved until you confirm the preview."
      />
      <UploadClient
        branch={{ id: branch!.id, code: branch!.code, name: branch!.name }}
        periods={periods.map((p) => ({
          id: p.id,
          year: p.year,
          week: p.week,
          status: p.status,
          alreadySubmitted: submitted.has(p.id),
        }))}
      />
    </>
  );
}
