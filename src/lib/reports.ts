import { and, desc, eq } from "drizzle-orm";
import { db, reportPeriods, weeklyReportDetails, weeklyReports } from "@/db";
import { NUMERIC_METRICS } from "./metrics";

export type Totals = Record<string, number>;

export function emptyTotals(): Totals {
  return Object.fromEntries(NUMERIC_METRICS.map((m) => [m.key, 0]));
}

/** Sums salesman rows into a branch-level roll-up. */
export function rollUp(details: { metricName: string; metricValue: number | null }[]): Totals {
  const t = emptyTotals();
  for (const d of details) {
    if (d.metricValue === null || d.metricValue === undefined) continue;
    if (d.metricName in t) t[d.metricName] += d.metricValue;
  }
  return t;
}

export function addTotals(a: Totals, b: Totals): Totals {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] ?? 0) + b[k];
  return out;
}

export async function totalsForReport(weeklyReportId: string): Promise<Totals> {
  const rows = await db
    .select({ metricName: weeklyReportDetails.metricName, metricValue: weeklyReportDetails.metricValue })
    .from(weeklyReportDetails)
    .where(and(eq(weeklyReportDetails.weeklyReportId, weeklyReportId), eq(weeklyReportDetails.metricType, "NUMBER")));
  return rollUp(rows);
}

/** Current period = the OPEN one, falling back to the newest period. */
export async function currentPeriod() {
  const open = await db.query.reportPeriods.findFirst({
    where: eq(reportPeriods.status, "OPEN"),
    orderBy: [desc(reportPeriods.year), desc(reportPeriods.week)],
  });
  if (open) return open;
  return db.query.reportPeriods.findFirst({ orderBy: [desc(reportPeriods.year), desc(reportPeriods.week)] });
}

/** Newest first. Used everywhere a period picker is rendered. */
export async function recentPeriods(limit = 12) {
  return db.query.reportPeriods.findMany({
    orderBy: [desc(reportPeriods.year), desc(reportPeriods.week)],
    limit,
  });
}

/** Reports for one branch, newest period first. */
export async function branchReports(branchId: string) {
  const rows = await db.query.weeklyReports.findMany({
    where: eq(weeklyReports.branchId, branchId),
    with: { period: true, submitter: { columns: { name: true } } },
  });
  return rows.sort((a, b) => b.period.year - a.period.year || b.period.week - a.period.week);
}

/**
 * Groups action-plan detail rows back into one item.
 * NEED CONFIRMATION: whether a branch needs several action-plan items per week.
 * V0.1 stores one.
 */
export function groupActionPlan(rows: { metricName: string; metricText: string | null }[]) {
  if (rows.length === 0) return null;
  return Object.fromEntries(rows.map((r) => [r.metricName, r.metricText])) as Record<string, string | null>;
}
