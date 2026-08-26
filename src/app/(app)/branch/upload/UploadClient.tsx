"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NUMERIC_METRICS, ACTION_METRICS } from "@/lib/metrics";
import { fmtJuta } from "@/lib/format";
import { Card, Badge, TableShell } from "@/components/ui";

interface PeriodOpt {
  id: string;
  year: number;
  week: number;
  status: string;
  alreadySubmitted: boolean;
}

interface Issue {
  severity: "ERROR" | "WARNING";
  sheet: string;
  row: number | null;
  column: string | null;
  message: string;
}

interface ParseResponse {
  batchId: string;
  fileName: string;
  isResubmission: boolean;
  checks: { label: string; ok: boolean }[];
  rows: { rowNumber: number; salesman: string; values: Record<string, number> }[];
  actionRows: { rowNumber: number; values: Record<string, string | null> }[];
  issues: Issue[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  totals: Record<string, number>;
  canCommit: boolean;
}

const STEPS = ["Select file", "Review", "Submitted"];

export default function UploadClient({
  branch,
  periods,
}: {
  branch: { id: string; code: string; name: string };
  periods: PeriodOpt[];
}) {
  const router = useRouter();
  const defaultPeriod = periods.find((p) => p.status === "OPEN") ?? periods[0];

  const [periodId, setPeriodId] = useState(defaultPeriod?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const period = periods.find((p) => p.id === periodId);
  const step = result ? 1 : 0;

  const errors = useMemo(() => result?.issues.filter((i) => i.severity === "ERROR") ?? [], [result]);
  const warnings = useMemo(() => result?.issues.filter((i) => i.severity === "WARNING") ?? [], [result]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !periodId) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("branchId", branch.id);
    fd.append("periodId", periodId);
    const res = await fetch("/api/import/parse", { method: "POST", body: fd });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "The file could not be processed.");
      return;
    }
    setResult(body);
    setShowErrors(false);
  }

  async function commit() {
    if (!result) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: result.batchId, reason }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "The report could not be submitted.");
      return;
    }
    router.push(body.redirect);
    router.refresh();
  }

  function reset() {
    setResult(null);
    setFile(null);
    setReason("");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {error}
        </p>
      )}

      {!result && (
        <Card title="Report file">
          <form onSubmit={upload} className="space-y-5 p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label">Branch</label>
                <input className="field bg-surface" value={`${branch.code} — ${branch.name}`} disabled />
              </div>
              <div>
                <label className="label" htmlFor="period">Reporting period</label>
                <select id="period" className="field" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      Week {p.week} / {p.year}
                      {p.status === "OPEN" ? " · open" : ""}
                      {p.alreadySubmitted ? " · already submitted" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {period?.alreadySubmitted && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
                Week {period.week} was already submitted. Uploading again will ask you for a reason and record every changed
                value in the change log.
              </p>
            )}

            <div>
              <label className="label" htmlFor="file">Excel file</label>
              <input
                id="file"
                type="file"
                accept=".xlsx"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
              <p className="mt-2 text-xs text-ink-mute">
                Use the template for this branch and period — the file carries a META sheet that must match your selection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <button type="submit" className="btn-primary" disabled={!file || busy}>
                {busy ? "Checking file…" : "Upload and check"}
              </button>
              <a className="btn-secondary" href={`/api/template?branchId=${branch.id}&periodId=${periodId}`}>
                Download template
              </a>
            </div>
          </form>
        </Card>
      )}

      {result && (
        <>
          <Card title="Import preview">
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
              <div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <Meta label="File" value={result.fileName} />
                  <Meta label="Rows detected" value={String(result.totalRows)} />
                  <Meta label="Valid" value={String(result.validRows)} />
                  <Meta label="Errors" value={String(result.errorRows)} />
                </dl>

                <ul className="mt-5 space-y-1.5">
                  {result.checks.map((c) => (
                    <li key={c.label} className={`flex items-start gap-2 text-sm ${c.ok ? "text-emerald-700" : "text-red-700"}`}>
                      <span aria-hidden className="mt-0.5 font-semibold">{c.ok ? "✓" : "✕"}</span>
                      <span>{c.label}</span>
                    </li>
                  ))}
                  {warnings.length > 0 && (
                    <li className="flex items-start gap-2 text-sm text-amber-700">
                      <span aria-hidden className="mt-0.5 font-semibold">!</span>
                      <span>
                        {warnings.length} warning{warnings.length > 1 ? "s" : ""} — these do not block submission.
                      </span>
                    </li>
                  )}
                </ul>

                {result.issues.length > 0 && (
                  <button type="button" className="btn-secondary mt-4" onClick={() => setShowErrors((s) => !s)}>
                    {showErrors ? "Hide issues" : `View issues (${result.issues.length})`}
                  </button>
                )}
              </div>

              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Branch roll-up</p>
                <dl className="mt-3 space-y-2">
                  {NUMERIC_METRICS.map((m) => (
                    <div key={m.key} className="flex items-baseline justify-between gap-4">
                      <dt className="text-sm text-ink-soft">{m.label}</dt>
                      <dd className="num text-ink">{fmtJuta(result.totals[m.key], 2)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 border-t border-line pt-2 text-xs text-ink-mute">Values in Rp juta.</p>
              </div>
            </div>

            {showErrors && result.issues.length > 0 && (
              <div className="border-t border-line">
                <TableShell>
                  <thead className="bg-surface">
                    <tr>
                      <th className="th">Severity</th>
                      <th className="th">Sheet</th>
                      <th className="th">Row</th>
                      <th className="th">Column</th>
                      <th className="th">What to fix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {result.issues.map((i, idx) => (
                      <tr key={idx}>
                        <td className="td"><Badge>{i.severity}</Badge></td>
                        <td className="td">{i.sheet}</td>
                        <td className="td num">{i.row ?? "—"}</td>
                        <td className="td">{i.column ?? "—"}</td>
                        <td className="td whitespace-normal text-ink">{i.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              </div>
            )}
          </Card>

          <Card title={`Rows to import (${result.rows.length})`}>
            {result.rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-mute">No salesman rows were read from the file.</p>
            ) : (
              <TableShell>
                <thead className="bg-surface">
                  <tr>
                    <th className="th">Row</th>
                    <th className="th">Salesman</th>
                    {NUMERIC_METRICS.map((m) => (
                      <th key={m.key} className="th text-right">{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.rows.map((r) => (
                    <tr key={r.rowNumber} className="hover:bg-surface">
                      <td className="td num text-ink-mute">{r.rowNumber}</td>
                      <td className="td font-medium text-ink">{r.salesman}</td>
                      {NUMERIC_METRICS.map((m) => (
                        <td key={m.key} className="td num text-right">{fmtJuta(r.values[m.key], 2)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Card>

          {result.actionRows.length > 0 && (
            <Card title="Action plan">
              <TableShell>
                <thead className="bg-surface">
                  <tr>{ACTION_METRICS.map((m) => <th key={m.key} className="th">{m.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.actionRows.map((r) => (
                    <tr key={r.rowNumber}>
                      {ACTION_METRICS.map((m) => (
                        <td key={m.key} className="td max-w-xs whitespace-normal">{r.values[m.key] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              {result.actionRows.length > 1 && (
                <p className="border-t border-line px-4 py-2 text-xs text-ink-mute">
                  V0.1 stores one action-plan item per report — the first row is saved.
                </p>
              )}
            </Card>
          )}

          <Card title="Submit">
            <div className="space-y-4 p-5">
              {result.isResubmission && (
                <div>
                  <label className="label" htmlFor="reason">Reason for change (required)</label>
                  <textarea
                    id="reason"
                    className="field min-h-[88px]"
                    placeholder="e.g. Invoice tambahan belum tercatat pada submission sebelumnya."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-ink-mute">
                    This period was already submitted. Every value that differs from the stored report is written to the
                    change log with this reason.
                  </p>
                </div>
              )}

              {!result.canCommit && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
                  {errors.length} error{errors.length > 1 ? "s" : ""} must be fixed in the Excel file before this report can be
                  submitted.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  className="btn-primary"
                  onClick={commit}
                  disabled={busy || !result.canCommit || (result.isResubmission && reason.trim().length < 10)}
                >
                  {busy ? "Submitting…" : "Submit report"}
                </button>
                <button className="btn-secondary" onClick={reset} disabled={busy}>
                  Choose a different file
                </button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink">{value}</dd>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              i <= current ? "bg-slate-900 text-white" : "bg-line text-ink-mute"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= current ? "font-medium text-ink" : "text-ink-mute"}>{s}</span>
          {i < STEPS.length - 1 && <span aria-hidden className="mx-1 text-ink-mute">→</span>}
        </li>
      ))}
    </ol>
  );
}
