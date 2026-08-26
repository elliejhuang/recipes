import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "recipe-photos";

/**
 * Server-side client. The service role key bypasses row-level security, so
 * this must only ever be constructed on the server — never imported into a
 * Client Component.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Photo uploads need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Whether photo uploads are configured, so the UI can say so plainly. */
export function photosEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
