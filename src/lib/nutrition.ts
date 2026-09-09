import { lookupFood } from "./food-data";
import { toBase, unitFamily } from "./units";

export type Macros = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
};

export const EMPTY_MACROS: Macros = {
  calories: null, proteinG: null, carbsG: null,
  fatG: null, fiberG: null, sugarG: null, sodiumMg: null,
};

/** The fields a hand-entered override can fill in — everything the nutrition
 *  panel shows except sodium, which isn't displayed anywhere in the app. */
export type MacroOverride = Pick<
  Macros,
  "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "sugarG"
>;

export type EstimateInput = {
  quantity: number | null;
  unit: string | null;
  name: string | null;
  /**
   * Hand-entered nutrition for this line, used whenever there's no food
   * match. Always the whole entry at once — a line's numbers are either
   * fully estimated or fully typed in, never a merge of the two, so a round
   * number never looks like a suspiciously precise measurement.
   */
  override?: MacroOverride | null;
};

export type Estimate = {
  perServing: Macros;
  /** How many ingredients we could price, out of how many we tried. */
  matched: number;
  total: number;
  /** Names we had no data for, so the UI can say what's missing. */
  unmatched: string[];
};

/**
 * Converts one ingredient line to grams, which is the only unit the nutrition
 * table speaks. Returns null when the line can't be weighed — "salt to taste"
 * has no amount, and an unknown food has no density to convert a cup with.
 */
export function toGrams(input: EstimateInput): number | null {
  const food = input.name ? lookupFood(input.name) : null;
  if (!food || input.quantity === null) return null;

  const family = unitFamily(input.unit);

  if (family === "weight") {
    return toBase(input.quantity, input.unit);
  }

  if (family === "volume") {
    if (!food.gramsPerCup) return null;
    const ml = toBase(input.quantity, input.unit);
    if (ml === null) return null;
    // 236.588 ml is one cup; scale the cup weight by how many cups this is.
    return (ml / 236.588) * food.gramsPerCup;
  }

  // Countable, or no unit at all ("2 eggs" arrives with unit null).
  const key = input.unit ?? "piece";
  const perUnit = food.gramsPerUnit?.[key] ?? food.gramsPerUnit?.piece;
  if (perUnit) return input.quantity * perUnit;

  // A bare number of something we only know by weight, e.g. "2 chicken".
  // Guessing here would be worse than admitting we don't know.
  return null;
}

const round = (n: number, places = 0) => Math.round(n * 10 ** places) / 10 ** places;

/**
 * One ingredient's nutrition, as used in the recipe (the full line's
 * quantity, not scaled to a serving) — null when there's no food match and
 * no hand-entered override, which is the UI's cue to offer filling it in.
 */
export function estimateIngredientMacros(input: EstimateInput): Macros | null {
  if (input.override) return { ...EMPTY_MACROS, ...input.override };

  const grams = toGrams(input);
  const food = input.name ? lookupFood(input.name) : null;
  if (grams === null || !food) return null;

  const factor = grams / 100;
  return {
    calories: round(food.kcal * factor),
    proteinG: round(food.protein * factor, 1),
    carbsG: round(food.carbs * factor, 1),
    fatG: round(food.fat * factor, 1),
    fiberG: round((food.fiber ?? 0) * factor, 1),
    sugarG: round((food.sugar ?? 0) * factor, 1),
    sodiumMg: round((food.sodium ?? 0) * factor),
  };
}

/**
 * Estimates a recipe's macros from its ingredients.
 *
 * Deliberately reports coverage alongside the numbers: an estimate that
 * silently skipped the half-pound of butter is worse than no estimate, so the
 * caller can show "matched 9 of 12" and let you judge it.
 */
export function estimateMacros(
  ingredients: EstimateInput[],
  servings: number,
): Estimate {
  const totals = {
    calories: 0, proteinG: 0, carbsG: 0,
    fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0,
  };
  let matched = 0;
  const unmatched: string[] = [];
  // Lines with no amount at all ("salt and pepper to taste") aren't failures
  // to look up — they're genuinely unmeasurable, so they don't count against
  // coverage either way.
  let countable = 0;

  for (const ing of ingredients) {
    if (!ing.name) continue;
    if (ing.quantity === null) continue;
    countable++;

    const line = estimateIngredientMacros(ing);
    if (!line) {
      unmatched.push(ing.name);
      continue;
    }

    totals.calories += line.calories ?? 0;
    totals.proteinG += line.proteinG ?? 0;
    totals.carbsG += line.carbsG ?? 0;
    totals.fatG += line.fatG ?? 0;
    totals.fiberG += line.fiberG ?? 0;
    totals.sugarG += line.sugarG ?? 0;
    totals.sodiumMg += line.sodiumMg ?? 0;
    matched++;
  }

  const per = Math.max(1, servings);

  return {
    perServing:
      matched === 0
        ? EMPTY_MACROS
        : {
            calories: round(totals.calories / per),
            proteinG: round(totals.proteinG / per, 1),
            carbsG: round(totals.carbsG / per, 1),
            fatG: round(totals.fatG / per, 1),
            fiberG: round(totals.fiberG / per, 1),
            sugarG: round(totals.sugarG / per, 1),
            sodiumMg: round(totals.sodiumMg / per),
          },
    matched,
    total: countable,
    unmatched,
  };
}

/** Adds up macros across a day or a week, scaling each by servings eaten. */
export function sumMacros(entries: { macros: Macros; servings: number }[]): Macros {
  const out = { ...EMPTY_MACROS };
  const keys = Object.keys(out) as (keyof Macros)[];
  let any = false;

  for (const { macros, servings } of entries) {
    for (const key of keys) {
      const value = macros[key];
      if (value === null || value === undefined) continue;
      out[key] = (out[key] ?? 0) + value * servings;
      any = true;
    }
  }
  if (!any) return EMPTY_MACROS;
  for (const key of keys) {
    if (out[key] !== null) {
      out[key] = Math.round(out[key]! * 10) / 10;
    }
  }
  return out;
}
