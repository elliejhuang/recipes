"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Loader2 } from "lucide-react";
import { forkRecipe, updateAdaptationNote } from "@/lib/actions";

export function ForkButton({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const id = await forkRecipe(recipeId);
          router.push(`/recipes/${id}/edit`);
        })
      }
      className="btn"
      title="Copy this into your own version, leaving the original as it was imported"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <ChefHat size={14} />}
      Make it mine
    </button>
  );
}

/** The running note on what you changed and why. */
export function AdaptationNote({
  recipeId,
  initial,
}: {
  recipeId: number;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const save = () => {
    if (value === (initial ?? "")) return;
    startTransition(async () => {
      await updateAdaptationNote(recipeId, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label" htmlFor="adaptation">
          What you changed
        </label>
        {saved && <span className="mb-1.5 text-[11px] text-leaf">Saved</span>}
      </div>
      <textarea
        id="adaptation"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={2}
        placeholder="Doubled the garlic, swapped in whole milk, baked 10 minutes longer."
        className="field resize-y"
      />
    </div>
  );
}
