import { NextResponse } from "next/server";
import { importRecipeFromUrl } from "@/lib/import-recipe";

// cheerio and the outbound fetch both need the Node runtime.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let url: string;
  try {
    const body = await request.json();
    url = String(body.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a url." }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: "Paste a link first." }, { status: 400 });
  }

  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const recipe = await importRecipeFromUrl(normalized);
    return NextResponse.json({ recipe });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Couldn't read that page.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
