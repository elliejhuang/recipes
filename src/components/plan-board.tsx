"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightLeft, Plus, Search, X } from "lucide-react";
import { clsx } from "clsx";
import type { Recipe } from "@/db/schema";
import {
  addToPlan,
  movePlanEntry,
  removeFromPlan,
  updatePlanServings,
} from "@/lib/actions";
import { MEALS, formatDayLabel, todayKey, weekDays } from "@/lib/dates";
import { sumMacros, type Macros } from "@/lib/nutrition";
import type { PlanEntry } from "@/lib/queries";

export function PlanBoard({
  weekStart,
  entries,
  recipes,
}: {
  weekStart: string;
  entries: PlanEntry[];
  recipes: Recipe[];
}) {
  const [picking, setPicking] = useState<{ date: string; meal: string } | null>(
    null,
  );
  const [dragging, setDragging] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const days = weekDays(weekStart);
  const today = todayKey();

  // A phone shows one day at a time. Seven stacked cards of mostly-empty meal
  // slots is a very long scroll to reach Sunday, and the week is legible as a
  // grid only when it fits on one screen anyway.
  const [openDay, setOpenDay] = useState(
    () => (days.includes(today) ? today : days[0]),
  );
  const selectedDay = days.includes(openDay) ? openDay : days[0];

  const byslot = useMemo(() => {
    const map = new Map<string, PlanEntry[]>();
    for (const entry of entries) {
      const key = `${entry.date}|${entry.meal}`;
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }, [entries]);

  const dayMacros = (date: string): Macros =>
    sumMacros(
      entries
        .filter((entry) => entry.date === date)
        .map((entry) => ({
          servings: entry.servings,
          macros: {
            calories: entry.recipe.calories,
            proteinG: entry.recipe.proteinG,
            carbsG: entry.recipe.carbsG,
            fatG: entry.recipe.fatG,
            fiberG: null,
            sugarG: null,
            sodiumMg: null,
          },
        })),
    );

  const drop = (date: string, meal: string) => {
    if (dragging === null) return;
    const entry = entries.find((e) => e.id === dragging);
    setDragging(null);
    if (!entry || (entry.date === date && entry.meal === meal)) return;
    startTransition(() => void movePlanEntry(dragging, date, meal));
  };

  const dayCount = (date: string) =>
    entries.filter((entry) => entry.date === date).length;

  return (
    <>
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden">
        {days.map((date) => {
          const { weekday, date: label } = formatDayLabel(date);
          const count = dayCount(date);
          return (
            <button
              key={date}
              onClick={() => setOpenDay(date)}
              className={clsx(
                "flex shrink-0 flex-col items-center rounded-lg border px-3 py-1.5 text-xs",
                date === selectedDay
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-rule bg-card text-muted",
              )}
            >
              <span className="font-semibold">{weekday}</span>
              <span className="text-[10px] opacity-70">{label}</span>
              {count > 0 && (
                <span
                  className="mt-1 h-1 w-1 rounded-full bg-current"
                  aria-label={`${count} planned`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((date) => {
          const { weekday, date: label } = formatDayLabel(date);
          const macros = dayMacros(date);
          const isToday = date === today;

          return (
            <section
              key={date}
              className={clsx(
                "flex-col rounded-xl border bg-card p-2.5",
                isToday ? "border-accent" : "border-rule",
                date === selectedDay ? "flex" : "hidden xl:flex",
              )}
            >
              <header className="flex items-baseline justify-between px-0.5 pb-2">
                <h2
                  className={clsx(
                    "text-sm font-semibold",
                    isToday ? "text-accent" : "",
                  )}
                >
                  {weekday}
                </h2>
                <span className="text-xs text-faint">{label}</span>
              </header>

              <div className="flex-1 space-y-2.5">
                {MEALS.map((meal) => {
                  const slot = byslot.get(`${date}|${meal}`) ?? [];
                  return (
                    <div
                      key={meal}
                      onDragOver={(e) => {
                        if (dragging !== null) e.preventDefault();
                      }}
                      onDrop={() => drop(date, meal)}
                      className={clsx(
                        "rounded-lg p-1 transition-colors",
                        dragging !== null && "bg-paper outline-1 outline-dashed outline-rule",
                      )}
                    >
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">
                          {meal}
                        </span>
                        <button
                          onClick={() => setPicking({ date, meal })}
                          aria-label={`Add to ${meal} on ${weekday}`}
                          className="-m-2 p-2 text-faint hover:text-accent"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div className="mt-1 space-y-1">
                        {slot.map((entry) => (
                          <PlanTile
                            key={entry.id}
                            entry={entry}
                            weekStart={weekStart}
                            onDragStart={() => setDragging(entry.id)}
                            onDragEnd={() => setDragging(null)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {macros.calories !== null && (
                <footer className="mt-2.5 border-t border-rule px-1 pt-2 text-[11px] tabular-nums text-muted">
                  <span className="font-medium text-ink">
                    {Math.round(macros.calories)}
                  </span>{" "}
                  cal
                  {macros.proteinG !== null && (
                    <span className="text-faint">
                      {" · "}
                      {Math.round(macros.proteinG)}p
                      {macros.carbsG !== null && ` ${Math.round(macros.carbsG)}c`}
                      {macros.fatG !== null && ` ${Math.round(macros.fatG)}f`}
                    </span>
                  )}
                </footer>
              )}
            </section>
          );
        })}
      </div>

      {picking && (
        <RecipePicker
          recipes={recipes}
          onClose={() => setPicking(null)}
          onPick={(recipeId) => {
            startTransition(
              () =>
                void addToPlan({
                  recipeId,
                  date: picking.date,
                  meal: picking.meal,
                }),
            );
            setPicking(null);
          }}
        />
      )}
    </>
  );
}

function PlanTile({
  entry,
  weekStart,
  onDragStart,
  onDragEnd,
}: {
  entry: PlanEntry;
  weekStart: string;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [, startTransition] = useTransition();
  const [moving, setMoving] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group relative cursor-grab rounded-lg border border-rule bg-paper p-1.5 active:cursor-grabbing"
    >
      <Link
        href={`/recipes/${entry.recipe.id}`}
        className="block pr-9 text-xs leading-snug font-medium hover:text-accent"
      >
        {entry.recipe.title}
      </Link>

      {moving && (
        // Dragging is a nicety that doesn't exist on a touchscreen, so every
        // move is also reachable through plain selects.
        <div className="mt-1.5 space-y-1">
          <select
            value={entry.date}
            onChange={(e) =>
              startTransition(() => {
                setMoving(false);
                void movePlanEntry(entry.id, e.target.value, entry.meal);
              })
            }
            aria-label="Day"
            className="w-full rounded border border-rule bg-card px-1 py-0.5 text-[11px]"
          >
            {weekDays(weekStart).map((day) => {
              const { weekday, date } = formatDayLabel(day);
              return (
                <option key={day} value={day}>
                  {weekday} {date}
                </option>
              );
            })}
          </select>
          <select
            value={entry.meal}
            onChange={(e) =>
              startTransition(() => {
                setMoving(false);
                void movePlanEntry(entry.id, entry.date, e.target.value);
              })
            }
            aria-label="Meal"
            className="w-full rounded border border-rule bg-card px-1 py-0.5 text-[11px] capitalize"
          >
            {MEALS.map((meal) => (
              <option key={meal} value={meal}>
                {meal}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          min={0.25}
          step={0.5}
          defaultValue={entry.servings}
          onBlur={(e) => {
            const value = Number(e.target.value);
            if (value && value !== entry.servings) {
              startTransition(() => void updatePlanServings(entry.id, value));
            }
          }}
          aria-label="Servings"
          className="w-11 rounded border border-rule bg-card px-1 py-0.5 text-[11px] tabular-nums"
        />
        <span className="text-[10px] text-faint">
          {entry.servings === 1 ? "serving" : "servings"}
        </span>
      </div>

      <div className="absolute top-1 right-1 flex gap-1.5">
        <button
          onClick={() => setMoving((m) => !m)}
          aria-label="Move to another day or meal"
          aria-expanded={moving}
          className="-m-1.5 p-1.5 text-faint hover:text-accent"
        >
          <ArrowRightLeft size={11} />
        </button>
        <button
          onClick={() => startTransition(() => void removeFromPlan(entry.id))}
          aria-label="Remove from plan"
          className="-m-1.5 p-1.5 text-faint hover:text-accent"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function RecipePicker({
  recipes,
  onPick,
  onClose,
}: {
  recipes: Recipe[];
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? recipes.filter((r) =>
        r.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : recipes;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-rule bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-rule">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Which recipe?"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && filtered[0]) onPick(filtered[0].id);
            }}
            className="w-full bg-transparent py-3 pr-4 pl-10 text-sm outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-faint">
              No recipes match that.
            </p>
          ) : (
            filtered.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => onPick(recipe.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-paper"
              >
                {recipe.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.imageUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-paper font-serif text-sm text-faint">
                    {recipe.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{recipe.title}</div>
                  <div className="text-[11px] text-faint">
                    Serves {recipe.servings}
                    {recipe.calories !== null &&
                      ` · ${Math.round(recipe.calories)} cal`}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
