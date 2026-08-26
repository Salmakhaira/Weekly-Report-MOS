"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Badge, TableShell } from "@/components/ui";

export interface ChangeRow {
  id: string;
  changedAt: string;
  branch: string;
  period: string;
  salesman: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  reason: string;
  source: string;
  reportUrl: string | null;
}

export default function ChangeTable({ rows }: { rows: ChangeRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <TableShell>
      <thead className="bg-surface">
        <tr>
          <th className="th">Date</th>
          <th className="th">Branch</th>
          <th className="th">Period</th>
          <th className="th">Field</th>
          <th className="th text-right">Old value</th>
          <th className="th text-right">New value</th>
          <th className="th">Changed by</th>
          <th className="th">Source</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => {
          const open = openId === r.id;
          return (
            <Fragment key={r.id}>
              <tr
                onClick={() => setOpenId(open ? null : r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId(open ? null : r.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-expanded={open}
                className={`cursor-pointer hover:bg-surface ${open ? "bg-surface" : ""}`}
              >
                <td className="td">{r.changedAt}</td>
                <td className="td font-medium text-ink">{r.branch}</td>
                <td className="td">{r.period}</td>
                <td className="td font-medium text-ink">
                  {r.field}
                  {r.salesman && <span className="ml-2 text-xs font-normal text-ink-mute">{r.salesman}</span>}
                </td>
                <td className="td num text-right">{r.oldValue ?? "—"}</td>
                <td className="td num text-right font-semibold text-ink">{r.newValue ?? "—"}</td>
                <td className="td">{r.changedBy}</td>
                <td className="td"><Badge>{r.source}</Badge></td>
              </tr>
              {open && (
                <tr className="bg-surface">
                  <td colSpan={8} className="px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Branch" value={r.branch} />
                      <Field label="Period" value={r.period} />
                      <Field label="Field" value={r.field} />
                      <Field label="Salesman" value={r.salesman ?? "Branch level"} />
                      <Field label="Old value" value={r.oldValue ?? "—"} />
                      <Field label="New value" value={r.newValue ?? "—"} />
                      <Field label="Changed by" value={r.changedBy} />
                      <Field label="Changed at" value={r.changedAt} />
                      <div className="sm:col-span-2 lg:col-span-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Reason</p>
                        <p className="mt-1 text-sm text-ink">{r.reason}</p>
                      </div>
                    </div>
                    {r.reportUrl && (
                      <Link href={r.reportUrl} className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
                        Open the report
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </TableShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className="mt-0.5 text-sm text-ink">{value}</p>
    </div>
  );
}
