"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Loader2 } from "lucide-react";
import { forkRecipe } from "@/lib/actions";

/**
 * Copies a recipe so your version can diverge from the imported one.
 *
 * It drops you straight into the editor, which is also where you rename it —
 * there's no "adapted from" banner any more, so the name is the only thing
 * telling the two apart.
 */
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
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <ChefHat size={14} />}
      Make it mine
    </button>
  );
}
