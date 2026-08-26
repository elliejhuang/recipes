import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RecipeForm } from "@/components/recipe-form";
import { getRecipe } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipe(Number(id));
  if (!recipe) notFound();

  return (
    <div>
      <Link
        href={`/recipes/${recipe.id}`}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={14} />
        Back to recipe
      </Link>

      <h1 className="mb-6 font-serif text-2xl font-semibold">Edit recipe</h1>

      <RecipeForm
        showDelete
        submitLabel="Save changes"
        initial={{
          id: recipe.id,
          title: recipe.title,
          description: recipe.description ?? "",
          imageUrl: recipe.imageUrl ?? "",
          sourceUrl: recipe.sourceUrl ?? "",
          sourceName: recipe.sourceName ?? "",
          servings: recipe.servings,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          tags: recipe.tags,
          notes: recipe.notes ?? "",
          ingredientText: recipe.ingredients.map((i) => i.raw).join("\n"),
          stepText: recipe.steps.map((s) => s.text).join("\n"),
          nutrition: {
            calories: recipe.calories,
            proteinG: recipe.proteinG,
            carbsG: recipe.carbsG,
            fatG: recipe.fatG,
            fiberG: recipe.fiberG,
            sugarG: recipe.sugarG,
            sodiumMg: recipe.sodiumMg,
          },
          nutritionSource: recipe.nutritionSource,
        }}
      />
    </div>
  );
}
