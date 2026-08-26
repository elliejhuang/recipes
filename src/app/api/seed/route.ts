import { NextResponse } from "next/server";
import { saveRecipe } from "@/lib/actions";
import type { ImportedRecipe } from "@/lib/import-recipe";

// Development convenience for loading a batch of recipes without clicking
// through the import screen once per link.
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const recipe = (await request.json()) as ImportedRecipe;
  const id = await saveRecipe({
    title: recipe.title,
    imageUrl: recipe.imageUrl,
    sourceUrl: recipe.sourceUrl,
    sourceName: recipe.sourceName,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    tags: recipe.tags,
    ingredientLines: recipe.ingredientLines,
    method: recipe.stepLines.join("\n"),
    notes: null,
    nutrition: recipe.nutrition,
    nutritionSource: recipe.nutrition ? "imported" : null,
  });
  return NextResponse.json({ id });
}
