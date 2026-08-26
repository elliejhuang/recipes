-- Restructure: folders, a flat plan shelf, multiple grocery lists, and method
-- as editable free text.
--
-- Written by hand rather than generated, because the data has to move before
-- the old tables are dropped and drizzle-kit emits DDL only.

--> statement-breakpoint
CREATE TABLE "folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_folders" (
	"recipe_id" integer NOT NULL,
	"folder_id" integer NOT NULL,
	CONSTRAINT "recipe_folders_recipe_id_folder_id_pk" PRIMARY KEY("recipe_id","folder_id")
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_auto" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_folders" ADD CONSTRAINT "recipe_folders_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipe_folders" ADD CONSTRAINT "recipe_folders_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "recipe_folders_folder_idx" ON "recipe_folders" USING btree ("folder_id");
--> statement-breakpoint
CREATE INDEX "plan_items_recipe_idx" ON "plan_items" USING btree ("recipe_id");

--> statement-breakpoint
-- Method text, seeded from the steps that are about to be dropped.
ALTER TABLE "recipes" ADD COLUMN "method" text;
--> statement-breakpoint
UPDATE "recipes" SET "method" = sub.joined
FROM (
	SELECT "recipe_id", string_agg("text", E'\n' ORDER BY "position") AS joined
	FROM "steps" GROUP BY "recipe_id"
) AS sub
WHERE "recipes"."id" = sub."recipe_id";
--> statement-breakpoint
DROP TABLE "steps" CASCADE;

--> statement-breakpoint
-- Whatever was on the week grid becomes something you want to make, once each.
INSERT INTO "plan_items" ("recipe_id", "position")
SELECT "recipe_id", ROW_NUMBER() OVER (ORDER BY MIN("date")) - 1
FROM "meal_plan_entries" GROUP BY "recipe_id";
--> statement-breakpoint
DROP TABLE "meal_plan_entries" CASCADE;

--> statement-breakpoint
-- Every list gets a home. The auto list is rebuilt from the plan, so its old
-- generated rows are disposable; hand-added ones are carried over.
INSERT INTO "grocery_lists" ("name", "is_auto", "position") VALUES ('To Make', true, 0);
--> statement-breakpoint
ALTER TABLE "grocery_items" ADD COLUMN "list_id" integer;
--> statement-breakpoint
ALTER TABLE "grocery_items" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "grocery_items" SET "list_id" = (SELECT "id" FROM "grocery_lists" WHERE "is_auto" = true LIMIT 1);
--> statement-breakpoint
DELETE FROM "grocery_items" WHERE "is_manual" = false;
--> statement-breakpoint
ALTER TABLE "grocery_items" ALTER COLUMN "list_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_list_id_grocery_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."grocery_lists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "grocery_week_idx";
--> statement-breakpoint
CREATE INDEX "grocery_list_idx" ON "grocery_items" USING btree ("list_id");
--> statement-breakpoint
ALTER TABLE "grocery_items" DROP COLUMN "week_start";
--> statement-breakpoint
ALTER TABLE "grocery_items" DROP COLUMN "aisle";

--> statement-breakpoint
-- Photos pinned to a step have nothing to pin to now.
ALTER TABLE "photos" DROP COLUMN "step_position";
