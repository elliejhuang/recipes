"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, Loader2 } from "lucide-react";
import { RecipeForm, type FormValues } from "@/components/recipe-form";
import type { ImportedRecipe } from "@/lib/import-recipe";

const SUGGESTIONS = [
  "seriouseats.com",
  "bonappetit.com",
  "allrecipes.com",
  "nytimes.com/cooking",
  "smittenkitchen.com",
  "budgetbytes.com",
];

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormValues | null>(null);

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Couldn't read that page.");
        return;
      }

      setDraft(toFormValues(data.recipe as ImportedRecipe));
    } catch {
      setError("Network error — check the link and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (draft) {
    return (
      <div>
        <button
          onClick={() => setDraft(null)}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          Import a different link
        </button>

        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold">
            Here&rsquo;s what came back
          </h1>
          <p className="mt-1 text-sm text-muted">
            Give it a read before saving — sites format their ingredients in
            some creative ways.
          </p>
        </div>

        <RecipeForm initial={draft} submitLabel="Save recipe" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pt-8">
      <h1 className="font-serif text-2xl font-semibold">Import a recipe</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Paste a link and it&rsquo;ll pull the ingredients, steps, times, and any
        nutrition the site published — leaving the ads and the personal essay
        behind.
      </p>

      <form onSubmit={run} className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <Link2
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.seriouseats.com/…"
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
        <div className="mt-4 rounded-lg border border-rule bg-card p-3.5">
          <p className="text-sm text-accent">{error}</p>
          <Link
            href="/recipes/new"
            className="mt-2 inline-block text-xs text-muted underline underline-offset-2"
          >
            Add it by hand instead
          </Link>
        </div>
      )}

      <div className="mt-10 border-t border-rule pt-5">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">
          Works with
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((site) => (
            <span
              key={site}
              className="rounded-full border border-rule bg-card px-2.5 py-1 text-xs text-muted"
            >
              {site}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-faint">
          …and most other recipe sites. Anything that shows a recipe card in
          Google results publishes the data this reads. Paywalled and app-only
          recipes generally won&rsquo;t work.
        </p>
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
