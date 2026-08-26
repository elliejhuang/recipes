import {
  and, asc, desc, eq, exists, getTableColumns, gte, ilike, inArray, lte, or, sql,
} from "drizzle-orm";
import { batchesNeeded } from "./aggregate-groceries";
import { db } from "@/db";
import {
  groceryItems,
  ingredients,
  mealPlanEntries,
  photos,
  recipes,
  steps,
  type Ingredient,
  type Photo,
  type Recipe,
  type Step,
} from "@/db/schema";

export type FullRecipe = Recipe & {
  ingredients: Ingredient[];
  steps: Step[];
  photos: Photo[];
  /** The recipe this was adapted from, if any. */
  forkedFrom: { id: number; title: string } | null;
  /** Versions of this recipe you've made yourself. */
  forks: { id: number; title: string }[];
};

/** A recipe plus whichever photo should represent it in a list. */
export type RecipeWithCover = Recipe & { coverPhotoUrl: string | null };

/**
 * One photo per recipe — the cover if you picked one, otherwise the first.
 *
 * Built as a joinable subquery rather than a correlated one written by hand:
 * inside a raw `sql` template drizzle emits column references unqualified, so
 * `photos.recipe_id = recipes.id` came out as `p.recipe_id = "id"`, which
 * Postgres happily resolved against the *inner* table. Every recipe got the
 * same photo and nothing errored. Column helpers qualify properly.
 */
function coverPhotoQuery() {
  return db
    .selectDistinctOn([photos.recipeId], {
      recipeId: photos.recipeId,
      url: photos.url,
    })
    .from(photos)
    .orderBy(photos.recipeId, desc(photos.isCover), asc(photos.position))
    .as("cover_photo");
}

export async function listRecipes(options?: {
  search?: string;
  tag?: string;
  favoritesOnly?: boolean;
}): Promise<RecipeWithCover[]> {
  const filters = [];

  if (options?.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    filters.push(
      or(
        ilike(recipes.title, term),
        ilike(recipes.description, term),
        // Matching ingredients is what makes "what can I do with leeks?" work.
        exists(
          db
            .select({ one: sql`1` })
            .from(ingredients)
            .where(
              and(
                eq(ingredients.recipeId, recipes.id),
                ilike(ingredients.raw, term),
              ),
            ),
        ),
      ),
    );
  }
  if (options?.tag) {
    filters.push(sql`${options.tag} = ANY(${recipes.tags})`);
  }
  if (options?.favoritesOnly) {
    filters.push(eq(recipes.isFavorite, true));
  }

  const cover = coverPhotoQuery();

  return db
    .select({ ...getTableColumns(recipes), coverPhotoUrl: cover.url })
    .from(recipes)
    .leftJoin(cover, eq(cover.recipeId, recipes.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(recipes.isFavorite), desc(recipes.createdAt));
}

export async function getRecipe(id: number): Promise<FullRecipe | null> {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!recipe) return null;

  const [recipeIngredients, recipeSteps, recipePhotos, forks, forkedFrom] =
    await Promise.all([
      db
        .select()
        .from(ingredients)
        .where(eq(ingredients.recipeId, id))
        .orderBy(asc(ingredients.position)),
      db
        .select()
        .from(steps)
        .where(eq(steps.recipeId, id))
        .orderBy(asc(steps.position)),
      db
        .select()
        .from(photos)
        .where(eq(photos.recipeId, id))
        .orderBy(desc(photos.isCover), asc(photos.position)),
      db
        .select({ id: recipes.id, title: recipes.title })
        .from(recipes)
        .where(eq(recipes.forkedFromId, id)),
      recipe.forkedFromId
        ? db
            .select({ id: recipes.id, title: recipes.title })
            .from(recipes)
            .where(eq(recipes.id, recipe.forkedFromId))
        : Promise.resolve([]),
    ]);

  return {
    ...recipe,
    ingredients: recipeIngredients,
    steps: recipeSteps,
    photos: recipePhotos,
    forks,
    forkedFrom: forkedFrom[0] ?? null,
  };
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const rows = await db
    .select({
      tag: sql<string>`unnest(${recipes.tags})`.as("tag"),
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(recipes)
    .groupBy(sql`1`)
    .orderBy(sql`2 DESC`);
  return rows;
}

export type PlanEntry = {
  id: number;
  date: string;
  meal: string;
  servings: number;
  position: number;
  recipe: Recipe;
};

export async function getWeekPlan(
  weekStart: string,
  weekEnd: string,
): Promise<PlanEntry[]> {
  const rows = await db
    .select({ entry: mealPlanEntries, recipe: recipes })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .where(
      and(gte(mealPlanEntries.date, weekStart), lte(mealPlanEntries.date, weekEnd)),
    )
    .orderBy(asc(mealPlanEntries.date), asc(mealPlanEntries.position));

  return rows.map(({ entry, recipe }) => ({
    id: entry.id,
    date: entry.date,
    meal: entry.meal,
    servings: entry.servings,
    position: entry.position,
    recipe,
  }));
}

/**
 * Every ingredient needed for a week, with how many batches of each recipe
 * the plan calls for.
 *
 * Ingredients are fetched once per distinct recipe rather than once per plan
 * entry — cooking the same thing on Monday and Thursday is two batches of one
 * ingredient list, not two copies of it.
 */
export async function getWeekIngredients(weekStart: string, weekEnd: string) {
  const planned = await db
    .select({
      recipeId: mealPlanEntries.recipeId,
      title: recipes.title,
      recipeServings: recipes.servings,
      plannedServings: sql<number>`SUM(${mealPlanEntries.servings})::float`,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .where(
      and(gte(mealPlanEntries.date, weekStart), lte(mealPlanEntries.date, weekEnd)),
    )
    .groupBy(mealPlanEntries.recipeId, recipes.title, recipes.servings);

  if (!planned.length) return [];

  const rows = await db
    .select({
      recipeId: ingredients.recipeId,
      name: ingredients.name,
      quantity: ingredients.quantity,
      unit: ingredients.unit,
    })
    .from(ingredients)
    .where(
      inArray(
        ingredients.recipeId,
        planned.map((p) => p.recipeId),
      ),
    );

  const byRecipe = new Map(planned.map((p) => [p.recipeId, p]));

  return rows.flatMap((row) => {
    const plan = byRecipe.get(row.recipeId);
    if (!plan) return [];
    return [
      {
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        recipeTitle: plan.title,
        batches: batchesNeeded(plan.plannedServings, plan.recipeServings),
      },
    ];
  });
}

export async function getGroceryList(weekStart: string) {
  return db
    .select()
    .from(groceryItems)
    .where(eq(groceryItems.weekStart, weekStart))
    .orderBy(asc(groceryItems.aisle), asc(groceryItems.name));
}
