import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

function connect(): Database {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL isn't set. Copy .env.example to .env.local, paste your Neon connection string, then run `npm run db:setup`.",
    );
  }

  instance = drizzle(neon(url), { schema });
  return instance;
}

/**
 * Connecting lazily keeps `next build` working with no database in sight —
 * every page is dynamic, so nothing needs a connection until a request lands.
 *
 * Neon's HTTP driver is stateless, which matters more than it sounds: Next
 * runs dev and production requests across several worker processes, and
 * anything holding a local connection or an embedded database would give each
 * worker its own divergent copy of the data.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    return Reflect.get(connect(), property);
  },
});

export * from "./schema";
