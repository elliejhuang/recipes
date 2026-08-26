import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sourceUrl: text("source_url"),
    sourceName: text("source_name"),
    servings: integer("servings").default(4).notNull(),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    tags: text("tags").array().default([]).notNull(),
    // Free text, not a step list. Imported recipes seed it from whatever the
    // source published; mostly it stays short or empty.
    method: text("method"),
    notes: text("notes"),
    isFavorite: boolean("is_favorite").default(false).notNull(),

    // Set when this recipe was forked from another one in the box. The
    // original stays untouched, so "my version" and "what the site said" can
    // both exist and be compared.
    forkedFromId: integer("forked_from_id"),
    // What you changed and why — the running story of making it yours.
    adaptationNote: text("adaptation_note"),

    // Per-serving nutrition. Null means "unknown", which the UI renders
    // differently from a real zero.
    calories: real("calories"),
    proteinG: real("protein_g"),
    carbsG: real("carbs_g"),
    fatG: real("fat_g"),
    fiberG: real("fiber_g"),
    sugarG: real("sugar_g"),
    sodiumMg: real("sodium_mg"),
    // "imported" | "manual" | "estimated"
    nutritionSource: text("nutrition_source"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("recipes_title_idx").on(t.title)],
);

export const ingredients = pgTable(
  "ingredients",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    // The line exactly as written, so we never lose the author's phrasing.
    raw: text("raw").notNull(),
    // Parsed pieces, used for scaling and grocery aggregation. Any of these
    // can be null when the line doesn't parse cleanly ("salt to taste").
    quantity: real("quantity"),
    unit: text("unit"),
    name: text("name"),
    note: text("note"),
    // Section header like "For the sauce" groups the lines under it.
    section: text("section"),
  },
  (t) => [index("ingredients_recipe_idx").on(t.recipeId)],
);

export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    // Path within the storage bucket, kept so the file can be deleted later.
    storagePath: text("storage_path").notNull(),
    url: text("url").notNull(),
    caption: text("caption"),
    position: integer("position").notNull().default(0),
    // The one that represents the recipe in lists and cards.
    isCover: boolean("is_cover").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("photos_recipe_idx").on(t.recipeId)],
);

/**
 * Recipes you want to make. No dates and no meal slots — a shelf you add to
 * and cook from, which is how the planning actually happened in practice.
 */
export const planItems = pgTable(
  "plan_items",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("plan_items_recipe_idx").on(t.recipeId)],
);

/**
 * Your own grouping of recipes. Separate from `recipes.tags`, which is
 * whatever the source site published and is nobody's idea of a filing system.
 */
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recipeFolders = pgTable(
  "recipe_folders",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    folderId: integer("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.folderId] }),
    index("recipe_folders_folder_idx").on(t.folderId),
  ],
);

/**
 * A shopping list. Exactly one is `isAuto`, rebuilt from the plan whenever the
 * plan changes; the rest are yours to make and delete.
 */
export const groceryLists = pgTable("grocery_lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isAuto: boolean("is_auto").default(false).notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groceryItems = pgTable(
  "grocery_items",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id")
      .notNull()
      .references(() => groceryLists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: real("quantity"),
    unit: text("unit"),
    checked: boolean("checked").default(false).notNull(),
    position: integer("position").notNull().default(0),
    // Free text like "2 recipes" or the original lines, for provenance.
    detail: text("detail"),
    // True when you typed it in yourself rather than it coming from the plan,
    // which is what protects it from being wiped on regenerate.
    isManual: boolean("is_manual").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("grocery_list_idx").on(t.listId)],
);

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(ingredients),
  photos: many(photos),
  planItems: many(planItems),
  recipeFolders: many(recipeFolders),
}));

export const ingredientsRelations = relations(ingredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [ingredients.recipeId],
    references: [recipes.id],
  }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  recipe: one(recipes, { fields: [photos.recipeId], references: [recipes.id] }),
}));

export const planItemsRelations = relations(planItems, ({ one }) => ({
  recipe: one(recipes, { fields: [planItems.recipeId], references: [recipes.id] }),
}));

export const foldersRelations = relations(folders, ({ many }) => ({
  recipeFolders: many(recipeFolders),
}));

export const recipeFoldersRelations = relations(recipeFolders, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeFolders.recipeId],
    references: [recipes.id],
  }),
  folder: one(folders, {
    fields: [recipeFolders.folderId],
    references: [folders.id],
  }),
}));

export const groceryListsRelations = relations(groceryLists, ({ many }) => ({
  items: many(groceryItems),
}));

export const groceryItemsRelations = relations(groceryItems, ({ one }) => ({
  list: one(groceryLists, {
    fields: [groceryItems.listId],
    references: [groceryLists.id],
  }),
}));

export type Recipe = typeof recipes.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type PlanItem = typeof planItems.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type GroceryList = typeof groceryLists.$inferSelect;
export type GroceryItem = typeof groceryItems.$inferSelect;
