import { AlbumGrid, type AlbumTile } from "@/components/album-grid";
import { NewListTile } from "@/components/list-albums";
import { SearchBar } from "@/components/search-bar";
import { ensureDefaultList, listAlbums } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const search = params.q ?? "";

  // "To Make" is always there, even on a database that has never seen one.
  await ensureDefaultList();
  const albums = await listAlbums({ search });

  const tiles: AlbumTile[] = albums.map((album) => ({
    key: String(album.id),
    name: album.name,
    count: album.count,
    covers: album.covers,
    href: `/lists/${album.id}`,
  }));

  return (
    <div>
      <h1 className="mb-4 font-serif text-2xl font-semibold">Lists</h1>
      <SearchBar initial={search} basePath="/lists" placeholder="Search lists…" />
      <div className="mt-5">
        <AlbumGrid tiles={tiles} action={!search ? <NewListTile /> : undefined} />
      </div>
    </div>
  );
}
