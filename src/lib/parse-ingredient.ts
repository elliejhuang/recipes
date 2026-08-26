import { KNOWN_UNITS, MODIFIERS, normalizeUnit, parseQuantity } from "./units";

export type ParsedIngredient = {
  raw: string;
  quantity: number | null;
  unit: string | null;
  name: string | null;
  note: string | null;
};

/**
 * Turns "2 (14.5 oz) cans diced tomatoes, drained" into its parts.
 *
 * The parse is deliberately forgiving: anything it can't confidently split
 * falls back to the whole line as the name, with `raw` always preserved so a
 * bad parse never loses what the recipe actually said.
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const raw = line.trim().replace(/\s+/g, " ");
  const empty: ParsedIngredient = {
    raw,
    quantity: null,
    unit: null,
    name: null,
    note: null,
  };
  if (!raw) return empty;

  let working = raw;
  let note: string | null = null;

  // Strip a leading bullet or dash some sites include in their markup.
  working = working.replace(/^[-•*▢□]\s*/, "");

  // A parenthetical is nearly always a size or a clarification, not the name.
  // "2 (14.5 oz) cans" -> pull "(14.5 oz)" out before parsing the count.
  const parentheticals: string[] = [];
  working = working
    .replace(/\(([^)]*)\)/g, (_, inner: string) => {
      parentheticals.push(inner.trim());
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  const { value: quantity, length } = parseQuantity(working);
  if (length > 0) working = working.slice(length).trim();

  // A size word can sit between the amount and the unit — "2 medium cloves
  // garlic" — so step over any modifiers before looking for the unit, and
  // keep them for the note.
  const leadingModifiers: string[] = [];
  while (true) {
    const word = working.match(/^([A-Za-z-]+)\b/);
    if (!word || !MODIFIERS.has(word[1].toLowerCase())) break;
    // Only skip it if a real unit follows; otherwise "large eggs" would lose
    // its adjective for nothing.
    const rest = working.slice(word[0].length).trim();
    const next = rest.match(/^([A-Za-z.]+)\b/);
    if (!next || !isUnitToken(next[1])) break;
    leadingModifiers.push(word[1]);
    working = rest;
  }

  // The unit is the next token, if we recognize it.
  let unit: string | null = null;
  const unitMatch = working.match(/^([A-Za-z.]+)\b/);
  if (unitMatch && isUnitToken(unitMatch[1])) {
    unit = normalizeUnit(unitMatch[1]);
    working = working.slice(unitMatch[0].length).trim();
  }

  if (leadingModifiers.length) note = leadingModifiers.join(" ");

  // "of" after a unit is filler: "2 cups of flour".
  working = working.replace(/^of\s+/i, "");

  // Everything after the comma is preparation, not identity: "onion, finely
  // diced" is still onion on a shopping list.
  //
  // The catch is lines like "4 skinless, boneless chicken breasts", where the
  // first comma sits between two adjectives rather than after the food. So
  // skip past any comma whose left side is nothing but modifiers.
  let searchFrom = 0;
  while (true) {
    const commaIndex = working.indexOf(",", searchFrom);
    if (commaIndex <= 0) break;

    const head = working.slice(0, commaIndex).trim();
    const headIsAllModifiers = head
      .split(/\s+/)
      .every((w) => MODIFIERS.has(w.toLowerCase()));

    if (headIsAllModifiers) {
      // Drop the comma outright — it was punctuation between adjectives, and
      // leaving it in would strand it in the middle of the name.
      working = `${head} ${working.slice(commaIndex + 1).trim()}`;
      searchFrom = head.length + 1;
      continue;
    }

    note = working.slice(commaIndex + 1).trim() || null;
    working = head;
    break;
  }

  // Trailing prep phrases that arrive without a comma.
  const trailing = working.match(
    /\s+(?:to taste|as needed|for (?:serving|garnish|drizzling|dusting|brushing|frying)|if desired|or more|plus more.*)$/i,
  );
  if (trailing) {
    note = [note, trailing[0].trim()].filter(Boolean).join(", ");
    working = working.slice(0, trailing.index).trim();
  }

  // Leading prep adjectives belong in the note too, but only when stripping
  // them leaves something behind — "ground beef" must stay "ground beef".
  const words = working.split(" ");
  let start = 0;
  while (start < words.length - 1 && MODIFIERS.has(words[start].toLowerCase())) {
    start++;
  }
  if (start > 0) {
    const stripped = words.slice(0, start).join(" ");
    note = [stripped, note].filter(Boolean).join(", ");
    working = words.slice(start).join(" ");
  }

  if (parentheticals.length) {
    note = [note, ...parentheticals].filter(Boolean).join(", ");
  }

  const name = working.replace(/[.;:]+$/, "").trim().toLowerCase() || null;

  return {
    raw,
    quantity: quantity ?? null,
    unit,
    name,
    note: note?.replace(/\s+/g, " ").trim() || null,
  };
}

function isUnitToken(token: string): boolean {
  const key = token.toLowerCase().replace(/\.$/, "");
  // "T" means tablespoon, but only capitalized — lowercase "t" is teaspoon.
  return KNOWN_UNITS.has(key) && normalizeUnit(token) !== null;
}

/**
 * Collapses names that mean the same thing on a shopping list, so "yellow
 * onion" and "onions" merge into one line instead of two.
 */
export function canonicalName(name: string): string {
  let n = name.toLowerCase().trim();
  n = n.replace(/^(fresh|dried|frozen|canned|raw|whole|organic|large|small|medium)\s+/g, "");
  // Depluralize, minus the words where the plural is the normal form.
  const keepPlural = new Set(["greens", "grits", "oats", "sprouts", "chives", "molasses", "hummus", "couscous", "asparagus"]);
  if (!keepPlural.has(n)) {
    if (n.endsWith("ies")) n = n.slice(0, -3) + "y";
    else if (/(ch|sh|ss|x|z)es$/.test(n)) n = n.slice(0, -2);
    else if (n.endsWith("oes")) n = n.slice(0, -2);
    else if (n.endsWith("s") && !n.endsWith("ss") && !n.endsWith("us")) n = n.slice(0, -1);
  }
  return n.trim();
}
