import Link from "next/link";
import { FolderBar } from "@/components/folder-bar";
import { RecipeCard } from "@/components/recipe-card";
import { SearchBar } from "@/components/search-bar";
import { listFolders, listRecipes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folder?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const folderId = params.folder ? Number(params.folder) : null;

  const [recipes, folders] = await Promise.all([
    listRecipes({ search, folderId: folderId ?? undefined }),
    listFolders(),
  ]);

  return (
    <div>
      <SearchBar initial={search} folderId={folderId} />

      <div className="mt-3">
        <FolderBar folders={folders} activeId={folderId} search={search} />
      </div>

      {recipes.length === 0 ? (
        <EmptyState filtering={Boolean(search || folderId)} />
      ) : (
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ filtering }: { filtering: boolean }) {
  if (filtering) {
    return (
      <div className="mt-16 text-center">
        <p className="font-serif text-xl">Nothing here.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-accent underline">
          Show everything
        </Link>
      </div>
    );
  }

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
