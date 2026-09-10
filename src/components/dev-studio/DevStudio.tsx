"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
// Aliased: the picker's document-level handlers take the DOM MouseEvent, and an
// unaliased import of React's synthetic one would quietly shadow it.
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import "./dev-studio.css";

/**
 * Dev-only annotation + live-tweak overlay. Ported from the portfolio, where
 * it originated; the two copies are not synced, so a fix worth having in both
 * has to be made twice.
 *
 * Never ships to production — see the NODE_ENV guard in DevStudioMount, which
 * a bundler folds to `false` so this module is never pulled into the graph.
 *
 * Two modes. **View** leaves the page alone and adds a breakpoint switcher, so
 * the site can be checked at phone and desktop widths without a second device.
 * **Annotate** turns on the element picker: click anything to leave a note, or
 * drag a slider to preview a type change live, then "Copy brief" to paste a
 * Markdown summary into a Claude Code session.
 *
 * Notes accumulate per element rather than replacing each other. Clicking an
 * element you have already annotated shows what you said before and starts a
 * fresh note underneath — the same element usually collects several unrelated
 * remarks over a session, and folding them into one textarea meant the second
 * one silently overwrote the first.
 *
 * Switching to a new element while the previous one has unsaved slider changes
 * auto-reverts them, so the page doesn't accumulate stray live edits. See the
 * plan's Deferred / Open Questions section for the alternative.
 *
 * The note panel anchors under the element it describes and can be dragged by
 * its header to somewhere less in the way; that position persists. Under
 * "Adjust type" the font-family menu offers only the families the site already
 * loads, and writes the token (`var(--font-serif)`) rather than a resolved
 * stack, so a previewed change is the change that would be committed.
 */

const STORAGE_KEY = "devstudio:annotations";
/**
 * Below this width the note panel is docked by CSS, so the saved drag position
 * would place it somewhere it can no longer be. Kept in sync with the
 * max-width query in dev-studio.css.
 */
const DOCK_BELOW_PX = 640;

const POPOVER_POS_KEY = "devstudio:popover-pos";
const RESET_MS = 1500;
const BAR_POS_KEY = "devstudio:barpos";

/**
 * Type only. The layout sliders (padding, gap, margin) came out: a single
 * padding value written to all four sides, or a margin collapsed to one number,
 * described a change nobody would actually make, and the resulting brief line
 * ("padding: 24px → 31px") was never the real instruction. Type is different —
 * a size or a weight is genuinely one number, so the slider says something true.
 */
type StyleProperty = "fontSize" | "fontWeight" | "letterSpacing" | "lineHeight";

/**
 * Everything the panel can change. font-family is the odd one out — a choice
 * from a fixed list rather than a number — but it reverts and records into the
 * brief exactly like the sliders, so it shares their machinery.
 */
type TypeProperty = StyleProperty | "fontFamily" | "scale";

const STYLE_PROPERTIES: StyleProperty[] = [
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
];

const PROP_LABEL: Record<TypeProperty, string> = {
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  letterSpacing: "letter-spacing",
  lineHeight: "line-height",
  scale: "scale",
};

/** What each property is actually written as. Scale writes several — see below. */
const WRITE_PROP: Record<StyleProperty | "fontFamily", string> = PROP_LABEL;

/**
 * "Is this the right size?" is the most common note on a photo, and until now
 * it could only be written in prose — "make this a bit bigger" — which meant
 * guessing, and then finding out on the next reload.
 *
 * Written as an explicit width in px, measured off the element at pick time.
 * Two more obvious mechanisms are both wrong:
 *
 * `transform: scale()` is painted, not laid out — the element would overlap
 * its neighbours at 2x and leave a hole at 0.5x, so the preview answers a
 * different question from the one being asked.
 *
 * `zoom` reflows, which is why it was tried first, but it scales *lengths*
 * and leaves percentages alone — a lot of this app's imagery is `width: 100%`
 * of its own box, which resolves the percentage against a containing block
 * that had already been rescaled and cancels itself out.
 *
 * A px width is what the layout actually does, so what's previewed is the
 * change that would be committed.
 *
 * Unlike the type sliders this is offered for any element, not only one with
 * text of its own — a photo is exactly the thing whose size is in question,
 * and it has no direct text.
 */
const SCALE_STEPS = [0.25, 0.5, 1, 2, 3] as const;

/** Everything a scale preview writes, so reverting can clear all of it. */
const SCALE_WRITES = ["width", "max-width", "height", "margin-inline"];

/**
 * The families the site actually loads — every one is @import-ed in
 * global.css and has a token in tokens.css, so a preview is the change that
 * would be committed.
 *
 * Figtree is the one exception: it's @import-ed and tokenised like the rest,
 * but no rule on the site renders in it yet, so the browser defers the woff2
 * until the menu first applies it. First preview can therefore flash — that's
 * the font arriving, not a bug. It's in the list as a candidate for replacing
 * Albert Sans; if it doesn't win, drop the package, the @import, and
 * --font-sans-alt together.
 *
 * `note` is the loaded weight range. Hahmlet, Halant and Crimson Pro ship a
 * single weight each, so dragging the font-weight slider after picking one of
 * them gets a browser-synthesised fake bold rather than a real cut — worth
 * seeing in the menu, since the weight slider sits directly underneath.
 */
const FONT_OPTIONS = [
  { token: "--font-serif", label: "Serif (display)", note: "Iowan / Palatino" },
  { token: "--font-sans", label: "Sans (UI)", note: "system stack" },
] as const;

/**
 * Sans faces in Albert Sans's neighbourhood — geometric, generous x-height,
 * the same job — for trying an alternative against real copy before committing.
 *
 * These are NOT shipped. They are @import-ed by dev-studio.css, which only ever
 * loads inside the overlay's dev-only branch, so production never pays for them.
 * That is also why they are written as literal stacks rather than tokens: a
 * token would imply the site knows about them, and it doesn't. Picking one is a
 * proposal — if it wins, it gets a package, an @import in global.css, and a
 * token, and only then can a stylesheet reference it.
 *
 * The display faces (Grandstander, Patrick Hand SC) came out of the menu
 * entirely. They belong to the name card and nothing else, and offering them
 * against body copy only produced options nobody would take.
 */
const TRYOUT_FONTS: readonly { label: string; family: string }[] = [];

/** The literal stack a try-out font writes, mirroring --font-sans's fallbacks. */
function tryoutStack(family: string): string {
  return `"${family}", ui-sans-serif, system-ui, sans-serif`;
}

/**
 * Tags worth re-casting a picked element as. Deliberately the document's own
 * vocabulary — the levels a case study is built from — rather than every
 * element HTML has. Anything not on this list is a question about markup, not
 * about hierarchy, and the overlay has no opinion on those.
 */
const ELEMENT_TAGS = ["h1", "h2", "h3", "h4", "p", "li", "strong", "em", "span", "div"];

/**
 * Re-cast an element as a different tag, in place.
 *
 * The node is genuinely replaced rather than restyled, because the whole point
 * is to see what the real `.case-body h2` rules do to this text — copying an
 * h2's computed styles onto a p would answer a different and much less useful
 * question. Attributes carry over wholesale, which matters most for Astro's
 * `data-astro-cid-*`: scoped CSS keys off it, so a swap that dropped it would
 * silently lose every component-scoped rule and look like the tag change did
 * something it didn't.
 *
 * Children are moved, not cloned, so nested elements and their listeners
 * survive. Returns the new node — the caller must re-point at it, since the old
 * one is now detached.
 */
function swapTag(el: HTMLElement, tag: string): HTMLElement {
  // el's own document — it may live in the breakpoint preview's iframe, and a
  // node created by the wrong document can't be inserted into this one.
  const next = el.ownerDocument.createElement(tag);
  for (const attr of Array.from(el.attributes)) next.setAttribute(attr.name, attr.value);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
}

function tagOf(el: HTMLElement): string {
  return el.tagName.toLowerCase();
}

