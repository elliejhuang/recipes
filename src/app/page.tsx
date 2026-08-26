import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AlbumGrid, type AlbumTile } from "@/components/album-grid";
import { FolderControls, NewFolderTile } from "@/components/folder-bar";
import { RecipeCard } from "@/components/recipe-card";
import { SearchBar } from "@/components/search-bar";
import {
  listFolderAlbums,
  listRecipes,
  recentCovers,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folder?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";
  const folder = params.folder ?? null;

  // Searching cuts straight to results; otherwise the folders are the way in.
  const browsing = !search && folder === null;

  if (browsing) {
    const [albums, allRecipes, covers] = await Promise.all([
      listFolderAlbums(),
      listRecipes(),
      recentCovers(),
    ]);

    const tiles: AlbumTile[] = [
      {
        key: "all",
        name: "All recipes",
        count: allRecipes.length,
        covers,
        href: "/?folder=all",
      },
      ...albums.map((album) => ({
        key: String(album.id),
        name: album.name,
        count: album.count,
        covers: album.covers,
        href: `/?folder=${album.id}`,
      })),
    ];

    return (
      <div>
        <SearchBar initial={search} folderId={null} />
        <div className="mt-5">
          <AlbumGrid tiles={tiles} action={<NewFolderTile />} />
        </div>
        {allRecipes.length === 0 && <EmptyState />}
      </div>
    );
  }

  const folderId = folder && folder !== "all" ? Number(folder) : undefined;
  const [recipes, albums] = await Promise.all([
    listRecipes({ search, folderId }),
    listFolderAlbums(),
  ]);

  const current = albums.find((a) => a.id === folderId);
  const heading = search
    ? `“${search}”`
    : (current?.name ?? "All recipes");

  return (
    <div>
      <SearchBar initial={search} folderId={folderId ?? null} />

      <div className="mt-5 mb-3 flex items-center gap-2">
        <Link
          href="/"
          aria-label="Back to folders"
          className="-m-2 p-2 text-muted hover:text-ink"
        >
          <ArrowLeft size={16} />
        </Link>
        {current ? (
          <div className="min-w-0 flex-1">
            <FolderControls folder={current} />
          </div>
        ) : (
          <h1 className="font-serif text-xl font-semibold">{heading}</h1>
        )}
        <span className="shrink-0 text-xs text-faint tabular-nums">
          {recipes.length}
        </span>
      </div>

      {recipes.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted">Nothing here.</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
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
