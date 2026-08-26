import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  groceryItems,
  ingredients,
  mealPlanEntries,
  recipes,
  steps,
  type Ingredient,
  type Recipe,
  type Step,
} from "@/db/schema";

export type FullRecipe = Recipe & {
  ingredients: Ingredient[];
  steps: Step[];
};

export async function listRecipes(options?: {
  search?: string;
  tag?: string;
  favoritesOnly?: boolean;
}): Promise<Recipe[]> {
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
    .select()
    .from(recipes)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(recipes.isFavorite), desc(recipes.createdAt));
}

export async function getRecipe(id: number): Promise<FullRecipe | null> {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!recipe) return null;

  const [recipeIngredients, recipeSteps] = await Promise.all([
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
  ]);

  return { ...recipe, ingredients: recipeIngredients, steps: recipeSteps };
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
