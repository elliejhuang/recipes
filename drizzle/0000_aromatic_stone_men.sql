CREATE TABLE "grocery_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"name" text NOT NULL,
	"quantity" real,
	"unit" text,
	"aisle" text DEFAULT 'Other' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"detail" text,
	"is_manual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"raw" text NOT NULL,
	"quantity" real,
	"unit" text,
	"name" text,
	"note" text,
	"section" text
);
--> statement-breakpoint
CREATE TABLE "meal_plan_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"meal" text NOT NULL,
	"recipe_id" integer NOT NULL,
	"servings" real DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"source_url" text,
	"source_name" text,
	"servings" integer DEFAULT 4 NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"calories" real,
	"protein_g" real,
	"carbs_g" real,
	"fat_g" real,
	"fiber_g" real,
	"sugar_g" real,
	"sodium_mg" real,
	"nutrition_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"section" text
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grocery_week_idx" ON "grocery_items" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "ingredients_recipe_idx" ON "ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "meal_plan_date_idx" ON "meal_plan_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "recipes_title_idx" ON "recipes" USING btree ("title");--> statement-breakpoint
CREATE INDEX "steps_recipe_idx" ON "steps" USING btree ("recipe_id");