import { notFound } from "next/navigation";
import { RecipeView } from "@/components/recipe-view";
import { getLearnedFoods, getRecipe, listLists } from "@/lib/queries";
import { photosEnabled } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [recipe, lists, learnedFoods] = await Promise.all([
    getRecipe(Number(id)),
    listLists(),
    getLearnedFoods(),
  ]);
  if (!recipe) notFound();

  return (
    <RecipeView
      recipe={recipe}
      lists={lists}
      uploadsEnabled={photosEnabled()}
      startEditing={query.edit === "1"}
      learnedFoods={learnedFoods}
    />
  );
}
