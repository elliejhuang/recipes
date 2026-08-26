"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import {
  addGroceryItem,
  clearCheckedItems,
  createGroceryList,
  deleteGroceryItem,
  deleteGroceryList,
  renameGroceryItem,
  renameGroceryList,
  toggleGroceryItem,
} from "@/lib/actions";
import type { ListWithItems } from "@/lib/queries";
import { formatQuantity, formatUnit } from "@/lib/units";

export function GroceryLists({ lists }: { lists: ListWithItems[] }) {
  const [activeId, setActiveId] = useState(lists[0]?.id ?? null);
  const [, startTransition] = useTransition();

  const active = lists.find((l) => l.id === activeId) ?? lists[0];

  return (
    <div>
      <div className="-mx-4 mb-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {lists.map((list) => {
          const outstanding = list.items.filter((i) => !i.checked).length;
          return (
            <button
              key={list.id}
              onClick={() => setActiveId(list.id)}
              className={clsx(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                list.id === active?.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-rule bg-card text-muted hover:border-faint",
              )}
            >
              {list.name}
              {outstanding > 0 && (
                <span className="ml-1.5 text-xs text-faint tabular-nums">
                  {outstanding}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() =>
            startTransition(async () => {
              const id = await createGroceryList("New list");
              setActiveId(id);
            })
          }
          className="shrink-0 rounded-full border border-dashed border-rule px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          <Plus size={13} className="inline" /> List
        </button>
      </div>

      {active && <SingleList key={active.id} list={active} />}
    </div>
  );
}

function SingleList({ list }: { list: ListWithItems }) {
  const [draft, setDraft] = useState("");
  const [name, setName] = useState(list.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const checked = list.items.filter((i) => i.checked).length;

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      await addGroceryItem(list.id, text);
      // Notes-app behaviour: the caret stays put so you can keep typing items.
      inputRef.current?.focus();
    });
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {list.isAuto ? (
          <h1 className="font-serif text-xl font-semibold">{list.name}</h1>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name !== list.name) {
                startTransition(() => void renameGroceryList(list.id, name));
              }
            }}
            aria-label="List name"
            className="min-w-0 flex-1 border-none bg-transparent p-0 font-serif text-xl font-semibold outline-none"
          />
        )}

        {checked > 0 && (
          <button
            onClick={() => startTransition(() => void clearCheckedItems(list.id))}
            className="ml-auto shrink-0 text-xs text-muted hover:text-accent"
          >
            Clear {checked} done
          </button>
        )}

        {!list.isAuto && (
          <button
            onClick={() => {
              if (confirm(`Delete the "${list.name}" list?`)) {
                startTransition(() => void deleteGroceryList(list.id));
              }
            }}
            aria-label="Delete list"
            className="shrink-0 p-1.5 text-faint hover:text-accent"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {list.isAuto && (
        <p className="mb-3 text-xs text-faint">
          Built from what you want to make. Updates itself; anything you add by
          hand stays put.
        </p>
      )}

      <ul>
        {list.items.map((item) => (
          // Keyed on the name too: when a plan change rebuilds the list, the
          // row remounts with the server's value rather than holding a stale
          // one. Renames only land on blur, so nothing is lost mid-edit.
          <Row key={`${item.id}:${item.name}`} item={item} />
        ))}
      </ul>

      {/* Always-present final row, the way a checklist works. */}
      <div className="mt-1 flex items-center gap-3 py-2">
        <span className="h-[18px] w-[18px] shrink-0 rounded border border-dashed border-faint" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          onBlur={add}
          placeholder="Add an item"
          className="min-w-0 flex-1 border-none bg-transparent p-0 text-[15px] outline-none"
        />
      </div>

      {list.items.length === 0 && !list.isAuto && (
        <p className="mt-6 text-sm text-faint">
          Empty. Type above and press return.
        </p>
      )}
    </section>
  );
}

function Row({ item }: { item: ListWithItems["items"][number] }) {
  const [name, setName] = useState(item.name);
  const [, startTransition] = useTransition();

  const amount = item.quantity
    ? `${formatQuantity(item.quantity)} ${formatUnit(item.unit, item.quantity)}`.trim()
    : "";

  return (
    <li className="group flex items-start gap-3 py-2">
      <button
        onClick={() =>
          startTransition(() => void toggleGroceryItem(item.id, !item.checked))
        }
        aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
        className={clsx(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
          item.checked ? "border-accent bg-accent text-white" : "border-faint",
        )}
      >
        {item.checked && <Check size={12} strokeWidth={3} />}
      </button>

      <div className={clsx("min-w-0 flex-1", item.checked && "opacity-45")}>
        <div className="flex items-baseline gap-1.5">
          {amount && (
            <span className="shrink-0 text-[15px] font-medium tabular-nums">
              {amount}
            </span>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name !== item.name) {
                startTransition(() => void renameGroceryItem(item.id, name));
              }
            }}
            aria-label="Item"
            className={clsx(
              "min-w-0 flex-1 border-none bg-transparent p-0 text-[15px] outline-none",
              item.checked && "line-through",
            )}
          />
        </div>
        {item.detail && !item.checked && (
          <p className="text-[11px] leading-snug text-faint">{item.detail}</p>
        )}
      </div>

      <button
        onClick={() => startTransition(() => void deleteGroceryItem(item.id))}
        aria-label={`Remove ${item.name}`}
        className="-m-2 shrink-0 p-2 text-faint hover:text-accent sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X size={14} />
      </button>
    </li>
  );
}
