import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

type DatabaseGlobal = typeof globalThis & {
  __counterosSqlite?: Database.Database;
};

function sqlitePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./local-dev/dev.db";
  return databaseUrl.startsWith("file:")
    ? databaseUrl.replace("file:", "")
    : databaseUrl;
}

const globalForDb = globalThis as DatabaseGlobal;

const sqlite =
  globalForDb.__counterosSqlite ??
  new Database(sqlitePath());

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  globalForDb.__counterosSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
