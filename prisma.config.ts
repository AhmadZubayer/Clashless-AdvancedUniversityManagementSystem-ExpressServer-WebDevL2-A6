// Prisma CLI configuration. It must not import the application config: that config
// requires every runtime secret, but `prisma generate` also runs during `npm install`
// on hosts (such as Vercel) where those variables may not be set yet.
import dotenv from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

dotenv.config({
  path: path.join(
    process.cwd(),
    process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  ),
  quiet: true,
});

const databaseUrl = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL)
  : undefined;

if (process.env.NODE_ENV === "test") {
  if (
    process.env.DATABASE_SCHEMA !== "clashless_test" ||
    process.env.REDIS_KEY_PREFIX !== "clashless:test:"
  )
    throw new Error("Tests require isolated database schema and Redis prefix");
  databaseUrl?.searchParams.set("schema", "clashless_test");
}

// `prisma generate` does not connect, so it may run without a database URL.
const generating = process.argv.includes("generate");
if (!databaseUrl && !generating)
  throw new Error("Missing environment variable: DATABASE_URL");

export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl?.toString() ?? "postgresql://placeholder@localhost:5432/placeholder",
  },
});
