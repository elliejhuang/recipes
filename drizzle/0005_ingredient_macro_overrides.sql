-- Widens the ingredient-level nutrition override from calories alone to the
-- full set the nutrition panel shows, so a hand-entered ingredient's numbers
-- feed the estimate the same way a matched one's do.

--> statement-breakpoint
ALTER TABLE "ingredients" ALTER COLUMN "calories_override" TYPE real;
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "protein_override" real;
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "carbs_override" real;
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "fat_override" real;
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "fiber_override" real;
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "sugar_override" real;
