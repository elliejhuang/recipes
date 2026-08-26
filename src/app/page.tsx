import Link from "next/link";
import { Link2, Plus, Star } from "lucide-react";
import { clsx } from "clsx";
import { RecipeCard } from "@/components/recipe-card";
import { SearchBar } from "@/components/search-bar";
import { getAllTags, listRecipes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; fav?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const tag = params.tag;
  const favoritesOnly = params.fav === "1";

  const [recipes, tags] = await Promise.all([
    listRecipes({ search, tag, favoritesOnly }),
    getAllTags(),
  ]);

  const filtering = Boolean(search || tag || favoritesOnly);

  const chipHref = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const merged = { q: search || undefined, tag, fav: favoritesOnly ? "1" : undefined, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    return query.toString() ? `/?${query}` : "/";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar initial={search} />
        <Link
          href={chipHref({ fav: favoritesOnly ? undefined : "1" })}
          className={clsx(
            "btn",
            favoritesOnly && "!border-accent !bg-accent-soft !text-accent",
          )}
        >
          <Star size={14} className={favoritesOnly ? "fill-accent" : ""} />
          Favorites
        </Link>
        <Link href="/recipes/import" className="btn">
          <Link2 size={14} />
          Import
        </Link>
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 18).map(({ tag: name, count }) => (
            <Link
              key={name}
              href={chipHref({ tag: tag === name ? undefined : name })}
              className={clsx(
                "rounded-full border px-2.5 py-1 text-xs",
                tag === name
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-rule bg-card text-muted hover:border-faint",
              )}
            >
              {name}
              <span className="ml-1 text-faint tabular-nums">{count}</span>
            </Link>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <EmptyState filtering={filtering} />
      ) : (
        <>
          <p className="mt-6 text-xs text-faint">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ filtering }: { filtering: boolean }) {
  if (filtering) {
    return (
      <div className="mt-16 text-center">
        <p className="font-serif text-xl">Nothing matches that.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-accent underline">
          Clear filters
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-16 text-center">
      <h1 className="font-serif text-2xl font-semibold">Your recipe box is empty.</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        Paste a link from any recipe site and it&rsquo;ll pull in the ingredients,
        steps, and nutrition — skipping the four paragraphs about someone&rsquo;s
        trip to Tuscany.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/recipes/import" className="btn btn-primary">
          <Link2 size={15} />
          Import from a link
        </Link>
        <Link href="/recipes/new" className="btn">
          <Plus size={15} />
          Type one in
        </Link>
      </div>
    </div>
  );
}
