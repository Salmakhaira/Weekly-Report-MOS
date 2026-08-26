import ExcelJS from "exceljs";
import { NUMERIC_METRICS, ACTION_METRICS, ACTION_STATUS_OPTIONS } from "@/lib/metrics";
import { SHEET_META, SHEET_DATA, SHEET_ACTION } from "./template";

export type Severity = "ERROR" | "WARNING";

export interface Issue {
  severity: Severity;
  sheet: string;
  row: number | null;
  column: string | null;
  message: string;
}

export interface DataRow {
  rowNumber: number;
  salesman: string;
  values: Record<string, number>;
}

export interface ActionRow {
  rowNumber: number;
  values: Record<string, string | null>;
}

export interface Check {
  label: string;
  ok: boolean;
}

export interface ParseResult {
  meta: { branchCode: string | null; year: number | null; week: number | null };
  checks: Check[];
  rows: DataRow[];
  actionRows: ActionRow[];
  issues: Issue[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  totals: Record<string, number>;
  canCommit: boolean;
}

export interface ExpectedContext {
  branchCode: string;
  year: number;
  week: number;
  roster: string[];
}

const norm = (s: unknown) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");

export async function parseWorkbook(buffer: Buffer, expected: ExpectedContext): Promise<ParseResult> {
  const issues: Issue[] = [];
  const checks: Check[] = [];
  const wb = new ExcelJS.Workbook();

  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return fail("The file could not be read as an .xlsx workbook. Re-save it from Excel and upload again.");
  }

  const metaSheet = wb.getWorksheet(SHEET_META);
  const dataSheet = wb.getWorksheet(SHEET_DATA);
  const actionSheet = wb.getWorksheet(SHEET_ACTION);

  if (!metaSheet || !dataSheet) {
    return fail(
      `The workbook is missing the "${SHEET_META}" or "${SHEET_DATA}" sheet. Download the template and fill that instead.`
    );
  }

  // ---------- META ----------
  const metaMap: Record<string, string> = {};
  metaSheet.eachRow((row, n) => {
    if (n === 1) return;
    const key = norm(cellText(row.getCell(1)));
    if (key) metaMap[key] = cellText(row.getCell(2)).trim();
  });

  const branchCode = metaMap["BRANCH_CODE"] || null;
  const year = toInt(metaMap["YEAR"]);
  const week = toInt(metaMap["WEEK"]);

  const branchOk = !!branchCode && norm(branchCode) === norm(expected.branchCode);
  checks.push({ label: "Branch matches the selected branch", ok: branchOk });
  if (!branchOk) {
    issues.push({
      severity: "ERROR",
      sheet: SHEET_META,
      row: null,
      column: "BRANCH_CODE",
      message: `The file reports branch "${branchCode ?? "(empty)"}" but you selected "${expected.branchCode}".`,
    });
  }

  const periodOk = year === expected.year && week === expected.week;
  checks.push({ label: "Period matches the selected reporting period", ok: periodOk });
  if (!periodOk) {
    issues.push({
      severity: "ERROR",
      sheet: SHEET_META,
      row: null,
      column: "YEAR / WEEK",
      message: `The file reports Week ${week ?? "?"} / ${year ?? "?"} but you selected Week ${expected.week} / ${expected.year}.`,
    });
  }

