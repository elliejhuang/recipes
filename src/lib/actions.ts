"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  folders,
  groceryItems,
  groceryLists,
  ingredients,
  photos,
  planItems,
  recipeFolders,
  recipes,
} from "@/db/schema";
import { aggregateGroceries } from "./aggregate-groceries";
import { estimateMacros } from "./nutrition";
import { parseIngredientLine } from "./parse-ingredient";
import { ensureAutoList, getPlanIngredients } from "./queries";

export type RecipeInput = {
  id?: number;
  title: string;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  servings: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  tags?: string[];
  method?: string | null;
  notes?: string | null;
  ingredientLines: string[];
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
 * Ingredient lines arrive as free text from every entry point — the manual
 * form, the import review screen, a paste. Parsing happens here so a recipe is
 * stored the same way no matter how it got in.
 */
async function writeIngredients(recipeId: number, lines: string[]) {
  await db.delete(ingredients).where(eq(ingredients.recipeId, recipeId));

  const rows = lines
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

  if (rows.length) await db.insert(ingredients).values(rows);
}

export async function saveRecipe(input: RecipeInput): Promise<number> {
  // When a recipe arrives with no nutrition at all, fall back to an estimate
  // from the ingredients, so a recipe never shows nothing while its ingredient
  // list says plenty.
  let nutrition = input.nutrition ?? null;
  let nutritionSource = input.nutritionSource ?? null;

  const hasNutrition =
    nutrition !== null && Object.values(nutrition).some((v) => v !== null);

  // Re-estimate whenever the numbers came from an estimate in the first place,
  // not just when they're missing — otherwise editing the ingredients of a
  // recipe you typed in leaves the old estimate sitting there, quietly wrong.
  if (!hasNutrition || nutritionSource === "estimated") {
    const estimate = estimateMacros(
      input.ingredientLines.map(parseIngredientLine),
      input.servings,
    );
    if (estimate.matched > 0) {
      nutrition = estimate.perServing;
      nutritionSource = "estimated";
    }
  }

  const base = {
    title: input.title.trim() || "Untitled recipe",
    imageUrl: input.imageUrl?.trim() || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    sourceName: input.sourceName?.trim() || null,
    servings: Math.max(1, Math.round(input.servings || 1)),
    prepMinutes: input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes ?? null,
    tags: (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    method: input.method?.trim() || null,
    notes: input.notes?.trim() || null,
    calories: nutrition?.calories ?? null,
    proteinG: nutrition?.proteinG ?? null,
    carbsG: nutrition?.carbsG ?? null,
    fatG: nutrition?.fatG ?? null,
    fiberG: nutrition?.fiberG ?? null,
    sugarG: nutrition?.sugarG ?? null,
    sodiumMg: nutrition?.sodiumMg ?? null,
    nutritionSource,
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

  await writeIngredients(recipeId, input.ingredientLines);
  await rebuildAutoList();

  revalidatePath("/");
  revalidatePath(`/recipes/${recipeId}`);
  return recipeId;
}

/** Inline edits from the recipe page, which never round-trip the whole form. */
export async function updateRecipeField(
  id: number,
  field: "method" | "notes" | "title",
  value: string,
) {
  const trimmed = value.trim();
  await db
    .update(recipes)
    .set({
      ...(field === "method" ? { method: trimmed || null } : {}),
      ...(field === "notes" ? { notes: trimmed || null } : {}),
      ...(field === "title" ? { title: trimmed || "Untitled recipe" } : {}),
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, id));
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/");
}

export async function deleteRecipe(id: number) {
  await db.delete(recipes).where(eq(recipes.id, id));
  await rebuildAutoList();
  revalidatePath("/");
  redirect("/");
}

export async function toggleFavorite(id: number, value: boolean) {
  await db.update(recipes).set({ isFavorite: value }).where(eq(recipes.id, id));
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
}

/**
 * Makes your own version of a recipe: everything copied, nothing shared, so
 * amounts and method can diverge while the imported original stays put.
 */
export async function forkRecipe(id: number): Promise<number> {
  const [source] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!source) throw new Error("That recipe doesn't exist.");

  const sourceIngredients = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.recipeId, id))
    .orderBy(ingredients.position);

  const [copy] = await db
    .insert(recipes)
    .values({
      title: source.title,
      imageUrl: source.imageUrl,
      sourceUrl: source.sourceUrl,
      sourceName: source.sourceName,
      servings: source.servings,
      prepMinutes: source.prepMinutes,
      cookMinutes: source.cookMinutes,
      tags: source.tags,
      method: source.method,
      notes: source.notes,
      calories: source.calories,
      proteinG: source.proteinG,
      carbsG: source.carbsG,
      fatG: source.fatG,
      fiberG: source.fiberG,
      sugarG: source.sugarG,
      sodiumMg: source.sodiumMg,
      nutritionSource: source.nutritionSource,
      forkedFromId: source.id,
    })
    .returning({ id: recipes.id });

  if (sourceIngredients.length) {
    await db.insert(ingredients).values(
      sourceIngredients.map((row) => ({
        recipeId: copy.id,
        position: row.position,
        raw: row.raw,
        quantity: row.quantity,
        unit: row.unit,
        name: row.name,
        note: row.note,
        section: row.section,
      })),
    );
  }

  revalidatePath("/");
  return copy.id;
}

