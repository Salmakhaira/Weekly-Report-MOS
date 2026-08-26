import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, branches, changeLogs } from "@/db";
import { requireUser } from "@/lib/session";
import { recentPeriods } from "@/lib/reports";
import { fmtDateTime, periodLabel } from "@/lib/format";
import { PageHeader, Card, Empty } from "@/components/ui";
import ChangeTable from "./ChangeTable";

export const dynamic = "force-dynamic";

type Search = Promise<{ branch?: string; period?: string }>;

export default async function ChangeMonitoring({ searchParams }: { searchParams: Search }) {
  const user = await requireUser();
  const sp = await searchParams;

  // A branch user only ever sees their own branch's history.
  const branchFilter = user.role === "BRANCH" ? user.branchId! : sp.branch || undefined;

  const conditions = [
    branchFilter ? eq(changeLogs.branchId, branchFilter) : undefined,
    sp.period ? eq(changeLogs.reportPeriodId, sp.period) : undefined,
  ].filter(Boolean);

  const [branchList, periods, logs] = await Promise.all([
    db.query.branches.findMany({ orderBy: [asc(branches.name)] }),
    recentPeriods(12),
    db.query.changeLogs.findMany({
      where: conditions.length ? and(...(conditions as never[])) : undefined,
      with: { branch: true, period: true, changer: { columns: { name: true } } },
      orderBy: [desc(changeLogs.changedAt)],
      limit: 200,
    }),
  ]);

  const rows = logs.map((l) => ({
    id: l.id,
    changedAt: fmtDateTime(l.changedAt),
    branch: `${l.branch.code} — ${l.branch.name}`,
    period: periodLabel(l.period),
    salesman: l.salesman,
    field: l.fieldChanged.replace(/_/g, " "),
    oldValue: l.oldValue,
    newValue: l.newValue,
    changedBy: l.changer.name,
    reason: l.reason,
    source: l.source,
    reportUrl: l.weeklyReportId ? `/reports/${l.weeklyReportId}` : null,
  }));

  return (
    <>
      <PageHeader
        title="Change monitoring"
        subtitle="Every value changed after a report was submitted, with the reason given at the time."
      />

      <Card className="mb-6">
        <form className="grid gap-4 p-4 sm:grid-cols-3">
          {user.role !== "BRANCH" && (
            <div>
              <label className="label" htmlFor="branch">Branch</label>
              <select id="branch" name="branch" defaultValue={sp.branch ?? ""} className="field">
                <option value="">All branches</option>
                {branchList.map((b) => (
                  <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="period">Reporting period</label>
            <select id="period" name="period" defaultValue={sp.period ?? ""} className="field">
              <option value="">All periods</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>Week {p.week} / {p.year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary" type="submit">Apply filters</button>
            <Link href="/ho/changes" className="btn-ghost">Reset</Link>
          </div>
        </form>
      </Card>

      <Card title={`Changes (${rows.length})`}>
        {rows.length === 0 ? (
          <Empty
            title="No changes recorded"
            body="A change is logged when a branch re-submits a period that was already submitted, or when an admin adjusts a stored value."
          />
        ) : (
          <ChangeTable rows={rows} />
        )}
      </Card>
    </>
  );
}
