import { parseIngredientLine } from "./parse-ingredient";

export type FreeTextRecipe = {
  title: string | null;
  ingredientLines: string[];
  methodLines: string[];
};

/** Bullets people actually use in captions, emoji included. */
const BULLET = /^\s*(?:[-–—•*·▢□○●◦✔✅☑»>]|\p{Extended_Pictographic})\s*/u;

const INGREDIENT_HEADER =
  /^\s*\**\s*(ingredients?|what you(?:'ll)? need|you will need|shopping list)\s*\**\s*:?\s*$/i;
const METHOD_HEADER =
  /^\s*\**\s*(method|directions?|instructions?|steps?|how to(?: make)?|preparation|recipe)\s*\**\s*:?\s*$/i;

/** Words that start an instruction. Used to tell a step from an ingredient. */
const COOKING_VERBS = new Set([
  "add", "bake", "beat", "blend", "boil", "broil", "brown", "brush", "chill",
  "chop", "combine", "cook", "cool", "cover", "cut", "deglaze", "dice",
  "drain", "drizzle", "dust", "fold", "fry", "garnish", "grate", "grill",
  "heat", "knead", "let", "marinate", "mash", "melt", "mix", "pat", "peel",
  "place", "polish", "pour", "preheat", "press", "puree", "reduce", "remove",
  "repeat", "rest", "roast", "roll", "sauté", "saute", "scatter", "sear",
  "season", "serve", "set", "shake", "simmer", "slice", "spoon", "spread",
  "sprinkle", "steam", "stir", "strain", "taste", "toast", "toss", "transfer",
  "turn", "whisk", "wipe", "arrange", "assemble", "bring", "return", "divide",
]);

/**
 * Pulls a recipe out of a blob of text — an Instagram caption, a pin
 * description, something pasted from a screenshot.
 *
 * There's no structure to lean on the way there is with schema.org markup, so
 * this reads the shape people actually write in: a title line, a bulleted list
 * of things with amounts, then sentences that start with a verb. It is a guess,
 * and the import screen shows you the guess before anything is saved.
 */
export function parseFreeText(input: string): FreeTextRecipe {
  const rawLines = input
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rawLines.length) {
    return { title: null, ingredientLines: [], methodLines: [] };
  }

  // Explicit headers, when the writer gave us any, beat every heuristic below.
  const ingredientAt = rawLines.findIndex((l) => INGREDIENT_HEADER.test(l));
  const methodAt = rawLines.findIndex((l) => METHOD_HEADER.test(l));

  if (ingredientAt !== -1 || methodAt !== -1) {
    return fromHeaders(rawLines, ingredientAt, methodAt);
  }

  return fromShape(rawLines);
}

function fromHeaders(
  lines: string[],
  ingredientAt: number,
  methodAt: number,
): FreeTextRecipe {
  const firstHeader = Math.min(
    ...[ingredientAt, methodAt].filter((i) => i !== -1),
  );

  const title = firstHeader > 0 ? cleanTitle(lines[0]) : null;

  const slice = (from: number, to: number) =>
    from === -1
      ? []
      : lines.slice(from + 1, to === -1 || to < from ? undefined : to);

  const ingredientEnd = methodAt > ingredientAt ? methodAt : -1;
  const methodEnd = ingredientAt > methodAt ? ingredientAt : -1;

  const usable = (line: string) => Boolean(line) && !/^[#@]/.test(line);

  return {
    title,
    ingredientLines: slice(ingredientAt, ingredientEnd).map(stripBullet).filter(usable),
    methodLines: slice(methodAt, methodEnd).map(stripStepNumber).filter(usable),
  };
}

/**
 * No headers, so classify line by line. A line with a leading amount is
 * shopping; a line opening with a cooking verb is doing.
 */
function fromShape(lines: string[]): FreeTextRecipe {
  const ingredientLines: string[] = [];
  const methodLines: string[] = [];
  let title: string | null = null;

  for (const [index, line] of lines.entries()) {
    const bare = stripBullet(line);
    if (!bare) continue;

    // Hashtag pile-ups and @mentions at the end of a caption are not recipe.
    if (/^[#@]/.test(bare)) continue;

    if (
      index === 0 &&
      parseIngredientLine(bare).quantity === null &&
      !looksLikeStep(bare)
    ) {
      title = cleanTitle(bare);
      if (title) continue;
    }

    if (looksLikeIngredient(bare)) ingredientLines.push(bare);
    else if (looksLikeStep(bare)) methodLines.push(stripStepNumber(bare));
    // Anything else — a stray sentence of praise for one's grandmother — is
    // dropped rather than guessed at.
  }

  return { title, ingredientLines, methodLines };
}

function looksLikeIngredient(line: string): boolean {
  // Long prose isn't a shopping line even when it opens with a number.
  if (line.length > 90) return false;
  if (/[.!?]\s+\S/.test(line)) return false;

  const parsed = parseIngredientLine(line);
  if (parsed.quantity !== null) return true;

  // "Salt and pepper", "Olive oil" — short, no verb, no sentence.
  const first = line.split(/\s+/)[0]?.toLowerCase().replace(/[^a-zé]/g, "");
  return line.split(/\s+/).length <= 6 && !COOKING_VERBS.has(first);
}

function looksLikeStep(line: string): boolean {
  const withoutNumber = stripStepNumber(line);
  const first = withoutNumber.split(/\s+/)[0]?.toLowerCase().replace(/[^a-zé]/g, "");
  if (COOKING_VERBS.has(first)) return true;
  // A full sentence with a verb somewhere in it.
  return withoutNumber.length > 40 && /\s/.test(withoutNumber);
}

function stripBullet(line: string): string {
  return line.replace(BULLET, "").trim();
}

function stripStepNumber(line: string): string {
  return stripBullet(line)
    .replace(/^\s*(?:step\s*)?\d+\s*[).:\-–]\s*/i, "")
    .trim();
}

function cleanTitle(line: string): string | null {
  const cleaned = stripBullet(line)
    .replace(/[#@]\S+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned || cleaned.length > 90) return null;
  return cleaned;
}
