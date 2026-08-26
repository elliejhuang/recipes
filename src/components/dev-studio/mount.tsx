"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Mounts DevStudio in development only.
 *
 * The import sits inside a branch that a production build folds to `false`,
 * since `process.env.NODE_ENV` is replaced with a literal at build time. That
 * makes the whole overlay — component, stylesheet, and the fonts it references
 * — dead code that never reaches the production graph. Verify with
 * `grep -ril devstudio .next` after `npm run build`; it should come back empty.
 *
 * Loading it from an effect rather than importing it at the top also keeps it
 * off the server: the overlay reads layout and localStorage, neither of which
 * exists during a server render.
 */
export function DevStudioMount() {
  const [overlay, setOverlay] = useState<ReactNode>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // The overlay's own breakpoint preview loads the site in an iframe. That
      // copy must not mount a second overlay inside itself.
      if (new URLSearchParams(window.location.search).has("ds-preview")) return;

      let cancelled = false;
      void import("./DevStudio").then(({ default: DevStudio }) => {
        if (!cancelled) setOverlay(<DevStudio />);
      });
      return () => {
        cancelled = true;
      };
    }
  }, []);

  return overlay;
}
