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

  // Supabase's direct host publishes an AAAA record and no A record, so it is
  // reachable only over IPv6. On a network whose IPv6 route comes and goes,
  // that surfaces as `getaddrinfo ENOTFOUND` wrapped in a "Failed query"
  // message that points at whichever query happened to run first — which reads
  // like a SQL bug and isn't one. Fail with something legible instead.
  if (/^db\.[^.]+\.supabase\.co$/.test(new URL(url).hostname)) {
    throw new Error(
      "DATABASE_URL points at Supabase's direct host, which is IPv6-only and " +
        "unreachable from most networks and from Vercel. Use the transaction " +
        "pooler instead: Dashboard → Connect → Transaction pooler " +
        "(aws-0-<region>.pooler.supabase.com:6543).",
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
