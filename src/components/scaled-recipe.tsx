"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clsx } from "clsx";
import type { Ingredient, Step } from "@/db/schema";
import { MacroSummary } from "./macros";
import { estimateMacros, type Macros } from "@/lib/nutrition";
import { formatQuantity, formatUnit } from "@/lib/units";

export function ScaledRecipe({
  baseServings,
  ingredients,
  steps,
  storedMacros,
  nutritionSource,
}: {
  baseServings: number;
  ingredients: Ingredient[];
  steps: Step[];
  storedMacros: Macros;
  nutritionSource: string | null;
}) {
  const [servings, setServings] = useState(baseServings);
  const [done, setDone] = useState<Set<number>>(new Set());

  const scale = servings / Math.max(1, baseServings);

  // Macros are stored per serving, so scaling the batch doesn't change them —
  // but if the recipe has none stored, estimate on the fly so the page isn't
  // simply blank about it.
  const hasStored = storedMacros.calories !== null;
  const estimate = useMemo(
    () => estimateMacros(ingredients, baseServings),
    [ingredients, baseServings],
  );

  const macros = hasStored ? storedMacros : estimate.perServing;
  const source = hasStored ? nutritionSource : "estimated";

  const toggle = (id: number) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-10 lg:grid-cols-[19rem_1fr] lg:items-start">
      <aside className="space-y-5 lg:sticky lg:top-20">
        <div className="flex items-center justify-between rounded-xl border border-rule bg-card px-3 py-2.5">
          <span className="text-sm text-muted">Serves</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              aria-label="Fewer servings"
              className="btn !p-1.5"
              disabled={servings <= 1}
            >
              <Minus size={13} />
            </button>
            <span className="w-9 text-center font-serif text-lg font-semibold tabular-nums">
              {servings}
            </span>
            <button
              onClick={() => setServings((s) => s + 1)}
              aria-label="More servings"
              className="btn !p-1.5"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        {scale !== 1 && (
          <p className="-mt-3 text-center text-xs text-faint">
            Scaled {formatQuantity(scale)}× from {baseServings}
          </p>
        )}

        <div>
          <h2 className="mb-2.5 text-xs font-semibold tracking-wider text-muted uppercase">
            Ingredients
          </h2>
          <ul className="space-y-0.5">
            {ingredients.map((ingredient) => (
              <li key={ingredient.id}>
                <button
                  onClick={() => toggle(ingredient.id)}
                  className={clsx(
                    "flex w-full gap-2 rounded-md px-1.5 py-1 text-left text-sm leading-snug hover:bg-card",
                    done.has(ingredient.id) && "text-faint line-through",
                  )}
                >
                  <span className="shrink-0 tabular-nums">
                    {ingredient.quantity !== null
                      ? `${formatQuantity(ingredient.quantity * scale)} ${formatUnit(
                          ingredient.unit,
                          ingredient.quantity * scale,
                        )}`.trim()
                      : ""}
                  </span>
                  <span>
                    {ingredient.name ?? ingredient.raw}
                    {ingredient.note && (
                      <span className="text-faint">, {ingredient.note}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <MacroSummary
          macros={macros}
          source={source}
          coverage={
            source === "estimated"
              ? {
                  matched: estimate.matched,
                  total: estimate.total,
                  unmatched: estimate.unmatched,
                }
              : null
          }
        />
      </aside>

      <div>
        <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
          Method
        </h2>
        {steps.length === 0 ? (
          <p className="text-sm text-faint">No steps saved for this one.</p>
        ) : (
          <ol className="space-y-5">
            {steps.map((step, index) => (
              <li key={step.id} className="flex gap-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule text-xs font-medium tabular-nums text-muted">
                  {index + 1}
                </span>
                <p className="text-[15px] leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