  // ---------- DATA header ----------
  const headerRow = dataSheet.getRow(1);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, idx) => {
    const h = norm(cellText(cell));
    if (!h) return;
    if (h === "SALESMAN") colIndex["SALESMAN"] = idx;
    const match = NUMERIC_METRICS.find((m) => norm(m.label) === h || norm(m.key) === h);
    if (match) colIndex[match.key] = idx;
  });

  const missingCols = [
    ...(colIndex["SALESMAN"] ? [] : ["SALESMAN"]),
    ...NUMERIC_METRICS.filter((m) => !colIndex[m.key]).map((m) => m.label.toUpperCase()),
  ];
  const colsOk = missingCols.length === 0;
  checks.push({ label: "All required columns are present", ok: colsOk });
  if (!colsOk) {
    issues.push({
      severity: "ERROR",
      sheet: SHEET_DATA,
      row: 1,
      column: missingCols.join(", "),
      message: `Missing column${missingCols.length > 1 ? "s" : ""}: ${missingCols.join(", ")}.`,
    });
  }

  // ---------- DATA rows ----------
  const rows: DataRow[] = [];
  const badRowNumbers = new Set<number>();
  const seen = new Map<string, number>();
  let numericOk = true;

  if (colsOk) {
    dataSheet.eachRow((row, n) => {
      if (n === 1) return;
      const salesman = cellText(row.getCell(colIndex["SALESMAN"])).trim();
      const rawValues = NUMERIC_METRICS.map((m) => row.getCell(colIndex[m.key]).value);
      const allBlank = !salesman && rawValues.every((v) => v === null || v === undefined || v === "");
      if (allBlank) return; // spacer / trailing row

      // The template's own footer note lands in column A; ignore it.
      if (!salesman) return;
      if (salesman.toLowerCase().startsWith("row 2 is filled in")) return;

      if (seen.has(norm(salesman))) {
        badRowNumbers.add(n);
        issues.push({
          severity: "ERROR",
          sheet: SHEET_DATA,
          row: n,
          column: "SALESMAN",
          message: `"${salesman}" already appears on row ${seen.get(norm(salesman))}. Each salesman may appear once.`,
        });
        return;
      }
      seen.set(norm(salesman), n);

      const values: Record<string, number> = {};
      let rowHasError = false;

      for (const m of NUMERIC_METRICS) {
        const cell = row.getCell(colIndex[m.key]);
        const parsed = toNumber(cell.value);
        if (parsed === "INVALID") {
          numericOk = false;
          rowHasError = true;
          issues.push({
            severity: "ERROR",
            sheet: SHEET_DATA,
            row: n,
            column: m.label.toUpperCase(),
            message: `"${cellText(cell)}" is not a number.`,
          });
          values[m.key] = 0;
        } else if (parsed < 0) {
          rowHasError = true;
          issues.push({
            severity: "ERROR",
            sheet: SHEET_DATA,
            row: n,
            column: m.label.toUpperCase(),
            message: `Negative value ${parsed}. Report figures must be zero or above.`,
          });
          values[m.key] = parsed;
        } else {
          values[m.key] = parsed;
        }
      }

      if (!expected.roster.some((r) => norm(r) === norm(salesman))) {
        issues.push({
          severity: "WARNING",
          sheet: SHEET_DATA,
          row: n,
          column: "SALESMAN",
          message: `"${salesman}" is not on the ${expected.branchCode} roster. It will be imported as entered.`,
        });
      }
      if (values["PLAN_SALES"] === 0 && values["ACTUAL_SALES"] > 0) {
        issues.push({
          severity: "WARNING",
          sheet: SHEET_DATA,
          row: n,
          column: "PLAN SALES",
          message: `Plan Sales is 0 while Actual Sales is ${values["ACTUAL_SALES"]}. Achievement cannot be calculated for this row.`,
        });
      }

      if (rowHasError) badRowNumbers.add(n);
      rows.push({ rowNumber: n, salesman, values });
    });
  }
  checks.push({ label: "Numeric values are valid", ok: numericOk });

  if (colsOk && rows.length === 0) {
    issues.push({
      severity: "ERROR",
      sheet: SHEET_DATA,
      row: null,
      column: null,
      message: "No salesman rows found. Fill at least one row on the DATA sheet.",
    });
  }

  // ---------- ACTION PLAN ----------
  const actionRows: ActionRow[] = [];
  if (actionSheet) {
    const aIdx: Record<string, number> = {};
    actionSheet.getRow(1).eachCell((cell, idx) => {
      const h = norm(cellText(cell));
      const match = ACTION_METRICS.find((m) => norm(m.label) === h || norm(m.key) === h);
      if (match) aIdx[match.key] = idx;
    });

    actionSheet.eachRow((row, n) => {
      if (n === 1) return;
      const values: Record<string, string | null> = {};
      let filled = false;
      for (const m of ACTION_METRICS) {
        const idx = aIdx[m.key];
        const raw = idx ? row.getCell(idx).value : null;
        const text = m.kind === "DATE" ? toDateText(raw) : cellText({ value: raw } as ExcelJS.Cell).trim();
        values[m.key] = text || null;
        if (text) filled = true;
      }
      if (!filled) return;
      if (String(values["REMARKS"] ?? "").startsWith("Example row")) return;

      if (!values["PIC"]) {
        issues.push({
          severity: "WARNING",
          sheet: SHEET_ACTION,
          row: n,
          column: "PIC",
          message: "PIC is empty. Assign an owner so the item can be followed up.",
        });
      }
      const status = values["STATUS"];
      if (status && !ACTION_STATUS_OPTIONS.includes(status.toUpperCase())) {
        issues.push({
          severity: "WARNING",
          sheet: SHEET_ACTION,
          row: n,
          column: "STATUS",
          message: `"${status}" is not one of ${ACTION_STATUS_OPTIONS.join(", ")}. It will be imported as entered.`,
        });
      }
      actionRows.push({ rowNumber: n, values });
    });
  }

  // ---------- Roll-up ----------
  const totals: Record<string, number> = {};
  for (const m of NUMERIC_METRICS) {
    totals[m.key] = rows.reduce((sum, r) => sum + (r.values[m.key] ?? 0), 0);
  }

  const totalRows = rows.length + actionRows.length;
  const errorRows = badRowNumbers.size;
  const hasBlockingIssue = issues.some((i) => i.severity === "ERROR");

  return {
    meta: { branchCode, year, week },
    checks,
    rows,
    actionRows,
    issues,
    totalRows,
    validRows: totalRows - errorRows,
    errorRows,
    totals,
    canCommit: !hasBlockingIssue,
  };

  function fail(message: string): ParseResult {
    return {
      meta: { branchCode: null, year: null, week: null },
      checks: [{ label: "File is readable", ok: false }],
      rows: [],
      actionRows: [],
      issues: [{ severity: "ERROR", sheet: "-", row: null, column: null, message }],
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      totals: {},
      canCommit: false,
    };
  }
}

/* ------------------------------------------------------------------ */

function cellText(cell: ExcelJS.Cell): string {
  const v = cell?.value as unknown;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("text" in o) return String(o.text ?? "");
    if ("result" in o) return String(o.result ?? "");
    if ("richText" in o) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

function toNumber(v: unknown): number | "INVALID" {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : "INVALID";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return toNumber(o.result);
    if ("text" in o) return toNumber(o.text);
  }
  const s = String(v).trim().replace(/\s/g, "");
  if (!s) return 0;
  // Accept "1.234,56" (id-ID) and "1,234.56" (en-US).
  const cleaned = s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : "INVALID";
}

function toInt(v: unknown): number | null {
  const n = toNumber(v);
  return n === "INVALID" ? null : Math.trunc(n);
}

function toDateText(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.result instanceof Date) return (o.result as Date).toISOString().slice(0, 10);
    if ("text" in o) return String(o.text ?? "");
  }
  return String(v).trim();
}
