import Link from "next/link";
import { Clock, Star, Users } from "lucide-react";
import type { RecipeWithCover } from "@/lib/queries";
import { formatMinutes } from "@/lib/dates";
import { MacroLine } from "./macros";

export function RecipeCard({ recipe }: { recipe: RecipeWithCover }) {
  const time = formatMinutes(
    (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0),
  );

  // A photo you took beats the one the site published.
  const imageUrl = recipe.coverPhotoUrl ?? recipe.imageUrl;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-rule bg-card transition-colors hover:border-faint"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-paper">
        {imageUrl ? (
          // Recipe images come from arbitrary hosts, so next/image's remote
          // allowlist would need editing for every new site. A plain img keeps
          // importing from anywhere friction-free.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-serif text-4xl text-faint">
              {recipe.title.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        {recipe.isFavorite && (
          <div className="absolute top-2 right-2 rounded-full bg-card/90 p-1.5 backdrop-blur">
            <Star size={13} className="fill-accent text-accent" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h2 className="font-serif text-[17px] leading-snug font-semibold">
          {recipe.title}
        </h2>

        {recipe.sourceName && (
          <p className="mt-0.5 text-xs text-faint">{recipe.sourceName}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted">
          {time && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {time}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={12} />
            {recipe.servings}
          </span>
          <MacroLine
            macros={{
              calories: recipe.calories,
              proteinG: recipe.proteinG,
              carbsG: null,
              fatG: null,
              fiberG: null,
              sugarG: null,
              sodiumMg: null,
            }}
          />
        </div>
      </div>
    </Link>
  );
}
