/**
 * Creates the tables in the database named by DATABASE_URL, then makes sure
 * the storage bucket recipe photos live in exists.
 *
 * Safe to re-run — applied migrations are skipped and an existing bucket is
 * left alone.
 */
// Next reads .env.local; a plain script has to be told to. Later files don't
// override earlier ones, so .env.local wins, matching Next's precedence.
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { PHOTO_BUCKET, createAdminClient } from "../src/lib/supabase.ts";

// Migrations need a session, not the transaction pooler: DDL inside a
// transaction has to keep every statement on the same backend.
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error(
    "DATABASE_URL isn't set.\n\n" +
      "  1. Create a project at https://supabase.com (free, no card)\n" +
      "  2. Settings → Database → Connection string → Transaction pooler\n" +
      "  3. Put it in .env.local as DATABASE_URL=\"…\"\n" +
      "  4. Run this again\n",
  );
  process.exit(1);
}

// Migrations run over a direct connection rather than the pooler, because
// DDL in a transaction needs the same backend for every statement.
const client = postgres(url, { max: 1, prepare: false });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.end();
console.log("Tables are ready.");

try {
  const admin = createAdminClient();
  const { data: buckets } = await admin.storage.listBuckets();

  if (buckets?.some((bucket) => bucket.name === PHOTO_BUCKET)) {
    console.log(`Storage bucket "${PHOTO_BUCKET}" already exists.`);
  } else {
    const { error } = await admin.storage.createBucket(PHOTO_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"],
    });
    if (error) throw error;
    console.log(`Storage bucket "${PHOTO_BUCKET}" created.`);
  }
} catch (error) {
  console.warn(
    `\nCouldn't set up the photo bucket: ${
      error instanceof Error ? error.message : error
    }\nEverything else works; add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and re-run to enable photo uploads.`,
  );
}
