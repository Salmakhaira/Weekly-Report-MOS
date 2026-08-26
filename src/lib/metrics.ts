/**
 * Metric catalog — the subset of the Excel we model in V0.1.
 *
 * These names were taken from the real column headers in `Sampit.xlsx` (sheet
 * "AGUSTUS 2026") and `WEEKLY REPORT MOS NASIONAL - 2026.xlsx` (sheet
 * "MOS AGUSTUS 2026"), which share an identical column layout.
 *
 * Deliberately NOT modelled yet: quotation-confidence buckets (>80% / 50-80% / <50%),
 * DFO proposed/approved/ETA, POCO and PRTM product splits (MAIN PROD / IKD / BKT),
 * carry-over and next-month outlook blocks. Those come in a later version.
 */

export type MetricKind = "NUMBER" | "TEXT" | "DATE";

export interface MetricDef {
  key: string;
  label: string;
  kind: MetricKind;
  /** IMPORTED = comes from the Excel upload, CALCULATED = derived, MANUAL = form input (V0.2) */
  origin: "IMPORTED" | "CALCULATED" | "MANUAL";
  excelHeader?: string;
  required?: boolean;
}

/** Numeric metrics, one column each in the upload template's DATA sheet. */
export const NUMERIC_METRICS: MetricDef[] = [
  { key: "PLAN_SALES", label: "Plan Sales", kind: "NUMBER", origin: "IMPORTED", excelHeader: "PLAN SALES MASTER", required: true },
  { key: "LIVE_QUOTATION", label: "Live Quotation", kind: "NUMBER", origin: "IMPORTED", excelHeader: "LIVE QUOTATION by CRM — TOTAL", required: true },
  { key: "ACTUAL_PRTM", label: "Actual PRTM", kind: "NUMBER", origin: "IMPORTED", excelHeader: "ACT PRTM by SO SAP", required: true },
  { key: "PO", label: "PO", kind: "NUMBER", origin: "IMPORTED", excelHeader: "TOTAL PO (POCO+PRTM)", required: true },
  { key: "POCO", label: "POCO", kind: "NUMBER", origin: "IMPORTED", excelHeader: "POCO", required: true },
  { key: "ACTUAL_SALES", label: "Actual Sales", kind: "NUMBER", origin: "IMPORTED", excelHeader: "ACTUAL SALES — AMOUNT", required: true },
  { key: "OUTLOOK_REVENUE", label: "Outlook Revenue", kind: "NUMBER", origin: "IMPORTED", excelHeader: "OUTLOOK REVENUE FINAL", required: true },
  { key: "BACK_ORDER", label: "Back Order", kind: "NUMBER", origin: "IMPORTED", excelHeader: "TOTAL BO & ETA NM", required: true },
];

/** Action-plan fields. Uploaded via the ACTION PLAN sheet in V0.1; move to form input in V0.2. */
export const ACTION_METRICS: MetricDef[] = [
  { key: "PROBLEM_IDENTIFICATION", label: "Problem Identification", kind: "TEXT", origin: "MANUAL", excelHeader: "PROBLEM IDENTIFICATION" },
  { key: "CORRECTIVE_ACTION", label: "Corrective Action", kind: "TEXT", origin: "MANUAL", excelHeader: "CORRECTIVE ACTION" },
  { key: "PIC", label: "PIC", kind: "TEXT", origin: "MANUAL", excelHeader: "PIC" },
  { key: "DUE_DATE", label: "Due Date", kind: "DATE", origin: "MANUAL", excelHeader: "DUE DATE" },
  { key: "STATUS", label: "Status", kind: "TEXT", origin: "MANUAL", excelHeader: "STATUS" },
  { key: "REMARKS", label: "Remarks", kind: "TEXT", origin: "MANUAL", excelHeader: "REMARKS" },
];

export const ALL_METRICS = [...NUMERIC_METRICS, ...ACTION_METRICS];

export const METRIC_BY_KEY: Record<string, MetricDef> = Object.fromEntries(
  ALL_METRICS.map((m) => [m.key, m])
);

export const ACTION_STATUS_OPTIONS = ["OPEN", "ON PROGRESS", "CLOSED"];

/** Achievement = Actual Sales / Plan Sales. Guarded against a zero plan. */
export function achievement(actualSales: number, planSales: number): number | null {
  if (!planSales) return null;
  return actualSales / planSales;
}
