import { categorize } from "./aisles";
import { canonicalName } from "./parse-ingredient";
import { humanizeAmount, toBase, unitFamily } from "./units";

export type GroceryInput = {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  recipeTitle: string;
  /** What the recipe yields. */
  recipeServings: number;
  /** How many of those servings the plan calls for. */
  planServings: number;
};

export type AggregatedItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: string;
  detail: string;
};

/**
 * Turns a week of planned recipes into a shopping list.
 *
 * Two things make this more than a group-by. Amounts are scaled to what you're
 * actually making — half a recipe needs half the butter — and they're summed
 * in a common base unit, so ⅓ cup in one recipe and 2 tablespoons in another
 * come out as a single line you can act on rather than two you have to add up
 * in the aisle.
 */
export function aggregateGroceries(rows: GroceryInput[]): AggregatedItem[] {
  type Bucket = {
    display: string;
    aisle: string;
    volumeMl: number;
    weightG: number;
    counts: Map<string, number>;
    unmeasured: boolean;
    sources: Set<string>;
  };

  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    if (!row.name) continue;

    const scale = row.planServings / Math.max(1, row.recipeServings);
    const key = canonicalName(row.name);

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        display: row.name,
        aisle: categorize(row.name),
        volumeMl: 0,
        weightG: 0,
        counts: new Map(),
        unmeasured: false,
        sources: new Set(),
      };
      buckets.set(key, bucket);
    }
    bucket.sources.add(row.recipeTitle);

    if (row.quantity === null) {
      // "Salt to taste" — worth listing, not worth quantifying.
      bucket.unmeasured = true;
      continue;
    }

    const amount = row.quantity * scale;
    const family = unitFamily(row.unit);

    if (family === "volume") {
      bucket.volumeMl += toBase(amount, row.unit) ?? 0;
    } else if (family === "weight") {
      bucket.weightG += toBase(amount, row.unit) ?? 0;
    } else {
      const unit = row.unit ?? "";
      bucket.counts.set(unit, (bucket.counts.get(unit) ?? 0) + amount);
    }
  }

  return [...buckets.values()].map((bucket) => {
    // One ingredient can arrive measured more than one way — a pound of
    // tomatoes in one recipe, two tomatoes in another. Lead with the largest
    // measurement and note the rest rather than pretending they combine.
    const parts: { quantity: number; unit: string }[] = [];

    if (bucket.weightG > 0) parts.push(humanizeAmount(bucket.weightG, "weight"));
    if (bucket.volumeMl > 0) parts.push(humanizeAmount(bucket.volumeMl, "volume"));
    for (const [unit, quantity] of bucket.counts) parts.push({ quantity, unit });

    const [primary, ...extras] = parts;

    const detail = [
      ...extras.map((p) => `plus ${round(p.quantity)} ${p.unit}`.trim()),
      bucket.unmeasured && parts.length > 0 ? "plus some to taste" : null,
      `for ${[...bucket.sources].slice(0, 3).join(", ")}${
        bucket.sources.size > 3 ? ` +${bucket.sources.size - 3} more` : ""
      }`,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      name: bucket.display,
      quantity: primary ? round(primary.quantity) : null,
      unit: primary?.unit || null,
      aisle: bucket.aisle,
      detail,
    };
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
