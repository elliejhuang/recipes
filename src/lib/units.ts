/**
 * Quantity and unit handling.
 *
 * Recipes are written by humans, so quantities arrive as "1 1/2", "½", "1-2",
 * "one", or nothing at all. Everything downstream (scaling, grocery
 * aggregation, macro estimates) needs a number, so all the messiness is
 * absorbed here.
 */

const VULGAR: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75,
  "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 0.1,
  "⅓": 1 / 3, "⅔": 2 / 3,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  dozen: 12, half: 0.5, quarter: 0.25,
};

/** Volume units, all expressed in milliliters. */
const VOLUME_ML: Record<string, number> = {
  tsp: 4.92892,
  tbsp: 14.7868,
  floz: 29.5735,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
  ml: 1,
  l: 1000,
};

/** Weight units, all expressed in grams. */
const WEIGHT_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

/**
 * Maps every spelling we've seen to a canonical unit key. Order matters only
 * in that longer aliases must not be shadowed — matching is exact, not prefix.
 */
const UNIT_ALIASES: Record<string, string> = {};
function alias(canonical: string, ...names: string[]) {
  for (const n of names) UNIT_ALIASES[n] = canonical;
}

alias("tsp", "tsp", "tsps", "t", "teaspoon", "teaspoons");
alias("tbsp", "tbsp", "tbsps", "tbs", "tb", "T", "tablespoon", "tablespoons");
alias("floz", "floz", "fl oz", "fluid ounce", "fluid ounces", "fl. oz.", "fl. oz");
alias("cup", "cup", "cups", "c");
alias("pint", "pint", "pints", "pt", "pts");
alias("quart", "quart", "quarts", "qt", "qts");
alias("gallon", "gallon", "gallons", "gal");
alias("ml", "ml", "milliliter", "milliliters", "millilitre", "millilitres", "cc");
alias("l", "l", "liter", "liters", "litre", "litres");
alias("g", "g", "gr", "gram", "grams", "gramme", "grammes");
alias("kg", "kg", "kilo", "kilos", "kilogram", "kilograms");
alias("oz", "oz", "ounce", "ounces");
alias("lb", "lb", "lbs", "pound", "pounds", "#");

// Countable units. These don't convert to anything, but they aggregate.
alias("clove", "clove", "cloves");
alias("can", "can", "cans");
alias("jar", "jar", "jars");
alias("package", "package", "packages", "pkg", "pkgs", "packet", "packets");
alias("bunch", "bunch", "bunches");
alias("head", "head", "heads");
alias("stalk", "stalk", "stalks");
alias("sprig", "sprig", "sprigs");
alias("slice", "slice", "slices");
alias("stick", "stick", "sticks");
alias("piece", "piece", "pieces");
alias("ear", "ear", "ears");
alias("fillet", "fillet", "fillets", "filet", "filets");
alias("breast", "breast", "breasts");
alias("thigh", "thigh", "thighs");
alias("leaf", "leaf", "leaves");
alias("pinch", "pinch", "pinches");
alias("dash", "dash", "dashes");
alias("handful", "handful", "handfuls");
alias("bottle", "bottle", "bottles");
alias("container", "container", "containers");
alias("box", "box", "boxes");
alias("bag", "bag", "bags");
alias("loaf", "loaf", "loaves");
alias("bulb", "bulb", "bulbs");
alias("rib", "rib", "ribs");
alias("wedge", "wedge", "wedges");
alias("sheet", "sheet", "sheets");
alias("strip", "strip", "strips");
alias("link", "link", "links");
alias("knob", "knob", "knobs");

export const KNOWN_UNITS = new Set(Object.keys(UNIT_ALIASES));

/** Words that describe size or prep, not amount. Stripped before the name. */
export const MODIFIERS = new Set([
  "large", "small", "medium", "extra-large", "jumbo", "big", "little",
  "heaping", "scant", "generous", "level", "packed", "loosely", "firmly",
  "fresh", "freshly", "ripe", "whole", "ground", "chopped", "minced",
  "diced", "sliced", "grated", "shredded", "crushed", "melted", "softened",
  "room", "temperature", "cold", "warm", "hot", "boiling", "cooked",
  "uncooked", "raw", "dried", "frozen", "canned", "drained", "rinsed",
  "peeled", "seeded", "stemmed", "trimmed", "halved", "quartered", "cubed",
  "boneless", "skinless", "bone-in", "skin-on", "unsalted", "salted",
  "low-sodium", "reduced-sodium", "low-fat", "nonfat", "full-fat", "toasted",
  "julienned", "thinly", "roughly", "finely", "coarsely", "lightly",
  "approximately", "about", "plus", "more", "optional", "divided",
]);

export function normalizeUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\.$/, "");
  // "T" for tablespoon is the one case where capitalization carries meaning,
  // so check the original before folding case.
  if (raw.trim() === "T") return "tbsp";
  return UNIT_ALIASES[key] ?? UNIT_ALIASES[raw.trim()] ?? null;
}

export type UnitFamily = "volume" | "weight" | "count";

export function unitFamily(unit: string | null): UnitFamily {
  if (!unit) return "count";
  if (unit in VOLUME_ML) return "volume";
  if (unit in WEIGHT_G) return "weight";
  return "count";
}

/** Converts an amount to the family's base unit (ml or g). */
export function toBase(quantity: number, unit: string | null): number | null {
  if (!unit) return null;
  if (unit in VOLUME_ML) return quantity * VOLUME_ML[unit];
  if (unit in WEIGHT_G) return quantity * WEIGHT_G[unit];
  return null;
}

