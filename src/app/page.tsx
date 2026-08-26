import Link from "next/link";
import { RecipeGrid } from "@/components/recipe-card";
import { SearchBar } from "@/components/search-bar";
import { listRecipes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const recipes = await listRecipes({ search });

  return (
    <div>
      <SearchBar initial={search} />

      <div className="mt-5">
        {recipes.length === 0 ? (
          search ? (
            <p className="mt-12 text-center text-sm text-muted">Nothing matches that.</p>
          ) : (
            <EmptyState />
          )
        ) : (
          <RecipeGrid recipes={recipes} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 text-center">
      <h1 className="font-serif text-2xl font-semibold">Your recipe box is empty.</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        Paste a link from any recipe site and it&rsquo;ll pull in the ingredients
        and nutrition, skipping the four paragraphs about someone&rsquo;s trip to
        Tuscany.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/recipes/import" className="btn btn-primary">
          Import from a link
        </Link>
        <Link href="/recipes/new" className="btn">
          Type one in
        </Link>
      </div>
    </div>
  );
}
