import { categorize } from "./aisles";
import { canonicalName } from "./parse-ingredient";
import { humanizeAmount, toBase, unitFamily } from "./units";

export type GroceryInput = {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  recipeTitle: string;
  /**
   * How many times you'll cook this recipe over the week. Always a whole
   * number — see `batchesNeeded`.
   */
  batches: number;
};

export type AggregatedItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle: string;
  detail: string;
};

/**
 * How many times a recipe has to be cooked to cover the servings planned.
 *
 * This is the difference between a shopping list that works and one that
 * doesn't. Planning one serving of a recipe that yields six doesn't mean
 * buying a sixth of every ingredient — you can't buy 0.83 of a garlic clove.
 * It means cooking it once and having leftovers. Macros still count only the
 * servings you actually planned to eat; this is purely about what to buy.
 */
export function batchesNeeded(
  plannedServings: number,
  recipeServings: number,
): number {
  if (plannedServings <= 0) return 0;
  return Math.max(1, Math.ceil(plannedServings / Math.max(1, recipeServings)));
}

/**
 * Turns a week of planned recipes into a shopping list.
 *
 * Amounts are summed in a common base unit, so ⅓ cup in one recipe and 2
 * tablespoons in another come out as a single line you can act on rather than
 * two you have to add up in the aisle.
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
    if (!row.name || row.batches <= 0) continue;

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

    const amount = row.quantity * row.batches;
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
    for (const [unit, quantity] of bucket.counts) {
      // Countable things are bought whole. Three recipes each wanting half a
      // lemon is two lemons at the shop, not 1.5.
      parts.push({ quantity: Math.ceil(quantity - 0.02), unit });
    }

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
