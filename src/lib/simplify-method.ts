/**
 * Boils a wordy instruction down to the part you actually look back at
 * mid-cook: what you're doing, how hot, how long.
 *
 * "Meanwhile, preheat oven to 350°F (180°C) and adjust rack to center
 * position. In a large bowl, toss bread cubes with 2 tablespoons olive oil.
 * Transfer to a rimmed baking sheet. Bake about 15 minutes, until crisp."
 *   → "Bake 350°F, 15 min"
 *
 * It's lossy on purpose. The full text stays available until you save, and
 * this is offered as a button rather than done to you.
 */

/** Verbs worth leading a line with, roughly ordered by how much they matter. */
const VERBS = [
  "bake", "roast", "grill", "broil", "fry", "deep-fry", "air-fry", "sear",
  "sauté", "saute", "boil", "simmer", "poach", "steam", "braise", "stew",
  "blanch", "toast", "caramelise", "caramelize", "reduce", "marinate",
  "chill", "freeze", "refrigerate", "rest", "rise", "proof", "knead", "whisk",
  "beat", "fold", "blend", "purée", "puree", "mash", "mix", "stir", "toss",
  "combine", "melt", "preheat", "cook", "warm", "cool", "drain", "strain",
  "chop", "dice", "slice", "mince", "grate", "peel", "assemble", "serve",
];

const VERB_PATTERN = new RegExp(`\\b(${VERBS.join("|")})(?:e?[sd]|ing)?\\b`, "i");

/** Present-tense form, so a line reads as an instruction. */
function normaliseVerb(word: string): string {
  const lower = word.toLowerCase();
  const direct = VERBS.find(
    (v) => lower === v || lower === `${v}s` || lower === `${v}d` || lower === `${v}ed`,
  );
  if (direct) return direct;
  const stem = lower.replace(/(?:ing|ed|s)$/, "");
  return VERBS.find((v) => v === stem || v === `${stem}e`) ?? stem;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** "350°F", "180 C", "gas mark 4". Imperial wins because ovens here are °F. */
function findTemperature(text: string): string | null {
  const degrees = text.match(
    /(\d{2,3})\s*(?:°|º|\s)?\s*(?:degrees?\s*)?(F\b|C\b|fahrenheit|celsius)/i,
  );
  if (degrees) {
    const unit = degrees[2].toUpperCase().startsWith("F") ? "F" : "C";
    return `${degrees[1]}°${unit}`;
  }
  const gas = text.match(/gas mark\s*(\d)/i);
  return gas ? `gas mark ${gas[1]}` : null;
}

/**
 * The longest duration mentioned, which is nearly always the one that governs
 * the step — "cook 2 minutes, then simmer 40 minutes" is a 40 minute step.
 */
function findDuration(text: string): string | null {
  const matches = [
    ...text.matchAll(
      /(\d+(?:\s*[-–—]\s*\d+)?(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi,
    ),
  ];
  if (!matches.length) return null;

  let best: { text: string; seconds: number } | null = null;

  for (const match of matches) {
    // A range takes its top end: "8–10 minutes" is a 10 minute step.
    const high = Number(match[1].split(/[-–—]/).pop()!.trim());
    if (!Number.isFinite(high)) continue;

    const unit = match[2].toLowerCase();
    const seconds = unit.startsWith("h")
      ? high * 3600
      : unit.startsWith("m")
        ? high * 60
        : high;

    const label = unit.startsWith("h") ? "hr" : unit.startsWith("m") ? "min" : "sec";
    const shown = `${match[1].replace(/\s*[-–—]\s*/, "–")} ${label}`;

    if (!best || seconds > best.seconds) best = { text: shown, seconds };
  }

  return best?.text ?? null;
}

/** One instruction, shortened. Returns null when there's nothing worth keeping. */
export function simplifyStep(step: string): string | null {
  const text = step.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const temperature = findTemperature(text);
  const duration = findDuration(text);

  // Take the numbers out before reading the sentence, or the object ends up
  // repeating what the detail already says: "Simmer about 8 minutes — 8 min".
  const prose = text
    .replace(
      /\b(?:for|about|approximately|around)?\s*\d+(?:\s*[-–—]\s*\d+)?(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi,
      " ",
    )
    .replace(/\b(?:to|at)?\s*\d{2,3}\s*(?:°|º)?\s*(?:degrees?\s*)?(?:F|C|fahrenheit|celsius)\b/gi, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const verbMatch = prose.match(VERB_PATTERN);

  if (!verbMatch) {
    // No verb to lead with: keep the first clause so nothing vanishes silently.
    const firstClause = text.split(/[.;]/)[0].trim();
    return firstClause.length > 70 ? `${firstClause.slice(0, 67)}…` : firstClause;
  }

  const verb = capitalise(normaliseVerb(verbMatch[1]));

  // What's being acted on — a few words after the verb, minus filler.
  const after = prose
    .slice(verbMatch.index! + verbMatch[0].length)
    .split(/[,.;(]|\b(?:until|and then|then)\b/i)[0]
    .replace(/^(?:the|a|an|your|for|about|to|in|on|with)\b\s*/i, "")
    .trim();

  const object = after
    .split(/\s+/)
    .slice(0, 4)
    .join(" ")
    // A trailing preposition reads as a sentence cut in half.
    .replace(/\s+(?:to|in|on|with|for|and|over|into|from|at|of)$/i, "")
    .trim();

  const parts = [verb, object || null].filter(Boolean).join(" ");
  const detail = [temperature, duration].filter(Boolean).join(", ");

  return detail ? `${parts} — ${detail}` : parts;
}

/** A whole method, one simplified line per step. */
export function simplifyMethod(method: string): string {
  return method
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(simplifyStep)
    .filter((line): line is string => Boolean(line))
    .join("\n");
}
