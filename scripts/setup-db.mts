/**
 * Creates the tables in the database named by DATABASE_URL.
 * Safe to re-run — migrations that have already been applied are skipped.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error(
    "DATABASE_URL isn't set.\n\n" +
      "  1. Sign up at https://neon.tech (free, no card)\n" +
      "  2. Create a project and copy the pooled connection string\n" +
      "  3. Put it in .env.local as DATABASE_URL=\"…\"\n" +
      "  4. Run this again\n",
  );
  process.exit(1);
}

await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
console.log("Tables are ready.");
