import { photosEnabled } from "@/lib/supabase";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

/**
 * Also the share target. A shortcut on the phone sends a link here as ?url=,
 * and the client runs the import on arrival so sharing a pin is one tap.
 */
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; text?: string }>;
}) {
  const params = await searchParams;
  return (
    <ImportClient
      initialUrl={params.url ?? ""}
      initialText={params.text ?? ""}
      uploadsEnabled={photosEnabled()}
    />
  );
}
