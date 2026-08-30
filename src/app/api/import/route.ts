import { NextResponse } from "next/server";
import {
  NeedsCaptionError,
  detectSource,
  importFromPinterest,
  importRecipeFromUrl,
  type ImportedRecipe,
} from "@/lib/import-recipe";
import { parseFreeText } from "@/lib/parse-freetext";

// cheerio and the outbound fetch both need the Node runtime.
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Takes either a link or a blob of text.
 *
 * A link is routed by where it points: a recipe site is read from its
 * schema.org markup, a Pinterest pin is resolved to the blog it links to, and
 * Instagram is refused with an explanation, because a logged-out request gets a
 * login wall and nothing else.
 *
 * Text is parsed by shape — that's the Instagram path, and the fallback for
 * anything else that won't give its recipe up.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const rawUrl = String(body.url ?? "").trim();
  const text = String(body.text ?? "").trim();

  if (text) return fromText(text, rawUrl);
  if (!rawUrl) return NextResponse.json({ error: "Paste a link first." }, { status: 400 });

  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  let source: ReturnType<typeof detectSource>;
  try {
    source = detectSource(url);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a link." }, { status: 400 });
  }

  try {
    if (source === "instagram") throw new NeedsCaptionError(url);

    const recipe =
      source === "pinterest"
        ? await importFromPinterest(url)
        : await importRecipeFromUrl(url);

    return NextResponse.json({ recipe, source });
  } catch (error) {
    if (error instanceof NeedsCaptionError) {
      return NextResponse.json(
        { error: error.message, needsCaption: true, sourceUrl: error.sourceUrl },
        { status: 422 },
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Couldn't read that page.",
        // Pasting the text is always the way out.
        needsCaption: true,
        sourceUrl: url,
      },
      { status: 422 },
    );
  }
}

function fromText(text: string, sourceUrl: string) {
  const parsed = parseFreeText(text);

  if (!parsed.ingredientLines.length && !parsed.methodLines.length) {
    return NextResponse.json(
      {
        error:
          "Couldn't find ingredients or steps in that. Ingredients usually sit one per line with an amount in front.",
      },
      { status: 422 },
    );
  }

  let sourceName: string | null = null;
  if (sourceUrl) {
    try {
      sourceName = new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      sourceName = null;
    }
  }

  const recipe: ImportedRecipe = {
    title: parsed.title ?? "Untitled recipe",
    description: null,
    imageUrl: null,
    sourceUrl,
    sourceName,
    servings: 4,
    prepMinutes: null,
    cookMinutes: null,
    tags: [],
    ingredientLines: parsed.ingredientLines,
    stepLines: parsed.methodLines,
    nutrition: null,
  };

  return NextResponse.json({ recipe, source: "text" });
}
