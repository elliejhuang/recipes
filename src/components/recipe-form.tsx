"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { deleteRecipe, saveRecipe, type RecipeInput } from "@/lib/actions";
import { estimateMacros, type Macros } from "@/lib/nutrition";
import { parseIngredientLine } from "@/lib/parse-ingredient";
import { formatQuantity, formatUnit } from "@/lib/units";

export type FormValues = Omit<RecipeInput, "ingredientLines" | "stepLines"> & {
  ingredientText: string;
  stepText: string;
};

const NUTRIENTS = [
  { key: "calories", label: "Calories", unit: "" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
  { key: "fiberG", label: "Fiber", unit: "g" },
  { key: "sugarG", label: "Sugar", unit: "g" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
] as const;

export function RecipeForm({
  initial,
  submitLabel,
  showDelete = false,
}: {
  initial: FormValues;
  submitLabel: string;
  showDelete?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const lines = useMemo(
    () => values.ingredientText.split("\n").map((l) => l.trim()).filter(Boolean),
    [values.ingredientText],
  );

  const parsed = useMemo(() => lines.map(parseIngredientLine), [lines]);

  const estimate = useMemo(
    () => estimateMacros(parsed, values.servings),
    [parsed, values.servings],
  );

  const setNutrient = (key: keyof Macros, raw: string) => {
    const value = raw.trim() === "" ? null : Number(raw);
    setValues((v) => ({
      ...v,
      nutritionSource: "manual",
      nutrition: {
        calories: null, proteinG: null, carbsG: null, fatG: null,
        fiberG: null, sugarG: null, sodiumMg: null,
        ...v.nutrition,
        [key]: Number.isFinite(value as number) ? value : null,
      },
    }));
  };

  const applyEstimate = () =>
    setValues((v) => ({
      ...v,
      nutrition: estimate.perServing,
      nutritionSource: "estimated",
    }));

  const submit = () => {
    if (!values.title.trim()) {
      setError("Give it a name first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const id = await saveRecipe({
          ...values,
          ingredientLines: lines,
          stepLines: values.stepText
            .split(/\n\s*\n|\n/)
            .map((s) => s.trim())
            .filter(Boolean),
        });
        router.push(`/recipes/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-6">
        <div>
          <label className="label" htmlFor="title">
            Name
          </label>
          <input
            id="title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Weeknight lemon chicken"
            className="field font-serif !text-xl"
          />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={values.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder="One line on what it is or when you'd make it."
            className="field resize-y"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="ingredients">
              Ingredients
            </label>
            <span className="mb-1.5 text-xs text-faint">one per line</span>
          </div>
          <textarea
            id="ingredients"
            value={values.ingredientText}
            onChange={(e) => set("ingredientText", e.target.value)}
            rows={10}
            placeholder={"2 cups all-purpose flour\n1 tsp kosher salt\n3 cloves garlic, minced"}
            className="field resize-y font-mono !text-[13px] leading-relaxed"
          />
          {parsed.length > 0 && <ParsePreview parsed={parsed} />}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="steps">
              Steps
            </label>
            <span className="mb-1.5 text-xs text-faint">one per line</span>
          </div>
          <textarea
            id="steps"
            value={values.stepText}
            onChange={(e) => set("stepText", e.target.value)}
            rows={8}
            placeholder={"Heat the oil in a large skillet over medium.\nAdd the onion and cook until soft, about 8 minutes."}
            className="field resize-y leading-relaxed"
          />
        </div>

        <div>
          <label className="label" htmlFor="notes">
            Your notes
          </label>
          <textarea
            id="notes"
            value={values.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="What you'd change next time. Doubled the garlic, needed 10 more minutes…"
            className="field resize-y"
          />
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-20">
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="Serves"
            value={values.servings}
            onChange={(n) => set("servings", Math.max(1, n ?? 1))}
          />
          <NumberField
            label="Prep"
            suffix="min"
            value={values.prepMinutes ?? null}
            onChange={(n) => set("prepMinutes", n)}
          />
          <NumberField
            label="Cook"
            suffix="min"
            value={values.cookMinutes ?? null}
            onChange={(n) => set("cookMinutes", n)}
          />
        </div>

        <div>
          <label className="label" htmlFor="tags">
            Tags
          </label>
          <input
            id="tags"
            value={values.tags.join(", ")}
            onChange={(e) =>
              set(
                "tags",
                e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
              )
            }
            placeholder="weeknight, vegetarian, italian"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="image">
            Image URL
          </label>
          <input
            id="image"
            value={values.imageUrl ?? ""}
            onChange={(e) => set("imageUrl", e.target.value)}
            placeholder="https://…"
            className="field !text-xs"
          />
        </div>

        <div>
          <label className="label" htmlFor="source">
            Source URL
          </label>
          <input
            id="source"
            value={values.sourceUrl ?? ""}
            onChange={(e) => set("sourceUrl", e.target.value)}
            placeholder="https://…"
            className="field !text-xs"
          />
        </div>

        <div className="rounded-xl border border-rule bg-card p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
              Nutrition
            </h3>
            <span className="text-[11px] text-faint">per serving</span>
          </div>

          <button
            type="button"
            onClick={applyEstimate}
            disabled={estimate.matched === 0}
            className="btn mt-3 w-full !py-1.5 !text-xs"
          >
            <Sparkles size={13} />
            Estimate from ingredients
          </button>

          {estimate.matched > 0 && (
            <p className="mt-1.5 text-[11px] leading-snug text-faint">
              ≈{estimate.perServing.calories} cal from {estimate.matched} of{" "}
              {estimate.total} measured ingredients
              {estimate.unmatched.length > 0 &&
                ` — no data for ${estimate.unmatched.slice(0, 2).join(", ")}`}
            </p>
          )}

          <div className="mt-3 space-y-1.5">
            {NUTRIENTS.map(({ key, label, unit }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-muted">{label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={values.nutrition?.[key] ?? ""}
                  onChange={(e) => setNutrient(key, e.target.value)}
                  className="field w-20 !px-2 !py-1 !text-right !text-xs tabular-nums"
                />
                <span className="w-6 text-xs text-faint">{unit}</span>
              </div>
            ))}
          </div>

          {values.nutritionSource && (
            <p className="mt-2.5 text-[11px] text-faint">
              Source:{" "}
              {values.nutritionSource === "imported"
                ? "the original recipe"
                : values.nutritionSource === "estimated"
                  ? "estimated from ingredients"
                  : "entered by hand"}
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={pending}
            className="btn btn-primary flex-1"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {submitLabel}
          </button>

          {showDelete && values.id && (
            <button
              onClick={() => {
                if (confirm(`Delete "${values.title}"? This can't be undone.`)) {
                  startTransition(() => void deleteRecipe(values.id!));
                }
              }}
              aria-label="Delete recipe"
              className="btn !px-2.5 text-muted hover:!border-accent hover:text-accent"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

/**
 * Shows how each line was understood. Parsing drives scaling, the shopping
 * list, and macros, so a line that came out wrong should be visible while
 * you're still in a position to reword it.
 */
function ParsePreview({
  parsed,
}: {
  parsed: ReturnType<typeof parseIngredientLine>[];
}) {
  const [open, setOpen] = useState(false);
  const unparsed = parsed.filter((p) => p.quantity === null).length;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-muted underline decoration-rule underline-offset-2 hover:text-ink"
      >
        {open ? "Hide" : "Check"} how these were read
        {unparsed > 0 && !open && (
          <span className="ml-1 text-faint">({unparsed} without an amount)</span>
        )}
      </button>

      {open && (
        <ul className="mt-2 space-y-1 rounded-lg border border-rule bg-card p-2.5 text-xs">
          {parsed.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span
                className={clsx(
                  "w-24 shrink-0 text-right tabular-nums",
                  p.quantity === null ? "text-faint" : "text-ink",
                )}
              >
                {p.quantity === null
                  ? "—"
                  : `${formatQuantity(p.quantity)} ${formatUnit(p.unit, p.quantity)}`.trim()}
              </span>
              <span className="text-ink">{p.name ?? p.raw}</span>
              {p.note && <span className="text-faint">({p.note})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className="label !text-[10px]">{label}</label>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className={clsx("field !px-2 !py-1.5 tabular-nums", suffix && "!pr-8")}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-faint">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
