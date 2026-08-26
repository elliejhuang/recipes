import Link from "next/link";
import { Star } from "lucide-react";
import type { RecipeWithCover } from "@/lib/queries";

/** Photo and name. Everything else belongs on the recipe itself. */
export function RecipeCard({ recipe }: { recipe: RecipeWithCover }) {
  // A photo you took beats the one the source published.
  const imageUrl = recipe.coverPhotoUrl ?? recipe.imageUrl;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex gap-3 overflow-hidden rounded-xl border border-rule bg-card p-2.5 transition-colors hover:border-faint sm:flex-col sm:gap-0 sm:p-0"
    >
      <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-paper sm:aspect-[4/3] sm:w-auto sm:rounded-none">
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
            <span className="font-serif text-2xl text-faint sm:text-4xl">
              {recipe.title.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        {recipe.isFavorite && (
          <div className="absolute top-1 right-1 rounded-full bg-card/90 p-1 backdrop-blur sm:top-2 sm:right-2 sm:p-1.5">
            <Star size={12} className="fill-accent text-accent" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center sm:p-3.5">
        <h2 className="font-serif text-lg leading-snug font-semibold text-balance">
          {recipe.title}
        </h2>
      </div>
    </Link>
  );
}
