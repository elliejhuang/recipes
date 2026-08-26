import { and, asc, desc, eq, exists, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
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
  type Folder,
  type GroceryItem,
  type GroceryList,
  type Ingredient,
  type Photo,
  type Recipe,
} from "@/db/schema";

export type FullRecipe = Recipe & {
  ingredients: Ingredient[];
  photos: Photo[];
  folderIds: number[];
  /** Whether this recipe is currently on the "want to make" shelf. */
  isPlanned: boolean;
};

/** A recipe plus whichever photo should represent it in a list. */
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
  folderId?: number;
  favoritesOnly?: boolean;
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
              and(
                eq(ingredients.recipeId, recipes.id),
                ilike(ingredients.raw, term),
              ),
            ),
        ),
      ),
    );
  }

  if (options?.folderId) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(recipeFolders)
          .where(
            and(
              eq(recipeFolders.recipeId, recipes.id),
              eq(recipeFolders.folderId, options.folderId),
            ),
          ),
      ),
    );
  }

  if (options?.favoritesOnly) filters.push(eq(recipes.isFavorite, true));

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

  const [recipeIngredients, recipePhotos, assigned, planned] = await Promise.all([
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
      .select({ folderId: recipeFolders.folderId })
      .from(recipeFolders)
      .where(eq(recipeFolders.recipeId, id)),
    db.select({ id: planItems.id }).from(planItems).where(eq(planItems.recipeId, id)),
  ]);

  return {
    ...recipe,
    ingredients: recipeIngredients,
    photos: recipePhotos,
    folderIds: assigned.map((row) => row.folderId),
    isPlanned: planned.length > 0,
  };
}

/* -------------------------------------------------------------- folders --- */

export type FolderWithCount = Folder & { count: number };

export async function listFolders(): Promise<FolderWithCount[]> {
  return db
    .select({
      ...getTableColumns(folders),
      count: sql<number>`count(${recipeFolders.recipeId})::int`,
    })
    .from(folders)
    .leftJoin(recipeFolders, eq(recipeFolders.folderId, folders.id))
    .groupBy(folders.id)
    .orderBy(asc(folders.position), asc(folders.id));
}

/** Folders with a few images each, for the album tiles. */
export async function listFolderAlbums(): Promise<
  (FolderWithCount & { covers: string[] })[]
> {
  const cover = coverPhotoQuery();

  const [folderRows, members] = await Promise.all([
    listFolders(),
    db
      .select({
        folderId: recipeFolders.folderId,
        image: sql<string | null>`COALESCE(${cover.url}, ${recipes.imageUrl})`,
      })
      .from(recipeFolders)
      .innerJoin(recipes, eq(recipeFolders.recipeId, recipes.id))
      .leftJoin(cover, eq(cover.recipeId, recipes.id))
      .orderBy(desc(recipes.createdAt)),
  ]);

  return folderRows.map((folder) => ({
    ...folder,
    covers: members
      .filter((m) => m.folderId === folder.id && m.image)
      .slice(0, 4)
      .map((m) => m.image as string),
  }));
}

/** Images for the "All" tile. */
export async function recentCovers(limit = 4): Promise<string[]> {
  const cover = coverPhotoQuery();
  const rows = await db
    .select({ image: sql<string | null>`COALESCE(${cover.url}, ${recipes.imageUrl})` })
    .from(recipes)
    .leftJoin(cover, eq(cover.recipeId, recipes.id))
    .orderBy(desc(recipes.createdAt))
    .limit(limit * 3);
  return rows.map((r) => r.image).filter((x): x is string => Boolean(x)).slice(0, limit);
}

/* ----------------------------------------------------------------- plan --- */

export type PlanEntry = { id: number; position: number; recipe: RecipeWithCover };

export async function getPlan(): Promise<PlanEntry[]> {
  const cover = coverPhotoQuery();

  const rows = await db
    .select({
      id: planItems.id,
      position: planItems.position,
      recipe: getTableColumns(recipes),
      coverPhotoUrl: cover.url,
    })
    .from(planItems)
    .innerJoin(recipes, eq(planItems.recipeId, recipes.id))
    .leftJoin(cover, eq(cover.recipeId, recipes.id))
    .orderBy(asc(planItems.position), asc(planItems.id));

  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    recipe: { ...row.recipe, coverPhotoUrl: row.coverPhotoUrl },
  }));
}

/** Every ingredient the plan calls for, one batch of each recipe. */
export async function getPlanIngredients() {
  const planned = await db
    .select({ recipeId: planItems.recipeId, title: recipes.title })
    .from(planItems)
    .innerJoin(recipes, eq(planItems.recipeId, recipes.id));

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
    // One batch each: the shelf says "make this", not "make this twice".
    return [{ ...row, recipeTitle: title, batches: 1 }];
  });
}

/* ------------------------------------------------------------ groceries --- */

export type ListWithItems = GroceryList & { items: GroceryItem[] };

export async function getGroceryLists(): Promise<ListWithItems[]> {
  const [lists, items] = await Promise.all([
    db
      .select()
      .from(groceryLists)
      .orderBy(desc(groceryLists.isAuto), asc(groceryLists.position), asc(groceryLists.id)),
    db
      .select()
      .from(groceryItems)
      .orderBy(asc(groceryItems.position), asc(groceryItems.id)),
  ]);

  return lists.map((list) => ({
    ...list,
    items: items.filter((item) => item.listId === list.id),
  }));
}

/**
 * The auto list, created on first use. Something has to be there before the
 * plan can fill it, and a fresh database has no lists at all.
 */
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
