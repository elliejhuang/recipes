"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardPaste, Link2, Loader2, Wand2 } from "lucide-react";
import { RecipeForm, type FormValues } from "@/components/recipe-form";
import type { ImportedRecipe } from "@/lib/import-recipe";
import { simplifyMethod } from "@/lib/simplify-method";

const WORKS_WITH = [
  "any recipe site",
  "pinterest.com",
  "seriouseats.com",
  "bonappetit.com",
  "allrecipes.com",
  "nytimes.com/cooking",
];

export function ImportClient({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCaption, setNeedsCaption] = useState(false);
  const [draft, setDraft] = useState<FormValues | null>(null);
  const autoRan = useRef(false);

  const run = useCallback(
    async (payload: { url?: string; text?: string }) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Couldn't read that.");
          setNeedsCaption(Boolean(data.needsCaption));
          return;
        }

        setNeedsCaption(false);
        setDraft(toFormValues(data.recipe as ImportedRecipe));
      } catch {
        setError("Network error — check the link and try again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Arriving from the share sheet: the link is already in the URL, so don't
  // make her press a button to do the obvious thing.
  useEffect(() => {
    if (initialUrl && !autoRan.current) {
      autoRan.current = true;
      void run({ url: initialUrl });
    }
  }, [initialUrl, run]);

  if (draft) {
    return (
      <div>
        <button
          onClick={() => {
            setDraft(null);
            setText("");
          }}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          Import something else
        </button>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold">
              Here&rsquo;s what came back
            </h1>
            <p className="mt-1 text-sm text-muted">
              Read it before saving — sites and captions format things in some
              creative ways.
            </p>
          </div>

          {draft.method && (
            <button
              onClick={() =>
                setDraft({ ...draft, method: simplifyMethod(draft.method ?? "") })
              }
              className="btn !py-1.5 !text-sm"
              title="Cut each step down to the verb, the temperature and the time"
            >
              <Wand2 size={14} />
              Simplify steps
            </button>
          )}
        </div>

        <RecipeForm initial={draft} submitLabel="Save recipe" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pt-6">
      <h1 className="font-serif text-2xl font-semibold">Add a recipe</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Paste a link and it&rsquo;ll pull the ingredients, steps and any
        nutrition the site published. Pinterest pins get followed through to the
        blog behind them.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) void run({ url });
        }}
        className="mt-5 flex gap-2"
      >
        <div className="relative flex-1">
          <Link2
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link…"
            autoFocus
            className="field !pl-9"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="btn btn-primary"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? "Reading…" : "Import"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-rule bg-card p-3.5">
          <p className="text-sm text-accent">{error}</p>
        </div>
      )}

      {/* Always available, not just after a failure — some things are only ever
          going to arrive as text. */}
      <div className="mt-8 border-t border-rule pt-5">
        <div className="flex items-center gap-1.5">
          <ClipboardPaste size={14} className="text-muted" />
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">
            Or paste the recipe itself
          </h2>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-faint">
          {needsCaption
            ? "Copy the caption from the post and drop it here."
            : "A caption, a screenshot's text, anything with the ingredients one per line."}
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={
            "Creamy Tuscan Chicken\n\nIngredients:\n4 chicken breasts\n1 cup heavy cream\n\nMethod:\nSear the chicken 5 min a side.\nSimmer in the cream 8 min."
          }
          className="field mt-2 resize-y font-mono !text-[13px] leading-relaxed"
        />

        <button
          onClick={() => void run({ text, url })}
          disabled={loading || !text.trim()}
          className="btn btn-primary mt-2 w-full"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Read this
        </button>
      </div>

      <div className="mt-8 border-t border-rule pt-5">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">
          Works with
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WORKS_WITH.map((site) => (
            <span
              key={site}
              className="rounded-full border border-rule bg-card px-2.5 py-1 text-xs text-muted"
            >
              {site}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-faint">
          Instagram is the exception: it shows a login wall to anything outside
          the app, so nothing can read a reel&rsquo;s caption for you. Share the
          link anyway — it&rsquo;s kept as the source — then paste the caption
          above.
        </p>
        <Link
          href="/recipes/new"
          className="mt-3 inline-block text-xs text-muted underline underline-offset-2"
        >
          Or write one from scratch
        </Link>

        {/* Kept in the app rather than only in the README, because the moment
            you want this you are holding the phone. */}
        <details className="mt-5 border-t border-rule pt-4">
          <summary className="cursor-pointer text-xs font-semibold tracking-wider text-muted uppercase">
            Sharing straight from another app
          </summary>
          <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-faint">
            <p>
              iOS won&rsquo;t let a website register itself in the share sheet,
              so it takes a Shortcut. Once, in the Shortcuts app:
            </p>
            <ol className="ml-4 list-decimal space-y-1">
              <li>New shortcut, name it &ldquo;Save to Recipe Box&rdquo;</li>
              <li>
                Add <span className="text-ink">Receive URLs from Share Sheet</span>
              </li>
              <li>
                Add <span className="text-ink">URL Encode</span>, input Shortcut
                Input
              </li>
              <li>
                Add <span className="text-ink">Text</span>:{" "}
                <code className="break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}
                  /recipes/import?url=
                </code>{" "}
                followed by the encoded text
              </li>
              <li>
                Add <span className="text-ink">Open URLs</span> with that text
              </li>
            </ol>
            <p>
              Then Pinterest → Share → Save to Recipe Box, and it lands here with
              the import already running.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

function toFormValues(recipe: ImportedRecipe): FormValues {
  return {
    title: recipe.title,
    imageUrl: recipe.imageUrl ?? "",
    sourceUrl: recipe.sourceUrl,
    sourceName: recipe.sourceName ?? "",
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    tags: recipe.tags,
    notes: "",
    ingredientText: recipe.ingredientLines.join("\n"),
    method: recipe.stepLines.join("\n"),
    nutrition: recipe.nutrition,
    nutritionSource: recipe.nutrition ? "imported" : null,
  };
}
