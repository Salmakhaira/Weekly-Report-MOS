/**
 * Sales Branch Report Data Monitoring — initial schema (V0.1)
 *
 * ASSUMPTION: SQLite so the prototype runs with zero infrastructure. Drizzle keeps
 * the same table/column names on PostgreSQL — moving to Supabase means swapping
 * `sqlite-core` for `pg-core`, `text` ids stay, and `real` becomes `numeric`.
 */

import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

export const branches = sqliteTable("branches", {
  id: id(),
  code: text("code").notNull().unique(), // plant code, e.g. SMP
  name: text("name").notNull(), // e.g. SAMPIT
  region: text("region").notNull(),
  createdAt: createdAt(),
});

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // ASSUMPTION: plaintext, prototype only. Hash before any real deployment.
  password: text("password").notNull(),
  role: text("role", { enum: ["BRANCH", "HO", "ADMIN"] }).notNull(),
  branchId: text("branch_id").references(() => branches.id),
  createdAt: createdAt(),
});

export const reportPeriods = sqliteTable(
  "report_periods",
  {
    id: id(),
    year: integer("year").notNull(),
    week: integer("week").notNull(),
    month: integer("month").notNull(), // the monthly Excel tab this week belongs to
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["OPEN", "CLOSED"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ yearWeek: uniqueIndex("report_periods_year_week").on(t.year, t.week) })
);

export const weeklyReports = sqliteTable(
  "weekly_reports",
  {
    id: id(),
    branchId: text("branch_id").notNull().references(() => branches.id),
    reportPeriodId: text("report_period_id").notNull().references(() => reportPeriods.id),
    status: text("status", { enum: ["DRAFT", "SUBMITTED"] }).notNull(),
    submittedBy: text("submitted_by").references(() => users.id),
    submittedAt: integer("submitted_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({ branchPeriod: uniqueIndex("weekly_reports_branch_period").on(t.branchId, t.reportPeriodId) })
);

export const weeklyReportDetails = sqliteTable(
  "weekly_report_details",
  {
    id: id(),
    weeklyReportId: text("weekly_report_id").notNull().references(() => weeklyReports.id, { onDelete: "cascade" }),
    // null = branch-level. Salesman rows mirror the salesman rows in the Excel.
    salesman: text("salesman"),
    metricName: text("metric_name").notNull(),
    // ASSUMPTION: Rp juta (millions), matching the scale used in the source Excel.
    metricValue: real("metric_value"),
    metricText: text("metric_text"),
    metricType: text("metric_type", { enum: ["NUMBER", "TEXT", "DATE"] }).notNull(),
    source: text("source", { enum: ["EXCEL_UPLOAD", "FORM", "ADMIN_ADJUSTMENT"] }).notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    uniq: uniqueIndex("wrd_report_salesman_metric").on(t.weeklyReportId, t.salesman, t.metricName),
    byMetric: index("wrd_metric").on(t.metricName),
  })
);

export const importBatches = sqliteTable("import_batches", {
  id: id(),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  reportPeriodId: text("report_period_id").notNull().references(() => reportPeriods.id),
  fileName: text("file_name").notNull(),
  status: text("status", { enum: ["PENDING", "COMMITTED", "CANCELLED", "FAILED"] }).notNull(),
  totalRows: integer("total_rows").notNull(),
  validRows: integer("valid_rows").notNull(),
  errorRows: integer("error_rows").notNull(),
  // Parsed rows held here until the user confirms the preview.
  payload: text("payload").notNull(),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const changeLogs = sqliteTable(
  "change_logs",
  {
    id: id(),
    branchId: text("branch_id").notNull().references(() => branches.id),
    reportPeriodId: text("report_period_id").notNull().references(() => reportPeriods.id),
    weeklyReportId: text("weekly_report_id").references(() => weeklyReports.id),
    changedBy: text("changed_by").notNull().references(() => users.id),
    changedAt: integer("changed_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    salesman: text("salesman"),
    fieldChanged: text("field_changed").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    reason: text("reason").notNull(),
    source: text("source", { enum: ["FORM", "EXCEL_UPLOAD", "ADMIN_ADJUSTMENT"] }).notNull(),
  },
  (t) => ({ byBranchPeriod: index("change_logs_branch_period").on(t.branchId, t.reportPeriodId) })
);

/* ------------------------- relations ------------------------- */

export const branchRelations = relations(branches, ({ many }) => ({
  users: many(users),
  weeklyReports: many(weeklyReports),
  changeLogs: many(changeLogs),
}));

export const userRelations = relations(users, ({ one }) => ({
  branch: one(branches, { fields: [users.branchId], references: [branches.id] }),
}));

export const periodRelations = relations(reportPeriods, ({ many }) => ({
  weeklyReports: many(weeklyReports),
  changeLogs: many(changeLogs),
}));

export const weeklyReportRelations = relations(weeklyReports, ({ one, many }) => ({
  branch: one(branches, { fields: [weeklyReports.branchId], references: [branches.id] }),
  period: one(reportPeriods, { fields: [weeklyReports.reportPeriodId], references: [reportPeriods.id] }),
  submitter: one(users, { fields: [weeklyReports.submittedBy], references: [users.id] }),
  details: many(weeklyReportDetails),
  changeLogs: many(changeLogs),
}));

export const detailRelations = relations(weeklyReportDetails, ({ one }) => ({
  report: one(weeklyReports, { fields: [weeklyReportDetails.weeklyReportId], references: [weeklyReports.id] }),
}));

export const changeLogRelations = relations(changeLogs, ({ one }) => ({
  branch: one(branches, { fields: [changeLogs.branchId], references: [branches.id] }),
  period: one(reportPeriods, { fields: [changeLogs.reportPeriodId], references: [reportPeriods.id] }),
  report: one(weeklyReports, { fields: [changeLogs.weeklyReportId], references: [weeklyReports.id] }),
  changer: one(users, { fields: [changeLogs.changedBy], references: [users.id] }),
}));

export const importBatchRelations = relations(importBatches, ({ one }) => ({
  branch: one(branches, { fields: [importBatches.branchId], references: [branches.id] }),
  period: one(reportPeriods, { fields: [importBatches.reportPeriodId], references: [reportPeriods.id] }),
  uploader: one(users, { fields: [importBatches.uploadedBy], references: [users.id] }),
}));

export type Branch = typeof branches.$inferSelect;
export type User = typeof users.$inferSelect;
export type ReportPeriod = typeof reportPeriods.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type WeeklyReportDetail = typeof weeklyReportDetails.$inferSelect;
export type ChangeLog = typeof changeLogs.$inferSelect;
