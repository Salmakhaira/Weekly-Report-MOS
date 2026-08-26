import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL?.replace(/^file:/, "") ?? path.join(process.cwd(), "data", "app.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof open> };

export const db = globalForDb.__db ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export { schema };
export * from "./schema";
