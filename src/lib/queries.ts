import { and, asc, desc, eq, getTableColumns, gte, ilike, lte, or, sql } from "drizzle-orm";
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
 * Your own photo wins over whatever picture the source site published, and
 * the one you marked as cover wins over the rest.
 */
const coverPhotoUrl = sql<string | null>`(
  SELECT p.url FROM ${photos} p
  WHERE p.recipe_id = ${recipes.id}
  ORDER BY p.is_cover DESC, p.position ASC
  LIMIT 1
)`;

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
        sql`EXISTS (SELECT 1 FROM ${ingredients} i WHERE i.recipe_id = ${recipes.id} AND i.raw ILIKE ${term})`,
      ),
    );
  }
  if (options?.tag) {
    filters.push(sql`${options.tag} = ANY(${recipes.tags})`);
  }
  if (options?.favoritesOnly) {
    filters.push(eq(recipes.isFavorite, true));
  }

  return db
    .select({
      ...getTableColumns(recipes),
      coverPhotoUrl: coverPhotoUrl.as("cover_photo_url"),
    })
    .from(recipes)
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

/** All ingredient rows for the recipes planned in a week, with plan servings. */
export async function getWeekIngredients(weekStart: string, weekEnd: string) {
  const rows = await db
    .select({
      ingredient: ingredients,
      recipeTitle: recipes.title,
      recipeServings: recipes.servings,
      planServings: mealPlanEntries.servings,
    })
    .from(mealPlanEntries)
    .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
    .innerJoin(ingredients, eq(ingredients.recipeId, recipes.id))
    .where(
      and(gte(mealPlanEntries.date, weekStart), lte(mealPlanEntries.date, weekEnd)),
    );
  return rows;
}

export async function getGroceryList(weekStart: string) {
  return db
    .select()
    .from(groceryItems)
    .where(eq(groceryItems.weekStart, weekStart))
    .orderBy(asc(groceryItems.aisle), asc(groceryItems.name));
}
