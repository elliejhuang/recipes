import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

let instance: Database | null = null;

function connect(): Database {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL isn't set. Copy .env.example to .env.local, paste your Supabase connection string, then run `npm run db:setup`.",
    );
  }

  const client = postgres(url, {
    // Supabase's transaction pooler hands out a different backend per
    // statement, so prepared statements can't be cached across them.
    prepare: false,
    // Serverless invocations are short-lived; a big pool per instance just
    // burns connections that are never reused.
    max: 5,
    idle_timeout: 20,
  });

  instance = drizzle(client, { schema });
  return instance;
}

/**
 * Connecting lazily keeps `next build` working with no database in sight —
 * every page is dynamic, so nothing needs a connection until a request lands.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    return Reflect.get(connect(), property);
  },
});

export * from "./schema";
