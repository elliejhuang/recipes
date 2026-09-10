-- Teaches the app an ingredient's nutrition once, so a future recipe that
-- calls for the same ingredient (at whatever quantity) reuses it instead of
-- asking again. Stored per one base unit (gram, milliliter, or — for
-- countable ingredients, which don't convert — the exact unit the lesson was
-- taught in) so it scales to whatever amount a new line calls for.

--> statement-breakpoint
CREATE TABLE "learned_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit_family" text NOT NULL,
	"unit_label" text,
	"calories_per_base" real,
	"protein_per_base" real,
	"carbs_per_base" real,
	"fat_per_base" real,
	"fiber_per_base" real,
	"sugar_per_base" real,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learned_ingredients_name_unique" UNIQUE("name")
);
