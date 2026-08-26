"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, Plus, Trash2, X } from "lucide-react";
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
import type { GroceryListWithItems } from "@/lib/queries";
import { formatMeasure } from "@/lib/units";

export function GroceryLists({ lists }: { lists: GroceryListWithItems[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const open = lists.find((l) => l.id === openId);

  if (open) {
    return (
      <div>
        <button
          onClick={() => setOpenId(null)}
          className="mb-3 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={15} />
          All lists
        </button>
        <SingleList key={open.id} list={open} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {lists.map((list) => {
        const outstanding = list.items.filter((i) => !i.checked).length;
        return (
          <button
            key={list.id}
            onClick={() => setOpenId(list.id)}
            className="group text-left"
          >
            <div className="flex aspect-square flex-col justify-start rounded-xl border border-rule bg-card p-3 transition-colors group-hover:border-faint">
              <ul className="space-y-1 overflow-hidden">
                {list.items.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className={clsx(
                      "truncate text-xs",
                      item.checked ? "text-faint line-through" : "text-muted",
                    )}
                  >
                    {item.name}
                  </li>
                ))}
                {list.items.length === 0 && (
                  <li className="text-xs text-faint">Empty</li>
                )}
              </ul>
            </div>
            <div className="mt-1.5 px-0.5">
              <div className="truncate text-sm font-medium">{list.name}</div>
              <div className="text-xs text-faint tabular-nums">
                {outstanding} to buy
              </div>
            </div>
          </button>
        );
      })}

      <div>
        <button
          onClick={() =>
            startTransition(async () => {
              const id = await createGroceryList("New list");
              setOpenId(id);
            })
          }
          className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-rule text-muted hover:border-accent hover:text-accent"
        >
          <Plus size={20} />
          <span className="text-xs">New list</span>
        </button>
        <div className="mt-1.5 px-0.5 text-sm font-medium text-transparent">.</div>
      </div>
    </div>
  );
}

function SingleList({ list }: { list: GroceryListWithItems }) {
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

function Row({ item }: { item: GroceryListWithItems["items"][number] }) {
  const [name, setName] = useState(item.name);
  const [, startTransition] = useTransition();

  // "butter (¾ cup)" — the thing you're looking for on the shelf leads, and
  // the amount is the detail you check once you've found it.
  const amount = formatMeasure(item.quantity, item.unit);

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

      {/* Ticking something off strikes it through and changes nothing else —
          the amount and what it's for are exactly what you re-read when you
          wonder whether you already grabbed it. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
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
          {amount && (
            <span
              className={clsx(
                "shrink-0 text-[15px] text-muted tabular-nums",
                item.checked && "line-through",
              )}
            >
              ({amount})
            </span>
          )}
        </div>
        {item.detail && (
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
