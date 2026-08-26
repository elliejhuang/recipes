"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createList, deleteList, renameList } from "@/lib/actions";
import type { ListWithCount } from "@/lib/queries";

/** The trailing tile on the Lists page. */
export function NewListTile() {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  const submit = () => {
    const name = draft.trim();
    setDraft("");
    setAdding(false);
    if (!name) return;
    startTransition(async () => {
      const id = await createList(name);
      router.push(`/lists/${id}`);
    });
  };

  return (
    <div>
      <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-rule">
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="Name"
            className="w-3/4 border-b border-rule bg-transparent pb-1 text-center text-sm outline-none"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted hover:text-accent"
          >
            <Plus size={20} />
            <span className="text-xs">New list</span>
          </button>
        )}
      </div>
      {/* Keeps this tile's height in step with the labelled ones beside it. */}
      <div className="mt-1.5 px-0.5 text-sm font-medium text-transparent">.</div>
    </div>
  );
}

/** Rename and delete, on the list's own page. "To Make" can do neither. */
export function ListHeader({ list }: { list: ListWithCount }) {
  const router = useRouter();
  const [name, setName] = useState(list.name);
  const [, startTransition] = useTransition();

  if (list.isDefault) {
    return (
      <h1 className="min-w-0 flex-1 font-serif text-xl font-semibold">{list.name}</h1>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== list.name) {
            startTransition(() => void renameList(list.id, name));
          }
        }}
        aria-label="List name"
        className="min-w-0 flex-1 border-none bg-transparent p-0 font-serif text-xl font-semibold outline-none"
      />
      <button
        onClick={() => {
          if (confirm(`Delete the "${list.name}" list? The recipes stay.`)) {
            startTransition(async () => {
              await deleteList(list.id);
              router.push("/lists");
            });
          }
        }}
        aria-label={`Delete ${list.name}`}
        className="shrink-0 p-2 text-faint hover:text-accent"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
