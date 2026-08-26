"use client";

import { useOptimistic, useTransition } from "react";
import { Printer, Star } from "lucide-react";
import { clsx } from "clsx";
import { toggleFavorite } from "@/lib/actions";

export function FavoriteButton({
  id,
  isFavorite,
}: {
  id: number;
  isFavorite: boolean;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await toggleFavorite(id, !optimistic);
        })
      }
      className={clsx("btn", optimistic && "!border-accent !text-accent")}
    >
      <Star size={14} className={optimistic ? "fill-accent" : ""} />
      {optimistic ? "Favorited" : "Favorite"}
    </button>
  );
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn">
      <Printer size={14} />
      Print
    </button>
  );
}