/**
 * Picks the unit a human would actually say for an amount. 48 teaspoons is
 * technically correct and completely useless on a shopping list.
 */
export function humanizeAmount(
  baseAmount: number,
  family: UnitFamily,
  preferMetric = false,
): { quantity: number; unit: string } {
  if (family === "volume") {
    if (preferMetric) {
      return baseAmount >= 1000
        ? { quantity: baseAmount / 1000, unit: "l" }
        : { quantity: baseAmount, unit: "ml" };
    }
    if (baseAmount >= VOLUME_ML.gallon * 0.98)
      return { quantity: baseAmount / VOLUME_ML.gallon, unit: "gallon" };
    if (baseAmount >= VOLUME_ML.quart * 0.98)
      return { quantity: baseAmount / VOLUME_ML.quart, unit: "quart" };

    // Cups win only when the amount lands on a measure a cook actually owns.
    // Half a cup should read "½ cup", but six tablespoons should stay six
    // tablespoons rather than becoming "⅜ cup".
    const cups = baseAmount / VOLUME_ML.cup;
    if (cups >= 0.245 && isFriendlyCupAmount(cups)) {
      return { quantity: cups, unit: "cup" };
    }

    if (baseAmount >= VOLUME_ML.tbsp * 0.98)
      return { quantity: baseAmount / VOLUME_ML.tbsp, unit: "tbsp" };
    return { quantity: baseAmount / VOLUME_ML.tsp, unit: "tsp" };
  }
  if (family === "weight") {
    if (preferMetric) {
      return baseAmount >= 1000
        ? { quantity: baseAmount / 1000, unit: "kg" }
        : { quantity: baseAmount, unit: "g" };
    }
    if (baseAmount >= WEIGHT_G.lb * 0.98)
      return { quantity: baseAmount / WEIGHT_G.lb, unit: "lb" };
    return { quantity: baseAmount / WEIGHT_G.oz, unit: "oz" };
  }
  return { quantity: baseAmount, unit: "" };
}

/**
 * Parses the leading amount off an ingredient line.
 * Returns the value and how many characters it consumed.
 */
/** Quarters and thirds of a cup — the marks on a measuring cup. */
function isFriendlyCupAmount(cups: number): boolean {
  const whole = Math.floor(cups);
  const frac = cups - whole;
  return [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75].some(
    (target) => Math.abs(frac - target) < 0.02,
  );
}

export function parseQuantity(input: string): { value: number | null; length: number } {
  const s = input.trimStart();
  const offset = input.length - s.length;

  // Ranges ("1-2 cups", "1 to 2 cups") take the low end; you can always add more.
  const range = s.match(
    /^(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)/i,
  );
  if (range) {
    return { value: evalNumeric(range[1]), length: offset + range[0].length };
  }

  // Mixed number: "1 1/2" or "1½"
  const mixed = s.match(/^(\d+)\s*(\d+\s*\/\s*\d+|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const frac = evalNumeric(mixed[2]) ?? 0;
    return { value: whole + frac, length: offset + mixed[0].length };
  }

  const simple = s.match(/^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
  if (simple) {
    return { value: evalNumeric(simple[1]), length: offset + simple[0].length };
  }

  const word = s.match(/^([a-z]+)\b/i);
  if (word) {
    const n = WORD_NUMBERS[word[1].toLowerCase()];
    // "a" and "an" are only amounts when a unit follows, otherwise "a pinch of
    // salt" is fine but "an apple, cored" would silently become quantity 1 of
    // "apple, cored" — which is actually what we want, so allow both.
    if (n !== undefined) return { value: n, length: offset + word[0].length };
  }

  return { value: null, length: 0 };
}

function evalNumeric(token: string): number | null {
  const t = token.trim();
  if (VULGAR[t] !== undefined) return VULGAR[t];
  if (t.includes("/")) {
    const [a, b] = t.split("/").map((x) => parseFloat(x.trim()));
    if (!b) return null;
    return a / b;
  }
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const FRACTION_DISPLAY: [number, string][] = [
  [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"],
  [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"],
];

/** Renders a number the way a recipe would write it: 1.5 becomes "1½". */
export function formatQuantity(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  if (n === 0) return "0";

  const rounded = Math.round(n * 1000) / 1000;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;

  if (frac < 0.02) return String(whole);
  // Floating-point sums land just shy of round numbers all the time; 0.99 of
  // a teaspoon is one teaspoon.
  if (frac > 0.98) return String(whole + 1);

  for (const [value, glyph] of FRACTION_DISPLAY) {
    if (Math.abs(frac - value) < 0.02) {
      return whole > 0 ? `${whole}${glyph}` : glyph;
    }
  }

  // Nothing close to a kitchen fraction, so show a decimal but keep it short.
  const decimals = rounded < 10 ? 2 : 1;
  return String(parseFloat(rounded.toFixed(decimals)));
}

/** Pluralizes a unit for display. Abbreviations never pluralize. */
export function formatUnit(unit: string | null, quantity: number | null): string {
  if (!unit) return "";
  const abbreviations = new Set(["tsp", "tbsp", "oz", "lb", "g", "kg", "ml", "l", "floz"]);
  if (abbreviations.has(unit)) return unit === "floz" ? "fl oz" : unit;
  if (quantity !== null && quantity > 1) {
    if (unit === "leaf") return "leaves";
    if (unit === "loaf") return "loaves";
    if (unit === "box") return "boxes";
    if (unit === "bunch") return "bunches";
    if (unit === "pinch") return "pinches";
    if (unit === "dash") return "dashes";
    return `${unit}s`;
  }
  return unit;
}
