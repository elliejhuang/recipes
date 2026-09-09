"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Loader2, Plus } from "lucide-react";
import { clsx } from "clsx";
import { createList, setRecipeLists } from "@/lib/actions";
import type { ListWithCount } from "@/lib/queries";

/**
 * Every list, with the ones this recipe is already on ticked. This is the only
 * place list membership is shown — it isn't worth a row of chips on a recipe
 * you're in the middle of reading.
 */
export function AddToListButton({
  recipeId,
  lists,
  listIds,
}: {
  recipeId: number;
  lists: ListWithCount[];
  listIds: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(listIds);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const apply = (next: number[]) => {
    setSelected(next);
    startTransition(async () => {
      await setRecipeLists(recipeId, next);
      router.refresh();
    });
  };

  const submitNew = () => {
    const name = draft.trim();
    setDraft("");
    setAdding(false);
    if (!name) return;
    startTransition(async () => {
      const id = await createList(name);
      await setRecipeLists(recipeId, [...selected, id]);
      setSelected((s) => [...s, id]);
      router.refresh();
    });
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Save to a list"
        className="shrink-0 rounded-lg p-2 text-ink hover:bg-card"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Bookmark size={16} />}
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-20 mt-1 max-h-72 min-w-52 overflow-y-auto rounded-xl border border-rule bg-card p-1 shadow-lg">
            {lists.map((list) => {
              const isOn = selected.includes(list.id);
              return (
                <button
                  key={list.id}
                  onClick={() =>
                    apply(
                      isOn
                        ? selected.filter((id) => id !== list.id)
                        : [...selected, list.id],
                    )
                  }
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm hover:bg-paper"
                >
                  <span
                    className={clsx(
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
                      isOn ? "border-accent bg-accent text-white" : "border-faint",
                    )}
                  >
                    {isOn && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 truncate">{list.name}</span>
                </button>
              );
            })}

            <div className="mt-1 border-t border-rule pt-1">
              {adding ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={submitNew}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNew();
                    if (e.key === "Escape") {
                      setDraft("");
                      setAdding(false);
                    }
                  }}
                  placeholder="New list name"
                  className="w-full rounded-lg px-2.5 py-2 text-sm outline-none"
                />
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted hover:bg-paper"
                >
                  <Plus size={16} className="shrink-0" />
                  New list
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
