"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { createFolder, deleteFolder, renameFolder } from "@/lib/actions";
import type { FolderWithCount } from "@/lib/queries";

/**
 * The trailing tile in the album grid.
 *
 * Folders are your own filing, kept separate from `recipes.tags` — those come
 * from whatever the source site published.
 */
export function NewFolderTile() {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  const submit = () => {
    const name = draft.trim();
    setDraft("");
    setAdding(false);
    if (name) startTransition(() => void createFolder(name));
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
            <span className="text-xs">New folder</span>
          </button>
        )}
      </div>
      {/* Keeps this tile's height in step with the labelled ones beside it. */}
      <div className="mt-1.5 px-0.5 text-sm font-medium text-transparent">.</div>
    </div>
  );
}

/** Rename and delete, offered on the folder's own page. */
export function FolderControls({ folder }: { folder: FolderWithCount }) {
  const [name, setName] = useState(folder.name);
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== folder.name) {
            startTransition(() => void renameFolder(folder.id, name));
          }
        }}
        aria-label="Folder name"
        className="min-w-0 flex-1 border-none bg-transparent p-0 font-serif text-xl font-semibold outline-none"
      />
      <button
        onClick={() => {
          if (confirm(`Delete the "${folder.name}" folder? The recipes stay.`)) {
            startTransition(() => void deleteFolder(folder.id));
          }
        }}
        aria-label={`Delete ${folder.name}`}
        className="shrink-0 p-2 text-faint hover:text-accent"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/** Assigns a recipe to folders, from the recipe page. */
export function FolderPicker({
  recipeId,
  folders,
  selected,
  onChange,
}: {
  recipeId: number;
  folders: FolderWithCount[];
  selected: number[];
  onChange: (next: number[]) => void;
}) {
  const [open, setOpen] = useState(false);

  if (folders.length === 0) return null;

  const chosen = folders.filter((f) => selected.includes(f.id));

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "rounded-full border px-3 py-1 text-sm",
          chosen.length
            ? "border-accent bg-accent-soft text-accent"
            : "border-dashed border-rule text-muted hover:border-accent hover:text-accent",
        )}
      >
        {chosen.length ? chosen.map((f) => f.name).join(", ") : "Add to folder"}
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-20 mt-1 min-w-44 rounded-xl border border-rule bg-card p-1 shadow-lg">
            {folders.map((folder) => {
              const isOn = selected.includes(folder.id);
              return (
                <button
                  key={folder.id}
                  onClick={() =>
                    onChange(
                      isOn
                        ? selected.filter((id) => id !== folder.id)
                        : [...selected, folder.id],
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-paper"
                >
                  <span
                    className={clsx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isOn ? "border-accent bg-accent text-white" : "border-rule",
                    )}
                  >
                    {isOn && <Check size={11} strokeWidth={3} />}
                  </span>
                  {folder.name}
                </button>
              );
            })}
            <button
              onClick={() => setOpen(false)}
              className="mt-1 flex w-full items-center justify-center gap-1 border-t border-rule px-2.5 py-2 text-xs text-muted"
            >
              <X size={11} /> Close
            </button>
          </div>
        </>
      )}
      <input type="hidden" value={recipeId} readOnly />
    </div>
  );
}
