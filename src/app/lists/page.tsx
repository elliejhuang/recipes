import { AlbumGrid, type AlbumTile } from "@/components/album-grid";
import { NewListTile } from "@/components/list-albums";
import { ensureDefaultList, listAlbums } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  // "To Make" is always there, even on a database that has never seen one.
  await ensureDefaultList();
  const albums = await listAlbums();

  const tiles: AlbumTile[] = albums.map((album) => ({
    key: String(album.id),
    name: album.name,
    count: album.count,
    covers: album.covers,
    href: `/lists/${album.id}`,
  }));

  return (
    <div>
      <h1 className="mb-4 font-serif text-xl font-semibold">Lists</h1>
      <AlbumGrid tiles={tiles} action={<NewListTile />} />
    </div>
  );
}
