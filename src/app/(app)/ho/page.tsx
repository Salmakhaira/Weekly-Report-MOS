import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, branches, weeklyReports } from "@/db";
import { requireHO } from "@/lib/session";
import { currentPeriod, recentPeriods, rollUp, emptyTotals, addTotals } from "@/lib/reports";
import { achievement } from "@/lib/metrics";
import { fmtRupiah, fmtPct, fmtDateTime, periodLabel } from "@/lib/format";
import { PageHeader, Card, Stat, Badge, TableShell } from "@/components/ui";

export const dynamic = "force-dynamic";

type Search = Promise<{ period?: string; branch?: string; status?: string }>;

export default async function HODashboard({ searchParams }: { searchParams: Search }) {
  await requireHO();
  const sp = await searchParams;

  const periods = await recentPeriods(12);
  const fallback = await currentPeriod();
  const period = periods.find((p) => p.id === sp.period) ?? fallback ?? periods[0];

  const branchList = await db.query.branches.findMany({ orderBy: [asc(branches.name)] });

  const reports = period
    ? await db.query.weeklyReports.findMany({
        where: eq(weeklyReports.reportPeriodId, period.id),
        with: { details: true },
      })
    : [];
  const reportByBranch = new Map(reports.map((r) => [r.branchId, r]));

  // Previous week, for the growth figure.
  const prev = period ? periods.find((p) => p.year === period.year && p.week === period.week - 1) : undefined;
  const prevReports = prev
    ? await db.query.weeklyReports.findMany({
        where: eq(weeklyReports.reportPeriodId, prev.id),
        with: { details: true },
      })
    : [];
  const prevSales = rollUp(prevReports.flatMap((r) => r.details.filter((d) => d.metricType === "NUMBER"))).ACTUAL_SALES;

  let rows = branchList.map((b) => {
    const r = reportByBranch.get(b.id);
    const totals = r ? rollUp(r.details.filter((d) => d.metricType === "NUMBER")) : emptyTotals();
    return {
      branch: b,
      report: r ?? null,
      status: r?.status ?? "NOT SUBMITTED",
      totals,
      ach: r ? achievement(totals.ACTUAL_SALES, totals.PLAN_SALES) : null,
    };
  });

  if (sp.branch) rows = rows.filter((r) => r.branch.id === sp.branch);
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);

  const national = rows.reduce((acc, r) => addTotals(acc, r.totals), emptyTotals());
  const submittedCount = rows.filter((r) => r.status === "SUBMITTED").length;
  const nationalAch = achievement(national.ACTUAL_SALES, national.PLAN_SALES);
  const growth = prevSales ? national.ACTUAL_SALES / prevSales - 1 : null;

  return (
    <>
      <PageHeader
        title="National dashboard"
        subtitle={
          period
            ? `${periodLabel(period)} · ${reports.length} of ${branchList.length} branches submitted`
            : "No reporting periods yet"
        }
      />

      <Card className="mb-6">
        <form className="grid gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="period">Reporting period</label>
            <select id="period" name="period" defaultValue={period?.id} className="field">
              {periods.map((p) => (
                <option key={p.id} value={p.id}>Week {p.week} / {p.year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="branch">Branch</label>
            <select id="branch" name="branch" defaultValue={sp.branch ?? ""} className="field">
              <option value="">All branches</option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={sp.status ?? ""} className="field">
              <option value="">Any status</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="NOT SUBMITTED">Not submitted</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary" type="submit">Apply filters</button>
            <Link href="/ho" className="btn-ghost">Reset</Link>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Branches" value={rows.length} />
        <Stat label="Submitted" value={submittedCount} tone={submittedCount === rows.length ? "good" : "warn"} />
        <Stat
          label="Not submitted"
          value={rows.length - submittedCount}
          tone={rows.length - submittedCount ? "bad" : "default"}
        />
        <Stat label="Total sales" value={fmtRupiah(national.ACTUAL_SALES)} />
        <Stat
          label="Achievement"
          value={fmtPct(nationalAch)}
          tone={nationalAch === null ? "default" : nationalAch >= 1 ? "good" : nationalAch >= 0.9 ? "warn" : "bad"}
        />
        <Stat
          label="Growth vs prev week"
          value={growth === null ? "—" : `${growth >= 0 ? "+" : ""}${fmtPct(growth, 1)}`}
          hint={prev ? periodLabel(prev) : "No previous week"}
          tone={growth === null ? "default" : growth >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="mt-6">
        <Card title="Branch submissions">
          <TableShell>
            <thead className="bg-surface">
              <tr>
                <th className="th">Branch</th>
                <th className="th">Region</th>
                <th className="th">Status</th>
                <th className="th text-right">Sales</th>
                <th className="th text-right">Plan</th>
                <th className="th text-right">Achievement</th>
                <th className="th text-right">Back order</th>
                <th className="th">Last updated</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.branch.id} className="hover:bg-surface">
                  <td className="td font-medium text-ink">
                    <span className="num mr-2 text-ink-mute">{r.branch.code}</span>
                    {r.branch.name}
                  </td>
                  <td className="td">{r.branch.region}</td>
                  <td className="td"><Badge>{r.status}</Badge></td>
                  <td className="td num text-right">{r.report ? fmtRupiah(r.totals.ACTUAL_SALES) : "—"}</td>
                  <td className="td num text-right">{r.report ? fmtRupiah(r.totals.PLAN_SALES) : "—"}</td>
                  <td
                    className={`td num text-right ${
                      r.ach === null ? "" : r.ach >= 1 ? "text-emerald-700" : r.ach < 0.9 ? "text-red-700" : "text-amber-700"
                    }`}
                  >
                    {fmtPct(r.ach)}
                  </td>
                  <td className="td num text-right">{r.report ? fmtRupiah(r.totals.BACK_ORDER) : "—"}</td>
                  <td className="td">{r.report ? fmtDateTime(r.report.updatedAt) : "—"}</td>
                  <td className="td text-right">
                    {r.report && (
                      <Link href={`/reports/${r.report.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="td py-8 text-center text-ink-mute" colSpan={9}>No branches match these filters.</td>
                </tr>
              )}
            </tbody>
          </TableShell>
        </Card>
      </div>
    </>
  );
}
