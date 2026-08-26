import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, weeklyReports, changeLogs } from "@/db";
import { requireUser } from "@/lib/session";
import { rollUp, groupActionPlan } from "@/lib/reports";
import { NUMERIC_METRICS, ACTION_METRICS, achievement } from "@/lib/metrics";
import { fmtJuta, fmtRupiah, fmtPct, fmtDateTime, periodLabel } from "@/lib/format";
import { PageHeader, Card, Stat, Badge, TableShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await db.query.weeklyReports.findFirst({
    where: eq(weeklyReports.id, id),
    with: {
      branch: true,
      period: true,
      submitter: { columns: { name: true } },
      details: true,
    },
  });

  if (!report) notFound();
  if (user.role === "BRANCH" && report.branchId !== user.branchId) notFound();

  const logs = await db.query.changeLogs.findMany({
    where: eq(changeLogs.weeklyReportId, report.id),
    with: { changer: { columns: { name: true } } },
    orderBy: [desc(changeLogs.changedAt)],
  });

  const numeric = report.details.filter((d) => d.metricType === "NUMBER");
  const totals = rollUp(numeric);
  const ach = achievement(totals.ACTUAL_SALES, totals.PLAN_SALES);

  const salesmen = [...new Set(numeric.map((d) => d.salesman).filter(Boolean))] as string[];
  const cell = (salesman: string, metric: string) =>
    numeric.find((d) => d.salesman === salesman && d.metricName === metric)?.metricValue ?? null;

  const action = groupActionPlan(report.details.filter((d) => d.metricType !== "NUMBER"));

  return (
    <>
      <PageHeader
        title={`Weekly report — ${periodLabel(report.period)}`}
        subtitle={
          <>
            {report.branch.code} — {report.branch.name} · submitted by {report.submitter?.name ?? "—"} on{" "}
            {fmtDateTime(report.submittedAt)}
          </>
        }
        actions={
          <>
            <Badge>{report.status}</Badge>
            <Link href={user.role === "BRANCH" ? "/branch/reports" : "/ho"} className="btn-secondary">Back</Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Actual sales" value={fmtRupiah(totals.ACTUAL_SALES)} hint={`Plan ${fmtRupiah(totals.PLAN_SALES)}`} />
        <Stat
          label="Achievement"
          value={fmtPct(ach)}
          tone={ach === null ? "default" : ach >= 1 ? "good" : ach >= 0.9 ? "warn" : "bad"}
        />
        <Stat label="PO" value={fmtRupiah(totals.PO)} hint={`POCO ${fmtRupiah(totals.POCO)}`} />
        <Stat label="Back order" value={fmtRupiah(totals.BACK_ORDER)} hint={`Outlook ${fmtRupiah(totals.OUTLOOK_REVENUE)}`} />
      </div>

      <div className="mt-6 space-y-6">
        <Card title="Figures by salesman">
          <TableShell>
            <thead className="bg-surface">
              <tr>
                <th className="th">Salesman</th>
                {NUMERIC_METRICS.map((m) => <th key={m.key} className="th text-right">{m.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {salesmen.map((s) => (
                <tr key={s} className="hover:bg-surface">
                  <td className="td font-medium text-ink">{s}</td>
                  {NUMERIC_METRICS.map((m) => (
                    <td key={m.key} className="td num text-right">{fmtJuta(cell(s, m.key), 2)}</td>
                  ))}
                </tr>
              ))}
              <tr className="bg-surface font-semibold">
                <td className="td text-ink">Branch total</td>
                {NUMERIC_METRICS.map((m) => (
                  <td key={m.key} className="td num text-right text-ink">{fmtJuta(totals[m.key], 2)}</td>
                ))}
              </tr>
            </tbody>
          </TableShell>
          <p className="border-t border-line px-4 py-2 text-xs text-ink-mute">Values in Rp juta.</p>
        </Card>

        <Card title="Action plan">
          {!action ? (
            <p className="px-5 py-8 text-center text-sm text-ink-mute">
              No action-plan item was included with this report.
            </p>
          ) : (
            <dl className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
              {ACTION_METRICS.map((m) => (
                <div key={m.key} className={m.kind === "TEXT" && m.key !== "PIC" ? "sm:col-span-2" : ""}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{m.label}</dt>
                  <dd className="mt-1 text-sm text-ink">
                    {m.key === "STATUS" && action[m.key] ? <Badge>{action[m.key]!}</Badge> : action[m.key] || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        <Card title={`Change history (${logs.length})`}>
          {logs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-mute">
              This report has not been changed since it was first submitted.
            </p>
          ) : (
            <TableShell>
              <thead className="bg-surface">
                <tr>
                  <th className="th">Changed at</th>
                  <th className="th">Salesman</th>
                  <th className="th">Field</th>
                  <th className="th text-right">Old</th>
                  <th className="th text-right">New</th>
                  <th className="th">By</th>
                  <th className="th">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((c) => (
                  <tr key={c.id}>
                    <td className="td">{fmtDateTime(c.changedAt)}</td>
                    <td className="td">{c.salesman ?? "Branch"}</td>
                    <td className="td font-medium text-ink">{c.fieldChanged.replace(/_/g, " ")}</td>
                    <td className="td num text-right">{c.oldValue ?? "—"}</td>
                    <td className="td num text-right text-ink">{c.newValue ?? "—"}</td>
                    <td className="td">{c.changer.name}</td>
                    <td className="td max-w-sm whitespace-normal">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>
      </div>
    </>
  );
}
