import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ExternalLink, Pencil } from "lucide-react";
import { AddToPlan } from "@/components/add-to-plan";
import { ScaledRecipe } from "@/components/scaled-recipe";
import { FavoriteButton, PrintButton } from "@/components/favorite-button";
import { formatMinutes } from "@/lib/dates";
import { getRecipe } from "@/lib/queries";

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

  return (
    <article>
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
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

          {recipe.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt=""
              className="h-36 w-36 shrink-0 rounded-xl object-cover sm:h-44 sm:w-44"
            />
          )}
        </div>

        <div className="no-print mt-6 flex flex-wrap items-center gap-2">
          <AddToPlan recipeId={recipe.id} />
          <FavoriteButton id={recipe.id} isFavorite={recipe.isFavorite} />
          <Link href={`/recipes/${recipe.id}/edit`} className="btn">
            <Pencil size={14} />
            Edit
          </Link>
          <PrintButton />
        </div>
      </header>

      <ScaledRecipe
        baseServings={recipe.servings}
        ingredients={recipe.ingredients}
        steps={recipe.steps}
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

      {recipe.notes && (
        <section className="mt-10 rounded-xl border border-rule bg-card p-5">
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
            Your notes
          </h2>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap">{recipe.notes}</p>
        </section>
      )}
    </article>
  );
}
