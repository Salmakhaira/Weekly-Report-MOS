import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, importBatches, weeklyReports, weeklyReportDetails, changeLogs } from "@/db";
import { requireUser } from "@/lib/session";
import type { DataRow, ActionRow } from "@/lib/excel/parse";
import { NUMERIC_METRICS, ACTION_METRICS } from "@/lib/metrics";

interface Incoming {
  salesman: string | null;
  metricName: string;
  metricValue: number | null;
  metricText: string | null;
  metricType: "NUMBER" | "TEXT" | "DATE";
}

/**
 * Step 2 of the import: write the parked batch into the database.
 *
 * If the branch already submitted this period, every changed value is diffed
 * against what is stored and written to change_logs with the supplied reason.
 * Nothing is overwritten silently.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  const { batchId, reason } = await req.json();

  const batch = await db.query.importBatches.findFirst({ where: eq(importBatches.id, String(batchId ?? "")) });
  if (!batch) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
  if (batch.status !== "PENDING") {
    return NextResponse.json({ error: `This import is already ${batch.status.toLowerCase()}.` }, { status: 409 });
  }
  if (user.role === "BRANCH" && batch.branchId !== user.branchId) {
    return NextResponse.json({ error: "You can only submit for your own branch." }, { status: 403 });
  }

  const payload = JSON.parse(batch.payload) as { rows: DataRow[]; actionRows: ActionRow[] };

  const existing = await db.query.weeklyReports.findFirst({
    where: and(
      eq(weeklyReports.branchId, batch.branchId),
      eq(weeklyReports.reportPeriodId, batch.reportPeriodId)
    ),
    with: { details: true },
  });

  const isResubmission = existing?.status === "SUBMITTED";
  const trimmedReason = String(reason ?? "").trim();
  if (isResubmission && trimmedReason.length < 10) {
    return NextResponse.json(
      { error: "This period was already submitted. Describe why the figures changed (at least 10 characters)." },
      { status: 400 }
    );
  }

  // ---- Build the incoming detail set ----
  const incoming: Incoming[] = [];
  for (const row of payload.rows) {
    for (const m of NUMERIC_METRICS) {
      incoming.push({
        salesman: row.salesman,
        metricName: m.key,
        metricValue: row.values[m.key] ?? 0,
        metricText: null,
        metricType: "NUMBER",
      });
    }
  }
  // V0.1 keeps a single action-plan item per report; the first filled row wins.
  const action = payload.actionRows[0];
  if (action) {
    for (const m of ACTION_METRICS) {
      incoming.push({
        salesman: null,
        metricName: m.key,
        metricValue: null,
        metricText: action.values[m.key] ?? null,
        metricType: m.kind,
      });
    }
  }

  // ---- Diff against what is already stored ----
  const keyOf = (salesman: string | null, metric: string) => `${salesman ?? "__BRANCH__"}::${metric}`;
  const oldMap = new Map<string, string | null>();
  for (const d of existing?.details ?? []) {
    oldMap.set(
      keyOf(d.salesman, d.metricName),
      d.metricType === "NUMBER" ? (d.metricValue?.toString() ?? null) : d.metricText
    );
  }

  const changes: { salesman: string | null; fieldChanged: string; oldValue: string | null; newValue: string | null }[] = [];

  if (isResubmission) {
    const seen = new Set<string>();
    for (const inc of incoming) {
      const k = keyOf(inc.salesman, inc.metricName);
      seen.add(k);
      const newValue = inc.metricType === "NUMBER" ? (inc.metricValue?.toString() ?? null) : inc.metricText;
      const oldValue = oldMap.get(k) ?? null;
      if (normalise(oldValue) !== normalise(newValue)) {
        changes.push({ salesman: inc.salesman, fieldChanged: inc.metricName, oldValue, newValue });
      }
    }
    // Rows that existed before and are absent from the new file.
    for (const [k, v] of oldMap) {
      if (seen.has(k)) continue;
      const [salesman, metricName] = k.split("::");
      changes.push({
        salesman: salesman === "__BRANCH__" ? null : salesman,
        fieldChanged: metricName,
        oldValue: v,
        newValue: null,
      });
    }
  }

  // ---- Write (better-sqlite3 transactions are synchronous) ----
  const now = new Date();
  const reportId = db.transaction((tx) => {
    let id: string;
    if (existing) {
      tx.update(weeklyReports)
        .set({ status: "SUBMITTED", submittedBy: user.id, submittedAt: now, updatedAt: now })
        .where(eq(weeklyReports.id, existing.id))
        .run();
      id = existing.id;
    } else {
      const [created] = tx
        .insert(weeklyReports)
        .values({
          branchId: batch.branchId,
          reportPeriodId: batch.reportPeriodId,
          status: "SUBMITTED",
          submittedBy: user.id,
          submittedAt: now,
          updatedAt: now,
        })
        .returning()
        .all();
      id = created.id;
    }

    tx.delete(weeklyReportDetails).where(eq(weeklyReportDetails.weeklyReportId, id)).run();
    if (incoming.length) {
      tx.insert(weeklyReportDetails)
        .values(incoming.map((i) => ({ ...i, weeklyReportId: id, source: "EXCEL_UPLOAD" as const, updatedAt: now })))
        .run();
    }

    if (changes.length) {
      tx.insert(changeLogs)
        .values(
          changes.map((c) => ({
            branchId: batch.branchId,
            reportPeriodId: batch.reportPeriodId,
            weeklyReportId: id,
            changedBy: user.id,
            changedAt: now,
            salesman: c.salesman,
            fieldChanged: c.fieldChanged,
            oldValue: c.oldValue,
            newValue: c.newValue,
            reason: trimmedReason,
            source: "EXCEL_UPLOAD" as const,
          }))
        )
        .run();
    }

    tx.update(importBatches).set({ status: "COMMITTED" }).where(eq(importBatches.id, batch.id)).run();
    return id;
  });

  return NextResponse.json({ reportId, changeCount: changes.length, redirect: `/reports/${reportId}` });
}

function normalise(v: string | null): string {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (v.trim() !== "" && Number.isFinite(n)) return String(Math.round(n * 1e6) / 1e6);
  return v.trim();
}
