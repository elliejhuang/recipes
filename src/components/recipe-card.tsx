import Link from "next/link";
import type { RecipeWithCover } from "@/lib/queries";

/**
 * Photo above, name below. Always this shape — the horizontal row that used to
 * appear on phones made the collection read as a list of text rather than a
 * wall of food.
 */
export function RecipeCard({ recipe }: { recipe: RecipeWithCover }) {
  // A photo you took beats the one the source published.
  const imageUrl = recipe.coverPhotoUrl ?? recipe.imageUrl;

  return (
    <Link href={`/recipes/${recipe.id}`} className="group">
      <div className="aspect-square overflow-hidden rounded-xl border border-rule bg-card transition-colors group-hover:border-faint">
        {imageUrl ? (
          // Recipe images come from arbitrary hosts, so next/image's remote
          // allowlist would need editing for every new site.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-serif text-3xl text-faint">
              {recipe.title.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <h2 className="mt-1.5 px-0.5 font-serif text-[15px] leading-snug font-semibold">
        {recipe.title}
      </h2>
    </Link>
  );
}

/** The wall itself, so every screen lays recipes out the same way. */
export function RecipeGrid({
  recipes,
  lead,
}: {
  recipes: RecipeWithCover[];
  /** Optional first tile — the Add tile on the recipes page. */
  lead?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {lead}
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
