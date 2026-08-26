"use client";

import { useTransition } from "react";
import { clearPlan } from "@/lib/actions";

export function ClearPlanButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Clear everything you wanted to make?")) {
          startTransition(() => void clearPlan());
        }
      }}
      className="btn"
    >
      Clear
    </button>
  );
}
