import { clsx } from "clsx";
import type { Macros } from "@/lib/nutrition";

const MACRO_KEYS = [
  { key: "proteinG", label: "Protein", suffix: "g" },
  { key: "carbsG", label: "Carbs", suffix: "g" },
  { key: "fatG", label: "Fat", suffix: "g" },
] as const;

export function MacroSummary({
  macros,
  source,
  coverage,
  className,
}: {
  macros: Macros;
  /** "imported" | "manual" | "estimated" — drives the caveat line. */
  source?: string | null;
  coverage?: { matched: number; total: number; unmatched: string[] } | null;
  className?: string;
}) {
  if (macros.calories === null && macros.proteinG === null) return null;

  const estimated = source === "estimated";

  return (
    <div className={clsx("rounded-xl border border-rule bg-card p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Per serving
        </h3>
        {source ? (
          <span
            className={clsx(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              estimated
                ? "bg-accent-soft text-accent"
                : "bg-leaf-soft text-leaf",
            )}
          >
            {source === "imported"
              ? "from source"
              : source === "manual"
                ? "entered by hand"
                : "estimated"}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className="font-serif text-3xl leading-none font-semibold tabular-nums">
            {macros.calories !== null ? Math.round(macros.calories) : "—"}
          </div>
          <div className="mt-1 text-xs text-muted">calories</div>
        </div>

        {MACRO_KEYS.map(({ key, label, suffix }) => {
          const value = macros[key];
          return (
            <div key={key}>
              <div className="text-xl leading-none font-medium tabular-nums">
                {value !== null ? `${Math.round(value)}${suffix}` : "—"}
              </div>
              <div className="mt-1 text-xs text-muted">{label}</div>
            </div>
          );
        })}
      </div>

      {(macros.fiberG !== null || macros.sodiumMg !== null) && (
        <div className="mt-3 flex gap-4 border-t border-rule pt-2.5 text-xs text-muted">
          {macros.fiberG !== null && (
            <span>Fiber {Math.round(macros.fiberG)}g</span>
          )}
          {macros.sugarG !== null && (
            <span>Sugar {Math.round(macros.sugarG)}g</span>
          )}
          {macros.sodiumMg !== null && (
            <span>Sodium {Math.round(macros.sodiumMg)}mg</span>
          )}
        </div>
      )}

      {estimated && coverage && (
        <p className="mt-3 border-t border-rule pt-2.5 text-xs leading-relaxed text-muted">
          Added up from {coverage.matched} of {coverage.total} measured
          ingredients.
          {coverage.unmatched.length > 0 && (
            <>
              {" "}
              No data for{" "}
              <span className="text-ink">
                {coverage.unmatched.slice(0, 4).join(", ")}
              </span>
              {coverage.unmatched.length > 4 &&
                ` +${coverage.unmatched.length - 4} more`}
              , so the real number is higher.
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** The one-line version, for cards and plan tiles. */
export function MacroLine({ macros }: { macros: Macros }) {
  if (macros.calories === null) return null;
  const bits = [
    `${Math.round(macros.calories)} cal`,
    macros.proteinG !== null ? `${Math.round(macros.proteinG)}p` : null,
    macros.carbsG !== null ? `${Math.round(macros.carbsG)}c` : null,
    macros.fatG !== null ? `${Math.round(macros.fatG)}f` : null,
  ].filter(Boolean);
  return <span className="tabular-nums">{bits.join(" · ")}</span>;
}
