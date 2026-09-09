"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { deleteRecipe, saveRecipe, setIngredientCalories } from "@/lib/actions";
import { estimateMacros, needsCalories, type Macros } from "@/lib/nutrition";
import { parseIngredientLine } from "@/lib/parse-ingredient";
import { formatMeasure } from "@/lib/units";
import type { FullRecipe, ListWithCount } from "@/lib/queries";
import { AddToListButton } from "./list-picker";
import { PhotoGallery } from "./photo-gallery";

const NUTRIENTS = [
  { key: "calories", label: "Calories", suffix: "" },
  { key: "proteinG", label: "Protein", suffix: "g" },
  { key: "fiberG", label: "Fiber", suffix: "g" },
  { key: "carbsG", label: "Carbs", suffix: "g" },
  { key: "fatG", label: "Fat", suffix: "g" },
  { key: "sugarG", label: "Sugar", suffix: "g" },
] as const;

/**
 * The recipe, readable and editable in the same layout.
 *
 * Editing used to be a separate form page, which meant leaving the thing you
 * were looking at to change one number in it. Here the page keeps its shape and
 * the pieces of it simply become inputs, sitting where the text they replace
 * was — so a title stays a serif headline while you retype it, and an
 * ingredient stays on its own line.
 */
export function RecipeView({
  recipe,
  lists,
  uploadsEnabled,
  startEditing = false,
}: {
  recipe: FullRecipe;
  lists: ListWithCount[];
  uploadsEnabled: boolean;
  startEditing?: boolean;
}) {
  const router = useRouter();
  // Read once. The component deliberately doesn't remount on save — a remount
  // would read ?edit=1 back off the URL and reopen the editor you just closed —
  // so after saving, the draft state *is* the saved state and needs no
  // re-seeding.
  const [editing, setEditing] = useState(startEditing);
  const [pending, startTransition] = useTransition();

  // Draft state, seeded from the recipe and thrown away on cancel.
  const [title, setTitle] = useState(recipe.title);
  const [servings, setServings] = useState(recipe.servings);
  const [method, setMethod] = useState(recipe.method ?? "");
  const [lines, setLines] = useState(() => recipe.ingredients.map((i) => i.raw));

  // Reading, not cooking a different batch: the serving stepper scales the
  // display only, and resets whenever the underlying recipe changes.
  const [viewServings, setViewServings] = useState(recipe.servings);
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  // Which ingredient's hand-entered calories are being edited, if any.
  const [calorieEditId, setCalorieEditId] = useState<number | null>(null);
  const [calorieDraft, setCalorieDraft] = useState("");
  const [, startCaloriesTransition] = useTransition();

  const scale = viewServings / Math.max(1, recipe.servings);

  // Overrides only line up with `recipe.ingredients` while the text hasn't
  // been touched — once editing starts, the ingredient being typed may not
  // correspond to the same row any more.
  const parsed = useMemo(
    () =>
      lines.map((line, index) => {
        const p = parseIngredientLine(line);
        return editing
          ? p
          : { ...p, caloriesOverride: recipe.ingredients[index]?.caloriesOverride ?? null };
      }),
    [lines, editing, recipe.ingredients],
  );

  const saveCalories = (ingredientId: number) => {
    const trimmed = calorieDraft.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    setCalorieEditId(null);
    startCaloriesTransition(async () => {
      await setIngredientCalories(ingredientId, recipe.id, Number.isFinite(value as number) ? value : null);
      router.refresh();
    });
  };

  const storedMacros: Macros = {
    calories: recipe.calories,
    proteinG: recipe.proteinG,
    carbsG: recipe.carbsG,
    fatG: recipe.fatG,
    fiberG: recipe.fiberG,
    sugarG: recipe.sugarG,
    sodiumMg: recipe.sodiumMg,
  };

  const hasStored = storedMacros.calories !== null;
  const liveEstimate = useMemo(
    () => estimateMacros(parsed, editing ? servings : recipe.servings),
    [parsed, servings, recipe.servings, editing],
  );

  // While editing, show what the numbers will become as the ingredients change.
  const macros = editing
    ? (hasStored && recipe.nutritionSource !== "estimated"
        ? storedMacros
        : liveEstimate.perServing)
    : hasStored
      ? storedMacros
      : liveEstimate.perServing;

  const isEstimated = !hasStored || recipe.nutritionSource === "estimated";

  const cover = recipe.photos.find((p) => p.isCover) ?? recipe.photos[0];
  const heroUrl = cover?.url ?? recipe.imageUrl;

  const cancel = () => {
    router.replace(`/recipes/${recipe.id}`, { scroll: false });
    setTitle(recipe.title);
    setServings(recipe.servings);
    setMethod(recipe.method ?? "");
    setLines(recipe.ingredients.map((i) => i.raw));
    setEditing(false);
  };

  const save = () =>
    startTransition(async () => {
      await saveRecipe({
        id: recipe.id,
        title,
        imageUrl: recipe.imageUrl,
        sourceUrl: recipe.sourceUrl,
        sourceName: recipe.sourceName,
        servings,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        tags: recipe.tags,
        method,
        notes: recipe.notes,
        ingredientLines: lines,
        // Anything the source published stays; an estimate is recomputed from
        // whatever the ingredients now say.
        nutrition: recipe.nutritionSource === "imported" ? storedMacros : null,
        nutritionSource: recipe.nutritionSource === "imported" ? "imported" : null,
      });
      setEditing(false);
      setViewServings(servings);
      // Drop ?edit=1 before refreshing. The page remounts on save (keyed on
      // updatedAt) and would otherwise read the parameter back and reopen the
      // editor you just closed.
      router.replace(`/recipes/${recipe.id}`, { scroll: false });
      router.refresh();
    });

  return (
    <article>
      {/* Pinned at the real top of the viewport once you've scrolled past the
          full title below, so back/save/edit stay reachable without a trip
          back up the page. Its own safe-area padding matters here — unlike
          the header underneath, this bar does sit flush against a notch once
          it's actually stuck. */}
      <div className="no-print sticky top-0 z-20 -mx-4 mb-6 flex items-center gap-2 border-b border-rule bg-paper/90 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <button
          onClick={() => router.push("/")}
          aria-label="Back to recipes"
          className="shrink-0 rounded-lg p-2 text-ink hover:bg-card"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {editing ? title : recipe.title}
        </span>
        {editing ? (
          <>
            <button onClick={save} disabled={pending} className="btn btn-primary shrink-0">
              {pending && <Loader2 size={14} className="animate-spin" />}
              Done
            </button>
            <button onClick={cancel} className="btn shrink-0">
              Cancel
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${recipe.title}"? This can't be undone.`)) {
                  startTransition(() => void deleteRecipe(recipe.id));
                }
              }}
              aria-label="Delete recipe"
              className="btn shrink-0 !px-2.5 text-muted hover:!border-accent hover:text-accent"
            >
              <Trash2 size={15} />
            </button>
          </>
        ) : (
          <>
            <AddToListButton
              recipeId={recipe.id}
              lists={lists}
              listIds={recipe.listIds}
            />
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit recipe"
              className="shrink-0 rounded-lg p-2 text-ink hover:bg-card"
            >
              <Pencil size={16} />
            </button>
          </>
        )}
      </div>

      <header className="mb-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Title"
                className="w-full border-b border-rule bg-transparent pb-1 font-serif text-3xl leading-tight font-semibold outline-none focus:border-accent sm:text-4xl"
              />
            ) : (
              <h1 className="font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl">
                {recipe.title}
              </h1>
            )}

            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
              >
                <ExternalLink size={13} />
                {recipe.sourceName ?? "Source"}
              </a>
            )}
          </div>

          {heroUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroUrl}
              alt=""
              className="h-32 w-32 shrink-0 rounded-xl object-cover sm:h-44 sm:w-44"
            />
          )}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr] lg:items-start">
        <aside className="space-y-5 lg:sticky lg:top-20">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted">Serves</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  editing
                    ? setServings((s) => Math.max(1, s - 1))
                    : setViewServings((s) => Math.max(1, s - 1))
                }
                aria-label="Fewer servings"
                className="btn !p-2"
                disabled={(editing ? servings : viewServings) <= 1}
              >
                <Minus size={13} />
              </button>
              <span className="w-9 text-center font-serif text-lg font-semibold tabular-nums">
                {editing ? servings : viewServings}
              </span>
              <button
                onClick={() =>
                  editing ? setServings((s) => s + 1) : setViewServings((s) => s + 1)
                }
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

            {editing ? (
              <IngredientEditor lines={lines} onChange={setLines} />
            ) : (
              <ul className="space-y-0.5">
                {recipe.ingredients.map((ingredient, index) => {
                  const isTicked = ticked.has(ingredient.id);
                  // Only worth surfacing while the panel is actually
                  // estimating from ingredients — an imported total already
                  // has its own numbers and won't move.
                  const canAddCalories =
                    isEstimated && needsCalories(parsed[index] ?? ingredient);

                  return (
                    <li key={ingredient.id}>
                      <div className="flex w-full items-start gap-1.5 rounded-lg px-1.5 py-2 hover:bg-card">
                        <button
                          onClick={() =>
                            setTicked((current) => {
                              const next = new Set(current);
                              if (next.has(ingredient.id)) next.delete(ingredient.id);
                              else next.add(ingredient.id);
                              return next;
                            })
                          }
                          className="flex flex-1 items-start gap-2.5 text-left"
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
                                {formatMeasure(
                                  ingredient.quantity * scale,
                                  ingredient.unit,
                                )}{" "}
                              </span>
                            )}
                            {ingredient.name ?? ingredient.raw}
                            {/* "minced", "cut into cubes" — instruction, not
                                decoration, so it stays, just quieter. */}
                            {ingredient.note && !isTicked && (
                              <span className="text-faint"> · {ingredient.note}</span>
                            )}
                          </span>
                        </button>

                        {calorieEditId === ingredient.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveCalories(ingredient.id);
                            }}
                            className="mt-0.5 flex shrink-0 items-center gap-1"
                          >
                            <input
                              autoFocus
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={calorieDraft}
                              onChange={(e) => setCalorieDraft(e.target.value)}
                              onBlur={() => saveCalories(ingredient.id)}
                              placeholder="cal"
                              aria-label={`Calories for ${ingredient.name ?? ingredient.raw}`}
                              className="field w-16 !px-1.5 !py-1 !text-xs tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => setCalorieEditId(null)}
                              aria-label="Cancel"
                              className="p-1 text-faint hover:text-accent"
                            >
                              <X size={12} />
                            </button>
                          </form>
                        ) : ingredient.caloriesOverride != null ? (
                          <button
                            onClick={() => {
                              setCalorieDraft(String(ingredient.caloriesOverride));
                              setCalorieEditId(ingredient.id);
                            }}
                            className="mt-1.5 shrink-0 text-[11px] text-muted underline decoration-rule underline-offset-2 hover:text-ink"
                          >
                            {ingredient.caloriesOverride} cal
                          </button>
                        ) : (
                          canAddCalories && (
                            <button
                              onClick={() => {
                                setCalorieDraft("");
                                setCalorieEditId(ingredient.id);
                              }}
                              className="mt-1.5 flex shrink-0 items-center gap-0.5 text-[11px] text-accent hover:underline"
                            >
                              <Plus size={11} />
                              calories
                            </button>
                          )
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <MethodBlock
          value={method}
          editing={editing}
          onChange={setMethod}
          onStartEditing={() => setEditing(true)}
        />
      </div>

      <PhotoGallery
        recipeId={recipe.id}
        photos={recipe.photos}
        uploadsEnabled={uploadsEnabled}
      />

      <div className="mt-8 max-w-sm">
        <NutritionPanel macros={macros} isEstimated={isEstimated} />
      </div>
    </article>
  );
}

/**
 * One input per ingredient, in the same place the line was. Editing the raw
 * text keeps the parser in charge of amounts, which is what makes scaling and
 * the grocery list work.
 */
function IngredientEditor({
  lines,
  onChange,
}: {
  lines: string[];
  onChange: (next: string[]) => void;
}) {
  const update = (index: number, value: string) =>
    onChange(lines.map((line, i) => (i === index ? value : line)));

  return (
    <div>
      <ul className="space-y-0.5">
        {lines.map((line, index) => (
          <li key={index} className="group flex items-center gap-1.5">
            <input
              value={line}
              onChange={(e) => update(index, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onChange([
                    ...lines.slice(0, index + 1),
                    "",
                    ...lines.slice(index + 1),
                  ]);
                }
              }}
              aria-label={`Ingredient ${index + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-transparent px-1.5 py-2 text-[15px] outline-none hover:border-rule focus:border-accent focus:bg-card"
            />
            <button
              onClick={() => onChange(lines.filter((_, i) => i !== index))}
              aria-label={`Remove ingredient ${index + 1}`}
              className="shrink-0 p-1.5 text-faint hover:text-accent"
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onChange([...lines, ""])}
        className="mt-1 flex items-center gap-1.5 px-1.5 py-2 text-sm text-muted hover:text-accent"
      >
        <Plus size={14} />
        Add ingredient
      </button>
    </div>
  );
}

/** Flat rows. A hierarchy of type sizes made these harder to read, not easier. */
function NutritionPanel({
  macros,
  isEstimated,
}: {
  macros: Macros;
  isEstimated: boolean;
}) {
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
      {isEstimated && (
        <p className="mt-2.5 border-t border-rule pt-2 text-[11px] text-faint">
          Added up from the ingredients
        </p>
      )}
    </div>
  );
}

/**
 * Free text, shown as numbered steps. One line is one step, which is why it's
 * quick to write and fine to leave empty.
 */
function MethodBlock({
  value,
  editing,
  onChange,
  onStartEditing,
}: {
  value: string;
  editing: boolean;
  onChange: (next: string) => void;
  onStartEditing: () => void;
}) {
  const steps = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
        Notes
      </h2>

      {editing ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={14}
          placeholder={"Grill 6 min a side.\n400°F, 25 min.\nDon't crowd the pan."}
          className="field resize-y leading-relaxed"
        />
      ) : (
        <button
          onClick={onStartEditing}
          className="w-full rounded-xl border border-transparent px-3 py-2 text-left hover:border-rule hover:bg-card"
        >
          {steps.length === 0 ? (
            <span className="text-faint">Tap to write how you make it.</span>
          ) : (
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule text-xs font-medium tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <span className="text-[15px] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </button>
      )}
    </div>
  );
}
