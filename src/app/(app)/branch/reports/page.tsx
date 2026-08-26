import Link from "next/link";
import { requireBranchUser } from "@/lib/session";
import { branchReports, recentPeriods, totalsForReport, type Totals } from "@/lib/reports";
import { achievement } from "@/lib/metrics";
import { fmtRupiah, fmtPct, fmtDateTime, periodLabel } from "@/lib/format";
import { PageHeader, Card, Badge, Empty, LinkButton, TableShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MyReports() {
  const user = await requireBranchUser();
  const [periods, reports] = await Promise.all([recentPeriods(12), branchReports(user.branchId)]);

  const byPeriod = new Map(reports.map((r) => [r.reportPeriodId, r]));
  const totals = new Map<string, Totals>();
  for (const r of reports) totals.set(r.id, await totalsForReport(r.id));

  return (
    <>
      <PageHeader
        title="My reports"
        subtitle={`${user.branchCode} — ${user.branchName}`}
        actions={<LinkButton href="/branch/upload" variant="primary">Upload weekly report</LinkButton>}
      />

      <Card>
        {periods.length === 0 ? (
          <Empty title="No reporting periods" body="An admin needs to open a reporting period first." />
        ) : (
          <TableShell>
            <thead className="bg-surface">
              <tr>
                <th className="th">Period</th>
                <th className="th">Status</th>
                <th className="th text-right">Actual sales</th>
                <th className="th text-right">Achievement</th>
                <th className="th">Last updated</th>
                <th className="th">Submitted by</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {periods.map((p) => {
                const r = byPeriod.get(p.id);
                const t = r ? totals.get(r.id) : null;
                const ach = t ? achievement(t.ACTUAL_SALES, t.PLAN_SALES) : null;
                return (
                  <tr key={p.id} className="hover:bg-surface">
                    <td className="td font-medium text-ink">
                      {periodLabel(p)}
                      {p.status === "OPEN" && <span className="ml-2 text-xs font-normal text-brand-600">open</span>}
                    </td>
                    <td className="td"><Badge>{r?.status ?? "NOT SUBMITTED"}</Badge></td>
                    <td className="td num text-right">{t ? fmtRupiah(t.ACTUAL_SALES) : "—"}</td>
                    <td className="td num text-right">{fmtPct(ach)}</td>
                    <td className="td">{r ? fmtDateTime(r.updatedAt) : "—"}</td>
                    <td className="td">{r?.submitter?.name ?? "—"}</td>
                    <td className="td text-right">
                      {r ? (
                        <Link href={`/reports/${r.id}`} className="font-medium text-brand-600 hover:text-brand-700">View</Link>
                      ) : (
                        <Link href="/branch/upload" className="font-medium text-brand-600 hover:text-brand-700">Upload</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>
    </>
  );
}
