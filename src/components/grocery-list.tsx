"use client";

import { useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import type { GroceryItem } from "@/db/schema";
import {
  addGroceryItem,
  clearCheckedGroceryItems,
  deleteGroceryItem,
  generateGroceryList,
  toggleGroceryItem,
} from "@/lib/actions";
import { AISLES } from "@/lib/aisles";
import { formatQuantity, formatUnit } from "@/lib/units";

export function GroceryList({
  weekStart,
  items,
  plannedCount,
}: {
  weekStart: string;
  items: GroceryItem[];
  plannedCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");

  const checked = items.filter((item) => item.checked).length;

  // Keep the aisles in store-walk order, and drop the ones you don't need.
  const grouped = AISLES.map((aisle) => ({
    aisle,
    items: items.filter((item) => item.aisle === aisle),
  })).filter((group) => group.items.length > 0);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(() => void addGroceryItem(weekStart, text));
  };

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          onClick={() => startTransition(() => void generateGroceryList(weekStart))}
          disabled={pending || plannedCount === 0}
          className="btn btn-primary"
        >
          <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
          {items.some((i) => !i.isManual) ? "Rebuild from plan" : "Build from plan"}
        </button>

        {checked > 0 && (
          <button
            onClick={() =>
              startTransition(() => void clearCheckedGroceryItems(weekStart))
            }
            className="btn"
          >
            <Trash2 size={14} />
            Clear {checked} checked
          </button>
        )}

        <span className="ml-auto text-xs text-faint tabular-nums">
          {checked} of {items.length}
        </span>
      </div>

      {plannedCount === 0 && items.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          Nothing planned this week yet, so there&rsquo;s nothing to shop for.
          You can still jot items down below.
        </p>
      )}

      <div className="no-print mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add something else — “2 lemons”, “paper towels”…"
          className="field"
        />
        <button onClick={add} disabled={!draft.trim()} className="btn">
          <Plus size={15} />
        </button>
      </div>

      <div className="mt-7 space-y-7">
        {grouped.map(({ aisle, items: group }) => (
          <section key={aisle}>
            <h2 className="mb-2 border-b border-rule pb-1.5 text-xs font-semibold tracking-wider text-muted uppercase">
              {aisle}
            </h2>

            <ul>
              {group.map((item) => {
                const amount = item.quantity
                  ? `${formatQuantity(item.quantity)} ${formatUnit(
                      item.unit,
                      item.quantity,
                    )}`.trim()
                  : "";

                return (
                  <li key={item.id} className="group flex items-start gap-3 py-2 sm:py-1.5">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) =>
                        startTransition(
                          () => void toggleGroceryItem(item.id, e.target.checked),
                        )
                      }
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
                    />

                    <div
                      className={clsx(
                        "min-w-0 flex-1",
                        item.checked && "text-faint line-through",
                      )}
                    >
                      <span className="text-[15px]">
                        {amount && (
                          <span className="font-medium tabular-nums">{amount} </span>
                        )}
                        {item.name}
                      </span>
                      {item.detail && !item.checked && (
                        <p className="text-[11px] leading-snug text-faint">
                          {item.detail}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() =>
                        startTransition(() => void deleteGroceryItem(item.id))
                      }
                      aria-label={`Remove ${item.name}`}
                      className="no-print -m-2 p-2 text-faint hover:text-accent sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
