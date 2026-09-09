-- Lets an ingredient carry hand-entered calories, for when the nutrition
-- table has no match for it.

--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "calories_override" integer;
