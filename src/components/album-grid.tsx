import Link from "next/link";
import { clsx } from "clsx";

export type AlbumTile = {
  key: string;
  name: string;
  count: number;
  /** Up to four images, collaged behind the name the way a photo album looks. */
  covers: string[];
  href?: string;
};

/**
 * Square tiles, two to a row on a phone. Folders and grocery lists both browse
 * this way, so a tap opens one rather than a chip filtering in place.
 */
export function AlbumGrid({
  tiles,
  action,
}: {
  tiles: AlbumTile[];
  /** The "new list" tile. Leads the grid — making one is the first thing you
      want when there's nothing here, and it stays in a predictable place once
      there is. */
  action?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {action}
      {tiles.map((tile) => {
        const inner = <AlbumFace tile={tile} />;
        return tile.href ? (
          <Link key={tile.key} href={tile.href} className="group">
            {inner}
          </Link>
        ) : (
          <div key={tile.key}>{inner}</div>
        );
      })}
    </div>
  );
}

function AlbumFace({ tile }: { tile: AlbumTile }) {
  const covers = tile.covers.slice(0, 4);

  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-xl border border-rule bg-card transition-colors group-hover:border-faint">
        {covers.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="font-serif text-3xl text-faint">
              {tile.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        ) : (
          <div
            className={clsx(
              "grid h-full w-full gap-px",
              covers.length === 1 ? "grid-cols-1" : "grid-cols-2",
              covers.length > 2 ? "grid-rows-2" : "grid-rows-1",
            )}
          >
            {covers.map((url, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={index}
                src={url}
                alt=""
                loading="lazy"
                className={clsx(
                  "h-full w-full object-cover",
                  // Three images: the first spans the full left column so the
                  // tile doesn't end on an obvious gap.
                  covers.length === 3 && index === 0 && "row-span-2",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-1.5 px-0.5">
        <div className="truncate text-sm font-medium">{tile.name}</div>
        <div className="text-xs text-faint tabular-nums">
          {tile.count} {tile.count === 1 ? "recipe" : "recipes"}
        </div>
      </div>
    </div>
  );
}
