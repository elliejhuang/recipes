import { AddRecipeTile } from "@/components/add-recipe-tile";
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
      <h1 className="mb-4 font-serif text-2xl font-semibold">Recipes</h1>
      <SearchBar initial={search} />

      <div className="mt-5">
        {search && recipes.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted">Nothing matches that.</p>
        ) : (
          <RecipeGrid
            recipes={recipes}
            lead={search ? undefined : <AddRecipeTile />}
          />
        )}
      </div>
    </div>
  );
}
