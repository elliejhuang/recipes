CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"storage_path" text NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"step_position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "forked_from_id" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "adaptation_note" text;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photos_recipe_idx" ON "photos" USING btree ("recipe_id");