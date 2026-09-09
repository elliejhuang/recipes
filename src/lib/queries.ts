import {
  and,
  asc,
  desc,
  eq,
  exists,
  getTableColumns,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import {
  groceryItems,
  groceryLists,
  ingredients,
  listMembers,
  lists,
  photos,
  recipes,
  type GroceryItem,
  type GroceryList,
  type Ingredient,
  type Photo,
  type Recipe,
  type RecipeList,
} from "@/db/schema";

export type FullRecipe = Recipe & {
  ingredients: Ingredient[];
  photos: Photo[];
  /** Which lists this recipe is on. */
  listIds: number[];
};

/** A recipe plus whichever photo should represent it in a grid. */
export type RecipeWithCover = Recipe & { coverPhotoUrl: string | null };

/**
 * One photo per recipe — the cover if you picked one, otherwise the first.
 *
 * Built as a joinable subquery rather than a correlated one written by hand:
 * inside a raw `sql` template drizzle emits column references unqualified, so
 * `photos.recipe_id = recipes.id` came out as `p.recipe_id = "id"`, which
 * Postgres happily resolved against the *inner* table. Column helpers qualify.
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
  listId?: number;
}): Promise<RecipeWithCover[]> {
  const filters = [];

  if (options?.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    filters.push(
      or(
        ilike(recipes.title, term),
        // Matching ingredients is what makes "what can I make with leeks" work.
        exists(
          db
            .select({ one: sql`1` })
            .from(ingredients)
            .where(
              and(eq(ingredients.recipeId, recipes.id), ilike(ingredients.raw, term)),
            ),
        ),
      ),
    );
  }

  if (options?.listId) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(listMembers)
          .where(
            and(
              eq(listMembers.recipeId, recipes.id),
              eq(listMembers.listId, options.listId),
            ),
          ),
      ),
    );
  }

  const cover = coverPhotoQuery();

  return db
    .select({ ...getTableColumns(recipes), coverPhotoUrl: cover.url })
    .from(recipes)
    .leftJoin(cover, eq(cover.recipeId, recipes.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(recipes.createdAt));
}

export async function getRecipe(id: number): Promise<FullRecipe | null> {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!recipe) return null;

  const [recipeIngredients, recipePhotos, assigned] = await Promise.all([
    db
      .select()
      .from(ingredients)
      .where(eq(ingredients.recipeId, id))
      .orderBy(asc(ingredients.position)),
    db
      .select()
      .from(photos)
      .where(eq(photos.recipeId, id))
      .orderBy(desc(photos.isCover), asc(photos.position)),
    db
      .select({ listId: listMembers.listId })
      .from(listMembers)
      .where(eq(listMembers.recipeId, id)),
  ]);

  return {
    ...recipe,
    ingredients: recipeIngredients,
    photos: recipePhotos,
    listIds: assigned.map((row) => row.listId),
  };
}

/* ---------------------------------------------------------------- lists --- */

export type ListWithCount = RecipeList & { count: number };

export async function listLists(): Promise<ListWithCount[]> {
  return db
    .select({
      ...getTableColumns(lists),
      count: sql<number>`count(${listMembers.recipeId})::int`,
    })
    .from(lists)
    .leftJoin(listMembers, eq(listMembers.listId, lists.id))
    .groupBy(lists.id)
    .orderBy(desc(lists.isDefault), asc(lists.position), asc(lists.id));
}

/** Lists with a few images each, for the album tiles. */
export async function listAlbums(options?: {
  search?: string;
}): Promise<(ListWithCount & { covers: string[] })[]> {
  const cover = coverPhotoQuery();

  const [allLists, members] = await Promise.all([
    listLists(),
    db
      .select({
        listId: listMembers.listId,
        image: sql<string | null>`COALESCE(${cover.url}, ${recipes.imageUrl})`,
      })
      .from(listMembers)
      .innerJoin(recipes, eq(listMembers.recipeId, recipes.id))
      .leftJoin(cover, eq(cover.recipeId, recipes.id))
      .orderBy(desc(recipes.createdAt)),
  ]);

  const term = options?.search?.trim().toLowerCase();
  const listRows = term
    ? allLists.filter((l) => l.name.toLowerCase().includes(term))
    : allLists;

  return listRows.map((list) => ({
    ...list,
    covers: members
      .filter((m) => m.listId === list.id && m.image)
      .slice(0, 4)
      .map((m) => m.image as string),
  }));
}

export async function getList(id: number): Promise<ListWithCount | null> {
  const all = await listLists();
  return all.find((l) => l.id === id) ?? null;
}

/**
 * The undeletable "To Make" list, created on first use. It's the one the
 * grocery list is built from.
 */
export async function ensureDefaultList(): Promise<RecipeList> {
  const [existing] = await db
    .select()
    .from(lists)
    .where(eq(lists.isDefault, true))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(lists)
    .values({ name: "To Make", isDefault: true, position: -1 })
    .returning();
  return created;
}

/** Every ingredient the default list calls for, one batch of each recipe. */
export async function getPlanIngredients() {
  const defaultList = await ensureDefaultList();

  const planned = await db
    .select({ recipeId: listMembers.recipeId, title: recipes.title })
    .from(listMembers)
    .innerJoin(recipes, eq(listMembers.recipeId, recipes.id))
    .where(eq(listMembers.listId, defaultList.id));

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

  const titles = new Map(planned.map((p) => [p.recipeId, p.title]));

  return rows.flatMap((row) => {
    const title = titles.get(row.recipeId);
    if (!title) return [];
    // One batch each: the list says "make this", not "make this twice".
    return [{ ...row, recipeTitle: title, batches: 1 }];
  });
}

/* ------------------------------------------------------------ groceries --- */

export type GroceryListWithItems = GroceryList & { items: GroceryItem[] };

export async function getGroceryLists(): Promise<GroceryListWithItems[]> {
  const [rows, items] = await Promise.all([
    db
      .select()
      .from(groceryLists)
      .orderBy(
        desc(groceryLists.isAuto),
        asc(groceryLists.position),
        asc(groceryLists.id),
      ),
    db
      .select()
      .from(groceryItems)
      .orderBy(asc(groceryItems.position), asc(groceryItems.id)),
  ]);

  return rows.map((list) => ({
    ...list,
    items: items.filter((item) => item.listId === list.id),
  }));
}

/** The auto grocery list, created on first use. */
export async function ensureAutoList(): Promise<GroceryList> {
  const [existing] = await db
    .select()
    .from(groceryLists)
    .where(eq(groceryLists.isAuto, true))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(groceryLists)
    .values({ name: "To Make", isAuto: true, position: 0 })
    .returning();
  return created;
}
