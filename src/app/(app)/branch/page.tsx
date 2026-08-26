import Link from "next/link";
import { requireBranchUser } from "@/lib/session";
import { branchReports, currentPeriod, totalsForReport } from "@/lib/reports";
import { achievement } from "@/lib/metrics";
import { fmtRupiah, fmtPct, fmtDate, periodLabel } from "@/lib/format";
import { PageHeader, Card, Stat, Badge, Empty, LinkButton, TableShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BranchDashboard() {
  const user = await requireBranchUser();
  const period = await currentPeriod();
  const all = await branchReports(user.branchId);
  const reports = all.slice(0, 6);

  const currentReport = period ? all.find((r) => r.reportPeriodId === period.id) ?? null : null;
  const latestSubmitted = all.find((r) => r.status === "SUBMITTED") ?? null;
  const totals = latestSubmitted ? await totalsForReport(latestSubmitted.id) : null;
  const ach = totals ? achievement(totals.ACTUAL_SALES, totals.PLAN_SALES) : null;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.branchName}`}
        subtitle={
          period
            ? `Current period ${periodLabel(period)} · ${fmtDate(period.startDate)} – ${fmtDate(period.endDate)}`
            : "No reporting period is open."
        }
        actions={
          <>
            <LinkButton href="/branch/upload" variant="primary">Upload weekly report</LinkButton>
            <LinkButton href="/branch/reports">My reports</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Report status"
          value={<Badge>{currentReport?.status ?? "NOT SUBMITTED"}</Badge>}
          hint={period ? periodLabel(period) : undefined}
        />
        <Stat
          label="Latest actual sales"
          value={fmtRupiah(totals?.ACTUAL_SALES)}
          hint={latestSubmitted ? periodLabel(latestSubmitted.period) : "No submitted report yet"}
        />
        <Stat
          label="Achievement"
          value={fmtPct(ach)}
          hint={totals ? `Plan ${fmtRupiah(totals.PLAN_SALES)}` : undefined}
          tone={ach === null ? "default" : ach >= 1 ? "good" : ach >= 0.9 ? "warn" : "bad"}
        />
        <Stat
          label="Back order"
          value={fmtRupiah(totals?.BACK_ORDER)}
          hint={totals ? `Outlook ${fmtRupiah(totals.OUTLOOK_REVENUE)}` : undefined}
        />
      </div>

      <div className="mt-6">
        <Card
          title="Recent reports"
          action={
            <Link href="/branch/reports" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          }
        >
          {reports.length === 0 ? (
            <Empty
              title="No reports yet"
              body="Upload the weekly Excel for the open period to create your first report."
              action={<LinkButton href="/branch/upload" variant="primary">Upload weekly report</LinkButton>}
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <th className="th">Period</th>
                  <th className="th">Status</th>
                  <th className="th">Submitted</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-surface">
                    <td className="td font-medium text-ink">{periodLabel(r.period)}</td>
                    <td className="td"><Badge>{r.status}</Badge></td>
                    <td className="td">{fmtDate(r.submittedAt)}</td>
                    <td className="td text-right">
                      <Link href={`/reports/${r.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>
      </div>

      {period && !currentReport && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          {periodLabel(period)} closes {fmtDate(period.endDate)} and has not been submitted yet.
        </p>
      )}
    </>
  );
}