/** First family in a stack, unquoted and lowercased — the part worth comparing. */
function firstFamily(stack: string): string {
  return (stack.split(",")[0] ?? "").replace(/["']/g, "").trim().toLowerCase();
}

/**
 * getComputedStyle off el's own window, not the module-global one — el may
 * live in the breakpoint preview's iframe, a separate Document and Window.
 */
function computedStyleOf(el: HTMLElement): CSSStyleDeclaration {
  const view = el.ownerDocument.defaultView ?? window;
  return view.getComputedStyle(el);
}

/**
 * What the element's font-family is *before* any change, written the way it
 * would be written in the stylesheet. Matching the computed stack back to a
 * token means the brief line reads `var(--font-sans) → var(--font-serif)`,
 * which is directly actionable, instead of two sprawling font stacks.
 */
function describeFontFamily(el: HTMLElement): string {
  const current = firstFamily(computedStyleOf(el).fontFamily);
  const root = computedStyleOf(el.ownerDocument.documentElement as HTMLElement);
  const match = FONT_OPTIONS.find(
    (opt) => firstFamily(root.getPropertyValue(opt.token)) === current
  );
  return match ? `var(${match.token})` : current || "inherit";
}

/** Phone, laptop, desktop. Widths are viewport widths, so media queries in the
 *  framed page resolve exactly as they would on a real device of that size. */
const BREAKPOINTS = [
  { id: "phone", label: "Phone", width: 390, height: 844 },
  { id: "narrow", label: "Narrow", width: 1024, height: 768 },
  { id: "wide", label: "Wide", width: 1440, height: 900 },
] as const;

type BreakpointId = (typeof BREAKPOINTS)[number]["id"];

/**
 * Just the fields the highlight box and popover positioning read. A DOMRect
 * from inside the framed preview gets rebuilt into one of these — scaled and
 * offset into the outer page's coordinates — so a real DOMRect isn't required.
 */
type Rect = { top: number; left: number; width: number; height: number; bottom: number };

interface PropertyChange {
  property: TypeProperty;
  before: string;
  after: string;
}

interface PopoverPos {
  top: number;
  left: number;
}

/** A rendered comment marker: the annotation's id/label plus the live rect of
 *  the element it currently resolves to, refreshed on scroll/resize. */
interface MarkerPos {
  id: string;
  text: string;
  rect: Rect;
}

interface Locator {
  tag: string;
  classes: string[];
  textExcerpt: string;
}

interface Annotation {
  id: string;
  page: string;
  locator: Locator;
  comment: string;
  changes: PropertyChange[];
  /** Set only when the element was re-cast as a different tag. */
  tagChange?: { from: string; to: string };
  createdAt: string;
  /** The breakpoint preview open when this was saved, or null for the real
   *  page (no preview — "Web"). Recorded so a note taken against the phone
   *  preview doesn't quietly get read as a general instruction later. */
  viewport: BreakpointId | null;
  /** Whether this note applies beyond just `viewport`. Phone notes default
   *  to false (phone-only, since the phone preview is a genuinely different
   *  target rather than another web width); Narrow/Wide/Web default to true,
   *  since those are all the same web layout at different widths. */
  allSizes: boolean;
}

type Range = { min: number; max: number; step: number };

function loadAnnotations(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Annotation>[];
    // Notes saved before viewport scoping existed have neither field. Treated
    // as "applies everywhere" — the safest read of a note nobody scoped,
    // rather than guessing it was phone-only and hiding it from every other
    // view.
    return parsed.map((a) => ({
      ...a,
      viewport: a.viewport ?? null,
      allSizes: a.allSizes ?? true,
    })) as Annotation[];
  } catch {
    return [];
  }
}

function saveAnnotations(list: Annotation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * Where the panel was last dragged to. Persisted because "get this thing off
 * the header I'm working on" is a decision about the page being reviewed, not
 * about one element — re-dragging it after every reload would defeat the point.
 */
function loadPopoverPos(): PopoverPos | null {
  try {
    const raw = localStorage.getItem(POPOVER_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.top === "number" && typeof parsed?.left === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function savePopoverPos(pos: PopoverPos | null) {
  if (pos) localStorage.setItem(POPOVER_POS_KEY, JSON.stringify(pos));
  else localStorage.removeItem(POPOVER_POS_KEY);
}

/** Keep the whole panel on screen — a smaller window than last session, or a
 *  drag that overshoots, would otherwise strand the close button off-viewport. */
function clampToViewport(top: number, left: number, el: HTMLElement): PopoverPos {
  const margin = 8;
  return {
    top: Math.max(margin, Math.min(top, window.innerHeight - el.offsetHeight - margin)),
    left: Math.max(margin, Math.min(left, window.innerWidth - el.offsetWidth - margin)),
  };
}

function locatorKey(locator: Locator, page: string) {
  return `${page}::${locator.tag}.${locator.classes.join(".")}::${locator.textExcerpt}`;
}

/** tag + classes + text excerpt, with fallbacks for textless elements and a
 * sibling-index tiebreaker when the locator collides with another element
 * currently on the page. */
function buildLocator(el: HTMLElement): Locator {
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList);
  const rawText = (el.textContent ?? "").trim().slice(0, 60);
  let textExcerpt = rawText;

  if (!textExcerpt) {
    const alt = el.getAttribute("alt") ?? el.querySelector("[alt]")?.getAttribute("alt") ?? null;
    const ariaLabel = el.getAttribute("aria-label");
    if (alt) {
      textExcerpt = `alt:${alt}`;
    } else if (ariaLabel) {
      textExcerpt = `aria-label:${ariaLabel}`;
    } else if (el.firstElementChild) {
      const child = el.firstElementChild;
      const childClass = child.classList[0];
      textExcerpt = childClass
        ? `${child.tagName.toLowerCase()}.${childClass}`
        : child.tagName.toLowerCase();
    }
  }

  let siblingIndex: number | null = null;
  const selector = classes.length ? `${tag}.${classes.join(".")}` : tag;
  try {
    // The element's own document, not the module-global one — el may live
    // inside the breakpoint preview's iframe, a separate document entirely.
    const ownerDoc = el.ownerDocument;
    const matches = Array.from(ownerDoc.querySelectorAll<HTMLElement>(selector)).filter(
      (candidate) => (candidate.textContent ?? "").trim().slice(0, 60) === rawText
    );
    if (matches.length > 1) siblingIndex = matches.indexOf(el);
  } catch {
    // invalid/unsupported selector -- skip disambiguation, base locator still works
  }

  return {
    tag,
    classes,
    textExcerpt: siblingIndex !== null ? `${textExcerpt} [#${siblingIndex + 1}]` : textExcerpt,
  };
}

/**
 * The inverse of buildLocator: given a saved Locator, find the live element on
 * the current page it refers to. Reuses buildLocator's own tag+classes
 * selector and locatorKey's string comparison — the same machinery that
 * decides whether a freshly-picked element already has notes — rather than
 * inventing a second, possibly-inconsistent way to recognise "the same
 * element." Returns null if nothing on the page matches (e.g. the markup
 * changed since the note was saved).
 *
 * Deliberately scoped to the real page (`document`), not the breakpoint
 * preview's iframe — markers are for orienting on the page you're actually
 * looking at, and toggling them while a preview is open isn't a case this
 * needs to cover.
 */
function findElementForLocator(locator: Locator, page: string): HTMLElement | null {
  const selector = locator.classes.length
    ? `${locator.tag}.${locator.classes.join(".")}`
    : locator.tag;
  const key = locatorKey(locator, page);
  try {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    return candidates.find((el) => locatorKey(buildLocator(el), page) === key) ?? null;
  } catch {
    // invalid/unsupported selector -- no marker for this annotation
    return null;
  }
}

/** What a marker's floating card says. Mirrors the fallback text already used
 *  when listing existing notes on the focused element, truncated since these
 *  cards sit on the page rather than in a scrollable list. */
function markerLabel(a: Annotation): string {
  const text = a.comment || (a.tagChange ? `element → <${a.tagChange.to}>` : "type change only");
  return text.length > 70 ? `${text.slice(0, 67)}...` : text;
}

/**
 * Whether the type sliders are worth showing. An element with no text of its
 * own renders nothing they could affect, and a wrapper div full of children
 * would have inherited font-size dragged onto it, which is almost never the
 * edit you want. Direct text nodes only — not descendant text.
 */
function hasOwnText(el: HTMLElement): boolean {
  return Array.from(el.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0
  );
}

function readInitialValue(el: HTMLElement, property: StyleProperty): number {
  const cs = computedStyleOf(el);
  switch (property) {
    case "fontSize":
      return parseFloat(cs.fontSize) || 16;
    case "fontWeight":
      return parseFloat(cs.fontWeight) || 400;
    case "letterSpacing":
      return cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) || 0;
    case "lineHeight": {
      if (cs.lineHeight === "normal") return 1.2;
      if (cs.lineHeight.endsWith("px")) {
        const fontSize = parseFloat(cs.fontSize) || 16;
        return Math.round((parseFloat(cs.lineHeight) / fontSize) * 100) / 100;
      }
      return parseFloat(cs.lineHeight) || 1.2;
    }
  }
}

function rangeFor(property: StyleProperty, initial: number): Range {
  switch (property) {
    case "fontWeight":
      return { min: 100, max: 900, step: 100 };
    case "lineHeight":
      return { min: Math.max(0.8, initial - 0.8), max: initial + 0.8, step: 0.1 };
    case "letterSpacing":
      return { min: initial - 4, max: initial + 4, step: 0.1 };
    default: {
      const span = Math.max(initial, 8);
      return { min: Math.max(0, initial - span), max: initial + span, step: 1 };
    }
  }
}

function applyValue(el: HTMLElement, property: StyleProperty, value: number) {
  switch (property) {
    case "fontSize":
      el.style.fontSize = `${value}px`;
      break;
    case "fontWeight":
      el.style.fontWeight = String(value);
      break;
    case "letterSpacing":
      el.style.letterSpacing = `${value}px`;
      break;
    case "lineHeight":
      el.style.lineHeight = String(value);
      break;
  }
}

function formatValue(property: StyleProperty, value: number): string {
  return property === "fontWeight" || property === "lineHeight" ? String(value) : `${value}px`;
}

function groupByPage(annotations: Annotation[]): Map<string, Annotation[]> {
  const map = new Map<string, Annotation[]>();
  annotations.forEach((a) => {
    const list = map.get(a.page) ?? [];
    list.push(a);
    map.set(a.page, list);
  });
  return map;
}

function describeLocator(locator: Locator): string {
  const classPart = locator.classes.length ? `.${locator.classes.join(".")}` : "";
  return `${locator.tag}${classPart}`;
}

/**
 * Only worth a line when the note was taken against a breakpoint preview —
 * "Web" (no preview, applies everywhere) is the overwhelming default and
 * would just be noise repeated on every single item. A phone-only note gets
 * this front and centre, since that's exactly the distinction the export
 * exists to preserve.
 */
function describeScope(a: Annotation): string | null {
  if (!a.viewport) return null;
  const label = BREAKPOINTS.find((b) => b.id === a.viewport)?.label ?? a.viewport;
  return a.allSizes ? `${label} (all sizes)` : `${label} only`;
}

function buildMarkdown(annotations: Annotation[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`# Studio notes — ${date}`, ""];
  groupByPage(annotations).forEach((list, page) => {
    lines.push(`## ${page}`);
    list.forEach((a) => {
      const excerptPart = a.locator.textExcerpt ? ` ("${a.locator.textExcerpt}")` : "";
      lines.push(`- **${describeLocator(a.locator)}**${excerptPart}`);
      const scope = describeScope(a);
      if (scope) lines.push(`  Scope: ${scope}`);
      if (a.comment) lines.push(`  Comment: ${a.comment}`);
      // First, because re-casting the element is the change every other line
      // here is relative to.
      if (a.tagChange) {
        lines.push(`  - element: <${a.tagChange.from}> → <${a.tagChange.to}>`);
      }
      a.changes.forEach((c) => {
        lines.push(`  - ${PROP_LABEL[c.property]}: ${c.before} → ${c.after}`);
      });
      lines.push("");
    });
  });
  return lines.join("\n").trim() + "\n";
}

export default function DevStudio() {
  const [mode, setMode] = useState<"view" | "annotate">("view");
  const [breakpoint, setBreakpoint] = useState<BreakpointId | null>(null);
  const [hoverRect, setHoverRect] = useState<Rect | null>(null);
  const [focusedEl, setFocusedEl] = useState<HTMLElement | null>(null);
  const [focusedRect, setFocusedRect] = useState<Rect | null>(null);
  const [touchedProps, setTouchedProps] = useState<Set<TypeProperty>>(new Set());
  const [values, setValues] = useState<Partial<Record<StyleProperty, number>>>({});
  const [ranges, setRanges] = useState<Partial<Record<StyleProperty, Range>>>({});
  const [fontToken, setFontToken] = useState("");
  const [scale, setScale] = useState(1);
  const [elementTag, setElementTag] = useState("");
  const [comment, setComment] = useState("");
  const [showType, setShowType] = useState(false);
  /** Whether the note being written applies beyond the current breakpoint
   *  preview. Reset per-pick in `pickElement`, defaulting to false only when
   *  the preview open at pick time is Phone — see the Annotation field this
   *  gets saved into for why. */
  const [applyAllSizes, setApplyAllSizes] = useState(true);
  const [isTrayOpen, setTrayOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  /**
   * Whether the current set of notes has been copied out. Separate from
   * copyStatus, which is the button's own label and resets itself after a
   * second and a half — far too short a window to then reach for Clear. This
   * latch stays up until the notes change, which is exactly when a previous
   * copy stops covering what is on screen.
   */
  const [copiedOut, setCopiedOut] = useState(false);
  /** The ids that were actually in the last successful Copy Brief — lets the
   *  tray/markers mark exactly those notes green, not just "some copy
   *  happened at some point." Cleared alongside copiedOut whenever the notes
   *  change (see the effect below), so a stale copy never reads as current. */
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  /** Which Studio Notes tab is showing: a page path, or "__all__" for every
   *  page in recency order. Null means "no explicit choice yet" — the tray
   *  then defaults to the current page's tab if it has notes. */
  const [activeTrayTab, setActiveTrayTab] = useState<string | null>(null);
  const [frameScale, setFrameScale] = useState(1);
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);
  /** "C" toggles this on/off; see the keydown effect below. */
  const [showMarkers, setShowMarkers] = useState(false);
  const [markers, setMarkers] = useState<MarkerPos[]>([]);

  /**
   * Where the toolbar has been dragged to, as an offset from the bottom-right
   * corner it starts in. Kept as an offset rather than as coordinates so the
   * bar stays anchored to that corner when the window resizes. The
   * breakpoint switcher used to be a second, independently-dragged pill in
   * the opposite corner; it's now a row inside this same pad, so one offset
   * covers both.
   *
   * Persisted, because the position is a working preference — having to shove
   * the bar out of the way again on every reload is exactly the annoyance
   * this is meant to remove.
   */
  const [barOffset, setBarOffset] = useState({ x: 0, y: 0 });

  /** Minimum gap kept between a dragged bar and the true window edge. */
  const DRAG_MARGIN = 12;

  /**
   * Keeps a bar's whole rect on screen, not just some sliver of it — the grip
   * that starts a drag sits at one end of the bar, and clamping only enough to
   * keep the grip itself reachable left the mode buttons and Notes hanging
   * off the edge past it, reachable to look at but not to click. `baseLeft`/
   * `baseTop` are the bar's un-translated position (its rect minus whatever
   * offset is already applied) — fixed for the life of one drag, so clamping
   * a mid-drag candidate doesn't feed back on itself the way re-measuring the
   * (already translated) live rect on every move would.
   */
  const clampBarOffset = (
    x: number,
    y: number,
    baseLeft: number,
    baseTop: number,
    width: number,
    height: number,
  ) => ({
    x: Math.min(
      Math.max(x, DRAG_MARGIN - baseLeft),
      Math.max(DRAG_MARGIN - baseLeft, window.innerWidth - width - DRAG_MARGIN - baseLeft),
    ),
    y: Math.min(
      Math.max(y, DRAG_MARGIN - baseTop),
      Math.max(DRAG_MARGIN - baseTop, window.innerHeight - height - DRAG_MARGIN - baseTop),
    ),
  });

  /**
   * Shared drag. Pointer capture with listeners on the handle itself, so a
   * fast drag that outruns the cursor keeps sending moves here instead of
   * dropping the bar the moment the pointer leaves it.
   */
  const startDrag = (
    event: ReactPointerEvent<HTMLElement>,
    from: { x: number; y: number },
    set: (pos: { x: number; y: number }) => void,
    storeKey: string,
  ) => {
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...from };

    // The whole bar, not just the grip — clamping is against the bar's own
    // footprint. Without it, an untethered drag (a wild real one, or an
    // automated testing click that registered as a big pointer delta) could
    // carry the bar's offset to some enormous value with nothing to stop it,
    // and once saved there was no way back into the tool short of editing
    // storage by hand. One bad save, from any tab, corrupts it for every tab
    // on the origin — localStorage isn't per-tab.
    const bar = grip.parentElement;
    const barRect = bar?.getBoundingClientRect();
    const baseLeft = (barRect?.left ?? 0) - origin.x;
    const baseTop = (barRect?.top ?? 0) - origin.y;
    const width = barRect?.width ?? 0;
    const height = barRect?.height ?? 0;

    const resolve = (e: PointerEvent) =>
      clampBarOffset(
        origin.x + (e.clientX - startX),
        origin.y + (e.clientY - startY),
        baseLeft,
        baseTop,
        width,
        height,
      );

    const move = (e: PointerEvent) => set(resolve(e));

    const up = (e: PointerEvent) => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      const pos = resolve(e);
      try {
        localStorage.setItem(storeKey, JSON.stringify(pos));
      } catch {
        // Not being able to remember it is no reason to refuse the move.
      }
    };

    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  };

  useEffect(() => {
    // Restores at {x:0,y:0} on this first render, so `.getBoundingClientRect()`
    // read right now reflects each bar's plain, un-translated anchor position —
    // exactly the `baseLeft`/`baseTop` clampBarOffset expects.
    const bar = document.querySelector<HTMLElement>(".devstudio__bar")?.getBoundingClientRect();
    try {
      const raw = localStorage.getItem(BAR_POS_KEY);
      if (raw && bar) {
        const saved = JSON.parse(raw);
        // Clamped on read, not just on the next drag — a position already
        // saved off-screen needs pulling back in on its own, not left
        // stranded until someone drags it again from a bar they can no
        // longer see or reach.
        setBarOffset(clampBarOffset(saved.x, saved.y, bar.left, bar.top, bar.width, bar.height));
      }
    } catch {
      // A malformed or blocked store just means the bar opens where it always did.
    }
  }, []);

  // ---- Segmented-control sliding indicator -------------------------------
  // The mode switch and the breakpoint switch are now one merged control pad
  // (see the toolbar JSX below), and each half gets a pill that glides under
  // the active button rather than snapping — measured off the real DOM
  // instead of hardcoded widths, since button width varies with its label.
  const modesGroupRef = useRef<HTMLDivElement>(null);
  const bpGroupRef = useRef<HTMLDivElement>(null);
  const [modeIndicator, setModeIndicator] = useState<{ left: number; width: number } | null>(null);
  const [bpIndicator, setBpIndicator] = useState<{ left: number; width: number } | null>(null);

  const measureIndicator = (container: HTMLElement | null) => {
    const active = container?.querySelector<HTMLElement>(".is-active");
    return active ? { left: active.offsetLeft, width: active.offsetWidth } : null;
  };

  useLayoutEffect(() => {
    setModeIndicator(measureIndicator(modesGroupRef.current));
  }, [mode]);

  useLayoutEffect(() => {
    setBpIndicator(measureIndicator(bpGroupRef.current));
  }, [breakpoint]);

  useEffect(() => {
    const onResize = () => {
      setModeIndicator(measureIndicator(modesGroupRef.current));
      setBpIndicator(measureIndicator(bpGroupRef.current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const baselineRef = useRef<Partial<Record<TypeProperty, string>>>({});
  /** The tag the element had in the source, so a swap can always be undone. */
  const originalTagRef = useRef<string>("");
  /**
   * The locator as it was at pick time. Re-deriving it at save time would read
   * the *swapped* tag, so a note saying "make this an h2" would be filed under
   * h2 — describing the element you asked for rather than the one to go and
   * change. Captured once, used for both saving and matching existing notes.
   */
  const pickedLocatorRef = useRef<Locator | null>(null);
  /**
   * The element's own rendered width at pick time. Every step is a multiple of
   * this rather than of whatever the last step left behind, so 0.5x then 2x
   * lands back where it started instead of compounding to 1x of a shrunken box.
   */
  const baseWidthRef = useRef(0);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Bumped on every iframe navigation, so effects that wire up listeners on
  // its contentDocument know to re-run against the fresh Document — the old
  // one, and every listener on it, is gone once the frame reloads.
  const [frameLoadTick, setFrameLoadTick] = useState(0);
  /** Elements matched for the current marker pass. Held in a ref rather than
   *  state because scroll/resize only needs fresh rects off these, not a
   *  fresh DOM search every frame. */
  const markerTargetsRef = useRef<{ id: string; text: string; el: HTMLElement }[]>([]);

  useEffect(() => {
    setAnnotations(loadAnnotations());
    // On a narrow screen the panel is docked by CSS; a restored drag position
    // from a desktop session would place it somewhere it can't be reached.
    if (window.innerWidth > DOCK_BELOW_PX) setPopoverPos(loadPopoverPos());
  }, []);

  useEffect(
    () => () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    },
    []
  );

  // Grow the textarea to fit. Height is reset to auto first so it can shrink
  // again when text is deleted — scrollHeight never reports less than the
  // current height, so without the reset the box only ever gets taller.
  useLayoutEffect(() => {
    const el = commentRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [comment, focusedEl]);

  const isOwnUI = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest("[data-devstudio-ui]");

  /**
   * el's rect, in the outer page's coordinates. An element picked from inside
   * the breakpoint preview lives in a document whose own getBoundingClientRect
   * answers in the iframe's *unscaled* coordinate space — genuinely 390px
   * wide regardless of how small the frame is drawn — so it has to be scaled
   * and offset by the iframe's own position to land in the right place when
   * the highlight box or popover renders in the parent document.
   */
  const getRect = useCallback(
    (el: HTMLElement): Rect => {
      const inner = el.getBoundingClientRect();
      if (el.ownerDocument === document) return inner;
      const frame = iframeRef.current;
      if (!frame) return inner;
      const outer = frame.getBoundingClientRect();
      const top = outer.top + inner.top * frameScale;
      const height = inner.height * frameScale;
      return {
        top,
        left: outer.left + inner.left * frameScale,
        width: inner.width * frameScale,
        height,
        bottom: top + height,
      };
    },
    [frameScale]
  );

  /** Undo both the inline style edits and any tag swap, in that order. */
  const revertUnsavedEdits = useCallback((el: HTMLElement, touched: Set<TypeProperty>) => {
    touched.forEach((prop) => {
      if (prop === "scale") SCALE_WRITES.forEach((css) => el.style.removeProperty(css));
      else el.style.removeProperty(WRITE_PROP[prop]);
    });
    const original = originalTagRef.current;
    if (original && tagOf(el) !== original) swapTag(el, original);
  }, []);

  const closeFocus = useCallback(() => {
    setFocusedEl(null);
    setFocusedRect(null);
    setTouchedProps(new Set());
    setValues({});
    setRanges({});
    setFontToken("");
    setScale(1);
    setElementTag("");
    setComment("");
    setShowType(false);
    setApplyAllSizes(true);
    baselineRef.current = {};
    originalTagRef.current = "";
    pickedLocatorRef.current = null;
  }, []);

  const pickElement = useCallback(
    (el: HTMLElement) => {
      if (focusedEl && focusedEl !== el) {
        revertUnsavedEdits(focusedEl, touchedProps);
      }

      const baseline: Partial<Record<TypeProperty, string>> = {};
      const initialValues: Partial<Record<StyleProperty, number>> = {};
      const initialRanges: Partial<Record<StyleProperty, Range>> = {};
      STYLE_PROPERTIES.forEach((prop) => {
        const iv = readInitialValue(el, prop);
        baseline[prop] = formatValue(prop, iv);
        initialValues[prop] = iv;
        initialRanges[prop] = rangeFor(prop, iv);
      });
      baseline.fontFamily = describeFontFamily(el);
      baseline.scale = "1x";

      baselineRef.current = baseline;
      originalTagRef.current = tagOf(el);
      pickedLocatorRef.current = buildLocator(el);
      baseWidthRef.current = el.getBoundingClientRect().width;
      setTouchedProps(new Set());
      setValues(initialValues);
      setRanges(initialRanges);
      setFontToken("");
      setScale(1);
      setElementTag(tagOf(el));
      // Always a blank note. Previous notes on this element render above it as
      // their own entries rather than being loaded in for editing.
      setComment("");
      setShowType(false);
      // Phone is a genuinely different target, not just another web width —
      // a note taken there defaults to phone-only. Narrow/Wide/no-preview are
      // all the same web layout at different widths, so those default to
      // applying everywhere.
      setApplyAllSizes(breakpoint !== "phone");
      setFocusedEl(el);
      setFocusedRect(getRect(el));
      setHoverRect(null);
    },
    [focusedEl, touchedProps, revertUnsavedEdits, getRect, breakpoint]
  );

  useEffect(() => {
    if (mode !== "annotate") return;

    const handleMove = (e: MouseEvent) => {
      if (isOwnUI(e.target)) {
        setHoverRect(null);
        return;
      }
      setHoverRect(getRect(e.target as HTMLElement));
    };

    const handleClick = (e: MouseEvent) => {
      if (isOwnUI(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const target = e.target as HTMLElement;
      const el = e.altKey && target.parentElement ? target.parentElement : target;
      pickElement(el);
    };

    // The same picker, wired to the framed preview's own document too — not
    // instead of the top-level one. A click inside an iframe never reaches
    // the parent document's listeners; it's a separate document entirely, so
    // without this the preview would be unannotatable the moment a
    // breakpoint is open.
    const docs = [document];
    const frameDoc = breakpoint ? iframeRef.current?.contentDocument : null;
    if (frameDoc) docs.push(frameDoc);

    docs.forEach((doc) => {
      doc.addEventListener("mousemove", handleMove, true);
      doc.addEventListener("click", handleClick, true);
    });
    return () => {
      docs.forEach((doc) => {
        doc.removeEventListener("mousemove", handleMove, true);
        doc.removeEventListener("click", handleClick, true);
      });
    };
  }, [mode, pickElement, getRect, breakpoint, frameLoadTick]);

  useEffect(() => {
    if (!focusedEl) return;
    const update = () => setFocusedRect(getRect(focusedEl));
    const ro = new ResizeObserver(update);
    ro.observe(focusedEl);
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    // Scrolling *inside* the framed preview moves the element relative to the
    // iframe too, and that scroll never reaches the outer window's listener.
    const frameWindow = focusedEl.ownerDocument.defaultView;
    if (frameWindow && frameWindow !== window) {
      frameWindow.addEventListener("scroll", update, { passive: true, capture: true });
    }
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      if (frameWindow && frameWindow !== window) {
        frameWindow.removeEventListener("scroll", update, true);
      }
    };
  }, [focusedEl, getRect]);

  // Scale the framed preview down when the chosen width doesn't fit the real
  // window — 1440 rarely does once the browser's own chrome is accounted for.
  // Scaling rather than clipping keeps the whole layout visible, and the iframe
  // still *reports* the full width internally, so media queries are unaffected.
  useEffect(() => {
    if (!breakpoint) return;
    const target = BREAKPOINTS.find((b) => b.id === breakpoint);
    if (!target) return;

    const update = () => {
      const availableW = window.innerWidth - 64;
      const availableH = window.innerHeight - 128;
      setFrameScale(Math.min(1, availableW / target.width, availableH / target.height));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [breakpoint]);

  /**
   * Esc switches modes — and only that. It used to also close an open
   * breakpoint preview, but that meant Esc-ing out of a note left inside the
   * Phone preview silently threw the preview away too, one keystroke doing
   * two unrelated things. Closing the preview is what its own × is for.
   *
   * With a popover open it closes that first and leaves the mode alone. One
   * rule, and it protects a half-typed note — Esc is reflex for "get this panel
   * off my screen", and if that also flipped the mode the note would be gone.
   * A second press then switches, which is what a reflexive double-Esc expects
   * anyway.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (focusedEl) {
        handleCancel();
        return;
      }
      setModeSafely(mode === "view" ? "annotate" : "view");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /**
   * "C" toggles comment markers on/off, in any mode. Guarded against typing —
   * without the activeElement check, typing a note that happens to contain
   * "c" would fight the popover's own textarea every keystroke.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "c" || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isTyping) return;
      setShowMarkers((v) => !v);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * Re-find every current-page annotation's element while markers are shown,
   * then keep their rects live on scroll/resize (rAF-throttled — a dev tool,
   * so this favours simplicity over a "did the rect actually change" check).
   * The DOM search itself only re-runs when markers are toggled on or the
   * annotation list changes, not on every scroll tick.
   */
  useEffect(() => {
    // No state to clear here: rendering already gates on showMarkers, so a
    // stale `markers` array sitting unused in state is harmless, and this
    // keeps the reset out of the effect body directly (see `update` below).
    if (!showMarkers) {
      markerTargetsRef.current = [];
      return;
    }

    const page = window.location.pathname;
    markerTargetsRef.current = annotations
      // Same scope rule as the tray: a phone-only note has no marker on the
      // real (Web) page, and vice versa — a marker for a note that isn't
      // actually about what's on screen right now would be misleading, not
      // just cluttered.
      .filter((a) => a.page === page && (a.allSizes || a.viewport === breakpoint))
      .map((a) => {
        const el = findElementForLocator(a.locator, page);
        return el ? { id: a.id, text: markerLabel(a), el } : null;
      })
      .filter((m): m is { id: string; text: string; el: HTMLElement } => m !== null);

    let raf = 0;
    const update = () => {
      setMarkers(
        markerTargetsRef.current.map((m) => ({
          id: m.id,
          text: m.text,
          rect: getRect(m.el),
        }))
      );
    };
    update();

    const onScrollOrResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showMarkers, annotations, breakpoint, getRect]);

  const handleSliderChange = (prop: StyleProperty, value: number) => {
    if (!focusedEl) return;
    setTouchedProps((prev) => new Set(prev).add(prop));
    applyValue(focusedEl, prop, value);
    setValues((v) => ({ ...v, [prop]: value }));
  };

  /**
   * 1x is the way back out rather than a value in its own right: it removes
   * the inline zoom and drops the property from the note, so tapping through
   * the steps and landing back on 1x leaves no trace, the same as never
   * having touched it.
   */
  const handleScaleChange = (value: number) => {
    if (!focusedEl) return;
    setScale(value);
    if (value === 1) {
      SCALE_WRITES.forEach((css) => focusedEl.style.removeProperty(css));
      setTouchedProps((prev) => {
        const next = new Set(prev);
        next.delete("scale");
        return next;
      });
      return;
    }
    const width = baseWidthRef.current * value;
    focusedEl.style.width = `${Math.round(width)}px`;
    // Beats a stylesheet's own cap — an image at width:100% with a max-height,
    // or an auto-width block; without this a 2x preview is silently clipped
    // back to its column.
    focusedEl.style.maxWidth = "none";
    // Images and figures often carry an explicit height, so the ratio has to
    // be handed back to the width.
    focusedEl.style.height = "auto";
    // Centred on what it leaves behind, so a shrunk element doesn't range
    // left of everything else on the page and read as a different change.
    focusedEl.style.marginInline = "auto";
    setTouchedProps((prev) => new Set(prev).add("scale"));
  };

  /**
   * The option's value IS the CSS to write — `var(--font-sans)` for a family the
   * site owns, a literal stack for a try-out that has no token yet. Either way
   * what's previewed is exactly what would go in the stylesheet, and the brief
   * line says so. Picking the blank option removes the inline property and
   * hands the element back to its own CSS.
   */
  const handleFontChange = (value: string) => {
    if (!focusedEl) return;
    setFontToken(value);
    if (value) {
      focusedEl.style.fontFamily = value;
      setTouchedProps((prev) => new Set(prev).add("fontFamily"));
    } else {
      focusedEl.style.removeProperty("font-family");
      setTouchedProps((prev) => {
        const next = new Set(prev);
        next.delete("fontFamily");
        return next;
      });
    }
  };

  /**
   * Re-cast the picked element as another tag. The node is replaced, so the
   * focus has to follow it to the new one — the old node is detached and every
   * subsequent slider edit would otherwise land on something not in the page.
   */
  const handleElementChange = (tag: string) => {
    if (!focusedEl || tag === tagOf(focusedEl)) return;
    const next = swapTag(focusedEl, tag);
    setElementTag(tag);
    setFocusedEl(next);
    setFocusedRect(getRect(next));
    // Re-read the sliders off the new tag: the whole point is that h2 and p
    // resolve to different sizes and weights, so the numbers under the menu
    // have to describe what is now on screen.
    const nextValues: Partial<Record<StyleProperty, number>> = {};
    const nextRanges: Partial<Record<StyleProperty, Range>> = {};
    STYLE_PROPERTIES.forEach((prop) => {
      const iv = readInitialValue(next, prop);
      nextValues[prop] = iv;
      nextRanges[prop] = rangeFor(prop, iv);
    });
    setValues(nextValues);
    setRanges(nextRanges);
  };

  // ---- Dragging the panel ------------------------------------------------
  // The panel is anchored under the element it describes, which is exactly
  // where it's most likely to cover the thing being looked at. Dragging by the
  // header moves it; the position then sticks across picks and reloads, since
  // "keep out of this corner" is a judgement about the page, not the element.
  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    // The close button lives in the drag handle — let it stay a button.
    if ((e.target as HTMLElement).closest("button")) return;
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handleDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = popoverRef.current;
    if (!drag || !el) return;
    const next = clampToViewport(e.clientY - drag.dy, e.clientX - drag.dx, el);
    setPopoverPos(next);
    savePopoverPos(next);
  };

  const handleDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  /** Double-click the header to give the panel back to the auto-anchoring. */
  const handleResetPos = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setPopoverPos(null);
    savePopoverPos(null);
  };

  // A stored position outlives the window it was chosen in. Re-clamp once the
  // panel has a measurable size so a narrower window can't hide the controls.
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el || !popoverPos || dragRef.current) return;
    if (window.innerWidth <= DOCK_BELOW_PX) return;
    const clamped = clampToViewport(popoverPos.top, popoverPos.left, el);
    if (clamped.top !== popoverPos.top || clamped.left !== popoverPos.left) {
      setPopoverPos(clamped);
      savePopoverPos(clamped);
    }
  }, [popoverPos, focusedEl, showType]);

  const handleCancel = useCallback(() => {
    if (focusedEl) revertUnsavedEdits(focusedEl, touchedProps);
    closeFocus();
  }, [focusedEl, touchedProps, revertUnsavedEdits, closeFocus]);

  const handleSave = () => {
    if (!focusedEl) return;
    const page = window.location.pathname;
    // The pick-time locator, not a fresh one — see pickedLocatorRef.
    const locator = pickedLocatorRef.current ?? buildLocator(focusedEl);
    const originalTag = originalTagRef.current;
    const currentTag = tagOf(focusedEl);
    const changes: PropertyChange[] = Array.from(touchedProps).map((prop) => {
      if (prop === "fontFamily") {
        return {
          property: prop,
          before: baselineRef.current.fontFamily ?? "inherit",
          after: fontToken,
        };
      }
      if (prop === "scale") {
        return { property: prop, before: "1x", after: `${scale}x` };
      }
      return {
        property: prop,
        before: baselineRef.current[prop] ?? formatValue(prop, readInitialValue(focusedEl, prop)),
        after: formatValue(prop, values[prop] ?? readInitialValue(focusedEl, prop)),
      };
    });

    // Always a new entry. Merging into the existing one is what made a second
    // remark about the same element overwrite the first.
    const next: Annotation[] = [
      ...annotations,
      {
        id: crypto.randomUUID(),
        page,
        locator,
        comment,
        changes,
        ...(currentTag !== originalTag && { tagChange: { from: originalTag, to: currentTag } }),
        createdAt: new Date().toISOString(),
        viewport: breakpoint,
        allSizes: applyAllSizes,
      },
    ];

    setAnnotations(next);
    saveAnnotations(next);
    // Put the element back before letting go of it. A saved note is a request
    // to change the source, not a change already made — leaving the swapped tag
    // in the page would mean the next reload silently undid what looks like an
    // applied edit, and every later pick would be measured against a DOM that
    // no longer matches the file.
    revertUnsavedEdits(focusedEl, touchedProps);
    closeFocus();
  };

  const handleDelete = (id: string) => {
    setAnnotations((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAnnotations(next);
      return next;
    });
  };

  const handleClearAll = () => {
    setAnnotations([]);
    saveAnnotations([]);
    setCopiedOut(false);
  };

  /**
   * Clicking a tray item re-opens the same focused popover a fresh pick
   * would — same edit/comment/scale controls, existing notes listed above a
   * blank one — so a note can be revisited without hunting the element down
   * on the page again. Only possible for the page currently open: the
   * locator is matched against the live DOM (see `findElementForLocator`),
   * and an annotation filed on a different page has nothing here to resolve
   * against.
   */
  const handleReopenFromTray = (a: Annotation) => {
    if (a.page !== window.location.pathname) return;
    const el = findElementForLocator(a.locator, a.page);
    if (!el) return;
    pickElement(el);
    setTrayOpen(false);
  };

  /**
   * Any change to the notes makes the last copy stale, so the clear gate closes
   * again. Otherwise a copy, then three more notes, then Clear would throw away
   * three notes that were never in the clipboard.
   */
  useEffect(() => {
    setCopiedOut(false);
    setCopiedIds(new Set());
  }, [annotations]);

  const handleCopyBrief = useCallback(async () => {
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    try {
      await navigator.clipboard.writeText(buildMarkdown(annotations));
      setCopyStatus("copied");
      setCopiedOut(true);
      setCopiedIds(new Set(annotations.map((a) => a.id)));
    } catch {
      setCopyStatus("failed");
    }
    copyTimeout.current = setTimeout(() => setCopyStatus("idle"), RESET_MS);
  }, [annotations]);

  const setModeSafely = (next: "view" | "annotate") => {
    if (next === mode) return;
    if (focusedEl) handleCancel();
    setHoverRect(null);
    setMode(next);
  };

  const tagChanged = !!focusedEl && tagOf(focusedEl) !== originalTagRef.current;
  const canSave = comment.trim().length > 0 || touchedProps.size > 0 || tagChanged;

  const existingNotes =
    focusedEl && pickedLocatorRef.current
      ? (() => {
          const page = window.location.pathname;
          // Pick-time locator again: after a swap, a fresh one would key off the
          // new tag and stop matching the notes already filed against this
          // element — they'd vanish from the panel mid-session.
          const key = locatorKey(pickedLocatorRef.current, page);
          return annotations.filter((a) => a.page === page && locatorKey(a.locator, page) === key);
        })()
      : [];

  const activeFrame = BREAKPOINTS.find((b) => b.id === breakpoint) ?? null;

  // The same rule everywhere a note gets shown: an all-sizes note is always
  // relevant; a scoped one only is while its own breakpoint is the one
  // actually open (including "Web" itself — null === null).
  const visibleAnnotations = annotations.filter((a) => a.allSizes || a.viewport === breakpoint);
  const hiddenElsewhereCount = annotations.length - visibleAnnotations.length;

  // ---- Studio Notes tabs --------------------------------------------------
  // One tab per page that actually has a (currently visible) note, ordered by
  // that page's own most recent note — not alphabetically, so the page
  // someone's actively annotating surfaces first — plus a trailing "All" tab
  // showing every note across pages, newest first.
  const currentPage = window.location.pathname;
  const pageRecency = new Map<string, number>();
  visibleAnnotations.forEach((a) => {
    const t = new Date(a.createdAt).getTime();
    if (t > (pageRecency.get(a.page) ?? -Infinity)) pageRecency.set(a.page, t);
  });
  const sortedPages = Array.from(pageRecency.keys()).sort(
    (a, b) => (pageRecency.get(b) ?? 0) - (pageRecency.get(a) ?? 0)
  );
  // No explicit tab choice yet defaults to the page open right now, if it has
  // notes — otherwise "All" is the only tab that could show anything.
  const trayTab =
    activeTrayTab && (activeTrayTab === "__all__" || sortedPages.includes(activeTrayTab))
      ? activeTrayTab
      : sortedPages.includes(currentPage)
        ? currentPage
        : "__all__";
  const recencyAnnotations = [...visibleAnnotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const shownAnnotations =
    trayTab === "__all__" ? recencyAnnotations : recencyAnnotations.filter((a) => a.page === trayTab);
  const copiedNow = copiedOut ? copiedIds : new Set<string>();

  // Dot at the element's top-left corner; label offset to the side and
  // clamped so it can't run off whichever edge the element is near.
  //
  // That first pass places every label purely from its own element's
  // position, with no idea any other label exists — two notes on elements
  // near each other land their label cards directly on top of one another,
  // and every one but the topmost is invisible. The second pass below is a
  // small top-to-bottom cascade: walk the labels and push any that would
  // overlap an already-placed one straight down until it clears it,
  // re-checking after every push since clearing one collision can walk it
  // into another that's further down. LABEL_W/LABEL_H are a fixed estimate
  // rather than a real measurement, generous enough that a real label is
  // never larger than the slot it's given.
  const LABEL_W = 200;
  const LABEL_H = 60;
  const LABEL_GAP = 6;

  const initialLayout = markers.map((m) => {
    const dotX = m.rect.left;
    const dotY = m.rect.top;
    const labelX = Math.min(dotX + 18, window.innerWidth - 210);
    const labelY = Math.min(Math.max(dotY, 8), window.innerHeight - 50);
    return { ...m, dotX, dotY, labelX, labelY };
  });

  const placed: typeof initialLayout = [];
  const markerLayout = [...initialLayout]
    .sort((a, b) => a.labelY - b.labelY || a.labelX - b.labelX)
    .map((m) => {
      let y = m.labelY;
      let changed = true;
      while (changed) {
        changed = false;
        for (const r of placed) {
          const overlapsX = Math.abs(r.labelX - m.labelX) < LABEL_W;
          const overlapsY = y < r.labelY + LABEL_H + LABEL_GAP && y + LABEL_H + LABEL_GAP > r.labelY;
          if (overlapsX && overlapsY) {
            y = r.labelY + LABEL_H + LABEL_GAP;
            changed = true;
          }
        }
      }
      const resolved = { ...m, labelY: Math.min(y, window.innerHeight - LABEL_H - 8) };
      placed.push(resolved);
      return resolved;
    });

  return (
    <div data-devstudio-ui className="devstudio">
      {/* ---- Toolbar ---------------------------------------------------- */}
      {/* Phone/Narrow/Wide reads as "what am I looking at" — put it on its
          own row above View/Annotate/Notes so it reads as the primary
          control, not one segment among five in a single crowded row. */}
      <div
        className="devstudio__bar"
        style={{ translate: `${barOffset.x}px ${barOffset.y}px` }}
      >
        <div className="devstudio__bar-row devstudio__bar-row--bp">
          <div className="devstudio__bp-group" ref={bpGroupRef} role="group" aria-label="Preview width">
            {bpIndicator && (
              <span
                className="devstudio__seg-indicator devstudio__seg-indicator--accent"
                style={{ transform: `translateX(${bpIndicator.left}px)`, width: bpIndicator.width }}
                aria-hidden="true"
              />
            )}
            {BREAKPOINTS.map((bp) => (
              <button
                key={bp.id}
                type="button"
                className={`devstudio__bp${breakpoint === bp.id ? " is-active" : ""}`}
                aria-pressed={breakpoint === bp.id}
                onClick={() => setBreakpoint((current) => (current === bp.id ? null : bp.id))}
                title={`${bp.label} — ${bp.width}px`}
              >
                {bp.label}
              </button>
            ))}
          </div>
        </div>

        <span className="devstudio__bar-divider devstudio__bar-divider--h" aria-hidden="true" />

        <div className="devstudio__bar-row devstudio__bar-row--main">
          {/* The grip. Dragging is on a handle rather than the whole bar because
              every other thing in here is a control — a drag started on a
              button would either move the bar or fire the button, and
              whichever one you picked would be wrong half the time. */}
          <button
            type="button"
            className="devstudio__grip"
            aria-label="Move the studio toolbar"
            onPointerDown={(event) => startDrag(event, barOffset, setBarOffset, BAR_POS_KEY)}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="6" cy="4" r="1.35" fill="currentColor" />
              <circle cx="10" cy="4" r="1.35" fill="currentColor" />
              <circle cx="6" cy="8" r="1.35" fill="currentColor" />
              <circle cx="10" cy="8" r="1.35" fill="currentColor" />
              <circle cx="6" cy="12" r="1.35" fill="currentColor" />
              <circle cx="10" cy="12" r="1.35" fill="currentColor" />
            </svg>
          </button>

          <div className="devstudio__modes" ref={modesGroupRef} role="group" aria-label="Studio mode">
            {modeIndicator && (
              <span
                className="devstudio__seg-indicator"
                style={{ transform: `translateX(${modeIndicator.left}px)`, width: modeIndicator.width }}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              className={`devstudio__mode${mode === "view" ? " is-active" : ""}`}
              aria-pressed={mode === "view"}
              onClick={() => setModeSafely("view")}
            >
              View
            </button>
            <button
              type="button"
              className={`devstudio__mode${mode === "annotate" ? " is-active" : ""}`}
              aria-pressed={mode === "annotate"}
              onClick={() => setModeSafely("annotate")}
            >
              Annotate
            </button>
          </div>

          <span className="devstudio__bar-divider" aria-hidden="true" />

          <button
            type="button"
            className="devstudio__notes-btn"
            onClick={() => setTrayOpen((v) => !v)}
            aria-label={`Notes, ${annotations.length} saved`}
          >
            Notes
            {annotations.length > 0 && (
              <span className="devstudio__badge" aria-hidden="true">
                {annotations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ---- Breakpoint preview ----------------------------------------- */}
      {activeFrame && (
        <div className="devstudio__frame-backdrop">
          <div className="devstudio__frame-bar">
            <span>
              {activeFrame.label} · {activeFrame.width}×{activeFrame.height}
              {frameScale < 1 && ` · ${Math.round(frameScale * 100)}%`}
            </span>
            <button type="button" onClick={() => setBreakpoint(null)} aria-label="Close preview">
              ×
            </button>
          </div>
          {/* Two boxes on purpose. A transform doesn't change layout size, so a
              scaled stage still occupies its full unscaled height — which threw
              the flex centring out and pushed the top of the frame and its
              label off-screen. The outer box carries the *scaled* dimensions so
              the layout agrees with what's actually drawn. */}
          <div
            className="devstudio__frame-fit"
            style={{
              width: activeFrame.width * frameScale,
              height: activeFrame.height * frameScale,
            }}
          >
            <div
              className="devstudio__frame-stage"
              style={{
                width: activeFrame.width,
                height: activeFrame.height,
                transform: `scale(${frameScale})`,
              }}
            >
            {/* A real iframe, not a width-constrained div. Media queries answer
                to the viewport, so a narrowed element on a wide window still
                gets desktop CSS — which is exactly the thing being checked. */}
              <iframe
                ref={iframeRef}
                title={`${activeFrame.label} preview`}
                src={`${window.location.pathname}${window.location.search ? `${window.location.search}&` : "?"}ds-preview=1`}
                // A fresh navigation replaces contentDocument with a new
                // Document — the annotate picker's listeners were on the old
                // one and are gone with it, so re-run the effect that attaches
                // them.
                onLoad={() => setFrameLoadTick((n) => n + 1)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ---- Picker ------------------------------------------------------ */}
      {mode === "annotate" && !focusedEl && hoverRect && (
        <div
          className="devstudio__highlight"
          style={{
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height,
          }}
        />
      )}

      {focusedEl && focusedRect && (
        <>
          <div
            className="devstudio__highlight"
            style={{
              top: focusedRect.top,
              left: focusedRect.left,
              width: focusedRect.width,
              height: focusedRect.height,
            }}
          />
          <div
            ref={popoverRef}
            className="devstudio__popover"
            style={
              window.innerWidth <= DOCK_BELOW_PX
                ? undefined
                : (popoverPos ?? {
                    top: Math.min(focusedRect.bottom + 8, window.innerHeight - 380),
                    left: Math.min(
                      Math.max(focusedRect.left, 8),
                      window.innerWidth - 316,
                    ),
                  })
            }
          >
            <div
              className="devstudio__popover-head"
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
              onDoubleClick={handleResetPos}
              title="Drag to move · double-click to snap back"
            >
              {/* The pick-time locator, so the header keeps naming the element
                  in the source even after it's been re-cast on screen. */}
              <code>
                {describeLocator(pickedLocatorRef.current ?? buildLocator(focusedEl))}
                {tagChanged && <> → &lt;{tagOf(focusedEl)}&gt;</>}
              </code>
              <button type="button" onClick={handleCancel} aria-label="Close">
                ×
              </button>
            </div>

            {existingNotes.length > 0 && (
              <ul className="devstudio__existing">
                {existingNotes.map((note) => (
                  <li key={note.id}>
                    <span>
                      {describeScope(note) && (
                        <em className="devstudio__scope-badge">{describeScope(note)} — </em>
                      )}
                      {note.comment ||
                        (note.tagChange ? (
                          <em>
                            element → &lt;{note.tagChange.to}&gt;
                          </em>
                        ) : (
                          <em>type change only</em>
                        ))}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      aria-label="Delete this note"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <textarea
              ref={commentRef}
              className="devstudio__comment"
              placeholder={existingNotes.length > 0 ? "Add another note…" : "What's wrong with this?"}
              value={comment}
              rows={2}
              onChange={(e) => setComment(e.target.value)}
            />

            {/* Names the context this note is about to be filed under, and
                lets that default be overridden either direction — a phone
                note that's actually a general layout bug, or (less often) a
                web-width note that's genuinely specific to just Narrow or
                just Wide. Phone defaults unchecked (see `applyAllSizes`'s own
                comment); everything else defaults checked. */}
            <label className="devstudio__scope-toggle">
              <input
                type="checkbox"
                checked={applyAllSizes}
                onChange={(e) => setApplyAllSizes(e.target.checked)}
              />
              Applies to all sizes
              <span className="devstudio__scope-toggle-context">
                — viewing {activeFrame ? activeFrame.label : "Web"}
              </span>
            </label>

            {/* Directly under the box it belongs to, rather than below the
                sliders — the note is the main thing here and the save was
                previously separated from it by everything else in the panel. */}
            <button
              type="button"
              className="devstudio__save"
              disabled={!canSave}
              onClick={handleSave}
            >
              Save note
            </button>

            {/* Outside the type block and ungated: the elements whose size is
                usually wrong are photos and figures, which have no text of
                their own and so never see the sliders. */}
            <div className="devstudio__scale">
              <span className="devstudio__scale-label">scale</span>
              <div className="devstudio__scale-steps">
                {SCALE_STEPS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    className={step === scale ? "is-on" : undefined}
                    aria-pressed={step === scale}
                    onClick={() => handleScaleChange(step)}
                  >
                    {step}x
                  </button>
                ))}
              </div>
            </div>

            {hasOwnText(focusedEl) &&
              (showType ? (
                <div className="devstudio__sliders">
                  {/* Coarsest change on the panel, so it sits at the top: every
                      number below is a consequence of which tag this is. */}
                  <div className="devstudio__font-row">
                    <label htmlFor="devstudio-element">
                      <span>element</span>
                    </label>
                    <select
                      id="devstudio-element"
                      value={elementTag}
                      onChange={(e) => handleElementChange(e.target.value)}
                    >
                      {/* The source tag stays in the list and stays selectable,
                          so switching back is the same gesture as switching
                          away rather than a hunt for an undo. */}
                      {(ELEMENT_TAGS.includes(originalTagRef.current)
                        ? ELEMENT_TAGS
                        : [originalTagRef.current, ...ELEMENT_TAGS]
                      ).map((tag) => (
                        <option key={tag} value={tag}>
                          &lt;{tag}&gt;
                          {tag === originalTagRef.current ? " — in the source" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Swapping the family resets what every number under it looks
                      like, so it wants deciding before the sliders too. */}
                  <div className="devstudio__font-row">
                    <label htmlFor="devstudio-font">
                      <span>{PROP_LABEL.fontFamily}</span>
                    </label>
                    <select
                      id="devstudio-font"
                      value={fontToken}
                      onChange={(e) => handleFontChange(e.target.value)}
                    >
                      <option value="">
                        Unchanged — {baselineRef.current.fontFamily ?? "inherit"}
                      </option>
                      <optgroup label="On the site">
                        {FONT_OPTIONS.map((opt) => (
                          <option key={opt.token} value={`var(${opt.token})`}>
                            {opt.label} ({opt.note})
                          </option>
                        ))}
                      </optgroup>
                      {/* Separated because picking one of these is a proposal,
                          not an edit — nothing in the site can reference them
                          until they're installed for real. */}
                      <optgroup label="Try out — not installed on the site">
                        {TRYOUT_FONTS.map((opt) => (
                          <option key={opt.family} value={tryoutStack(opt.family)}>
                            {opt.label} (variable)
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {STYLE_PROPERTIES.map((prop) => {
                    const value = values[prop] ?? 0;
                    const range = ranges[prop] ?? { min: 0, max: 100, step: 1 };
                    return (
                      <div className="devstudio__slider-row" key={prop}>
                        <label>
                          <span>{PROP_LABEL[prop]}</span>
                          <span>{formatValue(prop, value)}</span>
                        </label>
                        <input
                          type="range"
                          min={range.min}
                          max={range.max}
                          step={range.step}
                          value={value}
                          onChange={(e) => handleSliderChange(prop, parseFloat(e.target.value))}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  className="devstudio__disclose"
                  onClick={() => setShowType(true)}
                >
                  Adjust element &amp; type
                </button>
              ))}
          </div>
        </>
      )}

      {/* ---- Comment markers ---------------------------------------------
          Toggled by "C" (see the keydown effect above). One dot+line+label
          per annotation on the current page whose element is still findable. */}
      {showMarkers && markerLayout.length > 0 && (
        <div className="devstudio__markers">
          <svg className="devstudio__markers-svg">
            {markerLayout.map((m) => (
              <line
                key={m.id}
                className={copiedNow.has(m.id) ? "is-copied" : undefined}
                x1={m.dotX}
                y1={m.dotY}
                x2={m.labelX}
                y2={m.labelY + 10}
              />
            ))}
          </svg>
          {markerLayout.map((m) => {
            const isCopied = copiedNow.has(m.id);
            // Same popover a fresh pick opens — see handleReopenFromTray. The
            // annotation this marker stands for is always for the current
            // page (markerTargetsRef is built from `annotations` filtered to
            // `a.page === page`), so the lookup below always resolves.
            const reopen = (e: ReactMouseEvent) => {
              e.stopPropagation();
              const a = annotations.find((x) => x.id === m.id);
              if (a) handleReopenFromTray(a);
            };
            return (
              <div key={m.id}>
                <button
                  type="button"
                  className={`devstudio__marker-dot${isCopied ? " is-copied" : ""}`}
                  style={{ top: m.dotY, left: m.dotX }}
                  onClick={reopen}
                  aria-label={`Reopen note: ${m.text}`}
                />
                <button
                  type="button"
                  className={`devstudio__marker-label${isCopied ? " is-copied" : ""}`}
                  style={{ top: m.labelY, left: m.labelX }}
                  onClick={reopen}
                >
                  {m.text}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Notes tray -------------------------------------------------- */}
      {/* The tray travels with the bar. It is a sibling, not a child, so it
          cannot inherit the transform and is given the same offset directly. */}
      {isTrayOpen && (
        <div
          className="devstudio__tray"
          style={{ translate: `${barOffset.x}px ${barOffset.y}px` }}
        >
          <div className="devstudio__tray-header">
            <h2>Studio notes</h2>
            <button type="button" onClick={() => setTrayOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          {/* A phone-only note shown while looking at Web would read as a
              general instruction it isn't — the same reason the export
              carries a Scope line, applied here so the list itself can't
              mislead. Everything still exists; this just isn't the moment
              it's relevant, same as it wouldn't show a Wide-only note while
              Phone is open either. */}
          {hiddenElsewhereCount > 0 && (
            <p className="devstudio__tray-hint">
              Showing {activeFrame ? activeFrame.label : "Web"} — {hiddenElsewhereCount} more saved for
              other sizes.
            </p>
          )}
          {/* One tab per page with a visible note, most-recently-active
              first, plus a trailing "All" tab across every page in recency
              order. Hidden entirely when there's only one page's worth of
              notes — a single tab isn't a choice. */}
          {sortedPages.length > 1 && (
            <div className="devstudio__tray-tabs" role="tablist" aria-label="Notes by page">
              {sortedPages.map((page) => (
                <button
                  key={page}
                  type="button"
                  role="tab"
                  aria-selected={trayTab === page}
                  className={`devstudio__tray-tab${trayTab === page ? " is-active" : ""}`}
                  onClick={() => setActiveTrayTab(page)}
                  title={page}
                >
                  {page.replace(/^\//, "").replace(/\/$/, "") || "/"}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={trayTab === "__all__"}
                className={`devstudio__tray-tab${trayTab === "__all__" ? " is-active" : ""}`}
                onClick={() => setActiveTrayTab("__all__")}
              >
                All
              </button>
            </div>
          )}
          <div className="devstudio__tray-list">
            {annotations.length === 0 ? (
              <p className="devstudio__tray-empty">
                No notes yet — switch to Annotate and click something.
              </p>
            ) : shownAnnotations.length === 0 ? (
              <p className="devstudio__tray-empty">
                Nothing for {activeFrame ? activeFrame.label : "Web"} yet.
              </p>
            ) : (
              shownAnnotations.map((a) => {
                const canReopen = a.page === window.location.pathname;
                const isCopied = copiedNow.has(a.id);
                return (
                  <div
                    className={`devstudio__tray-item${canReopen ? " is-reopenable" : ""}${isCopied ? " is-copied" : ""}`}
                    key={a.id}
                    onClick={canReopen ? () => handleReopenFromTray(a) : undefined}
                    title={canReopen ? "Click to reopen this element's notes" : undefined}
                  >
                    <button
                      type="button"
                      className="devstudio__tray-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(a.id);
                      }}
                      aria-label="Delete annotation"
                    >
                      ×
                    </button>
                    {/* Only worth naming the page when the list is actually
                        mixing pages — the per-page tabs already say it once,
                        in the tab itself, for every other view. */}
                    {trayTab === "__all__" && <div className="devstudio__tray-item-page">{a.page}</div>}
                    <div className="devstudio__tray-item-locator">
                      {describeLocator(a.locator)}
                      {a.locator.textExcerpt ? ` ("${a.locator.textExcerpt}")` : ""}
                    </div>
                    {describeScope(a) && (
                      <div className="devstudio__tray-item-scope">{describeScope(a)}</div>
                    )}
                    {a.comment && <div className="devstudio__tray-item-comment">{a.comment}</div>}
                    {(a.changes.length > 0 || a.tagChange) && (
                      <ul className="devstudio__tray-item-changes">
                        {a.tagChange && (
                          <li key="element">
                            element: &lt;{a.tagChange.from}&gt; → &lt;{a.tagChange.to}&gt;
                          </li>
                        )}
                        {a.changes.map((c) => (
                          <li key={c.property}>
                            {PROP_LABEL[c.property]}: {c.before} → {c.after}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="devstudio__tray-footer">
            <button
              type="button"
              className="devstudio__copy"
              disabled={annotations.length === 0}
              onClick={handleCopyBrief}
            >
              {copyStatus === "copied"
                ? "Copied!"
                : copyStatus === "failed"
                  ? "Couldn't copy"
                  : "Copy brief"}
            </button>
            {/* Gated behind a successful copy. Clearing is the one destructive
                thing in here and there is no undo, so the button stays inert
                until the notes are demonstrably somewhere else. Copying again
                re-arms it; the status resets on its own, which re-locks it. */}
            <button
              type="button"
              className="devstudio__clear"
              disabled={annotations.length === 0 || !copiedOut}
              title={
                copiedOut
                  ? "Delete all notes"
                  : "Copy the brief first — clearing cannot be undone"
              }
              onClick={handleClearAll}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
