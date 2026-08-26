import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ExternalLink, GitBranch, Pencil } from "lucide-react";
import { AddToPlan } from "@/components/add-to-plan";
import { AdaptationNote, ForkButton } from "@/components/fork-button";
import { FavoriteButton, PrintButton } from "@/components/favorite-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { ScaledRecipe } from "@/components/scaled-recipe";
import { formatMinutes } from "@/lib/dates";
import { getRecipe } from "@/lib/queries";
import { photosEnabled } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getRecipe(Number(id));
  if (!recipe) notFound();

  const prep = formatMinutes(recipe.prepMinutes);
  const cook = formatMinutes(recipe.cookMinutes);

  // Your own photo, if you've taken one, otherwise whatever the source
  // published.
  const cover = recipe.photos.find((p) => p.isCover) ?? recipe.photos[0];
  const heroUrl = cover?.url ?? recipe.imageUrl;

  const isMine = recipe.forkedFromId !== null;

  return (
    <article>
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {isMine && recipe.forkedFrom && (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                <GitBranch size={12} />
                Your version, adapted from{" "}
                <Link
                  href={`/recipes/${recipe.forkedFrom.id}`}
                  className="text-accent underline underline-offset-2"
                >
                  the original
                </Link>
              </p>
            )}

            <h1 className="font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl">
              {recipe.title}
            </h1>

            {recipe.description && (
              <p className="mt-2.5 max-w-2xl leading-relaxed text-muted">
                {recipe.description}
              </p>
            )}

            <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
              {prep && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {prep} prep
                </span>
              )}
              {cook && (
                <span className="flex items-center gap-1.5">
                  {!prep && <Clock size={14} />}
                  {cook} cook
                </span>
              )}
              {recipe.sourceUrl && (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-ink"
                >
                  <ExternalLink size={13} />
                  {recipe.sourceName ?? "Source"}
                </a>
              )}
            </div>

            {recipe.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {recipe.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/?tag=${encodeURIComponent(tag)}`}
                    className="rounded-full border border-rule bg-card px-2.5 py-0.5 text-xs text-muted hover:border-faint"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {heroUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroUrl}
              alt=""
              className="h-36 w-36 shrink-0 rounded-xl object-cover sm:h-44 sm:w-44"
            />
          )}
        </div>

        {/* Versions you've already made, so you don't fork the same thing twice. */}
        {recipe.forks.length > 0 && (
          <div className="no-print mt-5 rounded-xl border border-rule bg-card px-3.5 py-2.5">
            <p className="text-xs text-muted">
              {recipe.forks.length === 1
                ? "You have a version of this:"
                : "Your versions of this:"}{" "}
              {recipe.forks.map((fork, index) => (
                <span key={fork.id}>
                  {index > 0 && ", "}
                  <Link
                    href={`/recipes/${fork.id}`}
                    className="text-accent underline underline-offset-2"
                  >
                    {fork.title}
                  </Link>
                </span>
              ))}
            </p>
          </div>
        )}

        <div className="no-print mt-6 flex flex-wrap items-center gap-2">
          <AddToPlan recipeId={recipe.id} />
          <FavoriteButton id={recipe.id} isFavorite={recipe.isFavorite} />
          <Link href={`/recipes/${recipe.id}/edit`} className="btn">
            <Pencil size={14} />
            Edit
          </Link>
          {!isMine && <ForkButton recipeId={recipe.id} />}
          <PrintButton />
        </div>
      </header>

      <ScaledRecipe
        baseServings={recipe.servings}
        ingredients={recipe.ingredients}
        steps={recipe.steps}
        photos={recipe.photos}
        storedMacros={{
          calories: recipe.calories,
          proteinG: recipe.proteinG,
          carbsG: recipe.carbsG,
          fatG: recipe.fatG,
          fiberG: recipe.fiberG,
          sugarG: recipe.sugarG,
          sodiumMg: recipe.sodiumMg,
        }}
        nutritionSource={recipe.nutritionSource}
      />

      <PhotoGallery
        recipeId={recipe.id}
        photos={recipe.photos}
        steps={recipe.steps}
        uploadsEnabled={photosEnabled()}
      />

      {isMine && (
        <section className="no-print mt-8">
          <AdaptationNote recipeId={recipe.id} initial={recipe.adaptationNote} />
        </section>
      )}

      {recipe.notes && (
        <section className="mt-8 rounded-xl border border-rule bg-card p-5">
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
            Your notes
          </h2>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap">{recipe.notes}</p>
        </section>
      )}
    </article>
  );
}
