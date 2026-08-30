"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2, PencilLine, Plus } from "lucide-react";

/**
 * Leads the recipe grid. There are two ways in — paste a link, or write it
 * yourself — and one tile that offers both beats a permanent button in the
 * header competing with the nav.
 */
export function AddRecipeTile() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-rule">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted hover:text-accent"
        >
          <Plus size={22} />
          <span className="text-xs">Add recipe</span>
        </button>
      </div>
      {/* Keeps this tile's height in step with the titled ones beside it. */}
      <div className="mt-1.5 px-0.5 text-[15px] font-semibold text-transparent">.</div>

      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-1/2 left-1/2 z-20 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rule bg-card p-1 shadow-lg">
            <Link
              href="/recipes/import"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm hover:bg-paper"
            >
              <Link2 size={15} className="shrink-0 text-muted" />
              Paste a link
            </Link>
            <Link
              href="/recipes/new"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm hover:bg-paper"
            >
              <PencilLine size={15} className="shrink-0 text-muted" />
              Write it myself
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
