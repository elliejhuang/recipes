import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { ForkButton } from "@/components/fork-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { AddToListButton, ToMakeButton } from "@/components/list-picker";
import { RecipeDetail } from "@/components/recipe-detail";
import { getRecipe, listLists } from "@/lib/queries";
import { photosEnabled } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [recipe, lists] = await Promise.all([
    getRecipe(Number(id)),
    listLists(),
  ]);
  if (!recipe) notFound();

  // Your own photo, if you've taken one, otherwise whatever the source used.
  const cover = recipe.photos.find((p) => p.isCover) ?? recipe.photos[0];
  const heroUrl = cover?.url ?? recipe.imageUrl;

  return (
    <article>
      <header className="mb-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl">
              {recipe.title}
            </h1>

            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
              >
                <ExternalLink size={13} />
                {recipe.sourceName ?? "Source"}
              </a>
            )}

          </div>

          {heroUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroUrl}
              alt=""
              className="h-32 w-32 shrink-0 rounded-xl object-cover sm:h-44 sm:w-44"
            />
          )}
        </div>

        <div className="no-print mt-5 flex flex-wrap items-center gap-2">
          <ToMakeButton
            recipeId={recipe.id}
            lists={lists}
            listIds={recipe.listIds}
          />
          <AddToListButton
            recipeId={recipe.id}
            lists={lists}
            listIds={recipe.listIds}
          />
          <Link href={`/recipes/${recipe.id}/edit`} className="btn">
            <Pencil size={14} />
            Edit
          </Link>
          {recipe.forkedFromId === null && <ForkButton recipeId={recipe.id} />}
        </div>
      </header>

      <RecipeDetail
        recipeId={recipe.id}
        baseServings={recipe.servings}
        ingredients={recipe.ingredients}
        method={recipe.method}
        nutritionSource={recipe.nutritionSource}
        storedMacros={{
          calories: recipe.calories,
          proteinG: recipe.proteinG,
          carbsG: recipe.carbsG,
          fatG: recipe.fatG,
          fiberG: recipe.fiberG,
          sugarG: recipe.sugarG,
          sodiumMg: recipe.sodiumMg,
        }}
      />

      <PhotoGallery
        recipeId={recipe.id}
        photos={recipe.photos}
        uploadsEnabled={photosEnabled()}
      />
    </article>
  );
}
