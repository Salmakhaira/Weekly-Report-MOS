import { db, branches, users, reportPeriods, weeklyReports, weeklyReportDetails, changeLogs, importBatches } from "./index";
import { BRANCHES } from "../lib/roster";
import { NUMERIC_METRICS, ACTION_METRICS } from "../lib/metrics";
import { eq, and } from "drizzle-orm";

// ASSUMPTION: a reporting period is an ISO week. The Excel uses monthly tabs with
// W1..W4 columns inside them, so "Week 35" here lands in the AGUSTUS tab.
// NEED CONFIRMATION: which convention HO wants to standardise on.
const PERIODS = [
  { year: 2026, week: 31, month: 7, start: "2026-07-27", end: "2026-08-02", status: "CLOSED" as const },
  { year: 2026, week: 32, month: 8, start: "2026-08-03", end: "2026-08-09", status: "CLOSED" as const },
  { year: 2026, week: 33, month: 8, start: "2026-08-10", end: "2026-08-16", status: "CLOSED" as const },
  { year: 2026, week: 34, month: 8, start: "2026-08-17", end: "2026-08-23", status: "CLOSED" as const },
  { year: 2026, week: 35, month: 8, start: "2026-08-24", end: "2026-08-30", status: "OPEN" as const },
];

const CURRENT_WEEK = 35;

