"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { clsx } from "clsx";
import { addToPlan, removeFromPlan } from "@/lib/actions";

export function PlanButton({
  recipeId,
  isPlanned,
}: {
  recipeId: number;
  isPlanned: boolean;
}) {
  const [, startTransition] = useTransition();
  const [planned, setPlanned] = useOptimistic(isPlanned);

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          setPlanned(!planned);
          if (planned) await removeFromPlan(recipeId);
          else await addToPlan(recipeId);
        })
      }
      className={clsx("btn", planned && "!border-accent !text-accent")}
    >
      {planned ? <Check size={14} /> : <Plus size={14} />}
      {planned ? "On the list" : "Want to make"}
    </button>
  );
}
