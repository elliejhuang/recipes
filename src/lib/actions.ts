"use server";

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  groceryItems,
  ingredients,
  mealPlanEntries,
  recipes,
  steps,
} from "@/db/schema";
import { aggregateGroceries } from "./aggregate-groceries";
import { categorize } from "./aisles";
import { addDays } from "./dates";
import { getWeekIngredients } from "./queries";
import { parseIngredientLine } from "./parse-ingredient";

export type RecipeInput = {
  id?: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  servings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  tags: string[];
  notes?: string | null;
  ingredientLines: string[];
  stepLines: string[];
  nutrition?: {
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    fiberG: number | null;
    sugarG: number | null;
    sodiumMg: number | null;
  } | null;
  nutritionSource?: string | null;
};

/**
 * Ingredient and step lines arrive as free text from every entry point — the
 * manual form, the import review screen, a paste. Parsing happens here so a
 * recipe is stored the same way no matter how it got in.
 */
async function writeLines(recipeId: number, input: RecipeInput) {
  await db.delete(ingredients).where(eq(ingredients.recipeId, recipeId));
  await db.delete(steps).where(eq(steps.recipeId, recipeId));

  const ingredientRows = input.ingredientLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parsed = parseIngredientLine(line);
      return {
        recipeId,
        position: index,
        raw: parsed.raw,
        quantity: parsed.quantity,
        unit: parsed.unit,
        name: parsed.name,
        note: parsed.note,
        section: null,
      };
    });

  const stepRows = input.stepLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({ recipeId, position: index, text, section: null }));

  if (ingredientRows.length) await db.insert(ingredients).values(ingredientRows);
  if (stepRows.length) await db.insert(steps).values(stepRows);
}

export async function saveRecipe(input: RecipeInput): Promise<number> {
  const base = {
    title: input.title.trim() || "Untitled recipe",
    description: input.description?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    sourceName: input.sourceName?.trim() || null,
    servings: Math.max(1, Math.round(input.servings || 1)),
    prepMinutes: input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes ?? null,
    tags: input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
    notes: input.notes?.trim() || null,
    calories: input.nutrition?.calories ?? null,
    proteinG: input.nutrition?.proteinG ?? null,
    carbsG: input.nutrition?.carbsG ?? null,
    fatG: input.nutrition?.fatG ?? null,
    fiberG: input.nutrition?.fiberG ?? null,
    sugarG: input.nutrition?.sugarG ?? null,
    sodiumMg: input.nutrition?.sodiumMg ?? null,
    nutritionSource: input.nutritionSource ?? null,
    updatedAt: new Date(),
  };

  let recipeId: number;

  if (input.id) {
    await db.update(recipes).set(base).where(eq(recipes.id, input.id));
    recipeId = input.id;
  } else {
    const [row] = await db.insert(recipes).values(base).returning({ id: recipes.id });
    recipeId = row.id;
  }

  await writeLines(recipeId, input);

  revalidatePath("/");
  revalidatePath(`/recipes/${recipeId}`);
  return recipeId;
}

export async function deleteRecipe(id: number) {
  await db.delete(recipes).where(eq(recipes.id, id));
  revalidatePath("/");
  redirect("/");
}

export async function toggleFavorite(id: number, value: boolean) {
  await db.update(recipes).set({ isFavorite: value }).where(eq(recipes.id, id));
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
}

/* ---------------------------------------------------------------- plan --- */

export async function addToPlan(input: {
  recipeId: number;
  date: string;
  meal: string;
  servings?: number;
}) {
  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${mealPlanEntries.position}), -1)::int` })
    .from(mealPlanEntries)
    .where(
      and(eq(mealPlanEntries.date, input.date), eq(mealPlanEntries.meal, input.meal)),
    );

  await db.insert(mealPlanEntries).values({
    recipeId: input.recipeId,
    date: input.date,
    meal: input.meal,
    servings: input.servings ?? 1,
    position: max + 1,
  });

  revalidatePath("/plan");
}

export async function removeFromPlan(id: number) {
  await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, id));
  revalidatePath("/plan");
}

export async function updatePlanServings(id: number, servings: number) {
  await db
    .update(mealPlanEntries)
    .set({ servings: Math.max(0.25, servings) })
    .where(eq(mealPlanEntries.id, id));
  revalidatePath("/plan");
}

export async function movePlanEntry(id: number, date: string, meal: string) {
  await db.update(mealPlanEntries).set({ date, meal }).where(eq(mealPlanEntries.id, id));
  revalidatePath("/plan");
}

export async function clearWeek(weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  await db
    .delete(mealPlanEntries)
    .where(and(gte(mealPlanEntries.date, weekStart), lte(mealPlanEntries.date, weekEnd)));
  revalidatePath("/plan");
}

/* ------------------------------------------------------------- grocery --- */

/**
 * Rebuilds the shopping list from the week's plan.
 *
 * Quantities are summed within a unit family, so half a cup here and two
 * tablespoons there become one line, while "2 cans tomatoes" stays countable.
 * Anything you added by hand survives, and so do your checkmarks on items that
 * are still on the list — regenerating after tweaking the plan shouldn't cost
 * you the aisles you already walked.
 */
export async function generateGroceryList(weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  const rows = await getWeekIngredients(weekStart, weekEnd);

  const existing = await db
    .select()
    .from(groceryItems)
    .where(eq(groceryItems.weekStart, weekStart));

  // Regenerating after a tweak to the plan shouldn't cost you the aisles
  // you already walked, so carry checkmarks over by name.
  const previouslyChecked = new Set(
    existing.filter((item) => item.checked).map((item) => item.name.toLowerCase()),
  );

  const generated = aggregateGroceries(
    rows.map((row) => ({
      name: row.ingredient.name,
      quantity: row.ingredient.quantity,
      unit: row.ingredient.unit,
      recipeTitle: row.recipeTitle,
      recipeServings: row.recipeServings,
      planServings: row.planServings,
    })),
  ).map((item) => ({
    ...item,
    weekStart,
    checked: previouslyChecked.has(item.name.toLowerCase()),
    isManual: false,
  }));

  // Replace only what we generated last time; hand-added items are yours.
  await db
    .delete(groceryItems)
    .where(
      and(eq(groceryItems.weekStart, weekStart), eq(groceryItems.isManual, false)),
    );

  if (generated.length) await db.insert(groceryItems).values(generated);

  revalidatePath("/list");
}

export async function addGroceryItem(weekStart: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const parsed = parseIngredientLine(trimmed);
  await db.insert(groceryItems).values({
    weekStart,
    name: parsed.name ?? trimmed,
    quantity: parsed.quantity,
    unit: parsed.unit,
    aisle: categorize(parsed.name ?? trimmed),
    detail: null,
    isManual: true,
  });
  revalidatePath("/list");
}

export async function toggleGroceryItem(id: number, checked: boolean) {
  await db.update(groceryItems).set({ checked }).where(eq(groceryItems.id, id));
  revalidatePath("/list");
}

export async function deleteGroceryItem(id: number) {
  await db.delete(groceryItems).where(eq(groceryItems.id, id));
  revalidatePath("/list");
}

export async function clearCheckedGroceryItems(weekStart: string) {
  await db
    .delete(groceryItems)
    .where(and(eq(groceryItems.weekStart, weekStart), eq(groceryItems.checked, true)));
  revalidatePath("/list");
}