/** Deterministic pseudo-random, so re-seeding produces the same demo numbers. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function metricsFor(branchCode: string, salesman: string, week: number): Record<string, number> {
  const r = rng(`${branchCode}|${salesman}|${week}`);
  const round = (n: number) => Math.round(n * 100) / 100;
  const plan = round(400 + r() * 900);
  const actual = round(plan * (0.6 + r() * 0.55));
  const poco = round(actual * (0.15 + r() * 0.25));
  const prtm = round(actual * (0.08 + r() * 0.2));
  return {
    PLAN_SALES: plan,
    LIVE_QUOTATION: round(plan * (0.3 + r() * 0.9)),
    ACTUAL_PRTM: prtm,
    PO: round(poco + prtm),
    POCO: poco,
    ACTUAL_SALES: actual,
    OUTLOOK_REVENUE: round(actual * (0.3 + r() * 0.5)),
    BACK_ORDER: round(actual * (0.1 + r() * 0.6)),
  };
}

async function main() {
  console.log("Clearing existing data …");
  db.delete(changeLogs).run();
  db.delete(importBatches).run();
  db.delete(weeklyReportDetails).run();
  db.delete(weeklyReports).run();
  db.delete(users).run();
  db.delete(reportPeriods).run();
  db.delete(branches).run();

  console.log("Seeding branches …");
  const branchRows = db
    .insert(branches)
    .values(BRANCHES.map((b) => ({ code: b.code, name: b.name, region: b.region })))
    .returning()
    .all();
  const branchByCode = Object.fromEntries(branchRows.map((b) => [b.code, b]));

  console.log("Seeding reporting periods …");
  const periodRows = db
    .insert(reportPeriods)
    .values(
      PERIODS.map((p) => ({
        year: p.year,
        week: p.week,
        month: p.month,
        startDate: new Date(p.start),
        endDate: new Date(p.end),
        status: p.status,
      }))
    )
    .returning()
    .all();
  const periodByWeek = Object.fromEntries(periodRows.map((p) => [p.week, p]));

  console.log("Seeding users …");
  const [ho] = db
    .insert(users)
    .values({ name: "Dwi Rahmawati", email: "ho@company.com", password: "password", role: "HO" })
    .returning()
    .all();
  db.insert(users)
    .values({ name: "System Admin", email: "admin@company.com", password: "password", role: "ADMIN" })
    .run();

  const branchUsers = db
    .insert(users)
    .values(
      BRANCHES.map((b) => ({
        name: `User ${b.name}`,
        email: `${b.code.toLowerCase().replace("-", "")}@company.com`,
        password: "password",
        role: "BRANCH" as const,
        branchId: branchByCode[b.code].id,
      }))
    )
    .returning()
    .all();
  const userByBranchCode = Object.fromEntries(
    BRANCHES.map((b, i) => [b.code, branchUsers[i]])
  );

  console.log("Seeding weekly reports …");
  // Weeks 31-34 are submitted by everyone. Week 35 (open) is deliberately mixed so
  // the HO dashboard shows real "Not submitted" rows and Sampit can demo an upload.
  const week35Submitted = new Set(["PLB", "MDN", "MKS", "BJM", "PTK", "JMB", "PDG", "SMD-1"]);

  for (const b of BRANCHES) {
    for (const p of PERIODS) {
      if (p.week === CURRENT_WEEK && !week35Submitted.has(b.code)) continue;

      const submittedAt = new Date(`${p.end}T09:${String(20 + (b.code.length % 30)).padStart(2, "0")}:00`);
      const [report] = db
        .insert(weeklyReports)
        .values({
          branchId: branchByCode[b.code].id,
          reportPeriodId: periodByWeek[p.week].id,
          status: "SUBMITTED",
          submittedBy: userByBranchCode[b.code].id,
          submittedAt,
          updatedAt: submittedAt,
        })
        .returning()
        .all();

      const details = b.salesmen.flatMap((s) => {
        const values = metricsFor(b.code, s, p.week);
        return NUMERIC_METRICS.map((m) => ({
          weeklyReportId: report.id,
          salesman: s,
          metricName: m.key,
          metricValue: values[m.key],
          metricType: "NUMBER" as const,
          source: "EXCEL_UPLOAD" as const,
        }));
      });
      db.insert(weeklyReportDetails).values(details).run();

      // One action-plan item on the latest closed week, so Report Detail has content
      // before form input exists.
      if (p.week === 34) {
        const action: Record<string, string> = {
          PROBLEM_IDENTIFICATION: "Main product stock at plant is below the confirmed PO quantity",
          CORRECTIVE_ACTION: "Weekly ETA confirmation with supply planning; reallocate from the nearest branch",
          PIC: b.salesmen[0] ?? "-",
          DUE_DATE: "2026-09-05",
          STATUS: "ON PROGRESS",
          REMARKS: "Seeded example",
        };
        db.insert(weeklyReportDetails)
          .values(
            ACTION_METRICS.map((m) => ({
              weeklyReportId: report.id,
              salesman: null,
              metricName: m.key,
              metricText: action[m.key],
              metricType: m.kind,
              source: "EXCEL_UPLOAD" as const,
            }))
          )
          .run();
      }
    }
  }

  console.log("Seeding change log examples …");
  const smp = branchByCode["SMP"];
  const w33 = periodByWeek[33];
  const smpW33 = db
    .select()
    .from(weeklyReports)
    .where(and(eq(weeklyReports.branchId, smp.id), eq(weeklyReports.reportPeriodId, w33.id)))
    .get();

  db.insert(changeLogs)
    .values([
      {
        branchId: smp.id,
        reportPeriodId: w33.id,
        weeklyReportId: smpW33?.id ?? null,
        changedBy: userByBranchCode["SMP"].id,
        changedAt: new Date("2026-08-26T10:12:00"),
        salesman: "HADI ISNANDAR",
        fieldChanged: "ACTUAL_SALES",
        oldValue: "500",
        newValue: "530",
        reason: "Invoice tambahan belum tercatat pada submission sebelumnya.",
        source: "EXCEL_UPLOAD" as const,
      },
      {
        branchId: branchByCode["MDN"].id,
        reportPeriodId: periodByWeek[34].id,
        weeklyReportId: null,
        changedBy: ho.id,
        changedAt: new Date("2026-08-25T16:40:00"),
        salesman: null,
        fieldChanged: "PLAN_SALES",
        oldValue: "1200",
        newValue: "1150",
        reason: "Plan revision approved by HO after the quarterly re-forecast.",
        source: "ADMIN_ADJUSTMENT" as const,
      },
    ])
    .run();

  console.log("Seed complete:", {
    branches: db.select().from(branches).all().length,
    users: db.select().from(users).all().length,
    periods: db.select().from(reportPeriods).all().length,
    reports: db.select().from(weeklyReports).all().length,
    details: db.select().from(weeklyReportDetails).all().length,
    changeLogs: db.select().from(changeLogs).all().length,
  });

  console.log("\nSign in with:");
  console.log("  smp@company.com   / password   (Branch — Sampit)");
  console.log("  ho@company.com    / password   (Head Office)");
  console.log("  admin@company.com / password   (Admin)");
}

main();
