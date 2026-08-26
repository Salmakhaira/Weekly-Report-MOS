import ExcelJS from "exceljs";
import { NUMERIC_METRICS, ACTION_METRICS, ACTION_STATUS_OPTIONS } from "@/lib/metrics";

export const SHEET_META = "META";
export const SHEET_DATA = "DATA";
export const SHEET_ACTION = "ACTION PLAN";

const HEAD_FILL = "FFE2E8F0";
const INPUT_FILL = "FFFFF7D6";

export interface TemplateArgs {
  branchCode: string;
  branchName: string;
  year: number;
  week: number;
  salesmen: string[];
}

/**
 * Builds the branch upload template. The META sheet is what lets the server
 * confirm the file belongs to the branch and period the user selected, instead
 * of trusting the file name.
 */
export async function buildTemplate(args: TemplateArgs): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sales Report Monitoring";
  wb.created = new Date();

  // ---------- META ----------
  const meta = wb.addWorksheet(SHEET_META);
  meta.columns = [
    { header: "FIELD", key: "field", width: 22 },
    { header: "VALUE", key: "value", width: 30 },
    { header: "NOTE", key: "note", width: 58 },
  ];
  styleHeader(meta.getRow(1));
  const metaRows: [string, string | number, string][] = [
    ["BRANCH_CODE", args.branchCode, "Do not edit. Must match the branch you upload for."],
    ["BRANCH_NAME", args.branchName, "Do not edit."],
    ["YEAR", args.year, "Do not edit."],
    ["WEEK", args.week, "Do not edit. Must match the reporting period you select."],
    ["UNIT", "Rp juta", "All numbers on the DATA sheet are in millions of rupiah."],
  ];
  metaRows.forEach((r) => meta.addRow({ field: r[0], value: r[1], note: r[2] }));
  meta.addRow([]);
  meta.addRow(["HOW TO FILL", "", ""]).font = { bold: true };
  [
    "1. Fill one row per salesman on the DATA sheet. Yellow cells are yours to edit.",
    "2. Numbers only on DATA — no text, no formulas, no thousand separators.",
    "3. Leave a cell blank if there is nothing to report; blank is read as 0.",
    "4. Do not add, rename, reorder or delete columns.",
    "5. Fill the ACTION PLAN sheet for issues that need follow-up. It may be left empty.",
    "6. Upload the saved file on the Upload Weekly Report page.",
  ].forEach((t) => meta.addRow(["", t, ""]));

  // ---------- DATA ----------
  const data = wb.addWorksheet(SHEET_DATA);
  data.columns = [
    { header: "SALESMAN", key: "salesman", width: 34 },
    ...NUMERIC_METRICS.map((m) => ({ header: m.label.toUpperCase(), key: m.key, width: 18 })),
  ];
  styleHeader(data.getRow(1));
  data.getRow(1).height = 28;

  const names = args.salesmen.length ? args.salesmen : ["EXAMPLE SALESMAN"];
  names.forEach((name, i) => {
    const row = data.addRow({ salesman: name });
    NUMERIC_METRICS.forEach((m) => {
      const cell = row.getCell(m.key);
      // One filled example row so the expected format is unambiguous.
      cell.value = i === 0 ? EXAMPLE_VALUES[m.key] ?? 0 : null;
      cell.numFmt = "#,##0.00";
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
    });
  });
  data.addRow([]);
  data.addRow(["Row 2 is filled in as a format example — replace it with your real figures."]).font = {
    italic: true,
    color: { argb: "FF64748B" },
  };
  data.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  // ---------- ACTION PLAN ----------
  const action = wb.addWorksheet(SHEET_ACTION);
  action.columns = ACTION_METRICS.map((m) => ({
    header: m.label.toUpperCase(),
    key: m.key,
    width: m.kind === "TEXT" ? 40 : 16,
  }));
  styleHeader(action.getRow(1));
  const example = action.addRow({
    PROBLEM_IDENTIFICATION: "Delivery of main product delayed, ETA not confirmed",
    CORRECTIVE_ACTION: "Escalate to supply planning, confirm ETA weekly",
    PIC: "ANDREW NOFENESIA",
    DUE_DATE: new Date(Date.UTC(args.year, 8, 5)),
    STATUS: "ON PROGRESS",
    REMARKS: "Example row — replace or delete",
  });
  example.getCell("DUE_DATE").numFmt = "yyyy-mm-dd";
  for (let r = 2; r <= 20; r++) {
    const row = action.getRow(r);
    ACTION_METRICS.forEach((m) => {
      const c = row.getCell(m.key);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
      c.alignment = { vertical: "top", wrapText: m.kind === "TEXT" };
      if (m.kind === "DATE") c.numFmt = "yyyy-mm-dd";
    });
    row.getCell("STATUS").dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${ACTION_STATUS_OPTIONS.join(",")}"`],
    };
  }
  action.views = [{ state: "frozen", ySplit: 1 }];

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

const EXAMPLE_VALUES: Record<string, number> = {
  PLAN_SALES: 3549,
  LIVE_QUOTATION: 1250.5,
  ACTUAL_PRTM: 349.05,
  PO: 3461.87,
  POCO: 727.98,
  ACTUAL_SALES: 3086.1,
  OUTLOOK_REVENUE: 1540.51,
  BACK_ORDER: 2191.45,
};

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FF0F172A" } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF94A3B8" } } };
  });
}

export function templateFileName(branchCode: string, year: number, week: number) {
  return `${branchCode}_W${String(week).padStart(2, "0")}_${year}.xlsx`;
}