/* -------------------------------------------------------------- folders --- */

export async function createFolder(name: string): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the folder a name.");

  const [{ next }] = await db
    .select({ next: sql<number>`(COALESCE(MAX(${folders.position}), -1) + 1)::int` })
    .from(folders);

  const [row] = await db
    .insert(folders)
    .values({ name: trimmed, position: next })
    .returning({ id: folders.id });

  revalidatePath("/");
  return row.id;
}

export async function renameFolder(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(folders).set({ name: trimmed }).where(eq(folders.id, id));
  revalidatePath("/");
}

export async function deleteFolder(id: number) {
  // Only the grouping goes; the recipes filed under it are untouched.
  await db.delete(folders).where(eq(folders.id, id));
  revalidatePath("/");
}

export async function setRecipeFolders(recipeId: number, folderIds: number[]) {
  await db.delete(recipeFolders).where(eq(recipeFolders.recipeId, recipeId));
  if (folderIds.length) {
    await db
      .insert(recipeFolders)
      .values(folderIds.map((folderId) => ({ recipeId, folderId })));
  }
  revalidatePath("/");
  revalidatePath(`/recipes/${recipeId}`);
}

/* ----------------------------------------------------------------- plan --- */

export async function addToPlan(recipeId: number) {
  const [existing] = await db
    .select({ id: planItems.id })
    .from(planItems)
    .where(eq(planItems.recipeId, recipeId))
    .limit(1);
  if (existing) return;

  const [{ next }] = await db
    .select({ next: sql<number>`(COALESCE(MAX(${planItems.position}), -1) + 1)::int` })
    .from(planItems);

  await db.insert(planItems).values({ recipeId, position: next });
  await rebuildAutoList();

  revalidatePath("/plan");
  revalidatePath("/list");
  revalidatePath(`/recipes/${recipeId}`);
}

export async function removeFromPlan(recipeId: number) {
  await db.delete(planItems).where(eq(planItems.recipeId, recipeId));
  await rebuildAutoList();

  revalidatePath("/plan");
  revalidatePath("/list");
  revalidatePath(`/recipes/${recipeId}`);
}

export async function clearPlan() {
  await db.delete(planItems);
  await rebuildAutoList();
  revalidatePath("/plan");
  revalidatePath("/list");
}

/* ------------------------------------------------------------ groceries --- */

/**
 * Rebuilds the auto list from the plan.
 *
 * Runs on every change to the plan rather than behind a button, so the list is
 * simply correct whenever you look at it. Hand-added items survive, and so do
 * checkmarks on items still needed — changing the plan shouldn't cost you the
 * aisles you already walked.
 */
