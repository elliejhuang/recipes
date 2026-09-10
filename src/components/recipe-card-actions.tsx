"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { deleteRecipe } from "@/lib/actions";

/** Edit/delete, overlaid on a recipe card's photo. */
export function RecipeCardActions({ id, title }: { id: number; title: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <Link
        href={`/recipes/${id}?edit=1`}
        onClick={(e) => e.stopPropagation()}
        aria-label="Edit recipe"
        className="rounded-lg bg-paper/90 p-1.5 text-ink shadow-sm backdrop-blur hover:bg-card"
      >
        <Pencil size={13} />
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirm(`Delete "${title}"? This can't be undone.`)) {
            startTransition(() => void deleteRecipe(id));
          }
        }}
        disabled={pending}
        aria-label="Delete recipe"
        className="rounded-lg bg-paper/90 p-1.5 text-muted shadow-sm backdrop-blur hover:!text-accent"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
