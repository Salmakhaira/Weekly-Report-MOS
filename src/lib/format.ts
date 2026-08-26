/** Values are stored in Rp juta (millions), matching the scale used in the source Excel. */

export function fmtJuta(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Renders Rp juta as a compact rupiah string, e.g. 3549 -> "Rp 3,55 M". */
export function fmtRupiah(juta: number | null | undefined): string {
  if (juta === null || juta === undefined || Number.isNaN(juta)) return "—";
  if (Math.abs(juta) >= 1000) return `Rp ${(juta / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  return `Rp ${juta.toLocaleString("id-ID", { maximumFractionDigits: 0 })} Jt`;
}

export function fmtPct(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return `${fmtDate(date)} ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}

export function periodLabel(p: { year: number; week: number }): string {
  return `Week ${p.week} / ${p.year}`;
}