export async function rebuildAutoList() {
  const list = await ensureAutoList();
  const rows = await getPlanIngredients();

  const existing = await db
    .select()
    .from(groceryItems)
    .where(eq(groceryItems.listId, list.id));

  const previouslyChecked = new Set(
    existing.filter((item) => item.checked).map((item) => item.name.toLowerCase()),
  );

  const generated = aggregateGroceries(rows).map((item, index) => ({
    listId: list.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    detail: item.detail,
    position: index,
    checked: previouslyChecked.has(item.name.toLowerCase()),
    isManual: false,
  }));

  await db
    .delete(groceryItems)
    .where(and(eq(groceryItems.listId, list.id), eq(groceryItems.isManual, false)));

  if (generated.length) await db.insert(groceryItems).values(generated);

  revalidatePath("/list");
}

export async function createGroceryList(name: string): Promise<number> {
  const trimmed = name.trim() || "New list";

  const [{ next }] = await db
    .select({ next: sql<number>`(COALESCE(MAX(${groceryLists.position}), -1) + 1)::int` })
    .from(groceryLists);

  const [row] = await db
    .insert(groceryLists)
    .values({ name: trimmed, isAuto: false, position: next })
    .returning({ id: groceryLists.id });

  revalidatePath("/list");
  return row.id;
}

export async function renameGroceryList(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(groceryLists).set({ name: trimmed }).where(eq(groceryLists.id, id));
  revalidatePath("/list");
}

export async function deleteGroceryList(id: number) {
  const [list] = await db.select().from(groceryLists).where(eq(groceryLists.id, id));
  // The auto list is the one that's always there; deleting it would only
  // recreate itself on the next plan change, emptier.
  if (!list || list.isAuto) return;

  await db.delete(groceryLists).where(eq(groceryLists.id, id));
  revalidatePath("/list");
}

export async function addGroceryItem(listId: number, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const [{ next }] = await db
    .select({ next: sql<number>`(COALESCE(MAX(${groceryItems.position}), -1) + 1)::int` })
    .from(groceryItems)
    .where(eq(groceryItems.listId, listId));

  const parsed = parseIngredientLine(trimmed);

  await db.insert(groceryItems).values({
    listId,
    name: parsed.name ?? trimmed,
    quantity: parsed.quantity,
    unit: parsed.unit,
    detail: null,
    position: next,
    isManual: true,
  });

  revalidatePath("/list");
}

export async function toggleGroceryItem(id: number, checked: boolean) {
  await db.update(groceryItems).set({ checked }).where(eq(groceryItems.id, id));
  revalidatePath("/list");
}

export async function renameGroceryItem(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(groceryItems).set({ name: trimmed }).where(eq(groceryItems.id, id));
  revalidatePath("/list");
}

export async function deleteGroceryItem(id: number) {
  await db.delete(groceryItems).where(eq(groceryItems.id, id));
  revalidatePath("/list");
}

export async function clearCheckedItems(listId: number) {
  await db
    .delete(groceryItems)
    .where(and(eq(groceryItems.listId, listId), eq(groceryItems.checked, true)));
  revalidatePath("/list");
}

/* -------------------------------------------------------------- photos --- */

export async function setCoverPhoto(photoId: number, recipeId: number) {
  await db
    .update(photos)
    .set({ isCover: false })
    .where(and(eq(photos.recipeId, recipeId), eq(photos.isCover, true)));
  await db.update(photos).set({ isCover: true }).where(eq(photos.id, photoId));

  revalidatePath("/");
  revalidatePath(`/recipes/${recipeId}`);
}

export async function updatePhotoCaption(
  photoId: number,
  recipeId: number,
  caption: string,
) {
  await db
    .update(photos)
    .set({ caption: caption.trim() || null })
    .where(eq(photos.id, photoId));
  revalidatePath(`/recipes/${recipeId}`);
}
