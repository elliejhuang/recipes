/**
 * Fills in estimated macros for recipes saved before estimates were stored.
 * Only touches rows that have no nutrition at all — anything published by a
 * source or typed in by hand is left alone.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNull } from "drizzle-orm";
import postgres from "postgres";
import { ingredients, recipes } from "../src/db/schema.ts";
import { estimateMacros } from "../src/lib/nutrition.ts";

const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(client);

const targets = await db
  .select({ id: recipes.id, title: recipes.title, servings: recipes.servings })
  .from(recipes)
  .where(isNull(recipes.calories));

for (const recipe of targets) {
  const rows = await db
    .select({
      name: ingredients.name,
      quantity: ingredients.quantity,
      unit: ingredients.unit,
    })
    .from(ingredients)
    .where(eq(ingredients.recipeId, recipe.id));

  const estimate = estimateMacros(rows, recipe.servings);
  if (estimate.matched === 0) {
    console.log(`skipped  ${recipe.title} — nothing recognisable to add up`);
    continue;
  }

  await db
    .update(recipes)
    .set({ ...estimate.perServing, nutritionSource: "estimated" })
    .where(eq(recipes.id, recipe.id));

  console.log(
    `estimated ${recipe.title} — ${estimate.perServing.calories} cal/serving ` +
      `(${estimate.matched}/${estimate.total} ingredients)`,
  );
}

await client.end();
console.log(`\nDone. ${targets.length} recipe(s) had no nutrition.`);
