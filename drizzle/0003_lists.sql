-- Folders and the "want to make" shelf were the same idea wearing two names:
-- a named collection of recipes. They become one — lists — with a default
-- "To Make" that the grocery list derives from.

--> statement-breakpoint
ALTER TABLE "folders" RENAME TO "lists";
--> statement-breakpoint
ALTER TABLE "recipe_folders" RENAME TO "list_recipes";
--> statement-breakpoint
ALTER TABLE "list_recipes" RENAME COLUMN "folder_id" TO "list_id";
--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;

--> statement-breakpoint
-- Sorts ahead of everything you made yourself.
INSERT INTO "lists" ("name", "is_default", "position") VALUES ('To Make', true, -1);

--> statement-breakpoint
-- Whatever was on the shelf joins the default list.
INSERT INTO "list_recipes" ("recipe_id", "list_id")
SELECT p."recipe_id", (SELECT "id" FROM "lists" WHERE "is_default" = true LIMIT 1)
FROM "plan_items" p
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DROP TABLE "plan_items" CASCADE;

--> statement-breakpoint
DROP INDEX IF EXISTS "recipe_folders_folder_idx";
--> statement-breakpoint
CREATE INDEX "list_recipes_list_idx" ON "list_recipes" USING btree ("list_id");
