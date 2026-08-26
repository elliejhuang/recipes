import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  index,
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

export const steps = pgTable(
  "steps",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    text: text("text").notNull(),
    section: text("section"),
  },
  (t) => [index("steps_recipe_idx").on(t.recipeId)],
);

/**
 * Photos you took. Separate from `recipes.imageUrl`, which holds whatever
 * picture the original site published — your own shots take precedence over
 * it, and survive if that remote URL ever rots.
 */
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
    // Optional: pin a photo to a step, for "this is what it looks like when
    // the onions are done".
    stepPosition: integer("step_position"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("photos_recipe_idx").on(t.recipeId)],
);

export const mealPlanEntries = pgTable(
  "meal_plan_entries",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    // "breakfast" | "lunch" | "dinner" | "snack"
    meal: text("meal").notNull(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    // How many servings of it you're actually making that day, which may
    // differ from the recipe's own yield.
    servings: real("servings").default(1).notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("meal_plan_date_idx").on(t.date)],
);

export const groceryItems = pgTable(
  "grocery_items",
  {
    id: serial("id").primaryKey(),
    // Monday of the week this list belongs to.
    weekStart: date("week_start").notNull(),
    name: text("name").notNull(),
    quantity: real("quantity"),
    unit: text("unit"),
    aisle: text("aisle").default("Other").notNull(),
    checked: boolean("checked").default(false).notNull(),
    // Free text like "2 recipes" or the original lines, for provenance.
    detail: text("detail"),
    // True when you typed it in yourself rather than it coming from the plan,
    // which is what protects it from being wiped on regenerate.
    isManual: boolean("is_manual").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("grocery_week_idx").on(t.weekStart)],
);

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(ingredients),
  steps: many(steps),
  photos: many(photos),
  mealPlanEntries: many(mealPlanEntries),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  recipe: one(recipes, { fields: [photos.recipeId], references: [recipes.id] }),
}));

export const ingredientsRelations = relations(ingredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [ingredients.recipeId],
    references: [recipes.id],
  }),
}));

export const stepsRelations = relations(steps, ({ one }) => ({
  recipe: one(recipes, { fields: [steps.recipeId], references: [recipes.id] }),
}));

export const mealPlanRelations = relations(mealPlanEntries, ({ one }) => ({
  recipe: one(recipes, {
    fields: [mealPlanEntries.recipeId],
    references: [recipes.id],
  }),
}));

export type Recipe = typeof recipes.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type Step = typeof steps.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type GroceryItem = typeof groceryItems.$inferSelect;
