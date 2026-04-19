import { defineConfig } from "drizzle-kit";

function sqlitePath() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./local-dev/dev.db";
  return databaseUrl.startsWith("file:")
    ? databaseUrl.replace("file:", "")
    : databaseUrl;
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: sqlitePath()
  }
});
