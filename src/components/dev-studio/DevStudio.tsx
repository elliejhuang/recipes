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
type TypeProperty = StyleProperty | "fontFamily";

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
};

const WRITE_PROP: Record<TypeProperty, string> = PROP_LABEL;

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
}

type Range = { min: number; max: number; step: number };

function loadAnnotations(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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

function buildMarkdown(annotations: Annotation[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`# Studio notes — ${date}`, ""];
  groupByPage(annotations).forEach((list, page) => {
    lines.push(`## ${page}`);
    list.forEach((a) => {
      const excerptPart = a.locator.textExcerpt ? ` ("${a.locator.textExcerpt}")` : "";
      lines.push(`- **${describeLocator(a.locator)}**${excerptPart}`);
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
  const [elementTag, setElementTag] = useState("");
  const [comment, setComment] = useState("");
  const [showType, setShowType] = useState(false);
  const [isTrayOpen, setTrayOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [frameScale, setFrameScale] = useState(1);
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);

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
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Bumped on every iframe navigation, so effects that wire up listeners on
  // its contentDocument know to re-run against the fresh Document — the old
  // one, and every listener on it, is gone once the frame reloads.
  const [frameLoadTick, setFrameLoadTick] = useState(0);

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
    touched.forEach((prop) => el.style.removeProperty(WRITE_PROP[prop]));
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
    setElementTag("");
    setComment("");
    setShowType(false);
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

      baselineRef.current = baseline;
      originalTagRef.current = tagOf(el);
      pickedLocatorRef.current = buildLocator(el);
      setTouchedProps(new Set());
      setValues(initialValues);
      setRanges(initialRanges);
      setFontToken("");
      setElementTag(tagOf(el));
      // Always a blank note. Previous notes on this element render above it as
      // their own entries rather than being loaded in for editing.
      setComment("");
      setShowType(false);
      setFocusedEl(el);
      setFocusedRect(getRect(el));
      setHoverRect(null);
    },
    [focusedEl, touchedProps, revertUnsavedEdits, getRect]
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

    document.addEventListener("mousemove", handleMove, true);
    document.addEventListener("click", handleClick, true);

    // The same picker, wired to the framed preview's own document too. A
    // click inside an iframe never reaches the parent document's listeners —
    // it's a separate document entirely — so without this the preview would
    // be unannotatable the moment a breakpoint is open.
    const frameDoc = iframeRef.current?.contentDocument;
    frameDoc?.addEventListener("mousemove", handleMove, true);
    frameDoc?.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("mousemove", handleMove, true);
      document.removeEventListener("click", handleClick, true);
      frameDoc?.removeEventListener("mousemove", handleMove, true);
      frameDoc?.removeEventListener("click", handleClick, true);
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

  const handleSliderChange = (prop: StyleProperty, value: number) => {
    if (!focusedEl) return;
    setTouchedProps((prev) => new Set(prev).add(prop));
    applyValue(focusedEl, prop, value);
    setValues((v) => ({ ...v, [prop]: value }));
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
  };

  const handleCopyBrief = useCallback(async () => {
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    try {
      await navigator.clipboard.writeText(buildMarkdown(annotations));
      setCopyStatus("copied");
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

  return (
    <div data-devstudio-ui className="devstudio">
      {/* ---- Toolbar ---------------------------------------------------- */}
      <div className="devstudio__bar">
        <div className="devstudio__modes" role="group" aria-label="Studio mode">
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

      {/* Its own group in the opposite corner. Sharing the bottom bar with the
          mode switch meant the toolbar changed width every time the mode
          changed, which moved the Notes button out from under the pointer.
          Shown in Annotate too once a preview is already open, so switching
          device sizes doesn't require bouncing back to View first. */}
      {(mode === "view" || breakpoint) && (
        <div className="devstudio__bp-bar" role="group" aria-label="Preview width">
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
      )}

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

      {/* ---- Notes tray -------------------------------------------------- */}
      {isTrayOpen && (
        <div className="devstudio__tray">
          <div className="devstudio__tray-header">
            <h2>Studio notes</h2>
            <button type="button" onClick={() => setTrayOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="devstudio__tray-list">
            {annotations.length === 0 ? (
              <p className="devstudio__tray-empty">
                No notes yet — switch to Annotate and click something.
              </p>
            ) : (
              Array.from(groupByPage(annotations)).map(([page, list]) => (
                <div className="devstudio__tray-group" key={page}>
                  <h3>{page}</h3>
                  {list.map((a) => (
                    <div className="devstudio__tray-item" key={a.id}>
                      <button
                        type="button"
                        className="devstudio__tray-item-delete"
                        onClick={() => handleDelete(a.id)}
                        aria-label="Delete annotation"
                      >
                        ×
                      </button>
                      <div className="devstudio__tray-item-locator">
                        {describeLocator(a.locator)}
                        {a.locator.textExcerpt ? ` ("${a.locator.textExcerpt}")` : ""}
                      </div>
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
                  ))}
                </div>
              ))
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
            <button
              type="button"
              className="devstudio__clear"
              disabled={annotations.length === 0}
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
