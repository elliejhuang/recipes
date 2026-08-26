"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { clsx } from "clsx";
import type { Ingredient } from "@/db/schema";
import { setRecipeFolders, updateRecipeField } from "@/lib/actions";
import { estimateMacros, type Macros } from "@/lib/nutrition";
import { formatQuantity, formatUnit } from "@/lib/units";
import type { FolderWithCount } from "@/lib/queries";
import { FolderPicker } from "./folder-bar";

const NUTRIENTS = [
  { key: "calories", label: "Calories", suffix: "" },
  { key: "proteinG", label: "Protein", suffix: "g" },
  { key: "fiberG", label: "Fiber", suffix: "g" },
  { key: "carbsG", label: "Carbs", suffix: "g" },
  { key: "fatG", label: "Fat", suffix: "g" },
  { key: "sugarG", label: "Sugar", suffix: "g" },
] as const;

export function RecipeDetail({
  recipeId,
  baseServings,
  ingredients,
  method,
  storedMacros,
  folders,
  folderIds,
}: {
  recipeId: number;
  baseServings: number;
  ingredients: Ingredient[];
  method: string | null;
  storedMacros: Macros;
  folders: FolderWithCount[];
  folderIds: number[];
}) {
  const router = useRouter();
  const [servings, setServings] = useState(baseServings);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState(folderIds);
  const [, startTransition] = useTransition();

  const scale = servings / Math.max(1, baseServings);

  // Macros are stored per serving, so scaling the batch doesn't change them —
  // but if none are stored, estimate rather than showing a blank panel.
  const hasStored = storedMacros.calories !== null;
  const estimate = useMemo(
    () => estimateMacros(ingredients, baseServings),
    [ingredients, baseServings],
  );
  const macros = hasStored ? storedMacros : estimate.perServing;

  const toggle = (id: number) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[20rem_1fr] lg:items-start">
      <aside className="space-y-5 lg:sticky lg:top-20">
        <div className="flex items-center justify-between rounded-xl border border-rule bg-card px-3 py-2.5">
          <span className="text-sm text-muted">Serves</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              aria-label="Fewer servings"
              className="btn !p-2"
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
              className="btn !p-2"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
            Ingredients
          </h2>
          <ul className="space-y-0.5">
            {ingredients.map((ingredient) => {
              const isTicked = ticked.has(ingredient.id);
              return (
                <li key={ingredient.id}>
                  <button
                    onClick={() => toggle(ingredient.id)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-2 text-left hover:bg-card"
                  >
                    <span
                      className={clsx(
                        "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
                        isTicked
                          ? "border-accent bg-accent text-white"
                          : "border-faint",
                      )}
                    >
                      {isTicked && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span
                      className={clsx(
                        "text-[15px] leading-snug",
                        isTicked && "text-faint line-through",
                      )}
                    >
                      {ingredient.quantity !== null && (
                        <span className="font-medium tabular-nums">
                          {`${formatQuantity(ingredient.quantity * scale)} ${formatUnit(
                            ingredient.unit,
                            ingredient.quantity * scale,
                          )}`.trim()}{" "}
                        </span>
                      )}
                      {ingredient.name ?? ingredient.raw}
                      {/* "minced", "cut into cubes" — real instruction, so it
                          stays, just quieter than the thing you're buying. */}
                      {ingredient.note && !isTicked && (
                        <span className="text-faint"> · {ingredient.note}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <NutritionPanel macros={macros} />

        {folders.length > 0 && (
          <FolderPicker
            recipeId={recipeId}
            folders={folders}
            selected={selectedFolders}
            onChange={(next) => {
              setSelectedFolders(next);
              startTransition(async () => {
                await setRecipeFolders(recipeId, next);
                router.refresh();
              });
            }}
          />
        )}
      </aside>

      <EditableNotes recipeId={recipeId} initial={method} />
    </div>
  );
}

/** Flat rows. A hierarchy of type sizes made these harder to read, not easier. */
function NutritionPanel({ macros }: { macros: Macros }) {
  if (macros.calories === null && macros.proteinG === null) return null;

  return (
    <div className="rounded-xl border border-rule bg-card p-3.5">
      <h2 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
        Per serving
      </h2>
      <dl className="space-y-1">
        {NUTRIENTS.map(({ key, label, suffix }) => {
          const value = macros[key];
          return (
            <div key={key} className="flex justify-between text-[15px]">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular-nums">
                {value === null ? "—" : `${Math.round(value)}${suffix}`}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/**
 * The method is free text you edit in place. Imported recipes seed it from
 * whatever the source published; most of the time it's a couple of lines or
 * nothing at all, which is why it isn't a step list any more.
 */
function EditableNotes({
  recipeId,
  initial,
}: {
  recipeId: number;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const save = () => {
    setEditing(false);
    if (value === (initial ?? "")) return;
    startTransition(async () => {
      await updateRecipeField(recipeId, "method", value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
          Notes
        </h2>
        {saved && <span className="text-[11px] text-leaf">Saved</span>}
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          rows={12}
          placeholder="Grill 6 min a side. 400°F, 25 min. Don't crowd the pan."
          className="field resize-y leading-relaxed"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full rounded-xl border border-transparent px-3 py-2 text-left leading-relaxed whitespace-pre-wrap hover:border-rule hover:bg-card"
        >
          {value || (
            <span className="text-faint">Tap to write how you make it.</span>
          )}
        </button>
      )}
    </div>
  );
}
