"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { createFolder, deleteFolder, renameFolder } from "@/lib/actions";
import type { FolderWithCount } from "@/lib/queries";

/**
 * Folders are your own filing, kept separate from `recipes.tags` — those come
 * from whatever the source site published and are nobody's idea of a system.
 */
export function FolderBar({
  folders,
  activeId,
  search,
}: {
  folders: FolderWithCount[];
  activeId: number | null;
  search: string;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  const href = (folderId: number | null) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (folderId) params.set("folder", String(folderId));
    return params.toString() ? `/?${params}` : "/";
  };

  const submit = () => {
    const name = draft.trim();
    if (!name) return setAdding(false);
    setDraft("");
    setAdding(false);
    startTransition(() => void createFolder(name));
  };

  return (
    <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
      <Link
        href={href(null)}
        className={clsx(
          "shrink-0 rounded-full border px-3 py-1.5 text-sm",
          activeId === null
            ? "border-accent bg-accent-soft text-accent"
            : "border-rule bg-card text-muted hover:border-faint",
        )}
      >
        All
      </Link>

      {folders.map((folder) => (
        <FolderChip
          key={folder.id}
          folder={folder}
          href={href(folder.id)}
          isActive={activeId === folder.id}
          editing={editing}
        />
      ))}

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
          placeholder="Folder name"
          className="w-32 shrink-0 rounded-full border border-accent bg-card px-3 py-1.5 text-sm outline-none"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-full border border-dashed border-rule px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          <Plus size={13} className="inline" /> Folder
        </button>
      )}

      {folders.length > 0 && (
        <button
          onClick={() => setEditing((e) => !e)}
          aria-label={editing ? "Done editing folders" : "Edit folders"}
          className={clsx(
            "ml-auto shrink-0 rounded-full p-2",
            editing ? "text-accent" : "text-faint hover:text-ink",
          )}
        >
          {editing ? <Check size={14} /> : <Pencil size={13} />}
        </button>
      )}
    </div>
  );
}

function FolderChip({
  folder,
  href,
  isActive,
  editing,
}: {
  folder: FolderWithCount;
  href: string;
  isActive: boolean;
  editing: boolean;
}) {
  const [name, setName] = useState(folder.name);
  const [, startTransition] = useTransition();

  if (editing) {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full border border-rule bg-card py-0.5 pr-1 pl-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== folder.name) {
              startTransition(() => void renameFolder(folder.id, name));
            }
          }}
          className="w-24 bg-transparent py-1 text-sm outline-none"
        />
        <button
          onClick={() => {
            if (confirm(`Delete the "${folder.name}" folder? The recipes stay.`)) {
              startTransition(() => void deleteFolder(folder.id));
            }
          }}
          aria-label={`Delete ${folder.name}`}
          className="rounded-full p-1.5 text-faint hover:text-accent"
        >
          <Trash2 size={13} />
        </button>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={clsx(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm",
        isActive
          ? "border-accent bg-accent-soft text-accent"
          : "border-rule bg-card text-muted hover:border-faint",
      )}
    >
      {folder.name}
      {folder.count > 0 && (
        <span className="ml-1.5 text-xs text-faint tabular-nums">{folder.count}</span>
      )}
    </Link>
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
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn !py-1.5 !text-sm">
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
