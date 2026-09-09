"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Link2, Loader2, Wand2 } from "lucide-react";
import { RecipeForm, type FormValues } from "@/components/recipe-form";
import type { ImportedRecipe } from "@/lib/import-recipe";
import { simplifyMethod } from "@/lib/simplify-method";

export function ImportClient({
  initialUrl,
  initialText,
  uploadsEnabled,
}: {
  initialUrl: string;
  initialText: string;
  uploadsEnabled: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCaption, setNeedsCaption] = useState(false);
  const [draft, setDraft] = useState<FormValues | null>(null);
  // Which kind of input the most recent attempt used, so a failure offers the
  // right box back rather than guessing.
  const [lastAttempt, setLastAttempt] = useState<"url" | "text" | null>(null);
  const autoRan = useRef(false);

  const run = useCallback(
    async (payload: { url?: string; text?: string }) => {
      setLoading(true);
      setError(null);
      setLastAttempt(payload.text ? "text" : "url");

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

  // Arriving with the input already given — the share sheet's ?url=, or the
  // "Paste a link"/"Paste recipe" modals on the homepage — so don't make her
  // press a button to do the obvious thing.
  useEffect(() => {
    if (initialUrl && !autoRan.current) {
      autoRan.current = true;
      void run({ url: initialUrl });
    }
  }, [initialUrl, run]);

  useEffect(() => {
    if (initialText && !autoRan.current) {
      autoRan.current = true;
      void run({ text: initialText });
    }
  }, [initialText, run]);

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

        <RecipeForm initial={draft} submitLabel="Save recipe" uploadsEnabled={uploadsEnabled} />
      </div>
    );
  }

  // Arrived with the input already given (share sheet or a homepage modal)
  // and still working on it — no form to show, the input was already handed
  // over. Only shown while there's no error to recover from yet.
  if (loading && !error && (initialUrl || initialText)) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 pt-16 text-center">
        <Loader2 size={22} className="animate-spin text-muted" />
        <p className="text-sm text-muted">Reading that now…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pt-6">
      <h1 className="font-serif text-2xl font-semibold">
        {error ? "Couldn't read that" : "Add a recipe"}
      </h1>
      {!error && (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Paste a link and it&rsquo;ll pull the ingredients, steps and any
          nutrition the site published. Pinterest pins get followed through to
          the blog behind them.
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-rule bg-card p-3.5">
          <p className="text-sm text-accent">{error}</p>
        </div>
      )}

      {/* A failed text attempt gets its box back rather than a link field it
          never used. Everything else — a fresh visit, a failed link attempt,
          the share-sheet default — gets the link form. */}
      {lastAttempt === "text" ? (
        <div className="mt-4">
          <p className="mb-1.5 text-xs leading-relaxed text-faint">
            {needsCaption
              ? "Copy the caption from the post and drop it here."
              : "A caption, a screenshot's text, anything with the ingredients one per line."}
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            autoFocus
            placeholder={
              "Creamy Tuscan Chicken\n\nIngredients:\n4 chicken breasts\n1 cup heavy cream\n\nMethod:\nSear the chicken 5 min a side.\nSimmer in the cream 8 min."
            }
            className="field resize-y font-mono !text-[13px] leading-relaxed"
          />
          <button
            onClick={() => void run({ text })}
            disabled={loading || !text.trim()}
            className="btn btn-primary mt-2 w-full"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Try again
          </button>
        </div>
      ) : (
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
      )}
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
