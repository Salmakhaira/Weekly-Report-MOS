import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    default: "text-ink",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
  }[tone];
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${toneClass}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  SUBMITTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DRAFT: "bg-amber-50 text-amber-700 ring-amber-200",
  "NOT SUBMITTED": "bg-slate-100 text-slate-600 ring-slate-200",
  OPEN: "bg-brand-50 text-brand-700 ring-brand-100",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-200",
  "ON PROGRESS": "bg-brand-50 text-brand-700 ring-brand-100",
  ERROR: "bg-red-50 text-red-700 ring-red-200",
  WARNING: "bg-amber-50 text-amber-700 ring-amber-200",
  EXCEL_UPLOAD: "bg-slate-100 text-slate-600 ring-slate-200",
  FORM: "bg-brand-50 text-brand-700 ring-brand-100",
  ADMIN_ADJUSTMENT: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ children, tone }: { children: string; tone?: string }) {
  const key = (tone ?? children).toUpperCase();
  const cls = BADGE_TONES[key] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${cls}`}>
      {children.replace(/_/g, " ")}
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-mute">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Link href={href} className={`btn-${variant}`}>
      {children}
    </Link>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-line">{children}</table>
    </div>
  );
}
